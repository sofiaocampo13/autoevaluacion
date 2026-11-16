"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { planImport, type ImportGroup } from "@/lib/import-plan";
import { cutLabel, formatSize, planFolderUpload } from "@/lib/files";
import { uploadToLab } from "@/lib/lab-upload";
import { createLabForImport } from "../actions";

type Row = {
  key: string;
  cut: number | null;
  name: string;
  number: number | null;
  files: { file: File; relativePath: string }[];
  skipped: { name: string; reason: string }[];
  bytes: number;
  exists: boolean;
};
type Outcome = { name: string; status: "ok" | "omitido" | "error"; detail: string };

export function ImportClient({ existing }: { existing: { name: string; cut: number | null }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setOutcomes(null);
    if (!files.length) return;

    const groups: ImportGroup<File>[] = planImport(
      files.map((f) => ({ item: f, rel: (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name })),
    );
    const out: Row[] = [];
    for (const g of groups) {
      // Valida por laboratorio (límite de 300 archivos, formatos, tamaño).
      const plan = planFolderUpload(g.entries.map((en) => en.item));
      if (plan.accepted.length === 0 && plan.skipped.length === 0) continue; // solo ruido (.git, etc.)
      const rel = new Map(g.entries.map((en) => [en.item, en.relativePath]));
      const accepted = plan.accepted.map((a) => ({ file: a.file, relativePath: rel.get(a.file) ?? a.file.name }));
      out.push({
        key: g.key,
        cut: g.cut,
        name: g.name,
        number: g.number,
        files: accepted,
        skipped: plan.skipped,
        bytes: accepted.reduce((s, a) => s + a.file.size, 0),
        exists: existing.some((x) => x.name === g.name && x.cut === g.cut),
      });
    }
    setRows(out);
    setSelected(new Set(out.filter((r) => !r.exists && r.files.length > 0).map((r) => r.key)));
  }

  async function startImport() {
    if (!rows) return;
    const chosen = rows.filter((r) => selected.has(r.key));
    const total = chosen.reduce((s, r) => s + r.files.length, 0);
    let done = 0;
    const results: Outcome[] = [];
    setProgress({ done: 0, total, current: "" });

    for (const r of chosen) {
      setProgress({ done, total, current: r.name });
      const lab = await createLabForImport({ name: r.name, number: r.number, cut: r.cut });
      if (!lab.ok) {
        done += r.files.length;
        results.push({ name: r.name, status: lab.error.startsWith("Ya existe") ? "omitido" : "error", detail: lab.error });
        continue;
      }
      const rep = await uploadToLab(lab.id, r.files, () => setProgress({ done: ++done, total, current: r.name }));
      const skipped = r.skipped.length + rep.problems.length;
      results.push({
        name: r.name,
        status: rep.uploaded > 0 ? "ok" : "error",
        detail: `${rep.uploaded} archivo(s) subido(s)${skipped ? `, ${skipped} omitido(s): ${[...r.skipped, ...rep.problems].slice(0, 3).map((p) => `${p.name} (${p.reason})`).join("; ")}${skipped > 3 ? "…" : ""}` : ""}`,
      });
    }
    setProgress(null);
    setRows(null);
    setOutcomes(results);
    router.refresh();
  }

  const busy = progress !== null;
  const chosenRows = rows?.filter((r) => selected.has(r.key)) ?? [];
  const chosenBytes = chosenRows.reduce((s, r) => s + r.bytes, 0);
  const chosenFiles = chosenRows.reduce((s, r) => s + r.files.length, 0);

  return (
    <div>
      {!busy && (
        <label className="mb-6 inline-block cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-within:ring-2 focus-within:ring-brand-300">
          Elegir carpeta
          <input type="file" multiple onChange={onPick} className="sr-only" {...({ webkitdirectory: "", directory: "" } as object)} />
        </label>
      )}

      {rows && rows.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No se detectaron laboratorios con archivos admitidos en esa carpeta.
        </p>
      )}

      {rows && rows.length > 0 && !busy && (
        <div>
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-3 py-2"><span className="sr-only">Incluir</span></th>
                  <th className="px-3 py-2">Corte</th>
                  <th className="px-3 py-2">Laboratorio</th>
                  <th className="px-3 py-2">Archivos</th>
                  <th className="px-3 py-2">Tamaño</th>
                  <th className="px-3 py-2">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${r.name}`}
                        disabled={r.exists || r.files.length === 0}
                        checked={selected.has(r.key)}
                        onChange={(e) => {
                          const s = new Set(selected);
                          if (e.target.checked) s.add(r.key);
                          else s.delete(r.key);
                          setSelected(s);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">{cutLabel(r.cut)}</td>
                    <td className="px-3 py-2 font-medium">{r.number != null && `${r.number}. `}{r.name}</td>
                    <td className="px-3 py-2">{r.files.length}</td>
                    <td className="px-3 py-2">{formatSize(r.bytes)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {r.exists && "Ya existe: se omite. "}
                      {r.skipped.length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-amber-700">{r.skipped.length} no se subirán</summary>
                          <ul className="mt-1 max-h-32 list-disc overflow-auto pl-4">
                            {r.skipped.map((s, i) => (
                              <li key={i}>{s.name}: {s.reason}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Se crearán {chosenRows.length} laboratorio(s) con {chosenFiles} archivo(s) ({formatSize(chosenBytes)}). Tu
            plan gratuito de almacenamiento es de 1 GB en total.
          </p>
          <button
            onClick={startImport}
            disabled={chosenRows.length === 0}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Crear laboratorios y subir archivos
          </button>
        </div>
      )}

      {progress && (
        <div role="status" aria-live="polite" className="max-w-xl">
          <p className="text-sm text-slate-700">
            Subiendo {progress.done} de {progress.total} · {progress.current}
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">No cierres esta pestaña hasta que termine.</p>
        </div>
      )}

      {outcomes && (
        <div className="max-w-2xl">
          <h2 className="mb-2 font-medium">Resultado</h2>
          <ul className="space-y-1 text-sm">
            {outcomes.map((o, i) => (
              <li key={i} className={o.status === "ok" ? "text-emerald-700" : o.status === "omitido" ? "text-slate-600" : "text-red-700"}>
                <b>{o.name}</b>: {o.detail}
              </li>
            ))}
          </ul>
          <Link href="/laboratorios" className="mt-4 inline-block text-brand-700 hover:underline">Ver mis laboratorios →</Link>
        </div>
      )}
    </div>
  );
}
