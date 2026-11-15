import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Genera una URL firmada de 60 s. Storage aplica RLS: solo se firma lo que es del usuario.
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const name = (request.nextUrl.searchParams.get("name") ?? "archivo").slice(0, 150);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !path.startsWith(auth.user.id + "/") || path.includes("..")) {
    return new NextResponse("No autorizado", { status: 403 });
  }
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60, { download: name });
  if (error || !data) return new NextResponse("Archivo no encontrado", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
