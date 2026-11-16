import { createClient } from "@/lib/supabase/server";
import { Field, Notice, SubmitButton } from "@/components/ui";
import { loadSemesterStats } from "@/lib/semester-data";
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

  // Todo sale de evaluaciones reales y completadas (la última de cada laboratorio); la nota revisada por un docente reemplaza a la de la IA.
  const stats = await loadSemesterStats(supabase, subject.id, Number(subject.grade_scale_max));
  const has = stats.labsEvaluated > 0;

  return (
    <section>
      <h1 className="text-2xl font-semibold">{subject.name}</h1>
      <p className="mb-6 text-slate-500">
        {subject.academic_period || "Sin periodo"} · escala 0 a {subject.grade_scale_max}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Laboratorios registrados" value={stats.labsTotal} />
        <Stat label="Laboratorios evaluados" value={stats.labsEvaluated} hint={stats.reviewedLabs > 0 ? `${stats.reviewedLabs} revisado(s) por docente` : undefined} />
        <Stat label="Promedio orientativo" value={has ? `${stats.averageGrade} / ${subject.grade_scale_max}` : "—"} hint={has ? undefined : "Disponible tras tu primera evaluación"} />
        <Stat label="Cumplimiento global" value={has ? `${stats.averagePercent} %` : "—"} hint={has ? undefined : "Disponible tras tu primera evaluación"} />
      </div>

      {has && (
        <div className="mt-6 rounded-xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-medium">Evolución por laboratorio</h2>
          <ul className="space-y-2">
            {stats.points.map((p) => (
              <li key={p.labId} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0 truncate text-slate-700" title={p.name}>{p.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, p.percent)}%` }} />
                </span>
                <span className="w-44 shrink-0 text-right text-slate-600">
                  {p.grade} / {subject.grade_scale_max} · {p.percent} %{p.reviewed ? " · revisada" : ""}
                </span>
              </li>
            ))}
          </ul>
          {stats.labsEvaluated < stats.labsTotal && (
            <p className="mt-3 text-xs text-slate-500">{stats.labsTotal - stats.labsEvaluated} laboratorio(s) aún sin evaluar no entran en estos números.</p>
          )}
        </div>
      )}

      <p className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-600">
        Las calificaciones son estimaciones orientativas de autoevaluación, no notas oficiales. Cuando un docente revisa una evaluación, su nota reemplaza a la
        estimación de la IA en estos promedios.
      </p>
    </section>
  );
}
