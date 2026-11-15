// Verificación técnica objetiva del código entregado, hecha con herramientas (no con IA).
// IMPORTANTE: el código del estudiante NUNCA se ejecuta. Solo se analiza su texto (sintaxis y análisis estático)
// con analizadores que corren como WebAssembly o como parser, sin red y sin acceso al sistema.
import type { EvidenceItem } from "./evidence";

export type CodeDiagnostic = { code: string; message: string; line: number; severity: "error" | "warning" | "info" };
export type CodeFileResult = {
  location: string;
  language: string;
  status: "ok" | "con_avisos" | "con_errores" | "no_analizado";
  diagnostics: CodeDiagnostic[];
  totalDiagnostics: number;
  lines: number;
  note?: string;
};
export type CodeReport = {
  analyzers: string[];
  summary: { analyzed: number; skipped: number; withErrors: number; errors: number; warnings: number; infos: number; byLanguage: Record<string, number> };
  files: CodeFileResult[];
  tests: { files: string[]; frameworks: string[]; executed: false };
  limitations: string[];
};

const MAX_FILES = 300;
const MAX_DIAGS_PER_FILE = 15;
const MAX_LINES = 20_000;

const ANALYZABLE = new Set(["py", "ipynb", "js", "json", "jsonl"]);
const CODE_LIKE = new Set(["py", "ipynb", "js", "ts", "tsx", "jsx", "java", "c", "cpp", "h", "cs", "go", "rs", "php", "sql", "sh", "bat", "r", "kt", "swift", "rb", "css", "html", "yml", "yaml", "json", "jsonl"]);

const LANG: Record<string, string> = { py: "Python", ipynb: "Notebook (Python)", js: "JavaScript", json: "JSON", jsonl: "JSON Lines", ts: "TypeScript", tsx: "TypeScript", jsx: "JavaScript", java: "Java", c: "C", cpp: "C++", h: "C/C++", cs: "C#", go: "Go", rs: "Rust", php: "PHP", sql: "SQL", sh: "Shell", bat: "Batch", r: "R", kt: "Kotlin", swift: "Swift", rb: "Ruby", css: "CSS", html: "HTML", yml: "YAML", yaml: "YAML" };

/** El texto guardado en la evidencia lleva un encabezado "[Archivo: …]"; aquí se quita para analizar el contenido real. */
const rawContent = (full: string) => full.replace(/^\[Archivo: [^\n]*\]\n/, "").replace(/\n\[…texto truncado por tamaño\]$/, "");

// Gravedad de las reglas de Ruff: errores = el código no puede funcionar; avisos = probable defecto; info = estilo.
function severityOf(code: string | null): CodeDiagnostic["severity"] {
  if (code === null || code === "invalid-syntax" || code.startsWith("E9")) return "error";
  if (["F821", "F822", "F823", "F631", "F632", "F633", "F702", "F704", "F706", "F707", "F501", "F502", "F503", "F506", "F508", "F521", "F522", "F523", "F524"].includes(code)) return "error";
  if (["F401", "F403", "F405", "F541"].includes(code)) return "info";
  return "warning";
}

type RuffDiag = { code: string | null; message: string; start_location: { row: number } };
type RuffWorkspace = { check(contents: string): RuffDiag[] };
let ruff: RuffWorkspace | null = null;

async function getRuff(): Promise<RuffWorkspace> {
  if (ruff) return ruff;
  const mod = await import("@astral-sh/ruff-wasm-nodejs");
  ruff = new mod.Workspace({ "line-length": 100, lint: { select: ["E9", "F"] } }, mod.PositionEncoding.Utf16) as unknown as RuffWorkspace;
  return ruff;
}

async function checkPython(code: string): Promise<CodeDiagnostic[]> {
  const ws = await getRuff();
  return ws.check(code).map((d) => ({ code: d.code ?? "sintaxis", message: d.message, line: d.start_location.row, severity: severityOf(d.code) }));
}

async function checkNotebook(raw: string): Promise<{ diags: CodeDiagnostic[]; lines: number }> {
  const nb = JSON.parse(raw) as { cells?: { cell_type: string; source: string | string[] }[] };
  const chunks: { cell: number; text: string }[] = [];
  (nb.cells ?? []).forEach((c, i) => {
    if (c.cell_type !== "code") return;
    const src = (Array.isArray(c.source) ? c.source.join("") : c.source)
      .split("\n")
      .map((l) => (/^\s*[%!?]/.test(l) ? "pass" : l)) // comandos mágicos de Jupyter: no son Python puro
      .join("\n");
    chunks.push({ cell: i + 1, text: src });
  });
  // Se analiza cada celda por separado para poder indicar en cuál está el problema.
  const diags: CodeDiagnostic[] = [];
  let lines = 0;
  for (const ch of chunks) {
    lines += ch.text.split("\n").length;
    for (const d of await checkPython(ch.text)) {
      // En un notebook, los nombres definidos en otras celdas no son errores reales: se degradan a aviso.
      diags.push({ ...d, message: `(celda ${ch.cell}) ${d.message}`, severity: d.code === "F821" ? "warning" : d.severity });
    }
  }
  return { diags, lines };
}

async function checkJavaScript(code: string): Promise<CodeDiagnostic[]> {
  const acorn = await import("acorn");
  const attempt = (sourceType: "module" | "script") => {
    try {
      acorn.parse(code, { ecmaVersion: "latest", sourceType, allowHashBang: true, allowAwaitOutsideFunction: true });
      return null;
    } catch (e) {
      const err = e as { message: string; loc?: { line: number } };
      return { message: err.message.replace(/\s*\(\d+:\d+\)$/, ""), line: err.loc?.line ?? 1 };
    }
  };
  const asModule = attempt("module");
  if (!asModule) return [];
  const asScript = attempt("script");
  if (!asScript) return [];
  return [{ code: "sintaxis", message: asModule.message, line: asModule.line, severity: "error" }];
}

function checkJson(raw: string, jsonl: boolean): CodeDiagnostic[] {
  const out: CodeDiagnostic[] = [];
  if (jsonl) {
    raw.split(/\r?\n/).forEach((l, i) => {
      if (!l.trim()) return;
      try {
        JSON.parse(l);
      } catch (e) {
        out.push({ code: "sintaxis", message: `JSON no válido: ${(e as Error).message.slice(0, 120)}`, line: i + 1, severity: "error" });
      }
    });
    return out;
  }
  try {
    JSON.parse(raw);
  } catch (e) {
    out.push({ code: "sintaxis", message: `JSON no válido: ${(e as Error).message.slice(0, 160)}`, line: 1, severity: "error" });
  }
  return out;
}

// Un archivo cuenta como "de pruebas" por su CONTENIDO (usa un framework o define funciones test_*), no solo por su nombre:
// p. ej. un script llamado ollama_test.py que solo llama a una API no es una prueba unitaria.
const TEST_DETECTORS: { name: string; exts: string[]; re: RegExp }[] = [
  { name: "unittest", exts: ["py"], re: /^\s*(import|from)\s+unittest\b/m },
  { name: "pytest", exts: ["py"], re: /^\s*(import|from)\s+pytest\b/m },
  { name: "funciones test_*", exts: ["py"], re: /^\s*(async\s+)?def\s+test_\w+\(/m },
  { name: "Jest/Vitest/Mocha", exts: ["js"], re: /\b(describe|it|test)\(\s*[\x27"`]/ },
];

export async function checkCodeEvidence(items: EvidenceItem[]): Promise<CodeReport | null> {
  const candidates = items.filter((it) => CODE_LIKE.has(it.ext) && it.ex.mode === "text" && it.fullText !== undefined);
  if (candidates.length === 0) return null;

  const files: CodeFileResult[] = [];
  const byLanguage: Record<string, number> = {};
  const testFiles: string[] = [];
  const frameworks = new Set<string>();
  const analyzers = new Set<string>();

  for (const it of candidates.slice(0, MAX_FILES)) {
    const language = LANG[it.ext] ?? it.ext;
    const raw = rawContent(it.fullText!);
    const lines = raw.split("\n").length;
    const base = { location: it.location, language, lines };

    const hits = TEST_DETECTORS.filter((d) => d.exts.includes(it.ext) && d.re.test(raw));
    if (hits.length) {
      testFiles.push(it.location);
      hits.forEach((h) => frameworks.add(h.name));
    }

    if (!ANALYZABLE.has(it.ext)) {
      files.push({ ...base, status: "no_analizado", diagnostics: [], totalDiagnostics: 0, note: `Sin analizador disponible para ${language}` });
      continue;
    }
    if (it.ex.note?.includes("truncado") || lines > MAX_LINES) {
      files.push({ ...base, status: "no_analizado", diagnostics: [], totalDiagnostics: 0, note: "Archivo demasiado grande: no se analizó completo" });
      continue;
    }

    try {
      let diags: CodeDiagnostic[] = [];
      let analyzedLines = lines;
      if (it.ext === "py") {
        diags = await checkPython(raw);
        analyzers.add("Ruff (análisis estático de Python)");
      } else if (it.ext === "ipynb") {
        const r = await checkNotebook(raw);
        diags = r.diags;
        analyzedLines = r.lines;
        analyzers.add("Ruff (análisis estático de Python)");
      } else if (it.ext === "js") {
        diags = await checkJavaScript(raw);
        analyzers.add("Acorn (sintaxis de JavaScript)");
      } else {
        diags = checkJson(raw, it.ext === "jsonl");
        analyzers.add("Validador de JSON");
      }
      diags.sort((a, b) => ["error", "warning", "info"].indexOf(a.severity) - ["error", "warning", "info"].indexOf(b.severity) || a.line - b.line);
      const hasError = diags.some((d) => d.severity === "error");
      const hasWarn = diags.some((d) => d.severity === "warning");
      byLanguage[language] = (byLanguage[language] ?? 0) + 1;
      files.push({
        ...base,
        lines: analyzedLines,
        status: hasError ? "con_errores" : hasWarn ? "con_avisos" : "ok",
        diagnostics: diags.slice(0, MAX_DIAGS_PER_FILE),
        totalDiagnostics: diags.length,
      });
    } catch {
      files.push({ ...base, status: "no_analizado", diagnostics: [], totalDiagnostics: 0, note: "No se pudo analizar este archivo (formato inesperado)" });
    }
  }

  const analyzed = files.filter((f) => f.status !== "no_analizado");
  const all = analyzed.flatMap((f) => f.diagnostics);
  return {
    analyzers: [...analyzers],
    summary: {
      analyzed: analyzed.length,
      skipped: files.length - analyzed.length,
      withErrors: files.filter((f) => f.status === "con_errores").length,
      errors: analyzed.reduce((s, f) => s + (f.diagnostics.filter((d) => d.severity === "error").length), 0),
      warnings: all.filter((d) => d.severity === "warning").length,
      infos: all.filter((d) => d.severity === "info").length,
      byLanguage,
    },
    files,
    tests: { files: testFiles, frameworks: [...frameworks], executed: false },
    limitations: [
      "El código NO se ejecutó: no hay un entorno aislado disponible, así que no se sabe con certeza si el programa corre ni si produce los resultados que se afirman.",
      "Las pruebas unitarias, si existen, no se ejecutaron; solo se detectó su presencia.",
      "El análisis estático solo cubre Python, notebooks, JavaScript y JSON; otros lenguajes no se analizaron.",
      ...(candidates.length > MAX_FILES ? [`Solo se analizaron los primeros ${MAX_FILES} archivos.`] : []),
    ],
  };
}

/** Resumen compacto para dárselo a la IA como evidencia objetiva (calculada por herramientas, no por IA). */
export function reportForPrompt(r: CodeReport): string {
  const problems = r.files
    .filter((f) => f.status === "con_errores" || f.status === "con_avisos")
    .slice(0, 15)
    .map((f) => `- ${f.location} [${f.language}] ${f.status === "con_errores" ? "CON ERRORES" : "con avisos"}: ${f.diagnostics.filter((d) => d.severity !== "info").slice(0, 3).map((d) => `línea ${d.line} ${d.code}: ${d.message}`).join(" | ")}`);
  return [
    "VERIFICACIÓN TÉCNICA AUTOMÁTICA DEL CÓDIGO (hecha por herramientas, no por IA). El código NO se ejecutó.",
    `Archivos analizados: ${r.summary.analyzed} (${Object.entries(r.summary.byLanguage).map(([k, v]) => `${k}: ${v}`).join(", ") || "ninguno"}). Con errores de sintaxis o de ejecución evidentes: ${r.summary.withErrors}. Errores: ${r.summary.errors}. Avisos: ${r.summary.warnings}. Observaciones de estilo: ${r.summary.infos}.`,
    `Pruebas unitarias: ${r.tests.files.length ? `se detectaron ${r.tests.files.length} archivo(s) de pruebas (${r.tests.frameworks.join(", ") || "sin framework identificado"}), NO ejecutadas` : "no se detectaron archivos de pruebas"}.`,
    problems.length ? `Archivos con problemas:\n${problems.join("\n")}` : "Ningún archivo analizado presentó errores ni avisos relevantes.",
  ].join("\n");
}
