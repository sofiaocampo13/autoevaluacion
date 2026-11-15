import { strFromU8, unzipSync } from "fflate";
import type { Part } from "./ai/types";
import { FILE_TYPES, TEXT_EXTENSIONS } from "./files";

export type Extraction = {
  parts: Part[];
  /** Cómo se leyó: texto extraído, envío nativo a la IA, o no se pudo. Va al inventario de evidencias. */
  mode: "text" | "native" | "unsupported";
  note?: string;
  chars?: number;
};

const MAX_TEXT_CHARS = 150_000;
const MAX_NATIVE_BYTES = 15 * 1024 * 1024; // inline en la API: el total de la petición es limitado
const MAX_XML_BYTES = 25 * 1024 * 1024; // tope por entrada al descomprimir (anti zip-bomb)

const TEXT_EXTS = new Set(TEXT_EXTENSIONS);
const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

function unzipOnly(bytes: Uint8Array, want: (name: string) => boolean): Record<string, Uint8Array> {
  return unzipSync(bytes, { filter: (f) => want(f.name) && f.originalSize <= MAX_XML_BYTES });
}

function cap(text: string): { text: string; truncated: boolean } {
  return text.length > MAX_TEXT_CHARS ? { text: text.slice(0, MAX_TEXT_CHARS), truncated: true } : { text, truncated: false };
}

// ───────── DOCX: párrafos y tablas (filas con celdas separadas por " | ") ─────────
function docxText(bytes: Uint8Array): string {
  const files = unzipOnly(bytes, (n) => n === "word/document.xml");
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("No es un .docx válido");
  const src = strFromU8(xml);
  const out: string[] = [];
  // Recorre por filas de tabla y párrafos, en orden.
  const re = /<w:tr[ >][\s\S]*?<\/w:tr>|<w:p[ >][\s\S]*?<\/w:p>/g;
  const paraText = (p: string) =>
    decodeXml(
      p
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, "$1\u0001")
        .replace(/<[^>]+>/g, "")
        .replace(/\u0001/g, ""),
    ).trim();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const block = m[0];
    if (block.startsWith("<w:tr")) {
      const cells = [...block.matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)].map((c) =>
        [...c[0].matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((p) => paraText(p[0])).filter(Boolean).join(" / "),
      );
      if (cells.some(Boolean)) out.push("| " + cells.join(" | ") + " |");
    } else {
      const t = paraText(block);
      if (t) out.push(t);
    }
  }
  return dedupeTableParagraphs(out).join("\n");
}

// Los párrafos dentro de tablas también coinciden con la expresión de párrafo; los filtramos por contenido repetido en la fila previa.
function dedupeTableParagraphs(lines: string[]): string[] {
  const res: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const prev = res[res.length - 1];
    if (prev?.startsWith("|") && !lines[i].startsWith("|") && prev.includes(lines[i])) continue;
    res.push(lines[i]);
  }
  return res;
}

// ───────── PPTX ─────────
function pptxText(bytes: Uint8Array): string {
  const files = unzipOnly(bytes, (n) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(n));
  const slides = Object.keys(files)
    .filter((n) => n.startsWith("ppt/slides/"))
    .sort((a, b) => Number(a.match(/(\d+)\.xml/)?.[1]) - Number(b.match(/(\d+)\.xml/)?.[1]));
  return slides
    .map((name, i) => {
      const xml = strFromU8(files[name]);
      const paras = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)]
        .map((p) => decodeXml([...p[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join("")).trim())
        .filter(Boolean);
      return `[Diapositiva ${i + 1}]\n${paras.join("\n")}`;
    })
    .join("\n\n");
}

// ───────── XLSX ─────────
function xlsxText(bytes: Uint8Array): string {
  const files = unzipOnly(bytes, (n) => /^xl\/(sharedStrings|workbook)\.xml$|^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = files["xl/sharedStrings.xml"]
    ? [...strFromU8(files["xl/sharedStrings.xml"]).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
      )
    : [];
  const names = files["xl/workbook.xml"]
    ? [...strFromU8(files["xl/workbook.xml"]).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decodeXml(m[1]))
    : [];
  const sheets = Object.keys(files)
    .filter((n) => n.startsWith("xl/worksheets/"))
    .sort((a, b) => Number(a.match(/(\d+)\.xml/)?.[1]) - Number(b.match(/(\d+)\.xml/)?.[1]));

  return sheets
    .map((name, i) => {
      const xml = strFromU8(files[name]);
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].slice(0, 2000).map((r) =>
        [...r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
          .map((c) => {
            const attrs = c[1];
            const type = /t="(\w+)"/.exec(attrs)?.[1];
            const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? "")?.[1];
            const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2] ?? "")?.[1];
            if (type === "s" && v != null) return shared[Number(v)] ?? "";
            if (type === "inlineStr") return decodeXml(inline ?? "");
            return decodeXml(v ?? "");
          })
          .join("\t"),
      );
      return `[Hoja: ${names[i] ?? i + 1}]\n${rows.filter((r) => r.replace(/\t/g, "").trim()).join("\n")}`;
    })
    .join("\n\n");
}

// ───────── Notebook ─────────
function ipynbText(raw: string): string {
  const nb = JSON.parse(raw) as { cells?: { cell_type: string; source: string | string[]; outputs?: { text?: string | string[] }[] }[] };
  const join = (s: string | string[] | undefined) => (Array.isArray(s) ? s.join("") : (s ?? ""));
  return (nb.cells ?? [])
    .map((c, i) => {
      const outs = (c.outputs ?? []).map((o) => join(o.text)).filter(Boolean).join("\n");
      return `[Celda ${i + 1} · ${c.cell_type}]\n${join(c.source)}${outs ? `\n[Salida]\n${outs}` : ""}`;
    })
    .join("\n\n");
}

const stripHtml = (s: string) =>
  s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Convierte un archivo en partes que la IA puede leer, sin ejecutar nada de su contenido. */
export function extractParts(fileName: string, ext: string, bytes: Uint8Array): Extraction {
  const header = (what: string) => `[Archivo: ${fileName} · ${what}]\n`;
  const asText = (text: string, what: string): Extraction => {
    const { text: t, truncated } = cap(text);
    return {
      mode: "text",
      parts: [{ kind: "text", text: header(what) + t + (truncated ? "\n[…texto truncado por tamaño]" : "") }],
      chars: t.length,
      note: truncated ? "Texto truncado por tamaño" : undefined,
    };
  };

  try {
    if (ext === "pdf" || IMAGE_MIME[ext]) {
      if (bytes.length > MAX_NATIVE_BYTES)
        return { mode: "unsupported", parts: [], note: "Supera 15 MB: demasiado grande para analizarlo directamente" };
      return {
        mode: "native",
        parts: [
          { kind: "text", text: header(ext === "pdf" ? "PDF" : "imagen") },
          { kind: "file", mime: ext === "pdf" ? "application/pdf" : IMAGE_MIME[ext], base64: Buffer.from(bytes).toString("base64"), name: fileName },
        ],
      };
    }
    if (ext === "docx") return asText(docxText(bytes), "Word");
    if (ext === "pptx") return asText(pptxText(bytes), "PowerPoint");
    if (ext === "xlsx") return asText(xlsxText(bytes), "Excel");
    if (ext === "ipynb") return asText(ipynbText(strFromU8(bytes)), "notebook");
    if (ext === "html") return asText(stripHtml(strFromU8(bytes)), "HTML (texto visible)");
    if (TEXT_EXTS.has(ext)) return asText(strFromU8(bytes), FILE_TYPES[ext]?.label ?? ext);
  } catch {
    return { mode: "unsupported", parts: [], note: "No se pudo leer el contenido (archivo dañado o con formato inesperado)" };
  }
  return { mode: "unsupported", parts: [], note: FILE_TYPES[ext]?.hint ?? "Formato no analizable todavía" };
}
