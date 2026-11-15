"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReviewLink, revokeReviewLink } from "@/lib/review";

const uuid = z.string().uuid();

/** Crea un enlace de revisión. Antes de usar la clave de servicio se comprueba, con la sesión del estudiante (RLS), que la evaluación es suya. */
export async function createLink(evaluationId: string): Promise<{ ok: true; url: string; expiresAt: string } | { ok: false; error: string }> {
  if (!uuid.safeParse(evaluationId).success) return { ok: false, error: "Evaluación no válida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const { data: own } = await supabase.from("evaluations").select("id, lab_id").eq("id", evaluationId).maybeSingle();
  if (!own) return { ok: false, error: "Evaluación no encontrada." };

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return { ok: false, error: "Falta NEXT_PUBLIC_SITE_URL en la configuración del servidor." };
  const res = await createReviewLink(createAdminClient(), auth.user.id, evaluationId, site);
  if (res.ok) revalidatePath(`/laboratorios/${own.lab_id}/evaluacion/${evaluationId}`);
  return res;
}

export async function revokeLink(linkId: string): Promise<boolean> {
  if (!uuid.safeParse(linkId).success) return false;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const ok = await revokeReviewLink(createAdminClient(), auth.user.id, linkId);
  if (ok) revalidatePath("/laboratorios", "layout");
  return ok;
}
