"use client";

import { createClient } from "@/lib/supabase/client";
import { extOf, validateFile } from "@/lib/files";

/** Sube un archivo directo a Supabase Storage (no pasa por el servidor de la app). */
export async function uploadFile(
  file: File,
  scope: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const invalid = validateFile(file);
  if (invalid) return { ok: false, error: invalid };

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const path = `${auth.user.id}/${scope}/${crypto.randomUUID()}.${extOf(file.name)}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined });
  if (error) {
    // La política de Storage rechaza la subida cuando se alcanzó el tope de almacenamiento (del usuario o de la plataforma).
    if (/row-level security|violates|unauthorized|403/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ""}`))
      return { ok: false, error: "No se pudo subir: alcanzaste tu límite de almacenamiento o el de la plataforma. Elimina archivos que ya no necesites." };
    return { ok: false, error: `No se pudo subir "${file.name}". Inténtalo de nuevo.` };
  }
  return { ok: true, path };
}
