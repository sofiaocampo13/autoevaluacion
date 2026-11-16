import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinalReport } from "./evaluate-summary";
import type { LabDetail } from "./mindmap-data";
import { computeSemesterStats, type SemesterLabInput, type SemesterStats } from "./semester-stats";

type Snapshot = { criteria?: { criterion: string; competency: string }[] };
type ConceptRow = { name: string; status: "demostrado" | "parcial" | "refuerzo" };
type Citation = { location: string; quote: string; status: "verificada" | "no_verificable" | "invalida" };

/**
 * Carga la última evaluación completada de cada laboratorio de la asignatura. Devuelve las estadísticas y el detalle por laboratorio
 * (para el mapa mental). Con el cliente del usuario, RLS limita todo a sus datos.
 */
export async function loadSemesterBundle(supabase: SupabaseClient, subjectId: string, scaleMax: number): Promise<{ stats: SemesterStats; details: LabDetail[] }> {
  const { data: labs } = await supabase.from("labs").select("id, name, number, cut").eq("subject_id", subjectId);
  const labList = labs ?? [];
  if (labList.length === 0) return { stats: computeSemesterStats([], 0, scaleMax), details: [] };

  const { data: evals } = await supabase
    .from("evaluations")
    .select("*")
    .in("lab_id", labList.map((l) => l.id))
    .eq("status", "completada")
    .order("completed_at", { ascending: false });

  const latest = new Map<string, NonNullable<typeof evals>[number]>();
  for (const e of evals ?? []) if (!latest.has(e.lab_id)) latest.set(e.lab_id, e);

  const ids = [...latest.values()].map((e) => e.id);
  const { data: results } = ids.length ? await supabase.from("criterion_results").select("*").in("evaluation_id", ids).order("position") : { data: [] };

  const inputs: SemesterLabInput[] = [];
  const details: LabDetail[] = [];
  for (const lab of labList) {
    const ev = latest.get(lab.id);
    if (!ev || ev.overall_percent == null) continue;
    const snap = (ev.rubric_snapshot ?? {}) as Snapshot;
    const competencyOf = new Map((snap.criteria ?? []).map((c) => [c.criterion, c.competency]));
    const rows = (results ?? []).filter((r) => r.evaluation_id === ev.id);
    const summary = (ev.summary ?? {}) as { fortalezas?: string[]; debilidades?: string[] };
    const fb = (ev.feedback ?? {}) as { conceptos_a_reforzar?: string[]; recomendaciones?: string[] };

    inputs.push({
      lab: { id: lab.id, name: lab.name, number: lab.number, cut: lab.cut },
      evaluation: {
        id: ev.id,
        completedAt: ev.completed_at ?? ev.created_at,
        overallPercent: Number(ev.overall_percent),
        estimatedGrade: Number(ev.estimated_grade),
        reviewStatus: ev.review_status ?? "preliminar",
        finalPercent: ev.final_percent != null ? Number(ev.final_percent) : null,
        finalGrade: ev.final_grade != null ? Number(ev.final_grade) : null,
      },
      criteria: rows.map((r) => ({ criterion: r.criterion, competency: competencyOf.get(r.criterion) ?? "", weight: Number(r.weight), percent: Number(r.percent), evidence: r.evidence_level })),
      strengths: summary.fortalezas ?? [],
      weaknesses: summary.debilidades ?? [],
      toReinforce: fb.conceptos_a_reforzar ?? [],
      concepts: rows.flatMap((r) => ((r.concepts ?? []) as ConceptRow[]).filter((k) => k && k.name && k.status)),
    });
    details.push({
      labId: lab.id,
      evaluationId: ev.id,
      name: lab.name,
      cut: lab.cut,
      number: lab.number,
      infographic: (ev.infographic ?? null) as FinalReport["infografia"] | null,
      toReinforce: fb.conceptos_a_reforzar ?? [],
      recommendations: fb.recomendaciones ?? [],
      criteria: rows.map((r) => ({
        criterion: r.criterion,
        percent: Number(r.percent),
        evidence: r.evidence_level,
        recommendation: r.recommendation ?? "",
        citations: ((r.citations ?? []) as Citation[]).filter((c) => c && c.location && c.quote),
      })),
    });
  }
  const stats = computeSemesterStats(inputs, labList.length, scaleMax);
  const done = new Set(inputs.map((i) => i.lab.id));
  stats.pendingLabs = labList
    .filter((l) => !done.has(l.id))
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
    .map((l) => l.name);
  return { stats, details };
}

export async function loadSemesterStats(supabase: SupabaseClient, subjectId: string, scaleMax: number): Promise<SemesterStats> {
  return (await loadSemesterBundle(supabase, subjectId, scaleMax)).stats;
}
