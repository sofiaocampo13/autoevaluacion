"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hasErrors, normalizeWeights, sumWeights, validateRubric, type Criterion, type Level } from "@/lib/rubric-validate";
import { confirmRubric, saveRubric } from "./actions";

const input = "block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900";
const emptyCriterion = (): Criterion => ({ competency: "", criterion: "", description: "", weight: null, levels: [] });
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function RubricEditor({
  rubricId,
  initialTitle,
  scale,
  initialCriteria,
}: {
  rubricId: string;
  initialTitle: string;
  scale: 5 | 100;
  initialCriteria: Criterion[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const issues = validateRubric(criteria);
  const total = sumWeights(criteria);
  const blocked = hasErrors(issues);

  const patch = (i: number, p: Partial<Criterion>) => setCriteria((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const patchLevel = (i: number, k: number, p: Partial<Level>) =>
    patch(i, { levels: criteria[i].levels.map((l, j) => (j === k ? { ...l, ...p } : l)) });

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
    <div>
      <label className="mb-4 block max-w-xl text-sm font-medium text-slate-700">
        Título de la rúbrica
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={input + " mt-1"} />
      </label>

      <div className="space-y-3">
        {criteria.map((c, i) => (
          <fieldset key={i} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <legend className="px-1 text-xs font-medium text-slate-500">Criterio {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-12">
              <label className="sm:col-span-5 text-xs font-medium text-slate-600">
                Criterio
                <input value={c.criterion} onChange={(e) => patch(i, { criterion: e.target.value })} maxLength={300} className={input} />
              </label>
              <label className="sm:col-span-5 text-xs font-medium text-slate-600">
                Competencia (opcional)
                <input value={c.competency} onChange={(e) => patch(i, { competency: e.target.value })} maxLength={200} className={input} />
              </label>
              <label className="sm:col-span-2 text-xs font-medium text-slate-600">
                Peso (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={c.weight ?? ""}
                  onChange={(e) => patch(i, { weight: num(e.target.value) })}
                  className={input + (c.weight == null ? " border-red-400" : "")}
                />
              </label>
              <label className="sm:col-span-12 text-xs font-medium text-slate-600">
                Descripción (opcional)
                <textarea value={c.description} onChange={(e) => patch(i, { description: e.target.value })} rows={2} maxLength={2000} className={input} />
              </label>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-indigo-700">Niveles de desempeño ({c.levels.length})</summary>
              <div className="mt-2 space-y-2">
                {c.levels.map((l, k) => (
                  <div key={k} className="grid gap-2 sm:grid-cols-12">
                    <input aria-label="Nombre del nivel" placeholder="Nivel" value={l.name} onChange={(e) => patchLevel(i, k, { name: e.target.value })} className={input + " sm:col-span-3"} />
                    <input
                      aria-label="Porcentaje mínimo"
                      placeholder="% mín."
                      type="number"
                      min={0}
                      max={100}
                      value={l.min_percent ?? ""}
                      onChange={(e) => patchLevel(i, k, { min_percent: num(e.target.value) })}
                      className={input + " sm:col-span-2"}
                    />
                    <textarea aria-label="Descriptor" placeholder="Descriptor" rows={2} value={l.descriptor} onChange={(e) => patchLevel(i, k, { descriptor: e.target.value })} className={input + " sm:col-span-6"} />
                    <button type="button" onClick={() => patch(i, { levels: c.levels.filter((_, j) => j !== k) })} className="text-sm text-red-600 hover:underline sm:col-span-1" aria-label="Quitar nivel">
                      Quitar
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => patch(i, { levels: [...c.levels, { name: "", min_percent: null, descriptor: "" }] })} className="text-sm text-indigo-700 hover:underline">
                  + Agregar nivel
                </button>
              </div>
            </details>

            <button type="button" onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))} className="mt-3 text-sm text-red-600 hover:underline">
              Eliminar criterio
            </button>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setCriteria((cs) => [...cs, emptyCriterion()])} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-indigo-400">
          + Agregar criterio
        </button>
        <button type="button" onClick={() => setCriteria((cs) => normalizeWeights(cs))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-indigo-400">
          Normalizar pesos a 100 %
        </button>
        <span className={`text-sm font-medium ${Math.abs(total - 100) <= 0.01 ? "text-emerald-700" : "text-red-700"}`} aria-live="polite">
          Suma de pesos: {total} %
        </span>
      </div>

      {issues.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm" aria-live="polite">
          {issues.map((it, n) => (
            <li key={n} className={it.severity === "error" ? "text-red-700" : "text-amber-700"}>
              {it.severity === "error" ? "Error: " : "Aviso: "}
              {it.message}
            </li>
          ))}
        </ul>
      )}

      {msg.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
      {msg.ok && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg.ok}</p>}

      <div className="mt-5 flex flex-wrap gap-3">
        <button disabled={pending} onClick={() => save(false)} className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar borrador"}
        </button>
        <button disabled={pending || blocked} onClick={() => save(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          Confirmar rúbrica
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Al confirmar, la rúbrica queda bloqueada con su versión (así cada evaluación conserva exactamente la que se usó). Para cambiarla
        después, se crea una nueva versión.
      </p>
    </div>
  );
}
