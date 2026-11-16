import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AIError, getProvider } from "@/lib/ai";
import { generateSemesterAnalysis, SEMESTER_PROMPT_VERSION, type SemesterAnalysis } from "./evaluate-semester";
import { loadSemesterStats } from "./semester-data";
import type { SemesterStats } from "./semester-stats";

export type SavedAnalysis = {
  id: string;
  createdAt: string;
  labsCount: number;
  analysis: SemesterAnalysis;
  warnings: string[];
  model: string;
  signature: string;
};

/** Firma de los datos de entrada: si no cambió ninguna evaluación ni su nota, el análisis guardado sigue vigente. */
export function signatureOf(s: SemesterStats): string {
  const key = JSON.stringify({ p: s.points.map((p) => [p.evaluationId, p.percent, p.reviewed]), pending: s.pendingLabs.length, v: SEMESTER_PROMPT_VERSION });
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export async function latestAnalysis(supabase: SupabaseClient, subjectId: string): Promise<SavedAnalysis | null> {
  const { data } = await supabase.from("semester_analyses").select("*").eq("subject_id", subjectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const stored = data.analysis as { analisis: SemesterAnalysis; avisos?: string[] };
  return {
    id: data.id,
    createdAt: data.created_at,
    labsCount: data.labs_count,
    analysis: stored.analisis,
    warnings: stored.avisos ?? [],
    model: data.ai_model ?? "",
    signature: data.input_signature ?? "",
  };
}

export type RunResult = { ok: true; reused: boolean } | { ok: false; error: string };

/**
 * Genera (o reutiliza) el análisis global. `supabase` es el cliente del usuario (RLS: solo sus datos);
 * `admin` solo se usa para guardar el resultado, que el estudiante no puede escribir.
 */
export async function runSemesterAnalysis(supabase: SupabaseClient, admin: SupabaseClient, userId: string, subjectId: string, force = false): Promise<RunResult> {
  const { data: subject } = await supabase.from("subjects").select("id, grade_scale_max").eq("id", subjectId).maybeSingle();
  if (!subject) return { ok: false, error: "Asignatura no encontrada." };

  const stats = await loadSemesterStats(supabase, subject.id, Number(subject.grade_scale_max));
  if (stats.labsEvaluated === 0) return { ok: false, error: "Todavía no hay laboratorios evaluados. Evalúa al menos uno para analizar tu desempeño." };

  const signature = signatureOf(stats);
  const prev = await latestAnalysis(supabase, subject.id);
  if (prev && prev.signature === signature && !force) return { ok: true, reused: true };

  let provider;
  try {
    provider = getProvider();
  } catch (e) {
    return { ok: false, error: e instanceof AIError ? e.message : "No se pudo configurar la IA." };
  }

  try {
    const { analysis, warnings } = await generateSemesterAnalysis(provider, stats);
    const { error } = await admin.from("semester_analyses").insert({
      user_id: userId,
      subject_id: subject.id,
      labs_count: stats.labsEvaluated,
      analysis: { analisis: analysis, avisos: warnings },
      stats,
      ai_model: provider.lastModelUsed ?? provider.model,
      prompt_version: SEMESTER_PROMPT_VERSION,
      input_signature: signature,
    });
    if (error) return { ok: false, error: "El análisis se generó pero no se pudo guardar. Inténtalo de nuevo." };
    return { ok: true, reused: false };
  } catch (e) {
    if (e instanceof AIError) return { ok: false, error: e.message };
    return { ok: false, error: "No se pudo generar el análisis. Inténtalo de nuevo." };
  }
}
