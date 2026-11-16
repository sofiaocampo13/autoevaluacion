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
import { PrismaTabs } from "@/components/prisma-tabs";
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
      <h4 className="mb-1 text-sm font-bold text-slate-800">{title}</h4>
      <ul className="list-disc space-y-0.5 pl-5 text-sm leading-relaxed text-slate-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

// Tarjeta de retroalimentación: etiqueta de tipo, problema en tipografía de títulos y recuadro «Cómo corregirlo».
const ISSUE_TAG = {
  conceptual: { label: "Error conceptual", cls: "bg-pink-50 text-pink-800" },
  tecnico: { label: "Error técnico", cls: "bg-pink-50 text-pink-800" },
  procedimiento: { label: "Procedimiento incorrecto", cls: "bg-pink-50 text-pink-800" },
  incompleto: { label: "Aspecto incompleto", cls: "bg-brand-50 text-brand-800" },
} as const;
function IssueCard({ kind, it }: { kind: keyof typeof ISSUE_TAG; it: Issue }) {
  return (
    <li className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5">
      <span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${ISSUE_TAG[kind].cls}`}>{ISSUE_TAG[kind].label}</span>
      <h3 className="text-[22px] leading-tight text-slate-900">{it.problema}</h3>
      <p className="text-sm leading-relaxed text-slate-700"><b>Por qué:</b> {it.por_que}</p>
      <p className="rounded-2xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-800"><b className="text-brand-800">Cómo corregirlo:</b> {it.como_corregir}</p>
    </li>
  );
}
const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6";
const pill = "flex min-h-11 flex-1 basis-36 items-center justify-center rounded-full px-5 text-center text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";
const fmt = (n: number | string | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("es", { maximumFractionDigits: 2 }));
const flagsOf = (flags: unknown) => ((flags ?? []) as (Flag | string)[]);

export default async function EvaluationPage({ params }: { params: Promise<{ id: string; evalId: string }> }) {
  const { id, evalId } = await params;
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(evalId).success) notFound();

  const supabase = await createClient();
  const { data: ev } = await supabase.from("evaluations").select("*").eq("id", evalId).eq("lab_id", id).maybeSingle();
  if (!ev) notFound(); // también cubre evaluaciones de otro usuario (RLS)
  const [{ data: lab }, { data: results }] = await Promise.all([
    supabase.from("labs").select("name, description").eq("id", id).single(),
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

  const reviewedPercent = reviewed ? ev.final_percent : ev.overall_percent;
  const points = (results ?? []).map((r) => (Number(r.weight) * Number(r.percent)) / 100);
  const totalPoints = points.reduce((a, b) => a + b, 0);

  const generalTab = summary ? (
    <div className="flex flex-col gap-5">
      <div className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[26px]">Cumplimiento por criterio de la rúbrica</h2>
          <span className="text-xs text-slate-600">Ponderado según la rúbrica, no promedio simple</span>
        </div>
        {(results ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">Esta evaluación no tiene criterios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left text-xs text-slate-600">
                  {["Criterio", "Peso", "Cumplimiento", "Aporte", "Evidencia", "Ubicación"].map((h) => <th key={h} scope="col" className="px-2 py-2.5 font-bold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(results ?? []).map((r, i) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="max-w-[320px] px-2 py-3.5">
                      <span className="font-extrabold text-slate-900">{r.criterion}</span>
                      {r.argumentation && <span className="mt-1 line-clamp-2 block leading-snug text-slate-600">{r.argumentation}</span>}
                    </td>
                    <td className="px-2 py-3.5 font-bold">{fmt(r.weight)} %</td>
                    <td className="px-2 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, Number(r.percent)))}%` }} />
                        </div>
                        <span className="font-extrabold">{fmt(r.percent)} %</span>
                      </div>
                    </td>
                    <td className="px-2 py-3.5 font-bold text-brand-800">{points[i].toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts</td>
                    <td className="px-2 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                          r.evidence_level === "suficiente"
                            ? "bg-blue-600 text-white"
                            : r.evidence_level === "parcial"
                              ? "bg-[#D9CCFB] text-[#2B1767]"
                              : "border-[1.5px] border-dashed border-[#9B90B2] text-slate-700"
                        }`}
                      >
                        {EVIDENCE_TEXT[r.evidence_level as keyof typeof EVIDENCE_TEXT]}
                      </span>
                    </td>
                    <td className="px-2 py-3.5 text-slate-600">{r.evidence_location ?? "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-800 font-extrabold">
                  <td className="px-2 py-3.5">Total ponderado</td>
                  <td className="px-2 py-3.5">{fmt((results ?? []).reduce((a, r) => a + Number(r.weight), 0))} %</td>
                  <td className="px-2 py-3.5">{fmt(ev.overall_percent)} %</td>
                  <td className="px-2 py-3.5 text-brand-800">{fmt(ev.estimated_grade)} / {fmt(ev.grade_scale_max)}</td>
                  <td colSpan={2} className="px-2 py-3.5 text-xs font-normal text-slate-600">{totalPoints.toLocaleString("es", { maximumFractionDigits: 2 })} de 100 pts · estimación de la IA</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={card}>
        <h2 className="mb-3 text-[22px]">Valoración general</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">{summary.resumen}</p>
        <List title="Objetivos identificados" items={summary.objetivos_identificados} />
        <p className="mb-1 text-sm"><b>Calidad del desarrollo:</b> {summary.calidad_desarrollo}</p>
        <p className="mb-3 text-sm"><b>Coherencia de los resultados:</b> {summary.coherencia_resultados}</p>
        <List title="Procedimientos realizados" items={summary.procedimientos_realizados} />
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        {(summary.conceptos_demostrados?.length > 0 || summary.fortalezas?.length > 0) && (
          <div className="flex flex-col gap-2 rounded-[20px] bg-blue-50 p-5 text-slate-800">
            <h3 className="text-lg text-blue-800">Qué demuestra el trabajo</h3>
            <List title="Conceptos demostrados" items={summary.conceptos_demostrados} />
            <List title="Fortalezas" items={summary.fortalezas} />
          </div>
        )}
        {summary.debilidades?.length > 0 && (
          <div className="flex flex-col gap-2 rounded-[20px] bg-pink-50 p-5 text-slate-800">
            <h3 className="text-lg text-pink-800">Qué falta desarrollar</h3>
            <List title="Debilidades" items={summary.debilidades} />
          </div>
        )}
        {ev.limitations && (
          <div className="flex flex-col gap-2 rounded-[20px] border border-dashed border-[#D9CFEA] bg-white p-5">
            <h3 className="text-lg text-slate-800">Limitaciones del análisis</h3>
            <p className="text-sm leading-relaxed text-slate-700">{ev.limitations}</p>
          </div>
        )}
      </div>
    </div>
  ) : (
    <p className="text-sm text-slate-600">La valoración general estará disponible cuando la evaluación se complete.</p>
  );

  const noIssues = fb && fb.errores_conceptuales.length + fb.errores_tecnicos.length + fb.procedimientos_incorrectos.length + fb.aspectos_incompletos.length === 0;
  const feedbackTab = fb ? (
    <div className="flex flex-col gap-5">
      <ul className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {fb.errores_conceptuales.map((it, i) => <IssueCard key={`c${i}`} kind="conceptual" it={it} />)}
        {fb.errores_tecnicos.map((it, i) => <IssueCard key={`t${i}`} kind="tecnico" it={it} />)}
        {fb.procedimientos_incorrectos.map((it, i) => <IssueCard key={`p${i}`} kind="procedimiento" it={it} />)}
        {fb.aspectos_incompletos.map((it, i) => <IssueCard key={`a${i}`} kind="incompleto" it={it} />)}
      </ul>
      {noIssues && <p className="text-sm text-slate-600">No se identificaron errores ni aspectos incompletos concretos.</p>}
      {(fb.criterios_no_cumplidos.length > 0 || fb.conceptos_a_reforzar.length > 0 || fb.recomendaciones.length > 0) && (
        <div className={card}>
          <List title="Criterios no cumplidos" items={fb.criterios_no_cumplidos} />
          <List title="Conceptos que requieren refuerzo" items={fb.conceptos_a_reforzar} />
          <List title="Recomendaciones" items={fb.recomendaciones} />
        </div>
      )}
    </div>
  ) : (
    <p className="text-sm text-slate-600">La retroalimentación estará disponible cuando la evaluación se complete.</p>
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
          <summary className="cursor-pointer text-sm text-brand-700">Ver inventario de archivos</summary>
          <ul className="mt-2 max-h-64 overflow-auto text-xs text-slate-600">
            {inventory.map((i, n) => (
              <li key={n}>{i.mode === "omitido" || i.mode === "unsupported" ? "✗" : "✓"} {i.location} · {i.mode}{i.note ? ` · ${i.note}` : ""}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );

  const pct = Math.min(100, Math.max(0, Number(reviewedPercent ?? 0)));
  const labDate = new Date(ev.completed_at ?? ev.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-800" href={`/laboratorios/${id}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          {lab?.name ?? "Laboratorio"}
        </Link>
        <span className="text-[13px] text-slate-600">Rúbrica v{ev.rubric_version} · escala 0 a {fmt(ev.grade_scale_max)}</span>
      </div>

      {!done && (
        <p className="rounded-2xl bg-aviso-bg px-4 py-3 text-sm text-aviso-text">
          {ev.status === "procesando"
            ? "Esta evaluación todavía está en curso. Vuelve al laboratorio y pulsa «Retomar evaluación»."
            : `Esta evaluación no se completó. ${ev.error ?? ""}`}
        </p>
      )}

      <section className="flex flex-wrap gap-5">
        <div className={`${card} flex min-w-0 flex-[3_1_320px] flex-col gap-4 sm:px-7`}>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">Evaluado el {labDate}</span>
          </div>
          <h1 className="text-[34px] leading-[1.08] tracking-tight sm:text-[42px]">{lab?.name ?? "Evaluación del laboratorio"}</h1>
          {lab?.description && <p className="max-w-[70ch] text-[15px] leading-relaxed text-slate-700">{lab.description}</p>}
          <p className="text-[13px] text-slate-600">Creada el {new Date(ev.created_at).toLocaleString("es")}</p>
        </div>

        {done && (
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-[#F4EEFF] sm:px-7">
            <h2 className="text-lg text-white">{reviewed ? "Nota final (revisada por docente)" : "Resultado orientativo"}</h2>
            <div className="flex items-center gap-5">
              <div
                role="img"
                aria-label={`Cumplimiento global ${fmt(reviewedPercent)} por ciento`}
                className="flex h-[132px] w-[132px] flex-none items-center justify-center rounded-full"
                style={{ background: `conic-gradient(#F49AC1 0deg, #B9A2FF ${pct * 1.8}deg, #8FB0FF ${pct * 3.6}deg, #3A2D56 ${pct * 3.6}deg)` }}
              >
                <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-slate-900">
                  <span className="font-display text-4xl leading-none">{fmt(reviewedPercent)}%</span>
                  <span className="text-[11px] text-[#C9BEE0]">cumplimiento</span>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[13px] text-[#C9BEE0]">{reviewed ? "Nota final" : "Nota orientativa"}</span>
                <span className="font-display text-5xl leading-none">{fmt(reviewed ? ev.final_grade : ev.estimated_grade)}<span className="text-xl text-[#C9BEE0]"> / {fmt(ev.grade_scale_max)}</span></span>
                {reviewed && <span className="text-xs text-[#C9BEE0]">Estimación de la IA: {fmt(ev.estimated_grade)} / {fmt(ev.grade_scale_max)} ({fmt(ev.overall_percent)} %)</span>}
              </div>
            </div>
            <p className="border-t border-[#3A2D56] pt-3.5 text-xs leading-relaxed text-[#DCD3EE]">{GRADE_DISCLAIMER}</p>
            {reviewed ? (
              <p className="text-xs leading-relaxed text-[#DCD3EE]">
                <b>{REVIEW_LABEL[ev.review_status as keyof typeof REVIEW_LABEL]}.</b> Revisó {ev.reviewer_name}
                {ev.reviewed_at ? ` el ${new Date(ev.reviewed_at).toLocaleDateString("es")}` : ""}.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-[#DCD3EE]">
                {ev.review_status === "devuelta"
                  ? "El docente devolvió esta evaluación con comentarios (ver la pestaña «Revisión docente»)."
                  : "Nota preliminar: aún no ha sido revisada por un docente. Puedes pedir una revisión en la pestaña «Revisión docente»."}{" "}
                Calculada por el sistema con los pesos de la rúbrica.
              </p>
            )}
            <div className="mt-auto flex flex-wrap gap-2.5">
              <a
                href={`/api/evaluaciones/${evalId}/informe`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${pill} bg-pink-300 font-extrabold text-slate-900 hover:bg-pink-200 focus-visible:ring-pink-300`}
              >
                Ver informe PDF
              </a>
              <a
                href={`/api/evaluaciones/${evalId}/informe?download=1`}
                className={`${pill} border-[1.5px] border-[#8FB0FF] font-bold text-white hover:bg-white/10 focus-visible:ring-[#8FB0FF]`}
              >
                Descargar informe PDF
              </a>
            </div>
          </div>
        )}
      </section>

      <PrismaTabs
        label="Resultados del laboratorio"
        tabs={[
          { id: "general", label: "Valoración general", content: generalTab },
          { id: "retro", label: "Retroalimentación", content: feedbackTab },
          { id: "infografia", label: "Infografía temática", content: infographicTab },
          { id: "criterios", label: "Detalle por criterio", content: criteriaTab },
          { id: "revision", label: "Revisión docente", content: reviewTab },
          { id: "tecnica", label: "Verificación y trazabilidad", content: technicalTab },
        ]}
      />
    </div>
  );
}
