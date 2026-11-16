import { SubmitButton } from "@/components/ui";
import { CUT_OPTIONS } from "@/lib/files";
import { aiLimits } from "@/lib/ai-budget";
import { AutofillButton } from "./autofill-button";

type Mat = { id: string; title: string; version: string };
type Lab = {
  id: string;
  name: string;
  number: number | null;
  cut: number | null;
  description: string;
  objectives: string;
  repo_url: string | null;
  instructions_material_id: string | null;
  rubric_material_id: string | null;
};

const input =
  "min-h-[46px] rounded-xl border-[1.5px] border-slate-300 bg-white px-3 text-[14px] font-normal text-slate-800 placeholder:text-slate-500 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";
const label = "flex flex-col gap-1.5 text-[13px] font-bold text-slate-800";
const card = "flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-[26px] py-6";

export function LabForm({
  action,
  lab,
  guides,
  rubrics,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  lab?: Lab;
  guides: Mat[];
  rubrics: Mat[];
  submitLabel: string;
}) {
  const opts = (list: Mat[]) =>
    list.map((m) => (
      <option key={m.id} value={m.id}>
        {m.title} (v{m.version})
      </option>
    ));
  return (
    <form action={action} className="flex flex-col gap-5">
      {lab && <input type="hidden" name="id" value={lab.id} />}
      <section className={card}>
        <h2 className="text-[22px]">Datos del laboratorio</h2>
        <label className={label}>
          Nombre
          <input name="name" defaultValue={lab?.name} required maxLength={200} className={input} />
        </label>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className={label}>
            Corte
            <select name="cut" defaultValue={lab?.cut ?? ""} className={input}>
              <option value="">Sin corte</option>
              {CUT_OPTIONS.map((c) => (
                <option key={c} value={c}>Corte {c}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            N.º / unidad
            <input name="number" type="number" min={0} max={999} defaultValue={lab?.number ?? ""} className={input} />
          </label>
        </div>
        <label className={label}>
          Descripción
          <textarea name="description" defaultValue={lab?.description} rows={3} maxLength={2000} className={`${input} py-2.5`} />
        </label>
        <label className={label}>
          Objetivos del laboratorio
          <textarea name="objectives" defaultValue={lab?.objectives} rows={3} maxLength={4000} className={`${input} py-2.5`} />
        </label>
        <label className={label}>
          Repositorio GitHub del código (opcional, público)
          <input name="repo" type="url" defaultValue={lab?.repo_url ?? ""} placeholder="https://github.com/usuario/repositorio" className={input} />
        </label>
      </section>

      <section className={card}>
        <h2 className="text-[22px]">Referencias para evaluar</h2>
        <label className={label}>
          Guía / instrucciones
          <select name="instructions" defaultValue={lab?.instructions_material_id ?? ""} className={input}>
            <option value="">Sin guía asociada</option>
            {opts(guides)}
          </select>
        </label>
        <AutofillButton dailyUnits={aiLimits().user} />
        <label className={label}>
          Rúbrica
          <select name="rubric" defaultValue={lab?.rubric_material_id ?? ""} className={input}>
            <option value="">Sin rúbrica (la evaluación tendrá menor certeza)</option>
            {opts(rubrics)}
          </select>
        </label>
        {guides.length === 0 && rubrics.length === 0 && (
          <p className="text-[13px] text-slate-600">
            Sube guías y rúbricas en <a className="font-bold text-brand-700 underline" href="/materiales">Materiales</a> para
            poder asociarlas.
          </p>
        )}
      </section>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
