import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { finalizeEvaluation, runAssessment } from "@/lib/run-evaluation";

// Dos pasos: valorar todos los criterios (una petición a la IA) y cerrar (nota + redacción final).
// Valorar todos los criterios en una sola petición puede tardar más de un minuto con la IA gratuita.
// 300 s es el máximo en Vercel Hobby con Fluid Compute: se verifica al desplegar (fase 6).
export const maxDuration = 300;

const body = z.union([z.object({ assess: z.literal(true) }), z.object({ finalize: z.literal(true) })]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json({ ok: false, error: "Solicitud no válida.", retryable: false }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión.", retryable: false }, { status: 401 });

  const result =
    "finalize" in parsed.data
      ? await finalizeEvaluation(supabase, data.user.id, id)
      : await runAssessment(supabase, data.user.id, id);
  return NextResponse.json(result);
}
