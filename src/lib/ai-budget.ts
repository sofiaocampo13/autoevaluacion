import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Presupuesto diario de IA. La cuota gratuita de Gemini (~20 peticiones por día y modelo) la comparten TODOS los usuarios:
 * cada operación reserva unidades antes de llamar a la IA, con un tope por usuario y otro global (ventana móvil de 24 h).
 * Una evaluación completa gasta ~3 peticiones (valoración, posible reintento y redacción final); lo demás, 1.
 */
export const AI_COST = { evaluacion: 3, rubrica: 1, analisis: 1, laboratorio: 1 } as const;
export type AiKind = keyof typeof AI_COST;

const intEnv = (name: string, fallback: number) => {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
/** Topes configurables por variable de entorno; el global queda por debajo de las 20 peticiones para dejar margen a reintentos. */
export const aiLimits = () => ({ user: intEnv("AI_USER_DAILY_UNITS", 12), global: intEnv("AI_GLOBAL_DAILY_UNITS", 18) });

export type Reservation = { ok: true; id: string } | { ok: false; error: string };

const fmtWhen = (iso: string | null | undefined) => {
  if (!iso) return "más tarde";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "más tarde";
  return `hacia las ${t.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })} (hora de Colombia)`;
};

/** Reserva el costo de una operación antes de llamar a la IA. `admin` = cliente con clave de servicio. */
export async function reserveAi(admin: SupabaseClient, userId: string, kind: AiKind, limits = aiLimits()): Promise<Reservation> {
  const { data, error } = await admin.rpc("reserve_ai_budget", {
    p_user: userId,
    p_kind: kind,
    p_units: AI_COST[kind],
    p_user_limit: limits.user,
    p_global_limit: limits.global,
  });
  if (error || !data) {
    console.error("[límite de IA] no se pudo comprobar el presupuesto:", error?.message);
    return { ok: false, error: "No se pudo comprobar tu límite de uso de la IA. Inténtalo de nuevo en un momento." };
  }
  const r = data as { ok: boolean; id?: string; reason?: "user" | "global"; used?: number; limit?: number; retry_at?: string };
  if (r.ok && r.id) return { ok: true, id: r.id };
  if (r.reason === "global")
    return { ok: false, error: `La plataforma alcanzó hoy el límite de uso de la IA gratuita, que comparten todos los usuarios. Podrás volver a intentarlo ${fmtWhen(r.retry_at)}.` };
  return {
    ok: false,
    error: `Alcanzaste tu límite diario de uso de la IA (${r.used} de ${r.limit} unidades en las últimas 24 horas; una evaluación gasta ${AI_COST.evaluacion}, las demás operaciones con IA gastan 1). Podrás volver a usarla ${fmtWhen(r.retry_at)}.`,
  };
}

/** Devuelve la reserva si la operación falló antes de obtener un resultado de la IA, para no cobrar un intento fallido. */
export async function releaseAi(admin: SupabaseClient, reservationId: string) {
  const { error } = await admin.from("ai_usage").delete().eq("id", reservationId);
  if (error) console.error("[límite de IA] no se pudo liberar la reserva:", error.message);
}
