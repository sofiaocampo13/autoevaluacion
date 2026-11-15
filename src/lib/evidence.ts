// Reúne y prepara TODA la evidencia de un laboratorio para que la IA la lea.
// Nada de lo entregado se ejecuta: los archivos se leen como texto o imagen/PDF.
import { unzipSync } from "fflate";
import type { Part } from "./ai/types";
import { extractParts, type Extraction } from "./extract";
import { FILE_TYPES, IGNORED_DIRS, IGNORED_FILES, effectiveExt, extOf } from "./files";

export type LabFileRef = { path: string; name: string; relativePath: string; size: number };

export type EvidenceItem = {
  /** Ubicación que se citará como evidencia: "carpeta/archivo.py" o "entrega.zip › src/main.py". */
  location: string;
  ext: string;
  origin: "archivo" | "zip" | "repositorio";
  bytes: number;
  ex: Extraction;
  /** Texto completo leído (para verificar después que las citas existen de verdad). */
  fullText?: string;
};

export type InventoryEntry = {
  location: string;
  origin: EvidenceItem["origin"];
  mode: Extraction["mode"] | "omitido";
  note?: string;
  chars?: number;
};

const LIMITS = {
  zipMaxFiles: 300,
  zipMaxTotalBytes: 80 * 1024 * 1024,
  zipEntryTextBytes: 2 * 1024 * 1024,
  zipEntryImageBytes: 8 * 1024 * 1024,
  repoMaxBytes: 30 * 1024 * 1024,
  budgetTextChars: 400_000,
  budgetNativeBytes: 14 * 1024 * 1024,
  maxImages: 40,
};

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp"]);
const CODE_EXT = new Set(["py", "js", "ts", "ipynb", "sql", "html", "yml", "yaml"]);
const DOC_EXT = new Set(["pdf", "docx", "pptx", "md", "txt"]);

function priority(ext: string): number {
  if (DOC_EXT.has(ext)) return 1;
  if (CODE_EXT.has(ext)) return 2;
  if (IMAGE_EXT.has(ext)) return 4;
  return 3; // datos (csv, json, xlsx…)
}

const ignoredPath = (p: string) => {
  const parts = p.split("/");
  return parts.slice(0, -1).some((d) => IGNORED_DIRS.has(d.toLowerCase())) || IGNORED_FILES.has(parts[parts.length - 1].toLowerCase());
};

const safeEntryName = (n: string) => !n.endsWith("/") && !n.startsWith("/") && !n.includes("..") && !n.includes("\\") && !n.includes("\0");

/** Descomprime un ZIP con límites (anti zip-bomb, anti rutas peligrosas). Los ZIP anidados se ignoran. */
export function expandZip(bytes: Uint8Array, stripTopFolder = false): { files: { name: string; data: Uint8Array }[]; skipped: number } {
  let total = 0;
  let count = 0;
  let skipped = 0;
  const entries = unzipSync(bytes, {
    filter: (f) => {
      const ext = effectiveExt(f.name);
      const ok =
        safeEntryName(f.name) &&
        !ignoredPath(f.name) &&
        !!FILE_TYPES[ext] &&
        ext !== "zip" &&
        f.originalSize > 0 &&
        f.originalSize <= (IMAGE_EXT.has(ext) ? LIMITS.zipEntryImageBytes : LIMITS.zipEntryTextBytes) &&
        count < LIMITS.zipMaxFiles &&
        total + f.originalSize <= LIMITS.zipMaxTotalBytes;
      if (ok) {
        count++;
        total += f.originalSize;
      } else if (!f.name.endsWith("/")) skipped++;
      return ok;
    },
  });
  return {
    skipped,
    files: Object.entries(entries).map(([name, data]) => ({ name: stripTopFolder ? name.split("/").slice(1).join("/") : name, data })),
  };
}

async function fetchRepoZip(repoUrl: string): Promise<{ bytes?: Uint8Array; error?: string }> {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(repoUrl);
  if (!m) return { error: "Enlace de repositorio no válido" };
  try {
    const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/zipball`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "autoevaluacion-academica" },
      signal: AbortSignal.timeout(25_000),
    });
    if (res.status === 404) return { error: "Repositorio no encontrado o privado (solo se pueden leer repositorios públicos)" };
    if (res.status === 403 || res.status === 429) return { error: "GitHub limitó las consultas por ahora; inténtalo más tarde" };
    if (!res.ok) return { error: `GitHub respondió ${res.status}` };
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > LIMITS.repoMaxBytes) return { error: "El repositorio es demasiado grande (más de 30 MB)" };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > LIMITS.repoMaxBytes) return { error: "El repositorio es demasiado grande (más de 30 MB)" };
    return { bytes: buf };
  } catch {
    return { error: "No se pudo descargar el repositorio" };
  }
}

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function loadEvidence(opts: {
  files: LabFileRef[];
  repoUrl?: string | null;
  download: (path: string) => Promise<Uint8Array | null>;
}): Promise<{ items: EvidenceItem[]; problems: InventoryEntry[] }> {
  const items: EvidenceItem[] = [];
  const problems: InventoryEntry[] = [];

  const addExtracted = (location: string, ext: string, origin: EvidenceItem["origin"], bytes: Uint8Array) => {
    const ex = extractParts(location, ext, bytes);
    const first = ex.parts[0];
    items.push({ location, ext, origin, bytes: bytes.length, ex, fullText: ex.mode === "text" && first?.kind === "text" ? first.text : undefined });
  };

  const downloaded = await pool(opts.files, 6, async (f) => ({ f, bytes: await opts.download(f.path) }));
  for (const { f, bytes } of downloaded) {
    const location = f.relativePath || f.name;
    if (!bytes) {
      problems.push({ location, origin: "archivo", mode: "unsupported", note: "No se pudo descargar el archivo" });
      continue;
    }
    const ext = extOf(f.name);
    if (ext === "zip") {
      try {
        const { files, skipped } = expandZip(bytes);
        files.forEach((z) => addExtracted(`${location} › ${z.name}`, effectiveExt(z.name), "zip", z.data));
        if (skipped) problems.push({ location, origin: "zip", mode: "omitido", note: `${skipped} entrada(s) del ZIP omitidas (tipo no admitido, demasiado grandes o por límites de seguridad)` });
      } catch {
        problems.push({ location, origin: "zip", mode: "unsupported", note: "ZIP dañado o no se pudo descomprimir" });
      }
    } else {
      addExtracted(location, ext, "archivo", bytes);
    }
  }

  if (opts.repoUrl) {
    const repo = await fetchRepoZip(opts.repoUrl);
    if (!repo.bytes) problems.push({ location: opts.repoUrl, origin: "repositorio", mode: "unsupported", note: repo.error });
    else {
      try {
        const { files, skipped } = expandZip(repo.bytes, true);
        files.forEach((z) => addExtracted(`repositorio › ${z.name}`, effectiveExt(z.name), "repositorio", z.data));
        if (skipped) problems.push({ location: opts.repoUrl, origin: "repositorio", mode: "omitido", note: `${skipped} archivo(s) del repositorio omitidos (tipo no admitido o por límites)` });
      } catch {
        problems.push({ location: opts.repoUrl, origin: "repositorio", mode: "unsupported", note: "No se pudo descomprimir el repositorio" });
      }
    }
  }
  return { items, problems };
}

/** Selecciona qué se envía a la IA según un presupuesto, y deja constancia de todo en el inventario. */
export function buildEvidencePackage(
  items: EvidenceItem[],
  extraProblems: InventoryEntry[] = [],
): { parts: Part[]; inventory: InventoryEntry[]; texts: Map<string, string> } {
  const sorted = [...items].sort((a, b) => priority(a.ext) - priority(b.ext) || a.location.localeCompare(b.location));
  const parts: Part[] = [];
  const inventory: InventoryEntry[] = [...extraProblems];
  const texts = new Map<string, string>();
  let chars = 0;
  let nativeBytes = 0;
  let images = 0;

  for (const it of sorted) {
    const base = { location: it.location, origin: it.origin };
    if (it.ex.mode === "unsupported") {
      inventory.push({ ...base, mode: "unsupported", note: it.ex.note });
      continue;
    }
    if (it.ex.mode === "text") {
      const len = it.fullText?.length ?? 0;
      if (chars + len > LIMITS.budgetTextChars) {
        inventory.push({ ...base, mode: "omitido", note: "Omitido por el límite de tamaño total de texto" });
        continue;
      }
      chars += len;
      if (it.fullText) texts.set(it.location, it.fullText);
    } else {
      const isImg = IMAGE_EXT.has(it.ext);
      if (nativeBytes + it.bytes > LIMITS.budgetNativeBytes || (isImg && images >= LIMITS.maxImages)) {
        inventory.push({ ...base, mode: "omitido", note: "Omitido por el límite de tamaño total de imágenes/PDF" });
        continue;
      }
      nativeBytes += it.bytes;
      if (isImg) images++;
    }
    // Se rotula cada pieza con su ubicación exacta para que la IA pueda citarla.
    parts.push(...it.ex.parts.map((p) => (p.kind === "text" ? { ...p, text: p.text.replace(/^\[Archivo: [^\]]*\]/, `[EVIDENCIA · ubicación: ${it.location}]`) } : p)));
    inventory.push({ ...base, mode: it.ex.mode, chars: it.ex.chars, note: it.ex.note });
  }
  return { parts, inventory, texts };
}
