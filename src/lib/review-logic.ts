// Lógica pura de la revisión docente: estado del enlace y recálculo de la nota. Sin acceso a base de datos.
import { estimatedGrade, overallPercent } from "./scoring";

export const LINK_DAYS = 14;
export const MAX_ACTIVE_LINKS = 3;

export type LinkState = "activo" | "expirado" | "revocado" | "usado";

export function linkState(l: { expires_at: string; revoked_at: string | null; used_at: string | null }, now = new Date()): LinkState {
  if (l.revoked_at) return "revocado";
  if (l.used_at) return "usado";
  if (new Date(l.expires_at).getTime() <= now.getTime()) return "expirado";
  return "activo";
}

export const STATE_LABEL: Record<LinkState, string> = {
  activo: "Activo",
  expirado: "Expirado",
  revocado: "Revocado",
  usado: "Usado (ya hay una revisión)",
};

export type CriterionForReview = { position: number; criterion: string; weight: number; percent: number };
export type AdjustmentInput = { position: number; adjustedPercent: number; justification: string };
export type FullAdjustment = {
  position: number;
  criterion: string;
  original_percent: number;
  adjusted_percent: number;
  justification: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const MIN_JUSTIFICATION = 8;

/**
 * Valida los ajustes del docente y recalcula la nota. El docente NO escribe una nota libre: ajusta el porcentaje de
 * criterios concretos (con justificación) y el sistema recalcula con los pesos de la rúbrica.
 */
export function evaluateReview(
  criteria: CriterionForReview[],
  adjustments: AdjustmentInput[],
  scaleMax: number,
): { ok: true; adjustments: FullAdjustment[]; finalPercent: number; finalGrade: number; changed: boolean } | { ok: false; error: string } {
  const byPos = new Map(criteria.map((c) => [c.position, c]));
  const adjusted = new Map<number, number>();
  const full: FullAdjustment[] = [];
  const seen = new Set<number>();

  for (const a of adjustments) {
    const c = byPos.get(a.position);
    if (!c) return { ok: false, error: "Se envió un ajuste para un criterio que no existe." };
    if (seen.has(a.position)) return { ok: false, error: "Hay dos ajustes para el mismo criterio." };
    seen.add(a.position);
    if (!Number.isFinite(a.adjustedPercent) || a.adjustedPercent < 0 || a.adjustedPercent > 100)
      return { ok: false, error: `El porcentaje de "${c.criterion}" debe estar entre 0 y 100.` };
    const value = round2(a.adjustedPercent);
    if (Math.abs(value - c.percent) < 0.005) continue; // sin cambio real: no es un ajuste
    if (a.justification.trim().length < MIN_JUSTIFICATION)
      return { ok: false, error: `Explica brevemente por qué cambias "${c.criterion}" (mínimo ${MIN_JUSTIFICATION} caracteres).` };
    adjusted.set(a.position, value);
    full.push({ position: a.position, criterion: c.criterion, original_percent: c.percent, adjusted_percent: value, justification: a.justification.trim().slice(0, 1000) });
  }

  const finalPercent = overallPercent(criteria.map((c) => ({ weight: c.weight, percent: adjusted.get(c.position) ?? c.percent })));
  return { ok: true, adjustments: full, finalPercent, finalGrade: estimatedGrade(finalPercent, scaleMax), changed: full.length > 0 };
}

/** Los enlaces son 32 bytes aleatorios en base64url = 43 caracteres. Descartar lo demás evita consultas inútiles. */
export const isPlausibleToken = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

export const REVIEW_LABEL = {
  preliminar: "Preliminar (sin revisión docente)",
  aprobada: "Aprobada por el docente",
  ajustada: "Aprobada con ajustes del docente",
  devuelta: "Devuelta por el docente con comentarios",
} as const;
