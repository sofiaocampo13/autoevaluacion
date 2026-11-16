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

// Dominio de conceptos del diseño: el color va siempre acompañado del texto del estado.
const STATE = {
  demostrado: { label: "Demostrado", row: "bg-blue-600 text-white", swatch: "bg-blue-600" },
  parcial: { label: "Parcial", row: "bg-[#D9CCFB] text-[#2B1767]", swatch: "bg-[#D9CCFB]" },
  refuerzo: { label: "Requiere refuerzo", row: "bg-pink-600 text-white", swatch: "bg-pink-600" },
} as const;

// Borde superior de cada categoría, rotando los colores del diseño.
const TOP_BORDER = ["border-t-blue-600", "border-t-brand-600", "border-t-pink-600", "border-t-pink-400"];

const fmt = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 2 });

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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={download}
          disabled={busy}
          className="min-h-11 rounded-full bg-brand-600 px-5 text-sm font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? "Generando imagen…" : "Descargar infografía (PNG)"}
        </button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>

      <div ref={ref} className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[28px] leading-tight text-slate-900">{data.title || data.labName}</h3>
            <p className="mt-1 text-[13px] text-slate-600">{data.labName} · {data.date}</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl bg-brand-50 px-4 py-2.5 text-brand-800">
              <p className="text-xs font-bold">Cumplimiento</p>
              <p className="font-display text-[28px] leading-tight">{data.percent != null ? `${fmt(data.percent)} %` : "—"}</p>
            </div>
            <div className="rounded-2xl bg-pink-50 px-4 py-2.5 text-pink-800">
              <p className="text-xs font-bold">Nota orientativa</p>
              <p className="font-display text-[28px] leading-tight">{data.grade != null ? fmt(data.grade) : "—"} / {data.scaleMax}</p>
            </div>
          </div>
        </div>

        {data.objectives.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-extrabold text-slate-800">Objetivos:</span>
            {data.objectives.map((o, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-3 py-1.5 text-[13px] text-slate-800">{i + 1} · {o}</span>
            ))}
          </div>
        )}

        <section>
          <h4 className="mb-3 font-display text-lg text-slate-900">Cumplimiento por criterio</h4>
          <ul className="space-y-2.5">
            {data.criteria.map((c, i) => (
              <li key={i}>
                <div className="flex justify-between gap-3 text-[13px] text-slate-700">
                  <span>{c.name} <span className="text-slate-600">(peso {fmt(c.weight)} %)</span></span>
                  <b className="text-slate-800">{fmt(c.percent)} %</b>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, c.percent))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="mb-3 font-display text-lg text-slate-900">Mapa de conocimientos</h4>
          {data.categories.length === 0 ? (
            <p className="text-sm text-slate-600">La evaluación no identificó conceptos para organizar.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.categories.map((cat, i) => (
                <div key={i} className={`rounded-[22px] border border-slate-200 border-t-[5px] bg-slate-50 p-4 ${TOP_BORDER[i % TOP_BORDER.length]}`}>
                  <h5 className="mb-3 font-display text-xl text-slate-900">{cat.nombre}</h5>
                  <div className="space-y-3">
                    {cat.subcategorias.map((sub, j) => (
                      <div key={j}>
                        <p className="mb-1.5 text-[13px] text-slate-600">{sub.nombre}</p>
                        <ul className="space-y-1.5">
                          {sub.conceptos.map((k, n) => (
                            <li key={n} className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold ${STATE[k.estado].row}`}>
                              <span>{k.nombre}</span>
                              <span className="shrink-0 text-xs font-bold">{STATE[k.estado].label}</span>
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
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-700">
            {(Object.keys(STATE) as (keyof typeof STATE)[]).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded ${STATE[k].swatch}`} aria-hidden="true" />
                {STATE[k].label} ({counts[k]})
              </li>
            ))}
          </ul>
        </section>

        <p className="border-t border-slate-200 pt-3 text-[11px] leading-snug text-slate-600">{data.disclaimer}</p>
      </div>
    </div>
  );
}
