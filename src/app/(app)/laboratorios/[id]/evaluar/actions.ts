"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cancelEvaluation, startEvaluation, type StartResult } from "@/lib/run-evaluation";

const uuid = z.string().uuid();

export async function startEval(labId: string): Promise<StartResult> {
  if (!uuid.safeParse(labId).success) return { ok: false, error: "Laboratorio no válido." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  return startEvaluation(supabase, data.user.id, labId);
}

export async function cancelEval(evaluationId: string): Promise<boolean> {
  if (!uuid.safeParse(evaluationId).success) return false;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  return cancelEvaluation(supabase, evaluationId);
}
