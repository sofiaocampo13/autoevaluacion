import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadReviewView } from "@/lib/review";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { REVIEW_LABEL } from "@/lib/review-logic";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Revisión docente", robots: { index: false, follow: false } };

const CITE_TEXT = { verificada: "verificada en el archivo", no_verificable: "captura/PDF: no comprobable automáticamente", invalida: "descartada: no coincide con los archivos" } as const;
const CITE_BADGE = {
  verificada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  no_verificable: "bg-slate-100 text-slate-600 ring-slate-200",
  invalida: "bg-slate-100 text-slate-500 ring-slate-200 line-through",
} as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-1 text-sm font-semibold text-indigo-700">Autoevaluación académica · Revisión docente</p>
        {children}
      </div>
    </main>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h1 className="mb-2 text-xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-600">{text}</p>
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
      <h1 className="text-2xl font-semibold">{view.lab.name}</h1>
      <p className="mb-4 text-sm text-slate-500">
        Estudiante: <b>{view.student}</b> · evaluación del {new Date(e.createdAt).toLocaleDateString("es")} · escala 0 a {e.scaleMax}
      </p>

      <div className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        <p className="font-medium">Cómo leer esta evaluación</p>
        <p className="mt-1">
          La valoración la generó una inteligencia artificial y es una <b>estimación orientativa</b>, no una nota oficial. Las citas marcadas como
          «verificada» existen literalmente en el archivo; las de capturas o PDF no se pueden comprobar automáticamente, por eso puedes abrir el
          archivo desde «Ver archivo». El código entregado no se ejecutó.
        </p>
      </div>

      <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Estimación de la IA</p>
            <p className="text-4xl font-semibold text-indigo-700">{e.aiGrade} <span className="text-lg text-slate-500">/ {e.scaleMax}</span></p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Cumplimiento</p>
            <p className="text-4xl font-semibold text-slate-800">{e.aiPercent} %</p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{GRADE_DISCLAIMER}</p>
        {view.summary && <p className="mt-3 text-sm text-slate-700">{view.summary}</p>}
        {e.limitations && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><b>Limitaciones:</b> {e.limitations}</p>}
      </div>

      <div className="mb-6 space-y-3">
        <h2 className="text-lg font-medium">Valoración de la IA por criterio</h2>
        {view.criteria.map((c) => (
          <details key={c.position} className="rounded-xl bg-white ring-1 ring-slate-200" open={c.warnings.length > 0}>
            <summary className="cursor-pointer px-4 py-3">
              <span className="font-medium">{c.criterion}</span>
              <span className="ml-2 text-sm text-slate-500">peso {c.weight} % · {c.rubricLevel} · <b>{c.percent} %</b> · evidencia {c.evidence} · confianza {c.confidence}</span>
            </summary>
            <div className="space-y-3 px-4 pb-4 text-sm text-slate-700">
              <p>{c.argumentation}</p>
              {c.warnings.length > 0 && <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-7 pr-3 text-amber-900">{c.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              <div>
                <p className="mb-1 font-medium">Evidencias citadas</p>
                {c.citations.length === 0 ? (
                  <p className="text-slate-500">Ninguna.</p>
                ) : (
                  <ul className="space-y-2">
                    {c.citations.map((x, i) => (
                      <li key={i} className="rounded-lg bg-slate-50 p-2">
                        <p className="text-xs text-slate-500">
                          {x.location}
                          {x.hasFile && (
                            <>
                              {" · "}
                              <a className="text-indigo-700 hover:underline" target="_blank" rel="noopener noreferrer" href={`/revision/${token}/archivo?loc=${encodeURIComponent(x.location)}`}>Ver archivo</a>
                            </>
                          )}
                        </p>
                        <p className="whitespace-pre-wrap font-mono text-xs">{x.quote}</p>
                        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ring-1 ${CITE_BADGE[x.status as keyof typeof CITE_BADGE]}`}>{CITE_TEXT[x.status as keyof typeof CITE_TEXT]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>

      {decided ? (
        <div className="rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <h2 className="text-lg font-medium text-emerald-900">Revisión registrada</h2>
          <p className="mt-1 text-sm text-emerald-900">
            {REVIEW_LABEL[decided.decision as keyof typeof REVIEW_LABEL]} por <b>{decided.reviewer}</b> el {new Date(decided.at).toLocaleString("es")}.
            {decided.finalGrade != null && <> Nota final: <b>{decided.finalGrade} / {e.scaleMax}</b> ({decided.finalPercent} %).</>}
          </p>
          {decided.comment && <p className="mt-2 text-sm text-emerald-900">Comentario: {decided.comment}</p>}
          <p className="mt-2 text-xs text-emerald-800">Este enlace ya fue usado y no admite más cambios. Gracias por tu revisión.</p>
        </div>
      ) : (
        <ReviewForm token={token} scaleMax={e.scaleMax} aiGrade={e.aiGrade} criteria={view.criteria.map((c) => ({ position: c.position, criterion: c.criterion, weight: c.weight, percent: c.percent }))} />
      )}
    </Shell>
  );
}
