// Detecta cortes y laboratorios a partir de las rutas de una carpeta elegida.
// Estructura esperada:  <raíz> / Corte N / <carpeta de laboratorio> / ...archivos y subcarpetas
// También funciona si se elige directamente una carpeta de corte, o una sin cortes.

export type ImportGroup<T> = {
  key: string;
  cut: number | null;
  folderName: string;
  name: string;
  number: number | null;
  entries: { item: T; relativePath: string }[];
};

const CUT_RE = /corte\D{0,3}(\d{1,2})/i;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function cutOf(segment: string | undefined): number | null {
  const m = segment ? CUT_RE.exec(segment) : null;
  return m ? Number(m[1]) : null;
}

export function labNameAndNumber(folder: string): { name: string; number: number | null } {
  const name = clean(folder.replace(/^\s*\d{1,3}\s*[.\-)]\s*/, "")) || clean(folder);
  const lead = /^\s*(\d{1,3})\s*[.\-)]/.exec(folder);
  const lab = /lab\D{0,3}0*(\d{1,3})/i.exec(folder);
  const raw = lead?.[1] ?? lab?.[1];
  return { name: name.slice(0, 200), number: raw != null ? Number(raw) : null };
}

/** `rel` es la ruta relativa completa, con la carpeta elegida como primer segmento. */
export function planImport<T>(entries: { item: T; rel: string }[]): ImportGroup<T>[] {
  const groups = new Map<string, ImportGroup<T>>();

  for (const { item, rel } of entries) {
    const seg = rel.split("/").filter(Boolean);
    if (seg.length < 2) continue;

    // ¿Dónde está el corte? Primer segmento (raíz = corte) o el segundo (raíz contiene cortes).
    let cut: number | null = null;
    let labIdx: number; // índice del segmento que es la carpeta del laboratorio
    if (cutOf(seg[0]) != null) {
      cut = cutOf(seg[0]);
      labIdx = 1;
    } else if (seg.length > 2 && cutOf(seg[1]) != null) {
      cut = cutOf(seg[1]);
      labIdx = 2;
    } else {
      labIdx = 1;
    }

    const last = seg.length - 1;
    let folderName: string;
    let relativePath: string;
    if (labIdx >= last) {
      // Archivo suelto directamente en la carpeta del corte (o de la raíz).
      folderName = cut != null ? `Archivos sueltos del corte ${cut}` : clean(seg[0]);
      relativePath = "";
    } else {
      folderName = seg[labIdx];
      relativePath = seg.slice(labIdx + 1).join("/");
    }

    const key = `${cut ?? ""}|${folderName}`;
    let g = groups.get(key);
    if (!g) {
      const { name, number } = labNameAndNumber(folderName);
      g = { key, cut, folderName, name, number, entries: [] };
      groups.set(key, g);
    }
    g.entries.push({ item, relativePath: relativePath || seg[last] });
  }

  return [...groups.values()].sort(
    (a, b) => (a.cut ?? 99) - (b.cut ?? 99) || (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name),
  );
}
