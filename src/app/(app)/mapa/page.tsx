import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSemesterBundle } from "@/lib/semester-data";
import { latestAnalysis } from "@/lib/run-semester";
import { buildMindMap, countNodes } from "@/lib/mindmap-data";
import { MindMapView } from "./mindmap-view";
import { PageHeader } from "@/components/page-header";
import { Note } from "@/components/ui";

export default async function MindMapPage() {
  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("*").order("created_at").limit(1).maybeSingle();
  if (!subject)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Mapa mental</h1>
        <p className="mt-2 text-slate-600">Primero registra tu asignatura en el <Link className="text-brand-700 underline" href="/">panel</Link>.</p>
      </section>
    );

  const { stats, details } = await loadSemesterBundle(supabase, subject.id, Number(subject.grade_scale_max));
  const saved = await latestAnalysis(supabase, subject.id);
  const tree = buildMindMap(subject.name, stats, details, saved?.analysis ?? null);

  return (
    <section className="space-y-4">
      <PageHeader title="Mapa mental" description={`${subject.name} · ${stats.labsEvaluated} de ${stats.labsTotal} laboratorios evaluados · ${countNodes(tree)} nodos`} />
      {stats.labsEvaluated === 0 ? (
        <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200 text-slate-700">
          Todavía no hay laboratorios evaluados, así que el mapa solo tendría la asignatura. Evalúa uno en <Link className="text-brand-700 underline" href="/laboratorios">Mis laboratorios</Link>.
        </div>
      ) : (
        <>
          <Note>
            Cada nodo sale de tus evaluaciones reales: temas de las infografías, niveles de dominio de los criterios y las citas del trabajo. Los laboratorios sin evaluar aparecen aparte y no cuentan.
            Son estimaciones orientativas, no notas oficiales.
          </Note>
          <MindMapView root={tree} />
        </>
      )}
    </section>
  );
}
