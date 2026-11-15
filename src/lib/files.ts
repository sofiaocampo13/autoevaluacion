export const MAX_FILE_BYTES = 50 * 1024 * 1024; // límite del plan gratuito de Supabase

type Support = "now" | "convert" | "later";

// `support` describe qué se podrá analizar:
//  now     → lo procesa el motor de evaluación (fase 3)
//  convert → formato antiguo: se guarda, pero se pide convertirlo
//  later   → audio/video: se procesan en la fase 6
// Texto y código: se guardan y se leen como texto, NUNCA se ejecutan.
export const TEXT_EXTENSIONS = [
  "txt", "md", "csv", "json", "jsonl", "py", "js", "ts", "sql", "yml", "yaml", "html", "ipynb",
  "java", "c", "cpp", "h", "cs", "go", "rs", "php", "css", "xml", "toml", "ini", "sh", "bat", "tsx", "jsx", "r", "kt", "swift", "rb",
];
// Archivos sin extensión que son texto (frecuentes en repositorios).
export const EXTENSIONLESS_TEXT = new Set(["readme", "dockerfile", "makefile", "license", "requirements"]);
export const effectiveExt = (name: string): string => {
  const e = extOf(name);
  if (e) return e;
  const base = name.split("/").pop()!.toLowerCase();
  return EXTENSIONLESS_TEXT.has(base) ? "txt" : "";
};

export const FILE_TYPES: Record<string, { label: string; support: Support; hint?: string }> = {
  pdf: { label: "PDF", support: "now" },
  docx: { label: "Word", support: "now" },
  doc: { label: "Word antiguo", support: "convert", hint: "Guárdalo como .docx o .pdf para que la IA pueda leerlo." },
  pptx: { label: "PowerPoint", support: "now" },
  xlsx: { label: "Excel", support: "now" },
  xls: { label: "Excel antiguo", support: "convert", hint: "Guárdalo como .xlsx o .csv para que la IA pueda leerlo." },
  txt: { label: "Texto", support: "now" },
  csv: { label: "CSV", support: "now" },
  png: { label: "Imagen", support: "now" },
  jpg: { label: "Imagen", support: "now" },
  jpeg: { label: "Imagen", support: "now" },
  webp: { label: "Imagen", support: "now" },
  // El contenido se descomprime en el servidor con límites y se lee como texto/imágenes; nunca se ejecuta.
  zip: { label: "ZIP (código u otros archivos)", support: "now" },
  // Texto y código adicionales (ver TEXT_EXTENSIONS)
  py: { label: "Código Python", support: "now" },
  md: { label: "Markdown", support: "now" },
  json: { label: "JSON", support: "now" },
  jsonl: { label: "JSON Lines", support: "now" },
  html: { label: "HTML", support: "now" },
  ipynb: { label: "Notebook", support: "now" },
  js: { label: "Código JavaScript", support: "now" },
  ts: { label: "Código TypeScript", support: "now" },
  sql: { label: "SQL", support: "now" },
  yml: { label: "YAML", support: "now" },
  yaml: { label: "YAML", support: "now" },
  mp3: { label: "Audio", support: "later", hint: "El análisis de audio estará disponible más adelante." },
  wav: { label: "Audio", support: "later", hint: "El análisis de audio estará disponible más adelante." },
  mp4: { label: "Video", support: "later", hint: "El análisis de video estará disponible más adelante." },
  mov: { label: "Video", support: "later", hint: "El análisis de video estará disponible más adelante." },
};

for (const e of TEXT_EXTENSIONS) FILE_TYPES[e] ??= { label: `Código/texto (.${e})`, support: "now" };

export const ACCEPT_ATTR = Object.keys(FILE_TYPES).map((e) => "." + e).join(",");

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Devuelve un mensaje de error en español, o null si el archivo es aceptable. */
export function validateFile(file: { name: string; size: number }): string | null {
  const ext = extOf(file.name);
  if (!FILE_TYPES[ext]) return `"${file.name}": formato no admitido. Usa ${Object.keys(FILE_TYPES).join(", ")}.`;
  if (file.size === 0) return `"${file.name}" está vacío.`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" supera el límite de 50 MB.`;
  return null;
}

// Carpetas que nunca se suben cuando se elige una carpeta completa.
export const IGNORED_DIRS = new Set(["node_modules", ".git", "__pycache__", ".venv", "venv", ".next", "dist", ".idea", ".vscode"]);
export const IGNORED_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
export const MAX_FOLDER_FILES = 300;

export type FolderPlan = {
  accepted: { file: File; relativePath: string }[];
  skipped: { name: string; reason: string }[];
};

/** Clasifica los archivos de una carpeta elegida: cuáles se suben y cuáles se omiten (y por qué). */
export function planFolderUpload(files: File[]): FolderPlan {
  const accepted: FolderPlan["accepted"] = [];
  const skipped: FolderPlan["skipped"] = [];
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = rel.split("/");
    if (parts.slice(0, -1).some((d) => IGNORED_DIRS.has(d.toLowerCase())) || IGNORED_FILES.has(file.name.toLowerCase())) {
      continue; // ruido: no se informa uno por uno
    }
    const err = validateFile(file);
    if (err) {
      skipped.push({ name: rel, reason: FILE_TYPES[extOf(file.name)] ? err.replace(/^".*?": /, "") : "formato no admitido" });
      continue;
    }
    if (accepted.length >= MAX_FOLDER_FILES) {
      skipped.push({ name: rel, reason: `se superó el máximo de ${MAX_FOLDER_FILES} archivos por carga` });
      continue;
    }
    accepted.push({ file, relativePath: rel });
  }
  return { accepted, skipped };
}

export const CUT_OPTIONS = [1, 2, 3, 4];
export const cutLabel = (c: number | null) => (c == null ? "Sin corte" : `Corte ${c}`);

export const CATEGORY_LABELS = {
  guia: "Guías",
  rubrica: "Rúbricas",
  mapa_mental: "Mapas mentales",
  material_estudio: "Material de estudio",
  complementario: "Documentos complementarios",
} as const;
export type Category = keyof typeof CATEGORY_LABELS;
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
