import type { MindNode, MindState } from "@/lib/mindmap-data";

// Estados de dominio del diseño; además del color llevan glifo y texto para no depender solo del color.
const CHIP: Record<MindState, string> = {
  demostrado: "bg-blue-600 text-white",
  parcial: "bg-brand-200 text-brand-900",
  refuerzo: "bg-pink-600 text-white",
  sin_evaluar: "border-[1.5px] border-dashed border-slate-400 bg-white text-slate-600",
  neutro: "bg-slate-100 text-slate-800",
};
const GLYPH: Record<MindState, string> = { demostrado: "✓", parcial: "◐", refuerzo: "↗", sin_evaluar: "–", neutro: "" };
const STATE_NAME: Record<MindState, string> = { demostrado: "demostrado", parcial: "parcial", refuerzo: "requiere refuerzo", sin_evaluar: "sin evidencia", neutro: "" };
const TOP: Record<MindState, string> = { demostrado: "border-t-blue-600", parcial: "border-t-brand-600", refuerzo: "border-t-pink-600", sin_evaluar: "border-t-slate-400", neutro: "border-t-slate-400" };

function Chip({ name, state }: { name: string; state: MindState }) {
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${CHIP[state]}`}>
      <span aria-hidden="true">{GLYPH[state]}</span>
      {name}
      <span className="sr-only"> ({STATE_NAME[state]})</span>
    </span>
  );
}

/** Categorías temáticas del semestre (rama «Temas» del mapa) y laboratorios aún sin evidencia. Solo datos reales. */
export function ThemeGrid({ themes, pending }: { themes: MindNode[]; pending: string[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-4">
      {themes.map((t) => (
        <section key={t.id} className={`flex flex-col gap-2.5 rounded-[22px] border border-slate-200 border-t-[6px] bg-white p-5 ${TOP[t.state]}`}>
          <h3 className="text-[21px] text-slate-800">{t.label}</h3>
          {t.children.map((s) => (
            <div key={s.id} className="flex flex-col gap-1.5 border-t border-dashed border-slate-300 pt-2.5">
              <p className="text-[13px] font-bold text-slate-600">{s.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {s.children.map((k) => <Chip key={k.id} name={k.label} state={k.state} />)}
              </div>
            </div>
          ))}
        </section>
      ))}
      {pending.length > 0 && (
        <section className="flex flex-col gap-2.5 rounded-[22px] border border-slate-200 border-t-[6px] border-t-slate-400 bg-white p-5">
          <h3 className="text-[21px] text-slate-800">Pendiente de evaluar</h3>
          <div className="flex flex-wrap gap-1.5 border-t border-dashed border-slate-300 pt-2.5">
            {pending.map((n) => <Chip key={n} name={n} state="sin_evaluar" />)}
          </div>
        </section>
      )}
    </div>
  );
}
