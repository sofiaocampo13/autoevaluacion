"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelEval, startEval } from "./actions";

type Stage = "assessing" | "finalizing";
type Run = { evaluationId: string; labels: string[]; allDone: boolean };
type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | ({ kind: "running"; stage: Stage } & Run)
  | ({ kind: "error"; message: string; retryable: boolean } & Run);

type StepResponse = { ok: true } | { ok: false; error: string; retryable: boolean };

async function callStep(evaluationId: string, payload: { assess: true } | { finalize: true }): Promise<StepResponse> {
  try {
    const res = await fetch(`/api/evaluaciones/${evaluationId}/paso`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as StepResponse;
  } catch {
    // Sin conexión, o la sesión expiró y la respuesta no es JSON.
    return { ok: false, error: "No se pudo comunicar con el servidor. Revisa tu conexión y reintenta.", retryable: true };
  }
}

/** Tiempo transcurrido desde que se monta (la evaluación puede tardar varios minutos). */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(seconds / 60);
  return <>{m > 0 ? `${m} min ${seconds % 60} s` : `${seconds} s`}</>;
}

export function EvaluatePanel({ labId, blockedReason, inProgress }: { labId: string; blockedReason: string | null; inProgress: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const cancelled = useRef(false);

  async function run(base: Pick<Run, "evaluationId" | "labels">, assessmentDone: boolean) {
    const fail = (message: string, retryable: boolean, allDone: boolean) =>
      setPhase({ kind: "error", ...base, allDone, message, retryable });

    if (!assessmentDone) {
      setPhase({ kind: "running", stage: "assessing", ...base, allDone: false });
      const a = await callStep(base.evaluationId, { assess: true });
      if (cancelled.current) return;
      if (!a.ok) return fail(a.error, a.retryable, false);
    }
    setPhase({ kind: "running", stage: "finalizing", ...base, allDone: true });
    const f = await callStep(base.evaluationId, { finalize: true });
    if (cancelled.current) return;
    if (!f.ok) return fail(f.error, f.retryable, true);
    router.push(`/laboratorios/${labId}/evaluacion/${base.evaluationId}`);
  }

  async function begin() {
    cancelled.current = false;
    setPhase({ kind: "starting" });
    const s = await startEval(labId);
    if (!s.ok) return setPhase({ kind: "error", evaluationId: "", labels: [], allDone: false, message: s.error, retryable: false });
    await run({ evaluationId: s.evaluationId, labels: s.labels }, s.donePositions.length >= s.total);
  }

  async function cancel(evaluationId: string) {
    cancelled.current = true;
    if (evaluationId) await cancelEval(evaluationId);
    setPhase({ kind: "idle" });
    router.refresh();
  }

  const btn = "rounded-lg bg-pink-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-800 disabled:opacity-50";
  const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-hidden="true" />;

  return (
    <div>
      {phase.kind === "idle" && (
        <div>
          {inProgress && !blockedReason && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Hay una evaluación en curso de este laboratorio. Pulsa el botón para retomarla donde quedó.
            </p>
          )}
          <button onClick={begin} disabled={!!blockedReason} className={btn} title={blockedReason ?? ""}>
            {inProgress && !blockedReason ? "RETOMAR EVALUACIÓN" : "EVALUAR LABORATORIO"}
          </button>
          {blockedReason && <p className="mt-2 text-sm text-slate-600">{blockedReason}</p>}
        </div>
      )}

      {phase.kind === "starting" && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-700">
          {spinner} Preparando la evaluación…
        </p>
      )}

      {phase.kind === "running" && (
        <div role="status" aria-live="polite" className="max-w-xl">
          <div className="mb-1 flex items-center justify-between text-sm font-medium text-slate-800">
            <span className="flex items-center gap-2">
              {spinner}
              {phase.stage === "assessing"
                ? `Paso 1 de 2 · Valorando los ${phase.labels.length} criterios con la IA`
                : "Paso 2 de 2 · Calculando la nota y redactando la retroalimentación"}
            </span>
            <span className="text-slate-500"><Elapsed key={phase.stage} /></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full w-1/3 animate-[pending-slide_1.4s_ease-in-out_infinite] rounded-full bg-brand-600" />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {phase.labels.map((label, i) => (
              <li key={i} className={phase.stage === "finalizing" ? "text-emerald-700" : "text-slate-700"}>
                {phase.stage === "finalizing" ? "✓" : "…"} {label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Se hace una sola petición a la IA con todo tu trabajo; puede tardar de 1 a 5 minutos (la IA gratuita es irregular). No cierres esta
            página; si lo haces, podrás retomar donde quedó.
          </p>
          <button onClick={() => cancel(phase.evaluationId)} className="mt-2 text-sm text-red-600 hover:underline">
            Cancelar evaluación
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <div role="alert" className="max-w-xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">No se pudo continuar</p>
          <p className="mt-1">{phase.message}</p>
          {phase.allDone && <p className="mt-1 text-xs">La valoración de los criterios ya está guardada; solo falta el cierre.</p>}
          <div className="mt-3 flex gap-3">
            {phase.retryable && phase.evaluationId && (
              <button
                onClick={() => {
                  cancelled.current = false;
                  run({ evaluationId: phase.evaluationId, labels: phase.labels }, phase.allDone);
                }}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-white hover:bg-red-800"
              >
                Reintentar
              </button>
            )}
            <button onClick={() => (phase.evaluationId ? cancel(phase.evaluationId) : setPhase({ kind: "idle" }))} className="text-red-700 hover:underline">
              {phase.evaluationId ? "Cancelar evaluación" : "Cerrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
