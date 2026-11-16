import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSemesterBundle } from "@/lib/semester-data";
import { latestAnalysis } from "@/lib/run-semester";
import { buildMindMap, countNodes } from "@/lib/mindmap-data";
import { MindMapView } from "./mindmap-view";

export default async function MindMapPage() {
  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("*").order("created_at").limit(1).maybeSingle();
  if (!subject)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Mapa mental</h1>
        <p className="mt-2 text-slate-600">Primero registra tu asignatura en el <Link className="text-indigo-700 underline" href="/">panel</Link>.</p>
      </section>
    );

  const { stats, details } = await loadSemesterBundle(supabase, subject.id, Number(subject.grade_scale_max));
  const saved = await latestAnalysis(supabase, subject.id);
  const tree = buildMindMap(subject.name, stats, details, saved?.analysis ?? null);

  return (
    <section className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mapa mental</h1>
        <p className="text-slate-500">
          {subject.name} · {stats.labsEvaluated} de {stats.labsTotal} laboratorios evaluados · {countNodes(tree)} nodos
        </p>
      </div>
      {stats.labsEvaluated === 0 ? (
        <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200 text-slate-700">
          Todavía no hay laboratorios evaluados, así que el mapa solo tendría la asignatura. Evalúa uno en <Link className="text-indigo-700 underline" href="/laboratorios">Mis laboratorios</Link>.
        </div>
      ) : (
        <>
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Cada nodo sale de tus evaluaciones reales: temas de las infografías, niveles de dominio de los criterios y las citas del trabajo. Los laboratorios sin evaluar aparecen aparte y no cuentan.
            Son estimaciones orientativas, no notas oficiales.
          </p>
          <MindMapView root={tree} />
        </>
      )}
    </section>
  );
}
