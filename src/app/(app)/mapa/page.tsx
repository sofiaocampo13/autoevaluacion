import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSemesterBundle } from "@/lib/semester-data";
import { latestAnalysis } from "@/lib/run-semester";
import { buildMindMap, countNodes } from "@/lib/mindmap-data";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { MindMapView } from "./mindmap-view";
import { ThemeGrid } from "./theme-grid";
import { Note } from "@/components/ui";

const card = "rounded-[22px] border border-slate-200 bg-white p-6";

export default async function MindMapPage() {
  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("*").order("created_at").limit(1).maybeSingle();
  if (!subject)
    return (
      <section>
        <h1 className="text-4xl tracking-tight">Infografía general de aprendizaje</h1>
        <p className="mt-2 text-slate-600">Primero registra tu asignatura en el <Link className="font-bold text-brand-700 underline" href="/">panel</Link>.</p>
      </section>
    );

  const { stats, details } = await loadSemesterBundle(supabase, subject.id, Number(subject.grade_scale_max));
  const saved = await latestAnalysis(supabase, subject.id);
  const tree = buildMindMap(subject.name, stats, details, saved?.analysis ?? null);
  const themes = tree.children.find((b) => b.id === "b-temas")?.children ?? [];
  const evaluated = stats.labsEvaluated > 0;
  const kpi = [
    { label: "Laboratorios", value: `${stats.labsEvaluated} / ${stats.labsTotal}`, box: "bg-brand-50 text-brand-700" },
    { label: "Categorías", value: String(themes.length), box: "bg-blue-50 text-blue-700" },
    ...(evaluated ? [{ label: "Cumplimiento global", value: `${stats.averagePercent} %`, box: "bg-pink-50 text-pink-700" }] : []),
  ];

  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-widest text-pink-600">Infografía general de aprendizaje</p>
          <h1 className="text-4xl leading-tight tracking-tight lg:text-[54px] lg:leading-[1.02]">
            {subject.name}
            {subject.academic_period && <> <em className="text-brand-600">{subject.academic_period}</em></>}
          </h1>
          <p className="text-sm text-slate-600">Construida a partir de {stats.labsEvaluated} {stats.labsEvaluated === 1 ? "laboratorio evaluado" : "laboratorios evaluados"}</p>
        </div>
        <ul className="flex flex-wrap gap-3">
          {kpi.map((k) => (
            <li key={k.label} className={`flex flex-col rounded-[18px] px-[18px] py-3 ${k.box}`}>
              <span className="text-[11px] font-extrabold uppercase">{k.label}</span>
              <span className="font-display text-[30px] leading-tight">{k.value}</span>
            </li>
          ))}
        </ul>
      </header>

      {!evaluated ? (
        <div className={`${card} text-slate-700`}>
          Todavía no hay laboratorios evaluados, así que la infografía solo tendría la asignatura. Evalúa uno en <Link className="font-bold text-brand-700 underline" href="/laboratorios">Mis laboratorios</Link>.
        </div>
      ) : (
        <>
          <Note>{GRADE_DISCLAIMER} Cada elemento sale de tus evaluaciones reales; los laboratorios sin evaluar aparecen aparte y no cuentan.</Note>

          {themes.length > 0 && <ThemeGrid themes={themes} pending={stats.pendingLabs} />}

          <ul aria-label="Leyenda de estados" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-slate-700">
            <li className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded bg-blue-600" />✓ Demostrado</li>
            <li className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded bg-brand-200" />◐ Parcialmente demostrado</li>
            <li className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded bg-pink-600" />↗ Requiere refuerzo</li>
            <li className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded border-[1.5px] border-dashed border-slate-400" />– Sin evidencia suficiente</li>
          </ul>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
            <div className="flex flex-col gap-2 rounded-[22px] bg-blue-50 p-5">
              <h2 className="font-sans text-xs font-extrabold uppercase tracking-wider text-blue-700">Principales fortalezas</h2>
              <p className="text-sm leading-relaxed text-slate-800">{stats.recurringStrengths.length ? stats.recurringStrengths.join("; ") + "." : "Aún no hay una fortaleza que se repita en 2 o más laboratorios."}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-[22px] bg-pink-50 p-5">
              <h2 className="font-sans text-xs font-extrabold uppercase tracking-wider text-pink-700">Principales dificultades</h2>
              <p className="text-sm leading-relaxed text-slate-800">{stats.recurringWeaknesses.length ? stats.recurringWeaknesses.join("; ") + "." : "No hay dificultades que se repitan en 2 o más laboratorios."}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-[22px] bg-slate-100 p-5">
              <h2 className="font-sans text-xs font-extrabold uppercase tracking-wider text-brand-700">{stats.competencies.every((c) => c.derived) ? "Criterios de la rúbrica" : "Competencias"}</h2>
              <p className="text-sm leading-relaxed text-slate-800">{stats.competencies.map((c) => c.competency).join(" · ")}</p>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <h2 className="text-[26px] text-slate-800">Mapa mental interactivo</h2>
            <p className="text-sm text-slate-600">{countNodes(tree)} nodos. Explora el semestre por temas, laboratorios y qué profundizar.</p>
            <MindMapView root={tree} />
          </div>
        </>
      )}
    </section>
  );
}
