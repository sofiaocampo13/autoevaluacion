import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AIError, getProvider } from "@/lib/ai";
import { releaseAi, reserveAi } from "@/lib/ai-budget";
import { isSystemicVerificationFailure, type Flag } from "@/lib/assessment";
import { assessCriteriaBatch, PROMPT_VERSION } from "@/lib/evaluate-criterion";
import { generateFinalReport, SUMMARY_PROMPT_VERSION, type CriterionDigest } from "@/lib/evaluate-summary";
import { checkCodeEvidence, reportForPrompt, type CodeReport } from "@/lib/code-check";
import { buildEvidencePackage, loadEvidence, type InventoryEntry } from "@/lib/evidence";
import { extractParts } from "@/lib/extract";
import { extOf } from "@/lib/files";
import type { Criterion, Level } from "@/lib/rubric-validate";
import { estimatedGrade, overallPercent } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";

type Supa = SupabaseClient;

export type StartResult =
  | { ok: true; evaluationId: string; total: number; labels: string[]; donePositions: number[]; resumed: boolean }
  | { ok: false; error: string };
export type StepResult = { ok: true } | { ok: false; error: string; retryable: boolean };

type SnapshotCriterion = Criterion & { id: string | null; position: number };
type Snapshot = { rubric_id: string; version: number; title: string; scale_max: number; criteria: SnapshotCriterion[] };

const STALE_MS = 30 * 60 * 1000;

/** Los flags antiguos eran texto; los nuevos son {level, text}. */
export const flagText = (f: Flag | string) => (typeof f === "string" ? f : f.text);
export const flagLevel = (f: Flag | string): Flag["level"] => (typeof f === "string" ? "aviso" : f.level);

/** Crea la evaluación (o retoma una en curso). Autoriza con el cliente del usuario: RLS decide qué ve. */
export async function startEvaluation(supabase: Supa, userId: string, labId: string): Promise<StartResult> {
  const { data: lab } = await supabase.from("labs").select("id, name, repo_url").eq("id", labId).maybeSingle();
  if (!lab) return { ok: false, error: "Laboratorio no encontrado." };

  const { data: rubric } = await supabase
    .from("rubrics")
    .select("id, version, title, scale_max")
    .eq("lab_id", labId)
    .eq("status", "confirmada")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rubric) return { ok: false, error: "Este laboratorio no tiene una rúbrica confirmada. Confírmala antes de evaluar." };

  const { count: fileCount } = await supabase.from("lab_files").select("id", { count: "exact", head: true }).eq("lab_id", labId);
  if (!fileCount && !lab.repo_url) return { ok: false, error: "Sube los archivos del trabajo (o indica un repositorio) antes de evaluar." };

  const { data: running } = await supabase
    .from("evaluations")
    .select("id, rubric_snapshot, updated_at")
    .eq("lab_id", labId)
    .eq("status", "procesando")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (running && Date.now() - new Date(running.updated_at).getTime() < STALE_MS) {
    const snap = running.rubric_snapshot as Snapshot;
    const { data: done } = await supabase.from("criterion_results").select("position").eq("evaluation_id", running.id);
    return {
      ok: true,
      evaluationId: running.id,
      total: snap.criteria.length,
      labels: snap.criteria.map((c) => c.criterion),
      donePositions: (done ?? []).map((d) => d.position),
      resumed: true,
    };
  }

  const { data: rows } = await supabase.from("rubric_criteria").select("*").eq("rubric_id", rubric.id).order("position");
  const criteria: SnapshotCriterion[] = (rows ?? []).map((r, i) => ({
    id: r.id,
    position: i,
    competency: r.competency,
    criterion: r.criterion,
    description: r.description,
    weight: r.weight,
    levels: r.levels as Level[],
  }));
  if (criteria.length === 0) return { ok: false, error: "La rúbrica no tiene criterios." };

  let provider;
  try {
    provider = getProvider();
  } catch (e) {
    return { ok: false, error: e instanceof AIError ? e.message : "No se pudo configurar la IA." };
  }

  // Reserva del presupuesto diario de IA (la cuota gratuita la comparten todos los usuarios).
  const admin = createAdminClient();
  const reservation = await reserveAi(admin, userId, "evaluacion");
  if (!reservation.ok) return { ok: false, error: reservation.error };

  const snapshot: Snapshot = { rubric_id: rubric.id, version: rubric.version, title: rubric.title, scale_max: rubric.scale_max, criteria };
  const { data: ev, error } = await admin
    .from("evaluations")
    .insert({
      user_id: userId,
      lab_id: labId,
      status: "procesando",
      has_rubric: true,
      grade_scale_max: rubric.scale_max,
      rubric_id: rubric.id,
      rubric_version: rubric.version,
      rubric_snapshot: snapshot,
      ai_provider: provider.id,
      ai_model: provider.model,
      prompt_version: `${PROMPT_VERSION}+${SUMMARY_PROMPT_VERSION}`,
    })
    .select("id")
    .single();
  if (error || !ev) {
    await releaseAi(admin, reservation.id);
    return { ok: false, error: "No se pudo iniciar la evaluación." };
  }
  return { ok: true, evaluationId: ev.id, total: criteria.length, labels: criteria.map((c) => c.criterion), donePositions: [], resumed: false };
}

async function guideText(supabase: Supa, lab: { instructions_material_id: string | null; rubric_material_id: string | null }) {
  const id = lab.instructions_material_id ?? lab.rubric_material_id;
  if (!id) return { text: "", material: null as { id: string; title: string; version: string } | null };
  const { data: m } = await supabase.from("reference_materials").select("id, title, version, storage_path").eq("id", id).maybeSingle();
  if (!m?.storage_path) return { text: "", material: null };
  const { data: blob } = await supabase.storage.from("documents").download(m.storage_path);
  if (!blob) return { text: "", material: { id: m.id, title: m.title, version: m.version } };
  const ex = extractParts(m.title, extOf(m.storage_path), new Uint8Array(await blob.arrayBuffer()));
  const first = ex.parts[0];
  return { text: first?.kind === "text" ? first.text : "", material: { id: m.id, title: m.title, version: m.version } };
}

/** Frase honesta sobre qué se verificó del código y qué no. */
function codeLimitation(r: CodeReport | null): string {
  if (!r)
    return "No se hizo verificación técnica del código (no se encontró código analizable o el analizador no estuvo disponible) y el código no se ejecutó: las valoraciones sobre su funcionamiento se basan en el propio código, los informes y las capturas.";
  return `Se verificó la sintaxis y se hizo análisis estático de ${r.summary.analyzed} archivo(s) de código (${r.summary.errors} error(es), ${r.summary.warnings} aviso(s)), pero el código NO se ejecutó y las pruebas unitarias, si existen, tampoco: que un programa no tenga errores de sintaxis no garantiza que funcione ni que produzca los resultados que se muestran.`;
}

function toStepError(e: unknown): StepResult {
  if (e instanceof AIError) return { ok: false, error: e.message, retryable: e.code !== "config" && e.code !== "blocked" };
  if (e instanceof z.ZodError) return { ok: false, error: "La IA devolvió una estructura inesperada. Reintenta.", retryable: true };
  console.error("[evaluación] error inesperado:", e);
  return { ok: false, error: "Ocurrió un error inesperado al evaluar. Reintenta; si persiste, avisa.", retryable: true };
}

async function loadOwnedEvaluation(supabase: Supa, evaluationId: string) {
  const { data: ev } = await supabase.from("evaluations").select("*").eq("id", evaluationId).maybeSingle(); // RLS: solo propias
  return ev;
}

/**
 * Valora TODOS los criterios que falten en UNA sola petición a la IA (la cuota gratuita es de ~20 por día y por modelo).
 * Es reanudable: si ya hay criterios guardados, solo se piden los pendientes. El índice único evita duplicados.
 */
export async function runAssessment(supabase: Supa, userId: string, evaluationId: string): Promise<StepResult> {
  const ev = await loadOwnedEvaluation(supabase, evaluationId);
  if (!ev) return { ok: false, error: "Evaluación no encontrada.", retryable: false };
  if (ev.status !== "procesando") return { ok: false, error: ev.error ?? "La evaluación ya no está en curso.", retryable: false };
  const snap = ev.rubric_snapshot as Snapshot;

  const admin = createAdminClient();
  try {
    const { data: done } = await supabase.from("criterion_results").select("position").eq("evaluation_id", evaluationId);
    const donePositions = new Set((done ?? []).map((d) => d.position as number));
    const pending = snap.criteria.filter((c) => !donePositions.has(c.position));
    if (pending.length === 0) return { ok: true };

    const { data: lab } = await supabase.from("labs").select("*").eq("id", ev.lab_id).single();
    if (!lab) return { ok: false, error: "Laboratorio no encontrado.", retryable: false };
    const { data: files } = await supabase.from("lab_files").select("storage_path, file_name, relative_path, size_bytes").eq("lab_id", ev.lab_id);
    const { items, problems } = await loadEvidence({
      files: (files ?? []).map((f) => ({ path: f.storage_path, name: f.file_name, relativePath: f.relative_path, size: f.size_bytes })),
      repoUrl: lab.repo_url,
      download: async (p) => {
        const { data } = await supabase.storage.from("documents").download(p);
        return data ? new Uint8Array(await data.arrayBuffer()) : null;
      },
    });
    const pkg = buildEvidencePackage(items, problems);
    if (pkg.parts.length === 0)
      return { ok: false, error: "No se pudo leer ninguna evidencia de este laboratorio (¿formatos no admitidos?). Revisa los archivos.", retryable: false };

    // Verificación técnica del código (sintaxis y análisis estático, sin ejecutar nada). Si el analizador fallara,
    // la evaluación continúa y simplemente no incluye esa verificación (se declara en las limitaciones).
    let codeReport: CodeReport | null = null;
    try {
      codeReport = await checkCodeEvidence(items);
    } catch (e) {
      console.error("[evaluación] falló la verificación técnica del código:", e);
    }
    await admin
      .from("evaluations")
      .update({ evidence_inventory: pkg.inventory, test_results: codeReport })
      .eq("id", evaluationId);

    const guide = await guideText(supabase, lab);
    const provider = getProvider();
    const batchInput = {
      codeCheckText: codeReport ? reportForPrompt(codeReport) : undefined,
      criteria: pending.map((c) => ({ position: c.position, criterion: c })),
      lab: { name: lab.name, objectives: lab.objectives },
      guideText: guide.text,
      evidenceParts: pkg.parts,
      evidenceInventory: pkg.inventory,
      texts: pkg.texts,
    };
    // Si casi todos los criterios se quedan sin ninguna cita verificable, algo falló en la IA o en su formato:
    // se reintenta una vez y, si persiste, NO se guarda ni se publica ninguna nota.
    let results = await assessCriteriaBatch(provider, batchInput);
    if (isSystemicVerificationFailure(results)) results = await assessCriteriaBatch(provider, batchInput);
    if (isSystemicVerificationFailure(results))
      return {
        ok: false,
        retryable: true,
        error:
          "La IA no devolvió citas que se pudieran comprobar en tus archivos, así que no se publicó ninguna nota (no es una valoración de tu trabajo). Reintenta; si se repite, avisa para revisarlo.",
      };

    const usedModel = provider.lastModelUsed ?? provider.model;
    const rows = pending.map((crit) => {
      const a = results.get(crit.position)!;
      const flags: Flag[] = [...a.flags];
      if (usedModel !== provider.model)
        flags.push({ level: "aviso", text: `Este criterio se valoró con un modelo alterno (${usedModel}) porque el principal no estaba disponible; puede ser menos preciso.` });
      return {
        evaluation_id: evaluationId,
        user_id: userId,
        position: crit.position,
        criterion_id: crit.id,
        criterion: crit.criterion,
        weight: crit.weight,
        evidence_level: a.evidence_sufficiency,
        percent: a.percent,
        rubric_level: a.rubric_level,
        citations: a.citations,
        concepts: a.concepts,
        flags,
        limitations: a.limitations || null,
        argumentation: a.argumentation,
        recommendation: a.recommendation,
        confidence: a.confidence,
        ai_model: usedModel,
      };
    });
    const { error } = await admin.from("criterion_results").insert(rows);
    if (error && error.code !== "23505") throw new Error(error.message); // 23505: otra llamada ya los guardó
    await admin.from("evaluations").update({ updated_at: new Date().toISOString() }).eq("id", evaluationId);
    return { ok: true };
  } catch (e) {
    return toStepError(e);
  }
}

/** Cierra la evaluación cuando todos los criterios están valorados: nota (en código) + redacción final. */
export async function finalizeEvaluation(supabase: Supa, userId: string, evaluationId: string): Promise<StepResult> {
  void userId;
  const ev = await loadOwnedEvaluation(supabase, evaluationId);
  if (!ev) return { ok: false, error: "Evaluación no encontrada.", retryable: false };
  if (ev.status === "completada") return { ok: true };
  if (ev.status !== "procesando") return { ok: false, error: ev.error ?? "La evaluación ya no está en curso.", retryable: false };

  const snap = ev.rubric_snapshot as Snapshot;
  const { data: results } = await supabase.from("criterion_results").select("*").eq("evaluation_id", evaluationId).order("position");
  const rs = results ?? [];
  if (rs.length < snap.criteria.length) return { ok: false, error: "Faltan criterios por valorar.", retryable: true };

  try {
    const percent = overallPercent(rs.map((r) => ({ weight: Number(r.weight), percent: Number(r.percent) })));
    const grade = estimatedGrade(percent, ev.grade_scale_max);
    const digest: CriterionDigest[] = rs.map((r) => ({
      criterio: r.criterion,
      peso: Number(r.weight),
      porcentaje: Number(r.percent),
      nivel: r.rubric_level ?? "",
      evidencia: r.evidence_level,
      confianza: r.confidence ?? "",
      argumentacion: r.argumentation ?? "",
      recomendacion: r.recommendation ?? "",
      conceptos: r.concepts ?? [],
      limitaciones: r.limitations ?? "",
      avisos: ((r.flags ?? []) as (Flag | string)[]).map(flagText),
    }));
    const { data: lab } = await supabase.from("labs").select("*").eq("id", ev.lab_id).single();
    const provider = getProvider();
    const report = await generateFinalReport(provider, { lab: { name: lab?.name ?? "", objectives: lab?.objectives ?? "" }, overallPercent: percent, criteria: digest });
    const guide = lab ? await guideText(supabase, lab) : { text: "", material: null };

    const inv = (ev.evidence_inventory ?? []) as InventoryEntry[];
    const skipped = inv.filter((i) => i.mode === "omitido" || i.mode === "unsupported");
    const withWarnings = rs.filter((r) => ((r.flags ?? []) as (Flag | string)[]).some((f) => flagLevel(f) === "aviso")).length;
    const altModels = [...new Set(rs.map((r) => r.ai_model).filter((m) => m && m !== ev.ai_model))];
    const limitations = [
      codeLimitation(ev.test_results as CodeReport | null),
      skipped.length ? `${skipped.length} archivo(s) no se pudieron analizar o se omitieron por límites de tamaño: ${skipped.slice(0, 5).map((s) => s.location).join(", ")}${skipped.length > 5 ? "…" : ""}.` : "",
      withWarnings ? `${withWarnings} criterio(s) tienen avisos que conviene revisar (ver su detalle).` : "",
      altModels.length ? `Algunos criterios se valoraron con un modelo alterno (${altModels.join(", ")}) por indisponibilidad del principal.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const { infografia, retroalimentacion, ...summary } = report;
    const { error } = await createAdminClient()
      .from("evaluations")
      .update({
        status: "completada",
        overall_percent: percent,
        estimated_grade: grade,
        summary: { ...summary, modelo_resumen: provider.lastModelUsed ?? provider.model },
        feedback: retroalimentacion,
        infographic: infografia,
        limitations,
        materials_used: {
          guia: guide.material,
          rubrica: { id: snap.rubric_id, version: snap.version, titulo: snap.title },
          repositorio: lab?.repo_url ?? null,
          archivos_analizados: inv.filter((i) => i.mode === "text" || i.mode === "native").length,
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", evaluationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return toStepError(e);
  }
}

export async function cancelEvaluation(supabase: Supa, evaluationId: string): Promise<boolean> {
  const ev = await loadOwnedEvaluation(supabase, evaluationId);
  if (!ev || ev.status !== "procesando") return false;
  await createAdminClient().from("evaluations").update({ status: "fallida", error: "Cancelada por el estudiante." }).eq("id", evaluationId);
  return true;
}
