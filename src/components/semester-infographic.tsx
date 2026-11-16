"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

export type SemesterInfographicData = {
  subject: string;
  period: string;
  date: string;
  grade: number;
  scaleMax: number;
  percent: number;
  evaluated: number;
  total: number;
  reviewed: number;
  points: { name: string; percent: number; reviewed: boolean }[];
  byCut: { label: string; percent: number; labs: number }[];
  competenciesTitle: string;
  competencies: { name: string; percent: number }[];
  conceptCounts: { demostrado: number; parcial: number; refuerzo: number };
  toReinforce: { name: string; recurrent: boolean }[];
  strengths: string[];
  weaknesses: string[];
  pending: string[];
  disclaimer: string;
};

// Mismos umbrales que el mapa mental y los criterios: ≥85 demostrado, ≥70 parcial, resto por reforzar.
const bar = (p: number) => (p >= 85 ? "bg-emerald-500" : p >= 70 ? "bg-yellow-500" : "bg-orange-500");
const clamp = (p: number) => Math.min(100, Math.max(0, p));

export function SemesterInfographic({ data }: { data: SemesterInfographicData }) {
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
      a.download = `infografia-semestre-${data.subject.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60)}.png`;
      a.click();
    } catch {
      setError("No se pudo generar la imagen. Inténtalo de nuevo o usa la captura de pantalla de tu sistema.");
    } finally {
      setBusy(false);
    }
  }

  const c = data.conceptCounts;
  const totalConcepts = c.demostrado + c.parcial + c.refuerzo;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={download} disabled={busy} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60">
          {busy ? "Generando imagen…" : "Descargar infografía del semestre (PNG)"}
        </button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>

      <div ref={ref} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <header className="bg-slate-800 px-6 py-5 text-white">
          <h3 className="text-xl font-semibold">{data.subject}</h3>
          {data.period && <p className="text-sm text-slate-300">{data.period}</p>}
          <p className="mt-0.5 text-xs text-slate-300">Infografía del semestre · {data.date}</p>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-slate-300">Promedio orientativo</p>
              <p className="text-3xl font-bold">{data.grade} <span className="text-base font-normal text-slate-300">/ {data.scaleMax}</span></p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Cumplimiento</p>
              <p className="text-3xl font-bold">{data.percent} %</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Laboratorios evaluados</p>
              <p className="text-3xl font-bold">{data.evaluated} <span className="text-base font-normal text-slate-300">de {data.total}</span></p>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-6">
          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Evolución por laboratorio</h4>
            <div className="flex h-36 items-end gap-2 border-b border-slate-200 px-1">
              {data.points.map((p, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-0.5 text-[11px] font-semibold text-slate-700">{p.percent} %</span>
                  <div className={`w-full max-w-12 rounded-t ${bar(p.percent)}`} style={{ height: `${clamp(p.percent) * 0.8}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-1">
              {data.points.map((p, i) => (
                <p key={i} className="flex-1 pt-1 text-center text-[10px] leading-tight text-slate-600 [overflow-wrap:anywhere]">
                  {p.reviewed ? "◆ " : ""}{p.name}
                </p>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Verde: 85 % o más · amarillo: 70 a 84 % · naranja: menos de 70 %.{data.reviewed > 0 ? " ◆ = nota revisada por un docente." : ""}
            </p>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">{data.competenciesTitle}</h4>
              <ul className="space-y-2">
                {data.competencies.map((k, i) => (
                  <li key={i}>
                    <div className="flex justify-between gap-2 text-xs text-slate-600">
                      <span>{k.name}</span>
                      <b className="text-slate-800">{k.percent} %</b>
                    </div>
                    <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${bar(k.percent)}`} style={{ width: `${clamp(k.percent)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="space-y-6">
              {data.byCut.length > 0 && (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Promedio por corte</h4>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {data.byCut.map((k, i) => (
                      <li key={i} className="flex justify-between"><span>{k.label} <span className="text-slate-500">({k.labs} lab.)</span></span><b>{k.percent} %</b></li>
                    ))}
                  </ul>
                </section>
              )}
              {totalConcepts > 0 && (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Conceptos</h4>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${(c.demostrado / totalConcepts) * 100}%` }} />
                    <div className="bg-yellow-500" style={{ width: `${(c.parcial / totalConcepts) * 100}%` }} />
                    <div className="bg-orange-500" style={{ width: `${(c.refuerzo / totalConcepts) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {c.demostrado} demostrados · {c.parcial} parciales · {c.refuerzo} por reforzar (de {totalConcepts})
                  </p>
                </section>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">Fortalezas recurrentes</h4>
              {data.strengths.length === 0 ? (
                <p className="text-xs text-slate-500">Aún no hay una fortaleza que se repita en 2 o más laboratorios.</p>
              ) : (
                <ul className="space-y-1 text-sm text-slate-700">
                  {data.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-emerald-600">✓</span>{s}</li>)}
                </ul>
              )}
            </section>
            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">Para seguir fortaleciendo</h4>
              {data.weaknesses.length === 0 && data.toReinforce.length === 0 ? (
                <p className="text-xs text-slate-500">No hay temas por reforzar en las evaluaciones actuales.</p>
              ) : (
                <>
                  {data.weaknesses.length > 0 && (
                    <ul className="space-y-1 text-sm text-slate-700">
                      {data.weaknesses.map((s, i) => <li key={i} className="flex gap-2"><span className="text-orange-600">↗</span>{s}</li>)}
                    </ul>
                  )}
                  {data.toReinforce.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {data.toReinforce.map((k, i) => (
                        <li key={i} className="rounded-full bg-orange-50 px-2.5 py-1 text-xs text-orange-900 ring-1 ring-orange-300">{k.name}{k.recurrent ? " · recurrente" : ""}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          </div>

          {data.pending.length > 0 && (
            <p className="text-xs text-slate-600">
              <b>Sin evaluar todavía ({data.pending.length}):</b> {data.pending.join(", ")}. No entran en los promedios.
            </p>
          )}

          <p className="border-t border-slate-200 pt-3 text-[11px] leading-snug text-slate-500">{data.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
