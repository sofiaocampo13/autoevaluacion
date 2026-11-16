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
  const [folderName, setFolderName] = useState("");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setOutcomes(null);
    if (!files.length) return;
    setFolderName(((files[0] as File & { webkitRelativePath: string }).webkitRelativePath || "").split("/")[0]);

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
  const step = outcomes ? 3 : busy ? 2 : 1;
  const chosenRows = rows?.filter((r) => selected.has(r.key)) ?? [];
  const chosenBytes = chosenRows.reduce((s, r) => s + r.bytes, 0);
  const chosenFiles = chosenRows.reduce((s, r) => s + r.files.length, 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <ol aria-label="Pasos" className="flex flex-wrap gap-2.5">
        {["Elegir carpeta", "Subir", "Resultado"].map((t, i) => (
          <li
            key={t}
            aria-current={step === i + 1 ? "step" : undefined}
            className={`flex min-h-11 items-center gap-2.5 rounded-full border border-slate-200 pl-1.5 pr-[18px] text-[14px] font-extrabold ${
              step === i + 1 ? "bg-slate-800 text-white" : "bg-white text-slate-600"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] ${
                step === i + 1 ? "bg-pink-300 text-slate-900" : "bg-slate-200 text-slate-600"
              }`}
            >
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>

      {!busy && (
        <div className="flex flex-wrap items-center gap-3.5">
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-brand-600 bg-white px-[22px] text-[14px] font-extrabold text-brand-700 hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-300 focus-within:ring-offset-2">
            Elegir carpeta
            <input type="file" multiple onChange={onPick} className="sr-only" {...({ webkitdirectory: "", directory: "" } as object)} />
          </label>
          {folderName && rows && (
            <span className="text-[13.5px] text-slate-600">
              Carpeta elegida: <strong className="text-slate-800">{folderName}</strong>
            </span>
          )}
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="rounded-2xl bg-aviso-bg px-4 py-3 text-[14px] text-aviso-text">
          No se detectaron laboratorios con archivos admitidos en esa carpeta.
        </p>
      )}

      {rows && rows.length > 0 && !busy && (
        <div>
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white px-[18px] pb-3 pt-2">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="text-[12px] text-slate-600">
                <tr>
                  <th className="px-2 py-3.5">Incluir</th>
                  <th className="px-2 py-3.5">Corte</th>
                  <th className="px-2 py-3.5">Laboratorio</th>
                  <th className="px-2 py-3.5">Archivos</th>
                  <th className="px-2 py-3.5">Tamaño</th>
                  <th className="px-2 py-3.5">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={`border-t border-slate-100 ${r.exists ? "text-slate-600" : ""}`}>
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        className="h-[22px] w-[22px] accent-brand-600"
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
                    <td className="px-2 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-extrabold ${r.cut == null ? "bg-slate-100 text-slate-700" : "bg-brand-50 text-brand-800"}`}>{cutLabel(r.cut)}</span></td>
                    <td className="px-2 py-3 font-extrabold">{r.number != null && `${r.number}. `}{r.name}</td>
                    <td className="px-2 py-3">{r.files.length}</td>
                    <td className="whitespace-nowrap px-2 py-3">{formatSize(r.bytes)}</td>
                    <td className="px-2 py-3 text-[13px] text-slate-600">
                      {r.exists && "Ya existe: se omite. "}
                      {r.skipped.length > 0 && (
                        <details>
                          <summary className="min-h-6 cursor-pointer font-bold text-aviso-text">{r.skipped.length} no se subirán</summary>
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
          <p className="mt-4 text-[14px] text-slate-700">
            Se crearán <strong>{chosenRows.length} laboratorio(s)</strong> con {chosenFiles} archivo(s) ({formatSize(chosenBytes)}). Tu
            plan gratuito de almacenamiento es de 1 GB en total.
          </p>
          <button
            onClick={startImport}
            disabled={chosenRows.length === 0}
            className="mt-3 min-h-[50px] rounded-full bg-brand-600 px-[26px] text-[14px] font-extrabold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Crear laboratorios y subir archivos
          </button>
        </div>
      )}

      {progress && (
        <div role="status" aria-live="polite" className="flex max-w-xl flex-col gap-2 rounded-3xl border border-slate-200 bg-white px-[22px] py-5">
          <p className="text-[14px] font-bold text-slate-800">
            Subiendo {progress.done} de {progress.total} · {progress.current}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="text-[12px] text-slate-600">No cierres esta pestaña hasta que termine.</p>
        </div>
      )}

      {outcomes && (
        <div className="flex max-w-2xl flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-[22px] py-5">
          <h2 className="text-[22px]">Resultado</h2>
          <ul className="flex flex-col gap-2 text-[14px]">
            {outcomes.map((o, i) => (
              <li key={i} className={o.status === "ok" ? "text-emerald-800" : o.status === "omitido" ? "text-slate-600" : "text-red-700"}>
                <span aria-hidden="true">{o.status === "ok" ? "✓" : o.status === "omitido" ? "–" : "✕"} </span>
                <span className="sr-only">{o.status === "ok" ? "Listo: " : o.status === "omitido" ? "Omitido: " : "Error: "}</span>
                <b>{o.name}</b>: {o.detail}
              </li>
            ))}
          </ul>
          <Link href="/laboratorios" className="inline-flex min-h-11 w-fit items-center text-[14px] font-bold text-brand-700 hover:underline">Ver mis laboratorios →</Link>
        </div>
      )}
    </div>
  );
}
