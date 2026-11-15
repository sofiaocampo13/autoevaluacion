import { SubmitButton } from "@/components/ui";
import { CUT_OPTIONS } from "@/lib/files";

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
  mindmap_topics: string[];
};

const input = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900";

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
    <form action={action} className="mb-6 max-w-xl rounded-xl bg-white p-6 ring-1 ring-slate-200">
      {lab && <input type="hidden" name="id" value={lab.id} />}
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Nombre
        <input name="name" defaultValue={lab?.name} required maxLength={200} className={input} />
      </label>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Corte
          <select name="cut" defaultValue={lab?.cut ?? ""} className={input}>
            <option value="">Sin corte</option>
            {CUT_OPTIONS.map((c) => (
              <option key={c} value={c}>Corte {c}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          N.º / unidad
          <input name="number" type="number" min={0} max={999} defaultValue={lab?.number ?? ""} className={input} />
        </label>
      </div>
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Descripción
        <textarea name="description" defaultValue={lab?.description} rows={3} maxLength={2000} className={input} />
      </label>
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Objetivos del laboratorio
        <textarea name="objectives" defaultValue={lab?.objectives} rows={3} maxLength={4000} className={input} />
      </label>
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Repositorio GitHub del código (opcional, público)
        <input name="repo" type="url" defaultValue={lab?.repo_url ?? ""} placeholder="https://github.com/usuario/repositorio" className={input} />
      </label>
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Guía / instrucciones
        <select name="instructions" defaultValue={lab?.instructions_material_id ?? ""} className={input}>
          <option value="">Sin guía asociada</option>
          {opts(guides)}
        </select>
      </label>
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Rúbrica
        <select name="rubric" defaultValue={lab?.rubric_material_id ?? ""} className={input}>
          <option value="">Sin rúbrica (la evaluación tendrá menor certeza)</option>
          {opts(rubrics)}
        </select>
      </label>
      {guides.length === 0 && rubrics.length === 0 && (
        <p className="mb-3 text-xs text-slate-500">
          Sube guías y rúbricas en <a className="text-indigo-700 underline" href="/materiales">Materiales</a> para
          poder asociarlas.
        </p>
      )}
      <label className="mb-4 block text-sm font-medium text-slate-700">
        Temas del mapa mental que debe demostrar (uno por línea)
        <textarea
          name="topics"
          defaultValue={lab?.mindmap_topics.join("\n")}
          rows={4}
          placeholder={"Ej.\nLey de Ohm\nCircuitos en serie"}
          className={input}
        />
      </label>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
