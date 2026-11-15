import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flag } from "./assessment";
import type { CodeReport } from "./code-check";
import type { FinalReport } from "./evaluate-summary";
import type { InventoryEntry } from "./evidence";
import { reconcileInfographic } from "./infographic-data";

export type ReportCitation = { location: string; quote: string; status: "verificada" | "no_verificable" | "invalida" };
export type ReportCriterion = {
  criterion: string;
  competency: string;
  weight: number;
  rubricLevel: string;
  percent: number;
  contribution: number; // puntos de porcentaje que aporta al global (peso x porcentaje / 100)
  evidence: "suficiente" | "parcial" | "inexistente";
  confidence: string;
  argumentation: string;
  recommendation: string;
  citations: ReportCitation[];
  warnings: string[];
  notes: string[];
  limitations: string;
};

export type ReportData = {
  student: string;
  labName: string;
  labDescription: string;
  labObjectives: string;
  evaluatedAt: Date;
  scaleMax: number;
  grade: number;
  overallPercent: number;
  rubric: { title: string; version: number };
  criteria: ReportCriterion[];
  summary: Omit<FinalReport, "infografia" | "retroalimentacion">;
  feedback: FinalReport["retroalimentacion"];
  concepts: { demostrado: string[]; parcial: string[]; refuerzo: string[] };
  limitations: string;
  materials: { guide: string | null; rubric: string; repo: string | null; filesAnalyzed: number };
  inventory: { analyzed: number; total: number; skipped: InventoryEntry[] };
  code: CodeReport | null;
  trace: { provider: string; model: string; promptVersion: string };
};

const text = (f: Flag | string) => (typeof f === "string" ? f : f.text);
const level = (f: Flag | string) => (typeof f === "string" ? "aviso" : f.level);

/** Reúne todo lo que necesita el informe. Con el cliente del usuario, RLS garantiza que solo se lean evaluaciones propias. */
export async function loadReportData(supabase: SupabaseClient, labId: string, evaluationId: string): Promise<ReportData | null> {
  const { data: ev } = await supabase.from("evaluations").select("*").eq("id", evaluationId).eq("lab_id", labId).maybeSingle();
  if (!ev || ev.status !== "completada") return null;

  const [{ data: lab }, { data: results }, { data: profile }] = await Promise.all([
    supabase.from("labs").select("name, description, objectives").eq("id", labId).single(),
    supabase.from("criterion_results").select("*").eq("evaluation_id", evaluationId).order("position"),
    supabase.from("profiles").select("full_name").eq("id", ev.user_id).maybeSingle(),
  ]);
  if (!lab || !results) return null;

  const snap = ev.rubric_snapshot as { title: string; version: number; criteria: { criterion: string; competency: string }[] };
  const competencyOf = new Map(snap.criteria.map((c) => [c.criterion, c.competency]));
  const summary = ev.summary as ReportData["summary"];
  const fb = ev.feedback as FinalReport["retroalimentacion"];
  const inventory = (ev.evidence_inventory ?? []) as InventoryEntry[];
  const usable = inventory.filter((i) => i.mode === "text" || i.mode === "native");
  const used = (ev.materials_used ?? {}) as { guia?: { title: string; version: string } | null; repositorio?: string | null; archivos_analizados?: number };

  const info = reconcileInfographic(ev.infographic as FinalReport["infografia"] | null, fb?.conceptos_a_reforzar);
  const concepts = { demostrado: [] as string[], parcial: [] as string[], refuerzo: [] as string[] };
  info.categorias.forEach((c) => c.subcategorias.forEach((s) => s.conceptos.forEach((k) => concepts[k.estado].push(k.nombre))));

  return {
    student: profile?.full_name || "Estudiante",
    labName: lab.name,
    labDescription: lab.description ?? "",
    labObjectives: lab.objectives ?? "",
    evaluatedAt: new Date(ev.completed_at ?? ev.created_at),
    scaleMax: Number(ev.grade_scale_max),
    grade: Number(ev.estimated_grade),
    overallPercent: Number(ev.overall_percent),
    rubric: { title: snap.title, version: snap.version },
    criteria: results.map((r) => ({
      criterion: r.criterion,
      competency: competencyOf.get(r.criterion) ?? "",
      weight: Number(r.weight),
      rubricLevel: r.rubric_level ?? "",
      percent: Number(r.percent),
      contribution: Math.round(Number(r.weight) * Number(r.percent)) / 100,
      evidence: r.evidence_level,
      confidence: r.confidence ?? "",
      argumentation: r.argumentation ?? "",
      recommendation: r.recommendation ?? "",
      citations: (r.citations ?? []) as ReportCitation[],
      warnings: ((r.flags ?? []) as (Flag | string)[]).filter((f) => level(f) === "aviso").map(text),
      notes: ((r.flags ?? []) as (Flag | string)[]).filter((f) => level(f) === "nota").map(text),
      limitations: r.limitations ?? "",
    })),
    summary,
    feedback: fb,
    concepts,
    limitations: ev.limitations ?? "",
    materials: {
      guide: used.guia ? `${used.guia.title} (v${used.guia.version})` : null,
      rubric: `${snap.title} (versión ${snap.version})`,
      repo: used.repositorio ?? null,
      filesAnalyzed: used.archivos_analizados ?? usable.length,
    },
    inventory: { analyzed: usable.length, total: inventory.length, skipped: inventory.filter((i) => i.mode === "omitido" || i.mode === "unsupported") },
    code: (ev.test_results ?? null) as CodeReport | null,
    trace: { provider: ev.ai_provider ?? "", model: ev.ai_model ?? "", promptVersion: ev.prompt_version ?? "" },
  };
}
