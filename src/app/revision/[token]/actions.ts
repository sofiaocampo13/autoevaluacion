"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitReview } from "@/lib/review";

const schema = z.object({
  reviewerName: z.string().max(200),
  reviewerEmail: z.string().max(200).optional(),
  decision: z.enum(["aprobar", "devolver"]),
  comment: z.string().max(5000),
  adjustments: z
    .array(z.object({ position: z.number().int().min(0).max(100), adjustedPercent: z.number(), justification: z.string().max(2000) }))
    .max(60),
});

/** El docente no tiene sesión: la autorización es el propio enlace, que se vuelve a validar en cada envío. */
export async function submitTeacherReview(token: string, payload: z.infer<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success || typeof token !== "string" || token.length > 100) return { ok: false, error: "Los datos enviados no son válidos." };
  const res = await submitReview(createAdminClient(), token, parsed.data);
  if (res.ok) revalidatePath(`/revision/${token}`);
  return res;
}
