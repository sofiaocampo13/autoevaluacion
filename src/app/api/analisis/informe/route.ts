import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSemesterBundle } from "@/lib/semester-data";
import { latestAnalysis, signatureOf } from "@/lib/run-semester";
import { renderSemesterReportPdf } from "@/lib/semester-report-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// Informe integrado del semestre en PDF. Con ?download=1 se descarga; sin él se abre en el navegador.
// Se arma siempre desde los datos guardados y con el cliente del usuario (RLS: solo ve lo suyo). No llama a la IA.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Tu sesión expiró. Vuelve a iniciar sesión.", { status: 401 });

  const { data: subject } = await supabase.from("subjects").select("*").order("created_at").limit(1).maybeSingle();
  if (!subject) return new NextResponse("Primero registra tu asignatura.", { status: 404 });

  const { stats, details } = await loadSemesterBundle(supabase, subject.id, Number(subject.grade_scale_max));
  if (stats.labsEvaluated === 0) return new NextResponse("Todavía no hay laboratorios evaluados: no hay informe del semestre.", { status: 409 });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
  const saved = await latestAnalysis(supabase, subject.id);

  let pdf: Buffer;
  try {
    pdf = await renderSemesterReportPdf({
      student: profile?.full_name || auth.user.email || "Estudiante",
      subject: subject.name,
      period: subject.academic_period || "",
      generatedAt: new Date(),
      stats,
      details,
      analysis: saved,
      analysisCurrent: saved != null && saved.signature === signatureOf(stats),
    });
  } catch (e) {
    console.error("[informe-semestre] no se pudo generar el PDF:", e);
    return new NextResponse("No se pudo generar el informe. Inténtalo de nuevo.", { status: 500 });
  }

  const safeName = subject.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "asignatura";
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="informe-semestre-${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
