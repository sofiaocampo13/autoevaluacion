"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { estimatedGrade, overallPercent } from "@/lib/scoring";
import { MIN_JUSTIFICATION } from "@/lib/review-logic";
import { submitTeacherReview } from "./actions";

type Criterion = { position: number; criterion: string; weight: number; percent: number };

const input = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900";

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
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-1 text-lg font-medium">Tu valoración por criterio</h2>
        <p className="mb-4 text-sm text-slate-600">
          Si estás de acuerdo con la valoración de la IA, no cambies nada. Si no, ajusta el porcentaje del criterio y explica por qué. La nota
          final se recalcula con los pesos de la rúbrica; no hace falta escribir una nota.
        </p>
        <ul className="space-y-4">
          {criteria.map((c) => (
            <li key={c.position} className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">
                {c.criterion} <span className="font-normal text-slate-500">(peso {c.weight} % · IA: {c.percent} %)</span>
              </p>
              <label className="mt-2 block text-xs font-medium text-slate-600">
                Porcentaje (0 a 100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={percents[c.position]}
                  onChange={(e) => setPercents({ ...percents, [c.position]: e.target.value })}
                  className={input + " max-w-[10rem]"}
                />
              </label>
              {changed(c) && (
                <label className="mt-2 block text-xs font-medium text-amber-800">
                  Justificación del ajuste (obligatoria, mínimo {MIN_JUSTIFICATION} caracteres)
                  <textarea rows={2} maxLength={1000} value={just[c.position] ?? ""} onChange={(e) => setJust({ ...just, [c.position]: e.target.value })} className={input} />
                </label>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="sticky bottom-3 z-10 rounded-xl bg-indigo-600 px-5 py-3 text-white shadow-lg" aria-live="polite">
        <p className="text-xs uppercase tracking-wide text-indigo-100">Nota resultante con tus valores</p>
        <p className="text-2xl font-semibold">
          {finalGrade} / {scaleMax} <span className="text-base font-normal text-indigo-100">({finalPercent} %)</span>
        </p>
        <p className="text-xs text-indigo-100">
          {anyChange ? `La IA había estimado ${aiGrade} / ${scaleMax}. Se recalcula con los pesos de la rúbrica.` : "Sin cambios: igual a la estimación de la IA."}
        </p>
      </div>

      <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-medium">Tus datos y comentario</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Tu nombre (obligatorio)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" className={input} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Correo (opcional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" className={input} />
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Comentario para el estudiante (obligatorio si devuelves la evaluación)
          <textarea rows={4} maxLength={4000} value={comment} onChange={(e) => setComment(e.target.value)} className={input} />
        </label>

        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            disabled={pending}
            onClick={() => send("aprobar")}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "Enviando…" : anyChange ? "Aprobar con mis ajustes" : "Aprobar la nota"}
          </button>
          <button
            disabled={pending}
            onClick={() => send("devolver")}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-red-400 disabled:opacity-60"
          >
            Devolver con comentarios
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Al enviar, este enlace queda usado y no podrá volver a modificarse. Se registran tu nombre y la fecha.</p>
      </div>
    </div>
  );
}
