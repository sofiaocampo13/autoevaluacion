import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extOf } from "@/lib/files";
import { hashToken } from "@/lib/review";
import { isPlausibleToken, linkState } from "@/lib/review-logic";

// Deja al docente abrir un archivo citado como evidencia (por ejemplo una captura que el sistema no puede verificar).
// Solo sirve archivos del laboratorio de la evaluación enlazada, mientras el enlace no esté revocado ni expirado.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loc = request.nextUrl.searchParams.get("loc") ?? "";
  const notFound = () => new NextResponse("No encontrado", { status: 404 });
  if (!isPlausibleToken(token) || !loc || loc.length > 500) return notFound();

  const admin = createAdminClient();
  const { data: link } = await admin.from("review_links").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!link) return notFound();
  const state = linkState(link);
  if (state === "revocado" || state === "expirado") return notFound();

  const { data: ev } = await admin.from("evaluations").select("lab_id").eq("id", link.evaluation_id).single();
  if (!ev) return notFound();
  // La ubicación citada es la ruta relativa del archivo (o su nombre si se subió suelto).
  const { data: files } = await admin.from("lab_files").select("storage_path, file_name, relative_path").eq("lab_id", ev.lab_id);
  const file = (files ?? []).find((f) => (f.relative_path || f.file_name) === loc);
  if (!file) return notFound();

  // Solo imágenes, PDF y texto se muestran en el navegador; lo demás (HTML, código…) se descarga sin abrirse.
  const inline = ["png", "jpg", "jpeg", "webp", "pdf", "txt", "md", "csv"].includes(extOf(file.file_name));
  const { data } = await admin.storage.from("documents").createSignedUrl(file.storage_path, 300, { download: inline ? false : file.file_name });
  if (!data) return notFound();
  return NextResponse.redirect(data.signedUrl);
}
