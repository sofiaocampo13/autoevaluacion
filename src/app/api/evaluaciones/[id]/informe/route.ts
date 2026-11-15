import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadReportData } from "@/lib/report-data";
import { renderReportPdf } from "@/lib/report-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// Genera el informe PDF de una evaluación completada. Con ?download=1 se descarga; sin él se abre en el navegador.
// El informe se calcula siempre a partir de los datos guardados, así que es reproducible. Con el cliente del usuario,
// RLS garantiza que solo se pueda generar el informe de evaluaciones propias.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new NextResponse("Solicitud no válida", { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Tu sesión expiró. Vuelve a iniciar sesión.", { status: 401 });

  const { data: ev } = await supabase.from("evaluations").select("lab_id").eq("id", id).maybeSingle();
  if (!ev) return new NextResponse("Evaluación no encontrada", { status: 404 });

  const data = await loadReportData(supabase, ev.lab_id, id);
  if (!data) return new NextResponse("La evaluación aún no está completada: no hay informe.", { status: 409 });

  let pdf: Buffer;
  try {
    pdf = await renderReportPdf(data);
  } catch (e) {
    console.error("[informe] no se pudo generar el PDF:", e);
    return new NextResponse("No se pudo generar el informe. Inténtalo de nuevo.", { status: 500 });
  }

  const safeName = data.labName.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "laboratorio";
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="informe-${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
