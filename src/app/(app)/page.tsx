import { createClient } from "@/lib/supabase/server";
import { Field, Notice, SubmitButton } from "@/components/ui";
import { PanelSemestre } from "@/components/panel-semestre";
import { loadSemesterStats } from "@/lib/semester-data";
import { createSubject } from "./actions";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("*").order("created_at").limit(1);
  const subject = subjects?.[0];

  if (!subject) {
    return (
      <section className="max-w-md">
        <header className="mb-8">
          <h1 className="text-[30px] leading-[1.08] tracking-[-0.02em] md:text-[44px]">
            Te damos la bienvenida. <em className="text-brand-600">Empecemos.</em>
          </h1>
          <p className="mt-2 text-sm text-slate-600">Empieza registrando la asignatura que quieres autoevaluar.</p>
        </header>
        <Notice error={error} />
        <form action={createSubject} className="rounded-[24px] border border-slate-200 bg-white p-6">
          <Field label="Nombre de la asignatura" name="name" required />
          <Field label="Periodo académico (ej. 2026-2)" name="period" />
          <label className="mb-5 flex flex-col gap-1.5 text-[13px] font-bold text-slate-800">
            Escala de calificación
            <select
              name="scale"
              className="min-h-12 rounded-[14px] border-[1.5px] border-slate-300 bg-white px-3.5 text-[15px] font-normal text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
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
  const { data: profile } = await supabase.from("profiles").select("full_name").maybeSingle();
  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  return <PanelSemestre stats={stats} subjectName={subject.name} period={subject.academic_period || null} firstName={firstName} />;
}
