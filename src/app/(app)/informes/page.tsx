import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { Icon } from "@/components/icons";
import { Note } from "@/components/ui";

const view = "inline-flex min-h-11 items-center rounded-full border-[1.5px] border-brand-600 px-5 text-[13px] font-bold text-brand-700 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2";
const download = "inline-flex min-h-11 items-center rounded-full bg-brand-600 px-5 text-[13px] font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2";

export default async function ReportsPage() {
  const supabase = await createClient();
  const [{ data: subject }, { data: labs }, { data: evals }] = await Promise.all([
    supabase.from("subjects").select("name, academic_period").order("created_at").limit(1).maybeSingle(),
    supabase.from("labs").select("id, name, number").order("number", { nullsFirst: false }),
    supabase.from("evaluations").select("id, lab_id, completed_at, created_at").eq("status", "completada").order("completed_at", { ascending: false }),
  ]);

  // Un informe por laboratorio: el de su evaluación completada más reciente.
  const latest = new Map<string, NonNullable<typeof evals>[number]>();
  for (const e of evals ?? []) if (!latest.has(e.lab_id)) latest.set(e.lab_id, e);
  const items = (labs ?? []).filter((l) => latest.has(l.id)).map((l) => ({ lab: l, ev: latest.get(l.id)! }));

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-pink-600">
          {subject ? `${subject.name}${subject.academic_period ? ` · ${subject.academic_period}` : ""}` : "Informes"}
        </span>
        <h1 className="text-[32px] leading-tight tracking-[-0.02em] sm:text-[44px]">Informes PDF</h1>
        <p className="text-sm text-slate-600">Los informes se generan siempre a partir de tus evaluaciones guardadas. Puedes verlos en el navegador o descargarlos.</p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-slate-700">
          Aún no hay informes disponibles. Evalúa un laboratorio en <Link className="font-bold text-brand-700 underline" href="/laboratorios">Mis laboratorios</Link> para generar el primero.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3.5">
            <li className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[18px] border border-slate-200 bg-white px-5 py-4">
              <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-slate-900 text-pink-300">
                <Icon name="informes" />
              </span>
              <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
                <span className="text-[15px] font-extrabold">Informe integrado del semestre</span>
                <span className="text-[12.5px] text-slate-600">Resumen de todos los laboratorios evaluados, competencias y plan de mejora.</span>
              </div>
              <span className="flex flex-wrap gap-2.5">
                <a className={view} href="/api/analisis/informe" target="_blank" rel="noreferrer">Ver</a>
                <a className={download} href="/api/analisis/informe?download=1">Descargar</a>
              </span>
            </li>
            {items.map(({ lab, ev }) => (
              <li key={lab.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[18px] border border-slate-200 bg-white px-5 py-4">
                <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Icon name="informes" />
                </span>
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
                  <span className="text-[15px] font-extrabold">
                    Informe individual · {lab.number != null ? `Lab ${lab.number} · ` : ""}{lab.name}
                  </span>
                  <span className="text-[12.5px] text-slate-600">
                    Evaluación del {new Date(ev.completed_at ?? ev.created_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <span className="flex flex-wrap gap-2.5">
                  <a className={view} href={`/api/evaluaciones/${ev.id}/informe`} target="_blank" rel="noreferrer">Ver</a>
                  <a className={download} href={`/api/evaluaciones/${ev.id}/informe?download=1`}>Descargar</a>
                </span>
              </li>
            ))}
          </ul>

          <section aria-labelledby="vista-previa" className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6">
            <h2 id="vista-previa" className="mb-3 text-[22px]">Vista previa del informe del semestre</h2>
            <iframe
              title="Vista previa del informe integrado del semestre"
              src="/api/analisis/informe"
              className="h-[70vh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-100"
            />
          </section>

          <Note>{GRADE_DISCLAIMER}</Note>
        </>
      )}
    </section>
  );
}
