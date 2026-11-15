import { createClient } from "@/lib/supabase/server";
import { Field, Notice, SubmitButton } from "@/components/ui";
import { createSubject } from "./actions";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("*").order("created_at").limit(1);
  const subject = subjects?.[0];

  if (!subject) {
    return (
      <section className="max-w-md">
        <h1 className="mb-1 text-2xl font-semibold">Bienvenido/a</h1>
        <p className="mb-6 text-slate-600">Empieza registrando la asignatura que quieres autoevaluar.</p>
        <Notice error={error} />
        <form action={createSubject} className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <Field label="Nombre de la asignatura" name="name" required />
          <Field label="Periodo académico (ej. 2026-2)" name="period" />
          <label className="mb-4 block text-sm font-medium text-slate-700">
            Escala de calificación
            <select name="scale" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="5">0 a 5</option>
              <option value="100">0 a 100</option>
            </select>
          </label>
          <SubmitButton>Crear asignatura</SubmitButton>
        </form>
      </section>
    );
  }

  // Conteos reales. Aún no hay laboratorios ni evaluaciones (fases 2-3), así que valen 0.
  const [{ count: labs }, { count: evaluated }] = await Promise.all([
    supabase.from("labs").select("id", { count: "exact", head: true }).eq("subject_id", subject.id),
    supabase.from("evaluations").select("id", { count: "exact", head: true }).eq("status", "completada"),
  ]);

  return (
    <section>
      <h1 className="text-2xl font-semibold">{subject.name}</h1>
      <p className="mb-6 text-slate-500">
        {subject.academic_period || "Sin periodo"} · escala 0 a {subject.grade_scale_max}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Laboratorios registrados" value={labs ?? 0} />
        <Stat label="Laboratorios evaluados" value={evaluated ?? 0} />
        <Stat label="Promedio orientativo" value="—" hint="Disponible tras tu primera evaluación" />
        <Stat label="Cumplimiento global" value="—" hint="Disponible tras tu primera evaluación" />
      </div>
      <p className="mt-6 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
        La carga de laboratorios y la evaluación con IA llegan en las siguientes fases. Las calificaciones serán
        siempre estimaciones orientativas, no notas oficiales.
      </p>
    </section>
  );
}
