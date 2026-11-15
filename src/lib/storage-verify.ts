import type { SupabaseClient } from "@supabase/supabase-js";
import { FILE_TYPES, MAX_FILE_BYTES, extOf } from "./files";

export type Verified = { ok: true; size: number; mime: string } | { ok: false; error: string };

/**
 * Comprueba un archivo YA subido por el navegador: que sea de este usuario, que exista y que
 * su tamaño real (según Storage, no según el cliente) y extensión sean válidos.
 * Si no cumple, lo borra para no dejar archivos huérfanos.
 */
export async function verifyUpload(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<Verified> {
  const fail = async (error: string): Promise<Verified> => {
    if (path.startsWith(userId + "/")) await supabase.storage.from("documents").remove([path]);
    return { ok: false, error };
  };

  if (!path.startsWith(userId + "/") || path.includes("..")) return { ok: false, error: "Ruta de archivo no válida." };
  if (!FILE_TYPES[extOf(path)]) return fail("Formato de archivo no admitido.");

  const { data, error } = await supabase.storage.from("documents").info(path);
  if (error || !data) return { ok: false, error: "No se encontró el archivo subido." };
  const size = data.size ?? 0;
  if (size <= 0 || size > MAX_FILE_BYTES) return fail("El archivo está vacío o supera 50 MB.");
  return { ok: true, size, mime: data.contentType ?? "application/octet-stream" };
}

export function newStoragePath(userId: string, scope: string, fileName: string): string {
  // Nombre aleatorio: el nombre original va en la BD, nunca en la ruta (evita caracteres raros).
  return `${userId}/${scope}/${crypto.randomUUID()}.${extOf(fileName)}`;
}
