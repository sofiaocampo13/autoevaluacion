import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Field, Note, Notice, SubmitButton } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/icons";
import { loadSemesterStats } from "@/lib/semester-data";
import { createSubject } from "./actions";

const card = "rounded-xl bg-white ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(42,35,64,0.05)]";
// Mismos umbrales que el mapa mental y los informes: ≥85 demostrado, ≥70 parcial, resto por reforzar.
const bar = (p: number) => (p >= 85 ? "bg-emerald-500" : p >= 70 ? "bg-yellow-500" : "bg-orange-500");

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("*").order("created_at").limit(1);
  const subject = subjects?.[0];

  if (!subject) {
    return (
      <section className="max-w-md">
        <PageHeader title="Te damos la bienvenida" description="Empieza registrando la asignatura que quieres autoevaluar." />
        <Notice error={error} />
        <form action={createSubject} className={`${card} p-6`}>
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
  const pending = stats.labsTotal - stats.labsEvaluated;

  return (
    <section>
      <PageHeader
        title={subject.name}
        description={`${subject.academic_period || "Sin periodo"} · escala de 0 a ${subject.grade_scale_max}`}
        actions={
          <Link href="/laboratorios" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Mis laboratorios
          </Link>
        }
      />

      {/* Resumen: las dos cifras que cuentan y cuánto del semestre ya está evaluado. */}
      <div className={`${card} grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10`}>
        <div className="flex items-baseline gap-8">
          <div>
            <p className="text-sm text-slate-500">Promedio orientativo</p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-tight text-brand-700">
              {has ? stats.averageGrade : "—"}
              {has && <span className="ml-1 text-lg font-normal text-slate-500">/ {subject.grade_scale_max}</span>}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Cumplimiento</p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-tight text-slate-800">{has ? `${stats.averagePercent} %` : "—"}</p>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p className="font-medium text-slate-800">Avance del semestre</p>
            <p className="text-slate-500">
              {stats.labsEvaluated} de {stats.labsTotal} evaluados{stats.reviewedLabs > 0 ? ` · ${stats.reviewedLabs} con revisión docente` : ""}
            </p>
          </div>
          <div className="mt-3 flex gap-1" role="img" aria-label={`${stats.labsEvaluated} de ${stats.labsTotal} laboratorios evaluados`}>
            {Array.from({ length: Math.max(stats.labsTotal, 1) }, (_, i) => (
              <span key={i} className={`h-2.5 flex-1 rounded-full ${i < stats.labsEvaluated ? "bg-brand-500" : "bg-slate-200"}`} />
            ))}
          </div>
          {!has && <p className="mt-3 text-sm text-slate-500">Las cifras aparecen cuando evalúes tu primer laboratorio.</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={`${card} p-6`}>
          <h2 className="text-base font-semibold text-slate-900">Evolución por laboratorio</h2>
          {has ? (
            <ul className="mt-4 space-y-3">
              {stats.points.map((p) => (
                <li key={p.labId} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
                  <span className="truncate text-slate-700" title={p.name}>{p.name}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <span className={`block h-full rounded-full ${bar(p.percent)}`} style={{ width: `${Math.min(100, p.percent)}%` }} />
                  </span>
                  <span className="whitespace-nowrap text-right tabular-nums text-slate-600">
                    <b className="font-semibold text-slate-800">{p.percent} %</b>
                    {p.reviewed && <span className="ml-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200">revisada</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Todavía no hay laboratorios evaluados.</p>
          )}
          <p className="mt-5 text-xs text-slate-500">Verde: 85 % o más · amarillo: de 70 a 84 % · naranja: menos de 70 %.</p>
        </div>

        <aside className={`${card} p-6`}>
          <h2 className="text-base font-semibold text-slate-900">Qué sigue</h2>
          {pending > 0 ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                {pending === 1 ? "Te falta 1 laboratorio por evaluar" : `Te faltan ${pending} laboratorios por evaluar`}. No entran en los promedios hasta entonces.
              </p>
              {stats.pendingLabs.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {stats.pendingLabs.slice(0, 5).map((n) => (
                    <li key={n} className="truncate border-b border-slate-100 pb-1.5 last:border-0" title={n}>{n}</li>
                  ))}
                  {stats.pendingLabs.length > 5 && <li className="text-xs text-slate-500">y {stats.pendingLabs.length - 5} más</li>}
                </ul>
              )}
              <Link href="/laboratorios" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
                Ir a mis laboratorios <Icon name="flecha" className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">Todos tus laboratorios registrados están evaluados.</p>
              <Link href="/analisis" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
                Ver el análisis del semestre <Icon name="flecha" className="h-4 w-4" />
              </Link>
            </>
          )}
        </aside>
      </div>

      <div className="mt-6">
        <Note>
          Las calificaciones son estimaciones orientativas de autoevaluación, no notas oficiales. Cuando un docente revisa una evaluación, su nota reemplaza a la
          estimación de la IA en estos promedios.
        </Note>
      </div>
    </section>
  );
}
