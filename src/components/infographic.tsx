"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

export type InfographicData = {
  labName: string;
  date: string;
  grade: number | null;
  scaleMax: number;
  percent: number | null;
  objectives: string[];
  title: string;
  categories: { nombre: string; subcategorias: { nombre: string; conceptos: { nombre: string; estado: "demostrado" | "parcial" | "refuerzo" }[] }[] }[];
  criteria: { name: string; percent: number; weight: number }[];
  disclaimer: string;
};

const STATE = {
  demostrado: { label: "Demostrado", chip: "bg-emerald-100 text-emerald-800 ring-emerald-300", dot: "bg-emerald-500" },
  parcial: { label: "Parcial", chip: "bg-amber-100 text-amber-800 ring-amber-300", dot: "bg-amber-500" },
  refuerzo: { label: "Requiere refuerzo", chip: "bg-rose-100 text-rose-800 ring-rose-300", dot: "bg-rose-500" },
} as const;

const barColor = (p: number) => (p >= 85 ? "bg-emerald-500" : p >= 65 ? "bg-amber-500" : "bg-rose-500");

export function Infographic({ data }: { data: InfographicData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    setError(null);
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `infografia-${data.labName.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60)}.png`;
      a.click();
    } catch {
      setError("No se pudo generar la imagen. Inténtalo de nuevo o usa la captura de pantalla de tu sistema.");
    } finally {
      setBusy(false);
    }
  }

  const counts = { demostrado: 0, parcial: 0, refuerzo: 0 };
  data.categories.forEach((c) => c.subcategorias.forEach((s) => s.conceptos.forEach((k) => counts[k.estado]++)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={download}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Generando imagen…" : "Descargar infografía (PNG)"}
        </button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>

      <div ref={ref} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <header className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-5 text-white">
          <p className="text-xs uppercase tracking-wide text-indigo-100">Infografía temática · {data.date}</p>
          <h3 className="mt-1 text-xl font-semibold">{data.labName}</h3>
          {data.title && <p className="text-sm text-indigo-100">{data.title}</p>}
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-indigo-100">Calificación orientativa</p>
              <p className="text-3xl font-bold">
                {data.grade ?? "—"} <span className="text-base font-normal text-indigo-100">/ {data.scaleMax}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-indigo-100">Cumplimiento</p>
              <p className="text-3xl font-bold">{data.percent ?? "—"} %</p>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-6">
          {data.objectives.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">Objetivos principales</h4>
              <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                {data.objectives.map((o, i) => (
                  <li key={i} className="flex gap-2"><span className="text-indigo-600">▸</span>{o}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Cumplimiento por criterio</h4>
            <ul className="space-y-2">
              {data.criteria.map((c, i) => (
                <li key={i}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{c.name} <span className="text-slate-400">(peso {c.weight} %)</span></span>
                    <b className="text-slate-800">{c.percent} %</b>
                  </div>
                  <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barColor(c.percent)}`} style={{ width: `${Math.min(100, Math.max(0, c.percent))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">Mapa de conocimientos</h4>
              <ul className="flex flex-wrap gap-3 text-xs text-slate-600">
                {(Object.keys(STATE) as (keyof typeof STATE)[]).map((k) => (
                  <li key={k} className="flex items-center gap-1">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATE[k].dot}`} />
                    {STATE[k].label} ({counts[k]})
                  </li>
                ))}
              </ul>
            </div>
            {data.categories.length === 0 ? (
              <p className="text-sm text-slate-500">La evaluación no identificó conceptos para organizar.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.categories.map((cat, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <h5 className="mb-2 font-semibold text-indigo-800">{cat.nombre}</h5>
                    <div className="space-y-3">
                      {cat.subcategorias.map((sub, j) => (
                        <div key={j}>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{sub.nombre}</p>
                          <ul className="flex flex-wrap gap-1.5">
                            {sub.conceptos.map((k, n) => (
                              <li key={n} className={`rounded-full px-2.5 py-1 text-xs ring-1 ${STATE[k.estado].chip}`} title={STATE[k.estado].label}>
                                {k.nombre}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="border-t border-slate-200 pt-3 text-[11px] leading-snug text-slate-500">{data.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
