import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadReviewView } from "@/lib/review";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { REVIEW_LABEL } from "@/lib/review-logic";
import { Note } from "@/components/ui";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Revisión docente", robots: { index: false, follow: false } };

const CITE_TEXT = { verificada: "verificada en el archivo", no_verificable: "captura/PDF: no comprobable automáticamente", invalida: "descartada: no coincide con los archivos" } as const;
const CITE_BADGE = {
  verificada: "bg-blue-50 text-blue-800 border-blue-200",
  no_verificable: "bg-slate-100 text-slate-700 border-slate-200",
  invalida: "bg-slate-100 text-slate-600 border-slate-200 line-through",
} as const;

/** Página propia y pública: cabecera con la marca, sin el shell de la app. */
function Shell({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-900 px-4 py-3.5 text-brand-50 sm:px-8 lg:px-12">
        <span className="font-display text-[22px] font-semibold">Asesor pedagógico</span>
        <span className="text-[13px] text-slate-300">Autoevaluación académica · Revisión docente</span>
      </header>
      <main className={`mx-auto flex w-full flex-col gap-[22px] px-4 pb-10 pt-8 sm:px-8 ${narrow ? "max-w-[720px]" : "max-w-[960px]"}`}>{children}</main>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <Shell narrow>
      <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-6 sm:p-9">
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-2xl text-pink-700">⊘</span>
        <h1 className="font-display text-[34px] leading-tight tracking-tight">{title}</h1>
        <p className="text-[15px] leading-relaxed text-slate-600">{text}</p>
      </div>
    </Shell>
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadReviewView(createAdminClient(), token);

  // Para un enlace inexistente, mal formado o ajeno la respuesta es idéntica: no revela nada.
  if (!view) return <Message title="Enlace no disponible" text="Este enlace no existe o ya no es válido. Pide al estudiante que genere uno nuevo." />;
  if (view.state === "revocado") return <Message title="Enlace revocado" text="El estudiante revocó este enlace. Pídele uno nuevo si necesitas revisar la evaluación." />;
  if (view.state === "expirado") return <Message title="Enlace expirado" text="Este enlace ya venció. Pide al estudiante que genere uno nuevo." />;

  const e = view.evaluation;
  const decided = view.decided;

  return (
    <Shell>
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-[32px] leading-tight tracking-tight sm:text-[40px]">{view.lab.name}</h1>
        <p className="text-sm text-slate-600">
          Estudiante: <strong className="text-slate-800">{view.student}</strong> · evaluación del {new Date(e.createdAt).toLocaleDateString("es")} · escala 0 a {e.scaleMax}
        </p>
      </header>

      <section className="rounded-[20px] bg-aviso-bg px-5 py-4 text-sm leading-relaxed text-aviso-text">
        <p className="mb-1 font-extrabold">Cómo leer esta evaluación</p>
        <p>
          La valoración la generó una inteligencia artificial y es una <strong>estimación orientativa</strong>, no una nota oficial. Las citas marcadas como
          «verificada» existen literalmente en el archivo; las de capturas o PDF no se pueden comprobar automáticamente, por eso puedes abrir el
          archivo desde «Ver archivo». El código entregado no se ejecutó.
        </p>
      </section>

      <section className="flex flex-col gap-3.5 rounded-3xl border border-slate-200 bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">Estimación de la IA</span>
            <span className="font-display text-5xl leading-[1.05] text-brand-600">{e.aiGrade} <span className="text-xl text-slate-600">/ {e.scaleMax}</span></span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">Cumplimiento</span>
            <span className="font-display text-5xl leading-[1.05]">{e.aiPercent} %</span>
          </div>
        </div>
        <Note>{GRADE_DISCLAIMER}</Note>
        {view.summary && <p className="text-sm leading-relaxed text-slate-700">{view.summary}</p>}
        {e.limitations && <p className="rounded-xl bg-aviso-bg px-3.5 py-2.5 text-[13px] leading-normal text-aviso-text"><strong>Limitaciones:</strong> {e.limitations}</p>}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-[26px]">Valoración de la IA por criterio</h2>
        {view.criteria.map((c) => (
          <details key={c.position} className="rounded-[20px] border border-slate-200 bg-white" open={c.warnings.length > 0}>
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[20px] px-5 py-4 focus-visible:outline-2 focus-visible:outline-brand-600">
              <span className="text-[15px] font-extrabold">{c.criterion}</span>
              <span className="text-[13px] text-slate-600">peso {c.weight} % · {c.rubricLevel} · <strong className="text-slate-800">{c.percent} %</strong> · evidencia {c.evidence} · confianza {c.confidence}</span>
            </summary>
            <div className="flex flex-col gap-3 px-5 pb-[18px] text-sm leading-relaxed text-slate-700">
              <p>{c.argumentation}</p>
              {c.warnings.length > 0 && <ul className="list-disc rounded-xl bg-aviso-bg py-2.5 pl-8 pr-3.5 text-aviso-text">{c.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              <p className="text-[13px] font-extrabold text-slate-800">Evidencias citadas</p>
              {c.citations.length === 0 ? (
                <p className="text-slate-600">Ninguna.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {c.citations.map((x, i) => (
                    <li key={i} className="flex flex-col gap-1.5 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-xs text-slate-600">
                        {x.location}
                        {x.hasFile && (
                          <>
                            {" · "}
                            <a className="inline-flex min-h-6 items-center font-bold text-brand-600 underline hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600" target="_blank" rel="noopener noreferrer" href={`/revision/${token}/archivo?loc=${encodeURIComponent(x.location)}`}>Ver archivo</a>
                          </>
                        )}
                      </p>
                      <p className={`whitespace-pre-wrap break-words font-mono text-[12.5px] leading-normal ${x.status === "invalida" ? "text-slate-600 line-through" : "text-slate-800"}`}>{x.quote}</p>
                      <span className={`w-fit rounded-lg border px-2 py-0.5 text-xs font-bold ${CITE_BADGE[x.status as keyof typeof CITE_BADGE]}`}>{CITE_TEXT[x.status as keyof typeof CITE_TEXT]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </section>

      {decided ? (
        <section className="flex flex-col gap-2 rounded-3xl bg-blue-50 px-6 py-6 text-blue-900">
          <h2 className="font-display text-[26px]">Revisión registrada</h2>
          <p className="text-[15px] leading-relaxed">
            {REVIEW_LABEL[decided.decision as keyof typeof REVIEW_LABEL]} por <strong>{decided.reviewer}</strong> el {new Date(decided.at).toLocaleString("es")}.
            {decided.finalGrade != null && <> Nota final: <strong>{decided.finalGrade} / {e.scaleMax}</strong> ({decided.finalPercent} %).</>}
          </p>
          {decided.finalGrade != null && <Note>{GRADE_DISCLAIMER}</Note>}
          {decided.comment && <p className="text-[15px]">Comentario: {decided.comment}</p>}
          <p className="text-[13px]">Este enlace ya fue usado y no admite más cambios. Gracias por tu revisión.</p>
        </section>
      ) : (
        <ReviewForm token={token} scaleMax={e.scaleMax} aiGrade={e.aiGrade} criteria={view.criteria.map((c) => ({ position: c.position, criterion: c.criterion, weight: c.weight, percent: c.percent }))} />
      )}
    </Shell>
  );
}
