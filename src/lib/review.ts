// Revisión docente por enlace. Estas funciones reciben el cliente con la clave de servicio (el docente no tiene sesión);
// quien las llama es responsable de haber comprobado antes que el estudiante es dueño de la evaluación.
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LINK_DAYS,
  MAX_ACTIVE_LINKS,
  evaluateReview,
  isPlausibleToken,
  linkState,
  type AdjustmentInput,
  type CriterionForReview,
  type LinkState,
} from "./review-logic";

type Admin = SupabaseClient;

// Solo se guarda el hash: aunque alguien leyera la base de datos, no podría reconstruir ningún enlace.
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function createReviewLink(
  admin: Admin,
  userId: string,
  evaluationId: string,
  siteUrl: string,
): Promise<{ ok: true; url: string; expiresAt: string } | { ok: false; error: string }> {
  const { data: ev } = await admin.from("evaluations").select("id, user_id, status, review_status").eq("id", evaluationId).maybeSingle();
  if (!ev || ev.user_id !== userId) return { ok: false, error: "Evaluación no encontrada." };
  if (ev.status !== "completada") return { ok: false, error: "Solo se puede pedir revisión de una evaluación completada." };
  if (ev.review_status !== "preliminar") return { ok: false, error: "Esta evaluación ya fue revisada por un docente." };

  const { data: links } = await admin.from("review_links").select("expires_at, revoked_at, used_at").eq("evaluation_id", evaluationId);
  const active = (links ?? []).filter((l) => linkState(l) === "activo").length;
  if (active >= MAX_ACTIVE_LINKS) return { ok: false, error: `Ya hay ${active} enlaces activos. Revoca alguno antes de crear otro.` };

  const token = newToken();
  const expiresAt = new Date(Date.now() + LINK_DAYS * 24 * 3600 * 1000).toISOString();
  const { error } = await admin.from("review_links").insert({ evaluation_id: evaluationId, user_id: userId, token_hash: hashToken(token), expires_at: expiresAt });
  if (error) return { ok: false, error: "No se pudo crear el enlace." };
  return { ok: true, url: `${siteUrl.replace(/\/$/, "")}/revision/${token}`, expiresAt };
}

export async function revokeReviewLink(admin: Admin, userId: string, linkId: string): Promise<boolean> {
  const { data } = await admin
    .from("review_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id");
  return !!data?.length;
}

export type ReviewView = {
  state: LinkState;
  linkId: string;
  student: string;
  lab: { id: string; name: string; description: string };
  evaluation: {
    id: string;
    createdAt: string;
    scaleMax: number;
    aiPercent: number;
    aiGrade: number;
    reviewStatus: string;
    limitations: string | null;
    rubricVersion: number | null;
    model: string | null;
  };
  criteria: {
    position: number;
    criterion: string;
    weight: number;
    rubricLevel: string;
    percent: number;
    evidence: string;
    confidence: string;
    argumentation: string;
    recommendation: string;
    citations: { location: string; quote: string; status: string; hasFile: boolean }[];
    warnings: string[];
  }[];
  summary: string;
  decided: { decision: string; reviewer: string; at: string; finalPercent: number | null; finalGrade: number | null; comment: string } | null;
};

/** Devuelve lo que el docente puede ver, o null si el enlace no existe. Para cualquier enlace inválido la respuesta es la misma. */
export async function loadReviewView(admin: Admin, token: string): Promise<ReviewView | null> {
  if (!isPlausibleToken(token)) return null;
  const { data: link } = await admin.from("review_links").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!link) return null;
  const state = linkState(link);
  if (state === "revocado" || state === "expirado") return { state } as ReviewView; // la página mostrará un mensaje, sin datos

  const { data: ev } = await admin.from("evaluations").select("*").eq("id", link.evaluation_id).single();
  if (!ev || ev.status !== "completada") return null;
  const [{ data: lab }, { data: results }, { data: profile }, { data: files }, { data: review }] = await Promise.all([
    admin.from("labs").select("id, name, description").eq("id", ev.lab_id).single(),
    admin.from("criterion_results").select("*").eq("evaluation_id", ev.id).order("position"),
    admin.from("profiles").select("full_name").eq("id", ev.user_id).maybeSingle(),
    admin.from("lab_files").select("file_name, relative_path").eq("lab_id", ev.lab_id),
    admin.from("teacher_reviews").select("*").eq("evaluation_id", ev.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!lab || !results) return null;

  if (state === "activo") await admin.from("review_links").update({ last_viewed_at: new Date().toISOString() }).eq("id", link.id);

  const known = new Set((files ?? []).flatMap((f) => [f.relative_path || f.file_name]));
  const flagText = (f: unknown) => (typeof f === "string" ? f : (f as { text: string }).text);
  const flagLevel = (f: unknown) => (typeof f === "string" ? "aviso" : (f as { level: string }).level);

  return {
    state,
    linkId: link.id,
    student: profile?.full_name || "Estudiante",
    lab: { id: lab.id, name: lab.name, description: lab.description ?? "" },
    evaluation: {
      id: ev.id,
      createdAt: ev.completed_at ?? ev.created_at,
      scaleMax: Number(ev.grade_scale_max),
      aiPercent: Number(ev.overall_percent),
      aiGrade: Number(ev.estimated_grade),
      reviewStatus: ev.review_status,
      limitations: ev.limitations,
      rubricVersion: ev.rubric_version,
      model: ev.ai_model,
    },
    criteria: results.map((r) => ({
      position: r.position,
      criterion: r.criterion,
      weight: Number(r.weight),
      rubricLevel: r.rubric_level ?? "",
      percent: Number(r.percent),
      evidence: r.evidence_level,
      confidence: r.confidence ?? "",
      argumentation: r.argumentation ?? "",
      recommendation: r.recommendation ?? "",
      citations: ((r.citations ?? []) as { location: string; quote: string; status: string }[]).map((c) => ({ ...c, hasFile: known.has(c.location) })),
      warnings: ((r.flags ?? []) as unknown[]).filter((f) => flagLevel(f) === "aviso").map(flagText),
    })),
    summary: (ev.summary as { resumen?: string } | null)?.resumen ?? "",
    decided: review
      ? { decision: review.decision, reviewer: review.reviewer_name, at: review.created_at, finalPercent: review.final_percent, finalGrade: review.final_grade, comment: review.comment }
      : null,
  };
}

export type ReviewSubmission = {
  reviewerName: string;
  reviewerEmail?: string;
  decision: "aprobar" | "devolver";
  adjustments: AdjustmentInput[];
  comment: string;
};

export async function submitReview(admin: Admin, token: string, input: ReviewSubmission): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPlausibleToken(token)) return { ok: false, error: "Enlace no válido." };
  const name = input.reviewerName.trim();
  const email = (input.reviewerEmail ?? "").trim();
  const comment = input.comment.trim();
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Escribe tu nombre (entre 2 y 120 caracteres)." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "El correo no es válido (puedes dejarlo vacío)." };
  if (comment.length > 4000) return { ok: false, error: "El comentario es demasiado largo (máximo 4000 caracteres)." };

  const { data: link } = await admin.from("review_links").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!link) return { ok: false, error: "Enlace no válido." };
  const state = linkState(link);
  if (state !== "activo") return { ok: false, error: state === "usado" ? "Este enlace ya se usó para una revisión." : `Este enlace está ${state}.` };

  const { data: ev } = await admin.from("evaluations").select("*").eq("id", link.evaluation_id).single();
  if (!ev || ev.status !== "completada") return { ok: false, error: "La evaluación no está disponible." };
  if (ev.review_status !== "preliminar") return { ok: false, error: "Esta evaluación ya fue revisada." };

  const { data: rs } = await admin.from("criterion_results").select("position, criterion, weight, percent").eq("evaluation_id", ev.id).order("position");
  const criteria: CriterionForReview[] = (rs ?? []).map((r) => ({ position: r.position, criterion: r.criterion, weight: Number(r.weight), percent: Number(r.percent) }));

  let decision: "aprobada" | "ajustada" | "devuelta";
  let adjustments: unknown[] = [];
  let finalPercent: number | null = null;
  let finalGrade: number | null = null;

  if (input.decision === "devolver") {
    if (comment.length < 10) return { ok: false, error: "Para devolver la evaluación explica el motivo (mínimo 10 caracteres)." };
    decision = "devuelta";
  } else {
    const r = evaluateReview(criteria, input.adjustments, Number(ev.grade_scale_max));
    if (!r.ok) return r;
    decision = r.changed ? "ajustada" : "aprobada";
    adjustments = r.adjustments;
    finalPercent = r.finalPercent;
    finalGrade = r.finalGrade;
  }

  // Consumir el enlace de forma atómica: si dos personas envían a la vez, solo una lo logra.
  const now = new Date().toISOString();
  const { data: consumed } = await admin.from("review_links").update({ used_at: now }).eq("id", link.id).is("used_at", null).is("revoked_at", null).select("id");
  if (!consumed?.length) return { ok: false, error: "Este enlace ya se usó para una revisión." };

  const rollback = () => admin.from("review_links").update({ used_at: null }).eq("id", link.id);
  const { error: e1 } = await admin.from("teacher_reviews").insert({
    evaluation_id: ev.id,
    link_id: link.id,
    user_id: ev.user_id,
    reviewer_name: name,
    reviewer_email: email || null,
    decision,
    adjustments,
    final_percent: finalPercent,
    final_grade: finalGrade,
    comment,
  });
  if (e1) {
    await rollback();
    return { ok: false, error: "No se pudo guardar la revisión. Inténtalo de nuevo." };
  }
  const { error: e2 } = await admin
    .from("evaluations")
    .update({ review_status: decision, final_percent: finalPercent, final_grade: finalGrade, reviewed_at: now, reviewer_name: name })
    .eq("id", ev.id)
    .eq("review_status", "preliminar");
  if (e2) {
    await admin.from("teacher_reviews").delete().eq("link_id", link.id);
    await rollback();
    return { ok: false, error: "No se pudo registrar la revisión. Inténtalo de nuevo." };
  }
  return { ok: true };
}
