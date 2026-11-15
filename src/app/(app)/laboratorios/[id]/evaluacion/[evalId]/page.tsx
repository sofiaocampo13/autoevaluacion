import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { flagLevel, flagText } from "@/lib/run-evaluation";
import type { Flag } from "@/lib/assessment";
import type { FinalReport } from "@/lib/evaluate-summary";
import type { InventoryEntry } from "@/lib/evidence";
import type { CodeReport } from "@/lib/code-check";
import { reconcileInfographic } from "@/lib/infographic-data";
import { Tabs } from "@/components/tabs";
import { REVIEW_LABEL, STATE_LABEL, linkState } from "@/lib/review-logic";
import { ReviewLinkPanel, type LinkRow } from "./review-panel";
import { Infographic, type InfographicData } from "@/components/infographic";

type Issue = { problema: string; por_que: string; como_corregir: string };
type Citation = { location: string; quote: string; supports: string; status: "verificada" | "no_verificable" | "invalida" };

// Solo lo realmente verificado se destaca en verde; lo demás es información, no una alarma.
const CITE_BADGE: Record<Citation["status"], string> = {
  verificada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  no_verificable: "bg-slate-100 text-slate-600 ring-slate-200",
  invalida: "bg-slate-100 text-slate-500 ring-slate-200 line-through",
};
const CITE_TEXT: Record<Citation["status"], string> = {
  verificada: "verificada en el archivo",
  no_verificable: "captura/PDF: contenido no comprobable automáticamente",
  invalida: "descartada: no coincide con los archivos",
};
const EVIDENCE_TEXT = { suficiente: "Evidencia suficiente", parcial: "Evidencia parcial", inexistente: "Sin evidencia" } as const;

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-3">
      <h4 className="mb-1 text-sm font-medium text-slate-800">{title}</h4>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}
function Issues({ title, items }: { title: string; items?: Issue[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-4">
      <h4 className="mb-1 text-sm font-medium text-slate-800">{title}</h4>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-medium">{it.problema}</p>
            <p className="mt-1"><b>Por qué:</b> {it.por_que}</p>
            <p className="mt-1"><b>Cómo corregirlo:</b> {it.como_corregir}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
const card = "rounded-xl bg-white p-5 ring-1 ring-slate-200";
const flagsOf = (flags: unknown) => ((flags ?? []) as (Flag | string)[]);

export default async function EvaluationPage({ params }: { params: Promise<{ id: string; evalId: string }> }) {
  const { id, evalId } = await params;
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(evalId).success) notFound();

  const supabase = await createClient();
  const { data: ev } = await supabase.from("evaluations").select("*").eq("id", evalId).eq("lab_id", id).maybeSingle();
  if (!ev) notFound(); // también cubre evaluaciones de otro usuario (RLS)
  const [{ data: lab }, { data: results }] = await Promise.all([
    supabase.from("labs").select("name").eq("id", id).single(),
    supabase.from("criterion_results").select("*").eq("evaluation_id", evalId).order("position"),
  ]);

  const summary = ev.summary as (Omit<FinalReport, "infografia" | "retroalimentacion"> & { modelo_resumen?: string }) | null;
  const fb = ev.feedback as FinalReport["retroalimentacion"] | null;
  const info = ev.infographic as FinalReport["infografia"] | null;
  const inventory = (ev.evidence_inventory ?? []) as InventoryEntry[];
  const code = ev.test_results as CodeReport | null;
  const done = ev.status === "completada";
  const reviewed = ev.review_status === "aprobada" || ev.review_status === "ajustada";

  // Enlaces de revisión del estudiante. Se nombran las columnas: el hash del enlace no es legible ni siquiera para su dueño.
  const [{ data: linkRows }, { data: review }] = await Promise.all([
    supabase.from("review_links").select("id, created_at, expires_at, revoked_at, used_at, last_viewed_at").eq("evaluation_id", evalId).order("created_at", { ascending: false }),
    supabase.from("teacher_reviews").select("*").eq("evaluation_id", evalId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const links: LinkRow[] = (linkRows ?? []).map((l) => {
    const state = linkState(l);
    return { id: l.id, createdAt: l.created_at, expiresAt: l.expires_at, state, label: STATE_LABEL[state], lastViewedAt: l.last_viewed_at };
  });
  const adjustments = (review?.adjustments ?? []) as { criterion: string; original_percent: number; adjusted_percent: number; justification: string }[];

  const reviewTab = (
    <div className="space-y-6">
      <div className={card}>
        <h2 className="mb-1 text-lg font-medium">Estado de la revisión</h2>
        <p className="mb-3 text-sm font-medium text-slate-800">{REVIEW_LABEL[ev.review_status as keyof typeof REVIEW_LABEL]}</p>
        {review ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <b>{review.reviewer_name}</b>{review.reviewer_email ? ` (${review.reviewer_email})` : ""} · {new Date(review.created_at).toLocaleString("es")}
            </p>
            {review.final_grade != null && (
              <p>
                Nota final: <b>{review.final_grade} / {ev.grade_scale_max}</b> ({review.final_percent} %) · estimación de la IA: {ev.estimated_grade} / {ev.grade_scale_max}
              </p>
            )}
            {review.comment && <p className="rounded-lg bg-slate-50 p-3">{review.comment}</p>}
            {adjustments.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Ajustes del docente</p>
                <ul className="space-y-2">
                  {adjustments.map((a, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 p-3">
                      <p className="font-medium">{a.criterion}: {a.original_percent} % → {a.adjusted_percent} %</p>
                      <p className="text-slate-600">{a.justification}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Esta nota es una estimación de la IA y todavía no la ha visto un docente. Genera un enlace privado para que tu profesor revise las
            evidencias, ajuste lo que considere y apruebe la nota. No necesita cuenta.
          </p>
        )}
      </div>

      {done && (
        <div className={card}>
          <h2 className="mb-3 text-lg font-medium">Enlaces de revisión</h2>
          <ReviewLinkPanel evaluationId={evalId} links={links} canCreate={ev.review_status === "preliminar" || ev.review_status === "devuelta"} />
        </div>
      )}
    </div>
  );

  const infographicData: InfographicData = {
    labName: lab?.name ?? "Laboratorio",
    date: new Date(ev.completed_at ?? ev.created_at).toLocaleDateString("es"),
    grade: ev.estimated_grade != null ? Number(ev.estimated_grade) : null,
    scaleMax: Number(ev.grade_scale_max),
    percent: ev.overall_percent != null ? Number(ev.overall_percent) : null,
    objectives: summary?.objetivos_identificados ?? [],
    title: info?.titulo ?? "",
    // Coherencia con la retroalimentación: lo que allí se pide reforzar se ve como "requiere refuerzo" aquí.
    categories: reconcileInfographic(info, fb?.conceptos_a_reforzar).categorias,
    criteria: (results ?? []).map((r) => ({ name: r.criterion, percent: Number(r.percent), weight: Number(r.weight) })),
    disclaimer: GRADE_DISCLAIMER,
  };

  const generalTab = summary ? (
    <div className={card}>
      <h2 className="mb-3 text-lg font-medium">Valoración general</h2>
      <p className="mb-3 text-sm text-slate-700">{summary.resumen}</p>
      <List title="Objetivos identificados" items={summary.objetivos_identificados} />
      <p className="mb-1 text-sm"><b>Calidad del desarrollo:</b> {summary.calidad_desarrollo}</p>
      <p className="mb-3 text-sm"><b>Coherencia de los resultados:</b> {summary.coherencia_resultados}</p>
      <List title="Conceptos demostrados" items={summary.conceptos_demostrados} />
      <List title="Procedimientos realizados" items={summary.procedimientos_realizados} />
      <List title="Fortalezas" items={summary.fortalezas} />
      <List title="Debilidades" items={summary.debilidades} />
    </div>
  ) : (
    <p className="text-sm text-slate-500">La valoración general estará disponible cuando la evaluación se complete.</p>
  );

  const feedbackTab = fb ? (
    <div className={card}>
      <h2 className="mb-3 text-lg font-medium">Retroalimentación</h2>
      <Issues title="Errores conceptuales" items={fb.errores_conceptuales} />
      <Issues title="Errores técnicos" items={fb.errores_tecnicos} />
      <Issues title="Procedimientos incorrectos" items={fb.procedimientos_incorrectos} />
      <Issues title="Aspectos incompletos" items={fb.aspectos_incompletos} />
      <List title="Criterios no cumplidos" items={fb.criterios_no_cumplidos} />
      <List title="Conceptos que requieren refuerzo" items={fb.conceptos_a_reforzar} />
      <List title="Recomendaciones" items={fb.recomendaciones} />
      {fb.errores_conceptuales.length + fb.errores_tecnicos.length + fb.procedimientos_incorrectos.length + fb.aspectos_incompletos.length === 0 && (
        <p className="text-sm text-slate-500">No se identificaron errores ni aspectos incompletos concretos.</p>
      )}
    </div>
  ) : (
    <p className="text-sm text-slate-500">La retroalimentación estará disponible cuando la evaluación se complete.</p>
  );

  const infographicTab = done ? <Infographic data={infographicData} /> : <p className="text-sm text-slate-500">La infografía estará disponible cuando la evaluación se complete.</p>;

  const criteriaTab = (
    <div className={card}>
      <h2 className="mb-3 text-lg font-medium">Resultado por criterio</h2>
      <div className="space-y-4">
        {(results ?? []).map((r) => {
          const warnings = flagsOf(r.flags).filter((f) => flagLevel(f) === "aviso");
          const notes = flagsOf(r.flags).filter((f) => flagLevel(f) === "nota");
          return (
            <details key={r.id} className="rounded-lg ring-1 ring-slate-200" open={warnings.length > 0}>
              <summary className="cursor-pointer px-4 py-3">
                <span className="font-medium">{r.criterion}</span>
                <span className="ml-2 text-sm text-slate-500">
                  peso {r.weight} % · {r.rubric_level} · <b>{r.percent} %</b> · {EVIDENCE_TEXT[r.evidence_level as keyof typeof EVIDENCE_TEXT]} · confianza {r.confidence}
                </span>
              </summary>
              <div className="space-y-3 px-4 pb-4 text-sm text-slate-700">
                <p>{r.argumentation}</p>
                {r.recommendation && <p><b>Recomendación:</b> {r.recommendation}</p>}
                {warnings.length > 0 && (
                  <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-7 pr-3 text-amber-900">
                    {warnings.map((f, i) => <li key={i}>{flagText(f)}</li>)}
                  </ul>
                )}
                <div>
                  <p className="mb-1 font-medium">Evidencias citadas</p>
                  {(r.citations as Citation[]).length === 0 ? (
                    <p className="text-slate-500">Ninguna.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(r.citations as Citation[]).map((c, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-2">
                          <p className="text-xs text-slate-500">{c.location}</p>
                          <p className="whitespace-pre-wrap font-mono text-xs">{c.quote}</p>
                          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ring-1 ${CITE_BADGE[c.status]}`}>{CITE_TEXT[c.status]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {notes.map((f, i) => <p key={i} className="text-xs text-slate-500">ℹ {flagText(f)}</p>)}
                {r.limitations && <p className="text-xs text-slate-500"><b>Limitaciones:</b> {r.limitations}</p>}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );

  const technicalTab = (
    <div className="space-y-6">
      {code ? (
        <div className={card}>
          <h2 className="mb-1 text-lg font-medium">Verificación técnica del código</h2>
          <p className="mb-3 text-xs text-slate-500">Hecha por herramientas ({code.analyzers.join(", ") || "sin analizadores"}), no por IA. El código no se ejecutó.</p>
          <dl className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {[
              ["Archivos analizados", code.summary.analyzed],
              ["Con errores", code.summary.withErrors],
              ["Errores", code.summary.errors],
              ["Avisos", code.summary.warnings],
              ["No analizados", code.summary.skipped],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg bg-slate-50 p-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-lg font-semibold text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-3 text-sm text-slate-700">
            <b>Pruebas unitarias:</b>{" "}
            {code.tests.files.length
              ? `se detectaron ${code.tests.files.length} archivo(s) de pruebas (${code.tests.frameworks.join(", ")}); no se ejecutaron.`
              : "no se detectaron archivos de pruebas."}
          </p>
          {code.files.filter((f) => f.status === "con_errores" || f.status === "con_avisos").length === 0 ? (
            <p className="mb-3 text-sm text-emerald-700">Ningún archivo analizado presentó errores ni avisos relevantes.</p>
          ) : (
            <ul className="mb-3 space-y-2 text-sm">
              {code.files.filter((f) => f.status === "con_errores" || f.status === "con_avisos").map((f) => (
                <li key={f.location} className="rounded-lg bg-slate-50 p-3">
                  <p className="font-medium text-slate-800">
                    {f.location} <span className={f.status === "con_errores" ? "text-red-700" : "text-amber-700"}>· {f.status === "con_errores" ? "con errores" : "con avisos"}</span>
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                    {f.diagnostics.filter((d) => d.severity !== "info").map((d, i) => (
                      <li key={i}>línea {d.line} · {d.code}: {d.message}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <details className="mb-3 text-xs text-slate-600">
            <summary className="cursor-pointer">Ver todos los archivos revisados ({code.files.length})</summary>
            <ul className="mt-2 max-h-56 overflow-auto">
              {code.files.map((f) => (
                <li key={f.location}>
                  {f.status === "no_analizado" ? "—" : f.status === "ok" ? "✓" : "✗"} {f.location} · {f.language} · {f.lines} líneas
                  {f.note ? ` · ${f.note}` : f.totalDiagnostics ? ` · ${f.totalDiagnostics} observación(es)` : ""}
                </li>
              ))}
            </ul>
          </details>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">
            {code.limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No hubo código analizable en esta evaluación.</p>
      )}

      <div className={card}>
        <h2 className="mb-3 text-lg font-medium">Trazabilidad</h2>
        <dl className="grid gap-1 text-sm text-slate-700 sm:grid-cols-[180px_1fr]">
          <dt className="text-slate-500">Proveedor y modelo</dt><dd>{ev.ai_provider} · {ev.ai_model}</dd>
          <dt className="text-slate-500">Versión de los prompts</dt><dd>{ev.prompt_version}</dd>
          <dt className="text-slate-500">Rúbrica usada</dt><dd>versión {ev.rubric_version} (copia exacta guardada en la evaluación)</dd>
          <dt className="text-slate-500">Archivos analizados</dt><dd>{inventory.filter((i) => i.mode === "text" || i.mode === "native").length} de {inventory.length}</dd>
        </dl>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-indigo-700">Ver inventario de archivos</summary>
          <ul className="mt-2 max-h-64 overflow-auto text-xs text-slate-600">
            {inventory.map((i, n) => (
              <li key={n}>{i.mode === "omitido" || i.mode === "unsupported" ? "✗" : "✓"} {i.location} · {i.mode}{i.note ? ` · ${i.note}` : ""}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );

  return (
    <section className="max-w-4xl">
      <p className="mb-1 text-sm"><Link className="text-indigo-700 hover:underline" href={`/laboratorios/${id}`}>← {lab?.name}</Link></p>
      <h1 className="mb-1 text-2xl font-semibold">Evaluación del laboratorio</h1>
      <p className="mb-4 text-sm text-slate-500">
        {new Date(ev.created_at).toLocaleString("es")} · rúbrica v{ev.rubric_version} · escala 0 a {ev.grade_scale_max}
      </p>

      {!done && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {ev.status === "procesando"
            ? "Esta evaluación todavía está en curso. Vuelve al laboratorio y pulsa «Retomar evaluación»."
            : `Esta evaluación no se completó. ${ev.error ?? ""}`}
        </p>
      )}

      {done && (
        <div className={`${card} mb-4`}>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{reviewed ? "Nota final (revisada por docente)" : "Calificación orientativa"}</p>
              <p className="text-4xl font-semibold text-indigo-700">
                {reviewed ? ev.final_grade : ev.estimated_grade} <span className="text-lg text-slate-500">/ {ev.grade_scale_max}</span>
              </p>
              {reviewed && <p className="text-xs text-slate-500">Estimación de la IA: {ev.estimated_grade} / {ev.grade_scale_max}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Cumplimiento global</p>
              <p className="text-4xl font-semibold text-slate-800">{reviewed ? ev.final_percent : ev.overall_percent} %</p>
              {reviewed && <p className="text-xs text-slate-500">IA: {ev.overall_percent} %</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={`/api/evaluaciones/${evalId}/informe`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Ver informe PDF
            </a>
            <a
              href={`/api/evaluaciones/${evalId}/informe?download=1`}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Descargar informe PDF
            </a>
          </div>
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{GRADE_DISCLAIMER}</p>
          {reviewed ? (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
              <p className="font-medium">
                {REVIEW_LABEL[ev.review_status as keyof typeof REVIEW_LABEL]}: nota final {ev.final_grade} / {ev.grade_scale_max} ({ev.final_percent} %)
              </p>
              <p className="text-xs">Revisó {ev.reviewer_name} el {ev.reviewed_at ? new Date(ev.reviewed_at).toLocaleDateString("es") : ""}. La estimación de la IA era {ev.estimated_grade} / {ev.grade_scale_max}.</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              {ev.review_status === "devuelta"
                ? "El docente devolvió esta evaluación con comentarios (ver la pestaña «Revisión docente»)."
                : "Nota preliminar: aún no ha sido revisada por un docente. Puedes pedir una revisión en la pestaña «Revisión docente»."}{" "}
              Calculada por el sistema con los pesos de la rúbrica.
            </p>
          )}
        </div>
      )}

      {ev.limitations && (
        <div className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="mb-1 font-medium">Limitaciones del análisis</p>
          <p>{ev.limitations}</p>
        </div>
      )}

      <Tabs
        tabs={[
          { id: "general", label: "Valoración general", content: generalTab },
          { id: "retro", label: "Retroalimentación", content: feedbackTab },
          { id: "infografia", label: "Infografía temática", content: infographicTab },
          { id: "criterios", label: "Detalle por criterio", content: criteriaTab },
          { id: "revision", label: "Revisión docente", content: reviewTab },
          { id: "tecnica", label: "Verificación y trazabilidad", content: technicalTab },
        ]}
      />
    </section>
  );
}
