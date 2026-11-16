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

export function EvaluatePanel({ labId, blockedReason, inProgress, cost }: { labId: string; blockedReason: string | null; inProgress: boolean; cost: number }) {
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

  const btn = "flex min-h-[52px] w-full items-center justify-center rounded-full bg-pink-300 px-5 text-[14px] font-extrabold tracking-[0.04em] text-slate-900 hover:bg-pink-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50";
  const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-pink-300 border-t-transparent" aria-hidden="true" />;

  return (
    <div>
      {phase.kind === "idle" && (
        <div>
          {inProgress && !blockedReason && (
            <p className="mb-3 rounded-2xl bg-aviso-bg px-3.5 py-2.5 text-[13px] text-aviso-text">
              Hay una evaluación en curso de este laboratorio. Pulsa el botón para retomarla donde quedó.
            </p>
          )}
          <button onClick={begin} disabled={!!blockedReason} className={btn} title={blockedReason ?? ""}>
            {inProgress && !blockedReason ? "RETOMAR EVALUACIÓN" : "EVALUAR LABORATORIO"}
          </button>
          {blockedReason ? (
            <p className="mt-2 text-[13px] text-slate-200">{blockedReason}</p>
          ) : (
            <p className="mt-2 text-[12px] text-[#FFE2B8]">Gasta {cost} unidades de tu cupo diario de IA.</p>
          )}
        </div>
      )}

      {phase.kind === "starting" && (
        <p role="status" className="flex items-center gap-2 text-[14px] text-white">
          {spinner} Preparando la evaluación…
        </p>
      )}

      {phase.kind === "running" && (
        <div role="status" aria-live="polite" className="rounded-2xl bg-white/[0.07] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 text-[14px] font-bold text-white">
            <span className="flex items-center gap-2">
              {spinner}
              {phase.stage === "assessing"
                ? `Paso 1 de 2 · Valorando los ${phase.labels.length} criterios con la IA`
                : "Paso 2 de 2 · Calculando la nota y redactando la retroalimentación"}
            </span>
            <span className="font-extrabold text-lavanda"><Elapsed key={phase.stage} /></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-1/3 animate-[pending-slide_1.4s_ease-in-out_infinite] rounded-full bg-lavanda" />
          </div>
          <ul className="mt-3 space-y-1 text-[13px]">
            {phase.labels.map((label, i) => (
              <li key={i} className={phase.stage === "finalizing" ? "text-white" : "text-slate-200"}>
                {phase.stage === "finalizing" ? "✓" : "…"} {label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-normal text-slate-200">
            Se hace una sola petición a la IA con todo tu trabajo; puede tardar de 1 a 5 minutos (la IA gratuita es irregular). No cierres esta
            página; si lo haces, podrás retomar donde quedó.
          </p>
          <button onClick={() => cancel(phase.evaluationId)} className="mt-3 min-h-11 rounded-full border-[1.5px] border-white/50 px-5 text-[14px] font-bold text-white hover:bg-white/10">
            Cancelar evaluación
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <div role="alert" className="rounded-2xl bg-[#4E1230] px-4 py-4 text-[14px] text-white">
          <p className="text-[15px] font-bold">No se pudo continuar</p>
          <p className="mt-1">{phase.message}</p>
          {phase.allDone && <p className="mt-2 text-[13px]">La valoración de los criterios ya está guardada; solo falta el cierre.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {phase.retryable && phase.evaluationId && (
              <button
                onClick={() => {
                  cancelled.current = false;
                  run({ evaluationId: phase.evaluationId, labels: phase.labels }, phase.allDone);
                }}
                className="min-h-11 rounded-full bg-pink-300 px-5 font-bold text-slate-900 hover:bg-pink-200"
              >
                Reintentar
              </button>
            )}
            <button onClick={() => (phase.evaluationId ? cancel(phase.evaluationId) : setPhase({ kind: "idle" }))} className="min-h-11 rounded-full border-[1.5px] border-white/50 px-5 font-bold text-white hover:bg-white/10">
              {phase.evaluationId ? "Cancelar evaluación" : "Cerrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
