import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSemesterStats } from "@/lib/semester-data";
import { latestAnalysis, signatureOf } from "@/lib/run-semester";
import { BAND_LABEL, type MasteryBand } from "@/lib/semester-stats";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { SemesterInfographic } from "@/components/semester-infographic";
import { AnalyzeButton } from "./analyze-button";

const card = "rounded-xl bg-white p-5 ring-1 ring-slate-200";
const BAND_COLOR: Record<MasteryBand, string> = { dominio: "bg-emerald-500", competente: "bg-indigo-500", en_desarrollo: "bg-amber-500", inicial: "bg-red-500" };
const PRIORITY: Record<string, string> = { alta: "bg-red-50 text-red-700 ring-red-200", media: "bg-amber-50 text-amber-800 ring-amber-200", baja: "bg-slate-100 text-slate-700 ring-slate-200" };
const delta = (d: number | null) => (d == null ? "—" : `${d > 0 ? "+" : ""}${d} pts`);

export default async function AnalysisPage() {
  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("*").order("created_at").limit(1).maybeSingle();
  if (!subject)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Análisis del semestre</h1>
        <p className="mt-2 text-slate-600">Primero registra tu asignatura en el <Link className="text-indigo-700 underline" href="/">panel</Link>.</p>
      </section>
    );

  const stats = await loadSemesterStats(supabase, subject.id, Number(subject.grade_scale_max));
  const saved = await latestAnalysis(supabase, subject.id);
  const current = saved != null && saved.signature === signatureOf(stats);
  const a = saved?.analysis;
  const max = subject.grade_scale_max;

  return (
    <section className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Análisis del semestre</h1>
        <p className="text-slate-500">{subject.name} · {subject.academic_period || "Sin periodo"}</p>
      </div>

      {stats.labsEvaluated === 0 ? (
        <div className={card}>
          <p className="text-slate-700">Todavía no hay laboratorios evaluados. Evalúa al menos uno en <Link className="text-indigo-700 underline" href="/laboratorios">Mis laboratorios</Link> y vuelve aquí.</p>
        </div>
      ) : (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Promedio orientativo</p>
                <p className="text-4xl font-semibold text-indigo-700">{stats.averageGrade} <span className="text-lg text-slate-500">/ {max}</span></p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Cumplimiento</p>
                <p className="text-4xl font-semibold text-slate-800">{stats.averagePercent} %</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Evaluados</p>
                <p className="text-4xl font-semibold text-slate-800">{stats.labsEvaluated}<span className="text-lg text-slate-500"> de {stats.labsTotal}</span></p>
              </div>
              {stats.trend && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Primero → último</p>
                  <p className="text-2xl font-semibold text-slate-800">{stats.trend.first} % → {stats.trend.last} %</p>
                </div>
              )}
            </div>
            {stats.labsEvaluated < 3 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Solo hay {stats.labsEvaluated} laboratorio(s) evaluado(s). Con tan pocos datos, las tendencias y los patrones todavía no son concluyentes.
              </p>
            )}
            <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{GRADE_DISCLAIMER} Los números de esta página los calcula el sistema; la IA solo redacta sobre ellos.</p>
          </div>

          <div className={card}>
            <h2 className="mb-1 text-lg font-medium">{stats.competencies.every((c) => c.derived) ? "Criterios de la rúbrica (de menor a mayor)" : "Competencias (de menor a mayor)"}</h2>
            {stats.competencies.some((c) => c.derived) && (
              <p className="mb-3 text-xs text-slate-500">Tu rúbrica no define competencias, así que se muestran los criterios tal como aparecen en ella.</p>
            )}
            <ul className="space-y-3">
              {stats.competencies.map((c) => (
                <li key={c.competency} className="text-sm">
                  <div className="mb-1 flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-slate-800">{c.competency}</span>
                    <span className="text-slate-600">
                      {c.percent} % · {BAND_LABEL[c.band]} · {c.labs} lab. · cambio {delta(c.delta)}
                      {c.weakEvidence > 0 ? ` · ${c.weakEvidence} criterio(s) con evidencia incompleta` : ""}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${BAND_COLOR[c.band]}`} style={{ width: `${Math.min(100, c.percent)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Niveles propios de la plataforma (85 % dominio alto, 70 % competente, 50 % en desarrollo) para resumir; no son los de la rúbrica de tu docente.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className={card}>
              <h2 className="mb-3 text-lg font-medium">Por corte</h2>
              <ul className="space-y-1 text-sm text-slate-700">
                {stats.byCut.map((c) => (
                  <li key={String(c.cut)} className="flex justify-between"><span>{c.cut ? `Corte ${c.cut}` : "Sin corte"} ({c.labs} lab.)</span><b>{c.averagePercent} %</b></li>
                ))}
              </ul>
            </div>
            <div className={card}>
              <h2 className="mb-3 text-lg font-medium">Criterios más bajos</h2>
              {stats.gaps.length === 0 ? (
                <p className="text-sm text-slate-600">Ningún criterio bajo el 85 % ni con evidencia incompleta.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {stats.gaps.map((g, i) => (
                    <li key={i}><b>{g.percent} %</b> · {g.criterion} <span className="text-slate-500">({g.lab}{g.evidence !== "suficiente" ? ` · evidencia ${g.evidence}` : ""})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {stats.concepts.some((c) => c.current === "refuerzo") && (
            <div className={card}>
              <h2 className="mb-3 text-lg font-medium">Conceptos por reforzar</h2>
              <ul className="flex flex-wrap gap-2 text-sm">
                {stats.concepts.filter((c) => c.current === "refuerzo").map((c) => (
                  <li key={c.name} className={`rounded-full px-3 py-1 ring-1 ${c.recurrent ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
                    {c.name}{c.recurrent ? " · recurrente" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={card}>
            <h2 className="mb-1 text-lg font-medium">Informe integrado del semestre (PDF)</h2>
            <p className="mb-3 text-sm text-slate-600">
              Reúne la valoración de cada laboratorio, criterios, evolución, brechas y, si ya lo generaste, el diagnóstico y el plan. Se arma con tus datos guardados y no gasta peticiones de IA.
              {a ? (current ? "" : " Ojo: el diagnóstico guardado está desactualizado y el informe lo marcará así.") : " Aún no generaste el análisis con IA: esa sección saldrá vacía."}
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900" href="/api/analisis/informe" target="_blank" rel="noreferrer">Ver informe</a>
              <a className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500" href="/api/analisis/informe?download=1">Descargar PDF</a>
            </div>
          </div>

          <div className={card}>
            <h2 className="mb-1 text-lg font-medium">Infografía del semestre</h2>
            <p className="mb-3 text-sm text-slate-600">Resume tus cifras reales del semestre en una imagen descargable. No usa la IA: sale solo de tus evaluaciones.</p>
            <SemesterInfographic
              data={{
                subject: subject.name,
                period: subject.academic_period || "",
                date: new Date().toLocaleDateString("es"),
                grade: stats.averageGrade,
                scaleMax: Number(max),
                percent: stats.averagePercent,
                evaluated: stats.labsEvaluated,
                total: stats.labsTotal,
                reviewed: stats.reviewedLabs,
                points: stats.points.map((p) => ({ name: p.name, percent: p.percent, reviewed: p.reviewed })),
                byCut: stats.byCut.map((c) => ({ label: c.cut ? `Corte ${c.cut}` : "Sin corte", percent: c.averagePercent, labs: c.labs })),
                competenciesTitle: stats.competencies.every((c) => c.derived) ? "Cumplimiento por criterio" : "Cumplimiento por competencia",
                competencies: [...stats.competencies].reverse().map((c) => ({ name: c.competency, percent: c.percent })),
                conceptCounts: stats.concepts.reduce((a, c) => ({ ...a, [c.current]: a[c.current] + 1 }), { demostrado: 0, parcial: 0, refuerzo: 0 }),
                toReinforce: stats.concepts.filter((c) => c.current === "refuerzo").map((c) => ({ name: c.name, recurrent: c.recurrent })),
                strengths: stats.recurringStrengths,
                weaknesses: stats.recurringWeaknesses,
                pending: stats.pendingLabs,
                disclaimer: `${GRADE_DISCLAIMER} Generada por la plataforma a partir de tus evaluaciones.`,
              }}
            />
          </div>

          <div className={card}>
            <h2 className="mb-1 text-lg font-medium">Diagnóstico y plan personalizado</h2>
            {saved && (
              <p className="mb-3 text-xs text-slate-500">
                Generado el {new Date(saved.createdAt).toLocaleString("es")} con {saved.labsCount} laboratorio(s) · modelo {saved.model || "no registrado"}.{" "}
                {current ? <span className="text-emerald-700">Vigente.</span> : <span className="font-medium text-amber-700">Desactualizado: tus evaluaciones cambiaron desde entonces.</span>}
              </p>
            )}
            {(!saved || !current) && <AnalyzeButton subjectId={subject.id} label={saved ? "Actualizar análisis con la IA" : "Analizar mi desempeño del semestre"} />}
            {saved && current && <AnalyzeButton subjectId={subject.id} label="Volver a generar (gasta una petición de IA)" force />}
          </div>

          {a && (
            <>
              {saved.warnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
                  {saved.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
              <div className={card}>
                <h2 className="mb-2 text-lg font-medium">Diagnóstico</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{a.diagnostico}</p>
                <h3 className="mb-1 mt-4 font-medium">Evolución</h3>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{a.evolucion}</p>
              </div>

              {a.competencias.length > 0 && (
                <div className={card}>
                  <h2 className="mb-2 text-lg font-medium">{stats.competencies.every((c) => c.derived) ? "Lectura por criterio" : "Lectura por competencia"}</h2>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {a.competencias.map((c, i) => <li key={i}><b>{c.competencia}:</b> {c.lectura}</li>)}
                  </ul>
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <div className={card}>
                  <h2 className="mb-2 text-lg font-medium">Fortalezas</h2>
                  {a.fortalezas.length === 0 ? <p className="text-sm text-slate-600">Sin fortalezas recurrentes que destacar todavía.</p> : <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{a.fortalezas.map((f, i) => <li key={i}>{f}</li>)}</ul>}
                </div>
                <div className={card}>
                  <h2 className="mb-2 text-lg font-medium">Brechas</h2>
                  {a.brechas.length === 0 ? <p className="text-sm text-slate-600">No se identificaron brechas con los datos actuales.</p> : (
                    <ul className="space-y-3 text-sm text-slate-700">
                      {a.brechas.map((b, i) => (
                        <li key={i}><b>{b.tema}</b><br />{b.por_que}{b.laboratorios.length > 0 && <span className="block text-xs text-slate-500">Laboratorios: {b.laboratorios.join(", ")}</span>}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className={card}>
                <h2 className="mb-1 text-lg font-medium">Plan personalizado de fortalecimiento</h2>
                <p className="mb-4 text-sm text-slate-700">{a.plan.objetivo}</p>
                <ol className="space-y-4">
                  {a.plan.acciones.map((x, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 p-4">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${PRIORITY[x.prioridad]}`}>Prioridad {x.prioridad}</span>
                        <b className="text-sm text-slate-900">{x.tema}</b>
                        <span className="text-xs text-slate-500">· {x.tiempo}</span>
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{x.pasos.map((p, j) => <li key={j}>{p}</li>)}</ul>
                      <p className="mt-2 text-sm text-slate-700"><b>Cómo sabrás que lo lograste:</b> {x.logro}</p>
                      {x.laboratorios.length > 0 && <p className="mt-1 text-xs text-slate-500">Relacionado con: {x.laboratorios.join(", ")}</p>}
                    </li>
                  ))}
                </ol>
                {a.plan.orden_sugerido && <p className="mt-4 text-sm text-slate-700"><b>Orden sugerido:</b> {a.plan.orden_sugerido}</p>}
                {a.plan.habitos.length > 0 && (
                  <div className="mt-3"><p className="text-sm font-medium">Hábitos que ayudan</p><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{a.plan.habitos.map((h, i) => <li key={i}>{h}</li>)}</ul></div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
