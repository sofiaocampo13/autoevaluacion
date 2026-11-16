"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AnalyzeButton({ subjectId, label, force = false }: { subjectId: string; label: string; force?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  async function run() {
    setMessage(null);
    setSeconds(0);
    setRunning(true);
    try {
      const res = await fetch("/api/analisis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId, force }) });
      const r = (await res.json()) as { ok: boolean; error?: string; reused?: boolean };
      if (!r.ok) setMessage({ kind: "error", text: r.error ?? "No se pudo generar el análisis." });
      else {
        if (r.reused) setMessage({ kind: "info", text: "Tus evaluaciones no han cambiado desde el último análisis, así que sigue vigente." });
        router.refresh();
      }
    } catch {
      setMessage({ kind: "error", text: "Se perdió la conexión con el servidor. Inténtalo de nuevo." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex max-w-sm flex-col items-start gap-3 sm:items-end">
      <button
        onClick={run}
        disabled={running}
        className="inline-flex min-h-12 items-center rounded-full bg-slate-800 px-6 text-[13px] font-extrabold tracking-wide text-white hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
      >
        {running ? "Analizando tu semestre…" : label}
      </button>
      {running && (
        <div role="status" className="w-full">
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-600" />
          </div>
          <p className="mt-1 text-xs text-slate-600">La IA está redactando el análisis y el plan. Puede tardar hasta un par de minutos ({seconds} s).</p>
        </div>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`rounded-2xl px-3 py-2 text-sm ${message.kind === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
