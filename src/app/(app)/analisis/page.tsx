import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSemesterStats } from "@/lib/semester-data";
import { latestAnalysis, signatureOf } from "@/lib/run-semester";
import { BAND_LABEL, type MasteryBand } from "@/lib/semester-stats";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { SemesterInfographic } from "@/components/semester-infographic";
import { Note } from "@/components/ui";
import { AnalyzeButton } from "./analyze-button";

const card = "scroll-mt-16 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:px-[26px]";
const h2 = "text-[23px] text-slate-800";
const pill = "inline-flex min-h-11 items-center rounded-full px-6 text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const SECTIONS = [
  { id: "resumen", label: "Resumen" },
  { id: "competencias", label: "Competencias" },
  { id: "diagnostico", label: "Diagnóstico y plan" },
  { id: "brechas", label: "Brechas" },
  { id: "informes", label: "Informes y descargas" },
];
// Progreso en violeta; azul/lavanda/rosado para los estados (el texto de cada fila nombra el nivel).
const BAND_COLOR: Record<MasteryBand, string> = { dominio: "bg-blue-600", competente: "bg-brand-600", en_desarrollo: "bg-brand-300", inicial: "bg-pink-600" };
const PRIORITY: Record<string, string> = { alta: "bg-pink-300 text-pink-900", media: "bg-brand-200 text-brand-900", baja: "bg-slate-200 text-slate-800" };
const delta = (d: number | null) => (d == null ? "—" : `${d > 0 ? "+" : ""}${d} pts`);

/** Tarjeta de lista con título y punto de color; no se dibuja si no hay elementos y `empty` no está definido. */
function ListCard({ title, dot, items, empty }: { title: string; dot: string; items: React.ReactNode[]; empty?: string }) {
  if (items.length === 0 && !empty) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-[22px] border border-slate-200 bg-white px-[22px] py-5">
      <h3 className="flex items-center gap-2 font-sans text-sm font-extrabold text-slate-800">
        <span aria-hidden="true" className={`size-2.5 rounded-full ${dot}`} />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">{empty}</p>
      ) : (
        items.map((x, i) => <div key={i} className="border-t border-slate-100 pt-2 text-sm leading-snug text-slate-800">{x}</div>)
      )}
    </div>
  );
}

export default async function AnalysisPage() {
  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("*").order("created_at").limit(1).maybeSingle();
  if (!subject)
    return (
      <section>
        <h1 className="text-4xl tracking-tight">Mi desempeño del semestre</h1>
        <p className="mt-2 text-slate-600">Primero registra tu asignatura en el <Link className="font-bold text-brand-700 underline" href="/">panel</Link>.</p>
      </section>
    );

  const stats = await loadSemesterStats(supabase, subject.id, Number(subject.grade_scale_max));
  const saved = await latestAnalysis(supabase, subject.id);
  const current = saved != null && saved.signature === signatureOf(stats);
  const a = saved?.analysis;
  const max = subject.grade_scale_max;
  const derived = stats.competencies.every((c) => c.derived);
  const conceptsBy = (s: "demostrado" | "parcial") => stats.concepts.filter((c) => c.current === s).map((c) => c.name);
  const reinforce = stats.concepts.filter((c) => c.current === "refuerzo");
  const kpi = [
    { label: "Promedio orientativo", value: <>{stats.averageGrade} <span className="text-base">/ {max}</span></>, box: "bg-brand-50 text-brand-700" },
    { label: "Cumplimiento", value: `${stats.averagePercent} %`, box: "bg-pink-50 text-pink-700" },
    { label: "Evaluados", value: <>{stats.labsEvaluated} <span className="text-base">de {stats.labsTotal}</span></>, box: "bg-blue-50 text-blue-700" },
    ...(stats.trend ? [{ label: "Primero → último", value: `${stats.trend.first} % → ${stats.trend.last} %`, box: "bg-slate-100 text-slate-800" }] : []),
  ];

  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[13px] font-bold uppercase tracking-widest text-pink-600">
            {subject.name} · {subject.academic_period || "Sin periodo"} · {stats.labsEvaluated} de {stats.labsTotal} laboratorios
          </p>
          <h1 className="text-4xl tracking-tight lg:text-[44px] lg:leading-tight">Mi desempeño del semestre</h1>
          {saved && (
            <p className="text-[13px] text-slate-600">
              Generado el {new Date(saved.createdAt).toLocaleString("es")} con {saved.labsCount} laboratorio(s) · modelo {saved.model || "no registrado"}.{" "}
              {current ? <span className="font-bold text-blue-700">Vigente.</span> : <span className="font-bold text-aviso-text">Desactualizado: tus evaluaciones cambiaron desde entonces.</span>}
            </p>
          )}
        </div>
        {stats.labsEvaluated > 0 && (
          <AnalyzeButton
            subjectId={subject.id}
            label={saved ? (current ? "Volver a generar (gasta una petición de IA)" : "Actualizar análisis con la IA") : "Analizar mi desempeño del semestre"}
            force={saved != null && current}
          />
        )}
      </header>

      {stats.labsEvaluated === 0 ? (
        <div className={card}>
          <p className="text-slate-700">Todavía no hay laboratorios evaluados. Evalúa al menos uno en <Link className="font-bold text-brand-700 underline" href="/laboratorios">Mis laboratorios</Link> y vuelve aquí.</p>
        </div>
      ) : (
        <>
          <nav aria-label="En esta página" className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 md:-mx-12 md:px-12">
            {SECTIONS.map((x) => (
              <a key={x.id} href={`#${x.id}`} className="flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-bold text-slate-600 hover:border-brand-300 hover:text-brand-700">
                {x.label}
              </a>
            ))}
          </nav>

          {stats.labsEvaluated < 3 && (
            <p role="note" className="rounded-2xl bg-aviso-bg px-4 py-3 text-[13px] leading-normal text-aviso-text">
              Solo hay {stats.labsEvaluated} laboratorio(s) evaluado(s). Con tan pocos datos, las tendencias y los patrones todavía no son concluyentes.
            </p>
          )}
          <Note>{GRADE_DISCLAIMER} Los números de esta página los calcula el sistema; la IA solo redacta sobre ellos.</Note>

          <ul id="resumen" className="grid scroll-mt-16 grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3">
            {kpi.map((k) => (
              <li key={k.label} className={`flex flex-col rounded-[18px] px-[18px] py-3 ${k.box}`}>
                <span className="text-xs font-bold">{k.label}</span>
                <span className="font-display text-[28px] leading-tight">{k.value}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-5">
            <div className={`${card} min-w-0 flex-[1_1_420px]`}>
              <h2 className={h2}>Evolución entre laboratorios</h2>
              <ul className="flex flex-col gap-3.5">
                {stats.points.map((p) => (
                  <li key={p.evaluationId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 text-[13px] sm:grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_3rem_4.5rem]">
                    <span className="truncate font-extrabold" title={p.name}>{p.reviewed ? "◆ " : ""}{p.name}</span>
                    <div className="order-last col-span-3 h-3.5 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, p.percent))}%` }} />
                    </div>
                    <span className="text-right font-extrabold">{p.percent} %</span>
                    <span className="text-right font-extrabold text-pink-700">{p.grade} / {max}</span>
                  </li>
                ))}
              </ul>
              {stats.trend && (
                <p className="text-[13px] leading-normal text-slate-600">
                  Del primer al último laboratorio evaluado pasaste de {stats.trend.first} % a {stats.trend.last} % ({delta(stats.trend.delta)}).
                  {stats.reviewedLabs > 0 ? " ◆ = nota revisada por un docente." : ""}
                </p>
              )}
            </div>

            <div id="competencias" className={`${card} min-w-0 flex-[1_1_420px]`}>
              <h2 className={h2}>{derived ? "Criterios de la rúbrica (de menor a mayor)" : "Competencias (de menor a mayor)"}</h2>
              {stats.competencies.some((c) => c.derived) && (
                <p className="text-[13px] text-slate-600">Tu rúbrica no define competencias, así que se muestran los criterios tal como aparecen en ella.</p>
              )}
              <ul className="flex flex-col gap-3.5">
                {stats.competencies.map((c) => (
                  <li key={c.competency} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-3 text-[13px]">
                      <span className="font-bold">{c.competency}</span>
                      <span className="shrink-0 font-extrabold">{c.percent} %</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${BAND_COLOR[c.band]}`} style={{ width: `${Math.min(100, c.percent)}%` }} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {BAND_LABEL[c.band]} · {c.labs} lab. · cambio {delta(c.delta)}
                      {c.weakEvidence > 0 ? ` · ${c.weakEvidence} criterio(s) con evidencia incompleta` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-600">Niveles propios de la plataforma (85 % dominio alto, 70 % competente, 50 % en desarrollo) para resumir; no son los de la rúbrica de tu docente.</p>
            </div>
          </div>

          <section id="diagnostico" className="scroll-mt-16 space-y-5 rounded-[26px] bg-slate-900 px-5 py-7 text-slate-100 sm:px-9">
            {a && saved ? (
              <>
                {saved.warnings.length > 0 && (
                  <div className="rounded-2xl bg-aviso-bg px-4 py-3 text-sm text-aviso-text">
                    {saved.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-7">
                  <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
                    <h2 className="text-[30px] leading-tight text-white">Diagnóstico del semestre</h2>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{a.diagnostico}</p>
                    <h3 className="mt-2 text-lg text-white">Evolución</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{a.evolucion}</p>
                  </div>
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
                    <h2 className="font-sans text-[15px] font-extrabold text-white">Plan personalizado de fortalecimiento</h2>
                    <p className="text-sm leading-normal text-slate-300">{a.plan.objetivo}</p>
                    <ol className="flex flex-col gap-2.5">
                      {a.plan.acciones.map((x, i) => (
                        <li key={i} className="flex items-start gap-3 rounded-[14px] bg-[#2b2045] px-3.5 py-3 text-[13.5px] leading-normal">
                          <span aria-hidden="true" className="flex size-6 flex-none items-center justify-center rounded-full bg-blue-300 text-xs font-extrabold text-[#141038]">{i + 1}</span>
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PRIORITY[x.prioridad]}`}>Prioridad {x.prioridad}</span>
                              <b className="text-white">{x.tema}</b>
                              <span className="text-xs text-slate-300">· {x.tiempo}</span>
                            </div>
                            <ul className="list-disc space-y-1 pl-5">{x.pasos.map((p, j) => <li key={j}>{p}</li>)}</ul>
                            <p><b className="text-white">Cómo sabrás que lo lograste:</b> {x.logro}</p>
                            {x.laboratorios.length > 0 && <p className="text-xs text-slate-300">Relacionado con: {x.laboratorios.join(", ")}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                    {a.plan.orden_sugerido && <p className="text-sm leading-normal text-slate-300"><b className="text-white">Orden sugerido:</b> {a.plan.orden_sugerido}</p>}
                    {a.plan.habitos.length > 0 && (
                      <div>
                        <p className="text-sm font-bold text-white">Hábitos que ayudan</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">{a.plan.habitos.map((h, i) => <li key={i}>{h}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <h2 className="text-[30px] leading-tight text-white">Diagnóstico y plan personalizado</h2>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
                  Aún no generaste el análisis con IA. Usa el botón «Analizar mi desempeño del semestre» de arriba: la IA redacta un diagnóstico y un plan de fortalecimiento a partir de las cifras que calcula el sistema.
                </p>
              </div>
            )}
          </section>

          {a && (
            <div className="grid gap-4 md:grid-cols-2">
              {a.competencias.length > 0 && (
                <div className={`${card} md:col-span-2`}>
                  <h2 className={h2}>{derived ? "Lectura por criterio" : "Lectura por competencia"}</h2>
                  <ul className="space-y-2 text-sm leading-normal text-slate-800">
                    {a.competencias.map((c, i) => <li key={i}><b>{c.competencia}:</b> {c.lectura}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-2 rounded-[22px] bg-blue-50 p-5">
                <h2 className="font-sans text-sm font-extrabold text-blue-700">Fortalezas</h2>
                {a.fortalezas.length === 0 ? <p className="text-sm text-slate-700">Sin fortalezas recurrentes que destacar todavía.</p> : <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">{a.fortalezas.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              </div>
              <div className="flex flex-col gap-2 rounded-[22px] bg-pink-50 p-5">
                <h2 className="font-sans text-sm font-extrabold text-pink-700">Brechas</h2>
                {a.brechas.length === 0 ? <p className="text-sm text-slate-700">No se identificaron brechas con los datos actuales.</p> : (
                  <ul className="space-y-3 text-sm text-slate-800">
                    {a.brechas.map((b, i) => (
                      <li key={i}><b>{b.tema}</b><br />{b.por_que}{b.laboratorios.length > 0 && <span className="block text-xs text-slate-600">Laboratorios: {b.laboratorios.join(", ")}</span>}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div id="brechas" className="grid scroll-mt-16 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
            <ListCard
              title="Fortalezas recurrentes"
              dot="bg-blue-600"
              items={stats.recurringStrengths}
              empty="Aún no hay una fortaleza que se repita en 2 o más laboratorios."
            />
            <ListCard
              title="Errores frecuentes"
              dot="bg-pink-600"
              items={stats.recurringWeaknesses}
              empty="No hay errores que se repitan en 2 o más laboratorios."
            />
            <ListCard title="Conceptos dominados" dot="bg-blue-600" items={conceptsBy("demostrado")} />
            <ListCard title="Parcialmente comprendidos" dot="bg-brand-600" items={conceptsBy("parcial")} />
            <ListCard
              title="Conceptos por reforzar"
              dot="bg-pink-600"
              items={reinforce.map((c) => <>{c.name}{c.recurrent ? <span className="font-bold text-pink-700"> · recurrente</span> : ""}</>)}
            />
            <ListCard title="Laboratorios sin evaluar" dot="bg-slate-400" items={stats.pendingLabs} />
            <ListCard
              title="Por corte"
              dot="bg-brand-600"
              items={stats.byCut.map((c) => (
                <span key={String(c.cut)} className="flex justify-between gap-3"><span>{c.cut ? `Corte ${c.cut}` : "Sin corte"} ({c.labs} lab.)</span><b>{c.averagePercent} %</b></span>
              ))}
            />
            <ListCard
              title="Criterios más bajos"
              dot="bg-pink-600"
              items={stats.gaps.map((g, i) => (
                <span key={i}><b>{g.percent} %</b> · {g.criterion} <span className="text-slate-600">({g.lab}{g.evidence !== "suficiente" ? ` · evidencia ${g.evidence}` : ""})</span></span>
              ))}
              empty="Ningún criterio bajo el 85 % ni con evidencia incompleta."
            />
          </div>

          <div id="informes" className="scroll-mt-16 space-y-5">
            <div className={card}>
              <h2 className={h2}>Informe integrado del semestre (PDF)</h2>
              <p className="text-sm leading-normal text-slate-600">
                Reúne la valoración de cada laboratorio, criterios, evolución, brechas y, si ya lo generaste, el diagnóstico y el plan. Se arma con tus datos guardados y no gasta peticiones de IA.
                {a ? (current ? "" : " Ojo: el diagnóstico guardado está desactualizado y el informe lo marcará así.") : " Aún no generaste el análisis con IA: esa sección saldrá vacía."}
              </p>
              <div className="flex flex-wrap gap-3">
                <a className={`${pill} bg-slate-800 text-white hover:bg-slate-900`} href="/api/analisis/informe" target="_blank" rel="noreferrer">Ver informe</a>
                <a className={`${pill} border-[1.5px] border-slate-300 bg-white text-slate-800 hover:border-brand-600`} href="/api/analisis/informe?download=1">Descargar PDF</a>
              </div>
            </div>

            <div className={card}>
              <h2 className={h2}>Infografía del semestre</h2>
              <p className="text-sm leading-normal text-slate-600">Resume tus cifras reales del semestre en una imagen descargable. No usa la IA: sale solo de tus evaluaciones.</p>
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
                  competenciesTitle: derived ? "Cumplimiento por criterio" : "Cumplimiento por competencia",
                  competencies: [...stats.competencies].reverse().map((c) => ({ name: c.competency, percent: c.percent })),
                  conceptCounts: stats.concepts.reduce((acc, c) => ({ ...acc, [c.current]: acc[c.current] + 1 }), { demostrado: 0, parcial: 0, refuerzo: 0 }),
                  toReinforce: reinforce.map((c) => ({ name: c.name, recurrent: c.recurrent })),
                  strengths: stats.recurringStrengths,
                  weaknesses: stats.recurringWeaknesses,
                  pending: stats.pendingLabs,
                  disclaimer: `${GRADE_DISCLAIMER} Generada por la plataforma a partir de tus evaluaciones.`,
                }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
