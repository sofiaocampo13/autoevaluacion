import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSemesterAnalysis } from "@/lib/run-semester";

// Una sola petición a la IA; con la cuota gratuita puede tardar más de un minuto.
export const maxDuration = 300;

const body = z.object({ subjectId: z.string().uuid(), force: z.boolean().optional() });

export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Solicitud no válida." }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });

  return NextResponse.json(await runSemesterAnalysis(supabase, createAdminClient(), data.user.id, parsed.data.subjectId, parsed.data.force === true));
}
