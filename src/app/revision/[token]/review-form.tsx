"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GRADE_DISCLAIMER, estimatedGrade, overallPercent } from "@/lib/scoring";
import { MIN_JUSTIFICATION } from "@/lib/review-logic";
import { submitTeacherReview } from "./actions";

type Criterion = { position: number; criterion: string; weight: number; percent: number };

const input = "min-h-11 w-full rounded-xl border-[1.5px] border-slate-300 bg-white px-3 text-[15px] text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";
const card = "flex flex-col gap-3.5 rounded-3xl border border-slate-200 bg-white px-5 py-5 sm:px-6";

export function ReviewForm({ token, scaleMax, criteria, aiGrade }: { token: string; scaleMax: number; criteria: Criterion[]; aiGrade: number }) {
  const router = useRouter();
  const [percents, setPercents] = useState<Record<number, string>>(() => Object.fromEntries(criteria.map((c) => [c.position, String(c.percent)])));
  const [just, setJust] = useState<Record<number, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const value = (c: Criterion) => {
    const n = Number(percents[c.position]);
    return Number.isFinite(n) ? n : c.percent;
  };
  const changed = (c: Criterion) => Math.abs(value(c) - c.percent) >= 0.005;
  // Solo para mostrar: la nota que cuenta la recalcula el servidor con los mismos pesos.
  const finalPercent = overallPercent(criteria.map((c) => ({ weight: c.weight, percent: Math.min(100, Math.max(0, value(c))) })));
  const finalGrade = estimatedGrade(finalPercent, scaleMax);
  const anyChange = criteria.some(changed);

  function send(decision: "aprobar" | "devolver") {
    setError(null);
    start(async () => {
      const res = await submitTeacherReview(token, {
        reviewerName: name,
        reviewerEmail: email || undefined,
        decision,
        comment,
        adjustments: decision === "devolver" ? [] : criteria.filter(changed).map((c) => ({ position: c.position, adjustedPercent: value(c), justification: just[c.position] ?? "" })),
      });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <section className={card}>
        <h2 className="font-display text-[26px]">Tu valoración por criterio</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Si estás de acuerdo con la valoración de la IA, no cambies nada. Si no, ajusta el porcentaje del criterio y explica por qué. La nota
          final se recalcula con los pesos de la rúbrica; no hace falta escribir una nota.
        </p>
        <ul className="flex flex-col gap-2.5">
          {criteria.map((c) => (
            <li key={c.position} className={`flex flex-col gap-2.5 rounded-2xl border px-4 py-3.5 ${changed(c) ? "border-[#F2C98A] bg-[#FFF9EE]" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-sm font-extrabold">
                {c.criterion} <span className="font-medium text-slate-600">(peso {c.weight} % · IA: {c.percent} %)</span>
              </p>
              <label className="flex max-w-[180px] flex-col gap-1.5 text-xs font-bold text-slate-700">
                Porcentaje (0 a 100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={percents[c.position]}
                  onChange={(e) => setPercents({ ...percents, [c.position]: e.target.value })}
                  className={input + " font-extrabold"}
                />
              </label>
              {changed(c) && (
                <label className="flex flex-col gap-1.5 text-xs font-bold text-aviso-text">
                  Justificación del ajuste (obligatoria, mínimo {MIN_JUSTIFICATION} caracteres)
                  <textarea rows={2} maxLength={1000} value={just[c.position] ?? ""} onChange={(e) => setJust({ ...just, [c.position]: e.target.value })} className={input + " py-2.5 text-sm font-normal"} />
                </label>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Barra fija: cálculo de ayuda; la nota que cuenta la recalcula el servidor. */}
      <div className="sticky bottom-3 z-10 flex flex-col gap-1.5 rounded-[22px] bg-brand-600 px-5 py-3.5 text-white shadow-[0_10px_30px_rgba(76,36,168,0.28)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" aria-live="polite">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-brand-50">Nota resultante con tus valores</span>
          <span className="font-display text-[30px] leading-[1.1] sm:text-[34px]">
            {finalGrade} / {scaleMax} <span className="font-sans text-[15px] text-brand-50">({finalPercent} %)</span>
          </span>
        </div>
        <span className="max-w-[340px] text-[12px] leading-snug text-brand-50">
          {anyChange ? `La IA había estimado ${aiGrade} / ${scaleMax}. Se recalcula con los pesos de la rúbrica.` : "Sin cambios: igual a la estimación de la IA."} {GRADE_DISCLAIMER}
        </span>
      </div>

      <section className={card}>
        <h2 className="font-display text-[26px]">Tus datos y comentario</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            Tu nombre (obligatorio)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" placeholder="Nombre y apellido" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            Correo (opcional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" placeholder="correo@universidad.edu" className={input} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          Comentario para el estudiante (obligatorio si devuelves la evaluación)
          <textarea rows={4} maxLength={4000} value={comment} onChange={(e) => setComment(e.target.value)} className={input + " py-2.5 text-sm font-normal"} />
        </label>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            disabled={pending}
            onClick={() => send("aprobar")}
            className="min-h-[50px] rounded-full bg-blue-600 px-6 text-sm font-extrabold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? "Enviando…" : anyChange ? "Aprobar con mis ajustes" : "Aprobar la nota"}
          </button>
          <button
            disabled={pending}
            onClick={() => send("devolver")}
            className="min-h-[50px] rounded-full border-[1.5px] border-pink-600 bg-white px-6 text-sm font-extrabold text-pink-600 hover:bg-pink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            Devolver con comentarios
          </button>
        </div>
        <p className="text-xs text-slate-600">Al enviar, este enlace queda usado y no podrá volver a modificarse. Se registran tu nombre y la fecha.</p>
      </section>
    </div>
  );
}
