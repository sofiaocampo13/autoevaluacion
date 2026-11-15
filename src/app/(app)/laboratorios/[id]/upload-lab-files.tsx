"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT_ATTR, planFolderUpload } from "@/lib/files";
import { uploadToLab, type UploadItem, type UploadReport } from "@/lib/lab-upload";

export function UploadLabFiles({ labId }: { labId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<UploadReport | null>(null);

  async function run(items: UploadItem[], preSkipped: { name: string; reason: string }[]) {
    let done = 0;
    setReport(null);
    setProgress({ done: 0, total: items.length });
    const r = await uploadToLab(labId, items, () => setProgress({ done: ++done, total: items.length }));
    setProgress(null);
    setReport({ ...r, problems: [...preSkipped, ...r.problems] });
    if (fileRef.current) fileRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
    router.refresh();
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) run(files.map((file) => ({ file, relativePath: file.name })), []);
  }

  function onFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const plan = planFolderUpload(files);
    if (plan.accepted.length === 0) return setReport({ uploaded: 0, problems: plan.skipped, hints: [] });
    run(plan.accepted, plan.skipped);
  }

  const busy = progress !== null;
  const btn =
    "inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-300";
  return (
    <div className="mb-4">
      <p className="mb-2 text-sm text-slate-600">
        Sube archivos sueltos o una carpeta completa (se conservan las subcarpetas). Máx. 50 MB por archivo y 300 por carga.
      </p>
      <div className="flex flex-wrap gap-2">
        <label className={btn + (busy ? " opacity-50" : "")}>
          Elegir archivos
          <input ref={fileRef} type="file" multiple accept={ACCEPT_ATTR} disabled={busy} onChange={onFiles} className="sr-only" />
        </label>
        <label className={btn + (busy ? " opacity-50" : "")}>
          Elegir carpeta
          <input
            ref={folderRef}
            type="file"
            multiple
            disabled={busy}
            onChange={onFolder}
            className="sr-only"
            {...({ webkitdirectory: "", directory: "" } as object)}
          />
        </label>
      </div>

      {progress && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="text-sm text-slate-600">Subiendo {progress.done} de {progress.total}…</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {report && (
        <div className="mt-3 text-sm" aria-live="polite">
          <p className={report.uploaded > 0 ? "text-emerald-700" : "text-slate-600"}>{report.uploaded} archivo(s) subido(s).</p>
          {report.hints.map((h) => (
            <p key={h} className="text-slate-600">{h}</p>
          ))}
          {report.problems.length > 0 && (
            <details className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              <summary className="cursor-pointer">{report.problems.length} archivo(s) no se subieron</summary>
              <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-auto pl-5">
                {report.problems.map((p, i) => (
                  <li key={i}>{p.name}: {p.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
