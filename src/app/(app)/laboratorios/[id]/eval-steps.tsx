import { Icon } from "@/components/icons";
import { STAGES } from "../lab-stages";

/** Etapas de la evaluación; `done[i]` indica las que ya se cumplieron según los datos reales del laboratorio. */
export function EvalSteps({ done }: { done: boolean[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-[22px] py-5">
      <h2 className="font-sans text-[13px] font-extrabold uppercase tracking-[0.08em] text-pink-700">Así se evalúa tu trabajo</h2>
      <ol className="flex flex-col gap-2.5">
        {STAGES.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-extrabold ${
                done[i] ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {done[i] ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <strong className="text-[14px]">
                {s.title}
                {done[i] && <span className="sr-only"> (hecho)</span>}
              </strong>
              <span className="text-[12.5px] leading-[1.45] text-slate-600">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
