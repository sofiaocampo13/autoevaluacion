"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hasErrors, normalizeWeights, sumWeights, validateRubric, type Criterion, type Level } from "@/lib/rubric-validate";
import { confirmRubric, saveRubric } from "./actions";

const input = "block w-full rounded-xl border-[1.5px] border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";
const lvlInput = "block w-full rounded-[10px] border-[1.5px] border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";
const ghost = "min-h-11 rounded-full border-[1.5px] border-slate-300 bg-white px-[18px] text-[13px] font-extrabold text-slate-800 hover:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300";
const emptyCriterion = (): Criterion => ({ competency: "", criterion: "", description: "", weight: null, levels: [] });
const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Niveles de un criterio: abierto al inicio si tiene menos de 2, y luego lo controla la persona. */
function Levels({ c, onChange }: { c: Criterion; onChange: (levels: Level[]) => void }) {
  const [open, setOpen] = useState(c.levels.length < 2);
  const patchLevel = (k: number, p: Partial<Level>) => onChange(c.levels.map((l, j) => (j === k ? { ...l, ...p } : l)));
  return (
    <details className="mt-3" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="min-h-8 cursor-pointer text-sm font-extrabold text-brand-600">Niveles de desempeño ({c.levels.length})</summary>
      <div className="mt-2 flex flex-col gap-2">
        {c.levels.map((l, k) => (
          <div key={k} className="grid gap-2 rounded-[14px] bg-slate-50 p-2.5 sm:grid-cols-[minmax(120px,2fr)_minmax(80px,1fr)_minmax(200px,5fr)_auto]">
            <input aria-label="Nombre del nivel" placeholder="Nivel" value={l.name} onChange={(e) => patchLevel(k, { name: e.target.value })} className={`${lvlInput} min-h-11 font-bold`} />
            <input
              aria-label="Porcentaje mínimo"
              placeholder="% mín."
              type="number"
              min={0}
              max={100}
              value={l.min_percent ?? ""}
              onChange={(e) => patchLevel(k, { min_percent: num(e.target.value) })}
              className={`${lvlInput} min-h-11`}
            />
            <textarea aria-label="Descriptor" placeholder="Descriptor" rows={2} value={l.descriptor} onChange={(e) => patchLevel(k, { descriptor: e.target.value })} className={`${lvlInput} py-2 leading-snug`} />
            <button type="button" onClick={() => onChange(c.levels.filter((_, j) => j !== k))} className="min-h-11 px-2.5 text-[13px] font-bold text-[#B4233A] hover:underline" aria-label="Quitar nivel">
              Quitar
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...c.levels, { name: "", min_percent: null, descriptor: "" }])} className="min-h-11 w-fit px-1 text-[13px] font-extrabold text-brand-600 hover:underline">
          + Agregar nivel
        </button>
      </div>
    </details>
  );
}

export function RubricEditor({
  rubricId,
  initialTitle,
  scale,
  initialCriteria,
  children,
}: {
  rubricId: string;
  initialTitle: string;
  scale: 5 | 100;
  initialCriteria: Criterion[];
  /** Acción de servidor para eliminar el borrador, que se dibuja bajo los criterios. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const issues = validateRubric(criteria);
  const total = sumWeights(criteria);
  const blocked = hasErrors(issues);
  const diff = Math.round((total - 100) * 100) / 100;
  const exact = Math.abs(diff) <= 0.01;
  const withIssue = new Set(issues.filter((it) => it.severity === "warning" && it.index != null).map((it) => it.index));

  const patch = (i: number, p: Partial<Criterion>) => setCriteria((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)));

  function save(thenConfirm: boolean) {
    setMsg({});
    start(async () => {
      const r = await saveRubric({ rubricId, title, scale, criteria });
      if (!r.ok) return setMsg({ error: r.error });
      if (!thenConfirm) return setMsg({ ok: r.message });
      const c = await confirmRubric(rubricId);
      if (!c.ok) return setMsg({ error: c.error });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
        <label className="flex max-w-[560px] flex-col gap-1.5 text-[13px] font-bold text-slate-800">
          Título de la rúbrica
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={`${input} min-h-[46px]`} />
        </label>

        {criteria.map((c, i) => (
          <fieldset key={i} className={`m-0 min-w-0 rounded-[22px] border bg-white px-5 pb-3.5 pt-4 ${withIssue.has(i) ? "border-[#F2C98A]" : "border-slate-200"}`}>
            <legend className="px-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-slate-600">Criterio {i + 1}</legend>
            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-0 flex-[3_1_260px] flex-col gap-1.5 text-xs font-bold text-slate-700">
                Criterio
                <input value={c.criterion} onChange={(e) => patch(i, { criterion: e.target.value })} maxLength={300} className={`${input} min-h-11`} />
              </label>
              <label className="flex min-w-0 flex-[2_1_200px] flex-col gap-1.5 text-xs font-bold text-slate-700">
                Competencia (opcional)
                <input value={c.competency} onChange={(e) => patch(i, { competency: e.target.value })} maxLength={200} className={`${input} min-h-11`} />
              </label>
              <label className="flex flex-[0_1_120px] flex-col gap-1.5 text-xs font-bold text-slate-700">
                Peso (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={c.weight ?? ""}
                  onChange={(e) => patch(i, { weight: num(e.target.value) })}
                  className={`${input} min-h-11 text-[15px] font-extrabold text-brand-800 ${c.weight == null ? "border-pink-600" : ""}`}
                />
              </label>
            </div>
            <label className="mt-3 flex flex-col gap-1.5 text-xs font-bold text-slate-700">
              Descripción (opcional)
              <textarea value={c.description} onChange={(e) => patch(i, { description: e.target.value })} rows={2} maxLength={2000} className={`${input} resize-y py-2.5`} />
            </label>

            <Levels c={c} onChange={(levels) => patch(i, { levels })} />

            <button type="button" onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))} className="mt-2.5 min-h-11 text-[13px] font-bold text-[#B4233A] hover:underline">
              Eliminar criterio
            </button>
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setCriteria((cs) => [...cs, emptyCriterion()])} className={ghost}>
            + Agregar criterio
          </button>
          <button type="button" onClick={() => setCriteria((cs) => normalizeWeights(cs))} className={ghost}>
            Normalizar pesos a 100 %
          </button>
        </div>
        {children}
      </div>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
        <div className="flex flex-col gap-3.5 rounded-3xl bg-slate-900 px-6 py-[22px] text-[#F4EEFF]">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#F49AC1]">Suma de pesos</span>
          <div className="flex flex-wrap items-baseline gap-2.5" aria-live="polite">
            <span className="font-display text-[52px] leading-none">{total}%</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${exact ? "bg-[#8FB0FF] text-[#0F2260]" : "bg-[#F49AC1] text-[#3A0E22]"}`}>
              {exact ? "Completo" : diff > 0 ? `Sobran ${diff} %` : `Faltan ${-diff} %`}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-plum-line" role="presentation">
            <div className={`h-full rounded-full ${exact ? "bg-[#8FB0FF]" : "bg-[#F49AC1]"}`} style={{ width: `${Math.min(Math.max(total, 0), 100)}%` }} />
          </div>
          {issues.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite">
              {issues.map((it, n) => (
                <li key={n} className={`rounded-xl px-3 py-2 text-[13px] leading-snug ${it.severity === "error" ? "bg-[#4A1430] text-[#FFD6E6]" : "bg-plum-line text-[#FFE2B8]"}`}>
                  <strong>{it.severity === "error" ? "Error:" : "Aviso:"}</strong> {it.message}
                </li>
              ))}
            </ul>
          )}
          {msg.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{msg.error}</p>}
          {msg.ok && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{msg.ok}</p>}
          <button
            disabled={pending}
            onClick={() => save(false)}
            className="min-h-[46px] rounded-full border-[1.5px] border-[#8FB0FF] bg-transparent text-sm font-extrabold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB0FF] disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar borrador"}
          </button>
          <button
            disabled={pending || blocked}
            onClick={() => save(true)}
            className="min-h-[50px] rounded-full bg-brand-600 text-sm font-extrabold text-white hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9A2FF] disabled:cursor-not-allowed disabled:bg-[#4A3F63] disabled:text-[#CFC6E0]"
          >
            Confirmar rúbrica
          </button>
          <p className="text-xs leading-normal text-[#C9BEE0]">
            Al confirmar, la rúbrica queda bloqueada con su versión (así cada evaluación conserva exactamente la que se usó). Para cambiarla
            después, se crea una nueva versión.
          </p>
        </div>
      </aside>
    </div>
  );
}
