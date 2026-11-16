"use client";

import { useRef, useState, useTransition } from "react";
import { FIELD_LABEL, fillPlan, type FillField } from "@/lib/lab-autofill";
import { suggestLabFields } from "./actions";

const btn = "min-h-11 rounded-full border-[1.5px] px-4 text-[13px] font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300";

/**
 * Rellena el formulario del laboratorio leyendo la guía elegida. Antes de gastar IA pide confirmación y dice cuánto cuesta.
 * Solo escribe en los campos vacíos y nunca guarda nada: la persona revisa y corrige antes de pulsar «Crear / Guardar».
 */
export function AutofillButton({ dailyUnits }: { dailyUnits: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "confirm">("idle");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const form = () => anchor.current?.closest("form") ?? null;
  const field = (name: string) => form()?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

  function start() {
    setMessage(null);
    if (!field("instructions")?.value) {
      setMessage({ kind: "error", text: "Elige primero una guía en «Guía / instrucciones» (súbela antes en Materiales)." });
      return;
    }
    setPhase("confirm");
  }

  function run() {
    const materialId = field("instructions")?.value ?? "";
    setPhase("idle");
    setMessage(null);
    startTransition(async () => {
      const r = await suggestLabFields(materialId);
      if (!r.ok) {
        setMessage({ kind: "error", text: r.error });
        return;
      }
      const current = Object.fromEntries((Object.keys(FIELD_LABEL) as FillField[]).map((k) => [k, field(k)?.value ?? ""])) as Record<FillField, string>;
      const { fill, skipped } = fillPlan(current, r.suggestion);
      (Object.entries(fill) as [FillField, string][]).forEach(([k, v]) => {
        const el = field(k);
        if (el) el.value = v;
      });
      const filled = (Object.keys(fill) as FillField[]).map((k) => FIELD_LABEL[k]);
      setMessage({
        kind: "ok",
        text:
          (filled.length ? `Se rellenó: ${filled.join(", ")}. ` : "La IA no encontró datos nuevos para los campos vacíos. ") +
          (skipped.length ? `No se tocó lo que ya habías escrito (${skipped.map((k) => FIELD_LABEL[k]).join(", ")}). ` : "") +
          "Revísalo y corrígelo antes de guardar: es una propuesta de la IA basada solo en la guía.",
      });
    });
  }

  return (
    <div ref={anchor} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[13px] leading-normal text-slate-800">
        ¿No quieres escribir los datos? La IA puede proponer el nombre, la descripción, los objetivos, el corte y el número leyendo la guía elegida.
      </p>

      {phase === "confirm" ? (
        <div role="alertdialog" aria-label="Confirmar uso de IA" className="mt-3 rounded-2xl bg-aviso-bg p-4 text-[13px] leading-normal text-aviso-text">
          <p>
            <b>Esto usa la IA y gasta 1 unidad</b> de tu cupo diario ({dailyUnits} unidades cada 24 horas; una evaluación completa gasta 3).
            Escribir los datos a mano <b>no gasta nada</b>.
          </p>
          <p className="mt-1">Solo se rellenan los campos vacíos y nada se guarda hasta que tú lo confirmes. Puede tardar hasta un minuto.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={run} className={`${btn} border-aviso-text bg-aviso-text text-white hover:opacity-90`}>Sí, rellenar con IA</button>
            <button type="button" onClick={() => setPhase("idle")} className={`${btn} border-slate-300 bg-white text-slate-800 hover:border-slate-400`}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={start} disabled={pending} className={`mt-2 ${btn} border-brand-600 bg-white text-brand-700 hover:bg-brand-50 disabled:opacity-60`}>
          {pending ? "La IA está leyendo la guía…" : "Rellenar con IA desde la guía (gasta 1 unidad)"}
        </button>
      )}

      <div aria-live="polite">
        {message && <p className={`mt-2 text-[13px] ${message.kind === "ok" ? "text-emerald-800" : "text-red-700"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
