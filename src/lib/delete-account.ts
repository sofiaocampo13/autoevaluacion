import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "documents";

/** Todas las rutas de archivo bajo un prefijo (Storage lista por carpeta: se baja recursivamente). */
async function listAll(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const e of data) {
      if (e.id) out.push(`${prefix}/${e.name}`); // archivo
      else out.push(...(await listAll(admin, `${prefix}/${e.name}`))); // carpeta
    }
    if (data.length < 100) break;
  }
  return out;
}

/**
 * Borra TODO lo de una persona: primero sus archivos de Storage y, solo si no quedó ninguno, su usuario.
 * Al borrar el usuario, la base elimina en cascada su perfil, asignaturas, laboratorios, rúbricas, evaluaciones,
 * análisis, enlaces de revisión y consumo de IA. Si algo falla antes de borrar el usuario, no se pierde nada y se puede reintentar.
 * `admin` es el cliente con clave de servicio; quien llama debe haber comprobado ya la identidad de la persona.
 */
export async function deleteUserData(admin: SupabaseClient, userId: string): Promise<{ ok: true; files: number } | { ok: false; error: string }> {
  try {
    const paths = await listAll(admin, userId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
      if (error) return { ok: false, error: "No se pudieron borrar tus archivos. No se eliminó nada; inténtalo de nuevo." };
    }
    if ((await listAll(admin, userId)).length > 0) return { ok: false, error: "Quedaron archivos sin borrar. No se eliminó tu cuenta; inténtalo de nuevo." };

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: "Se borraron tus archivos pero no se pudo eliminar la cuenta. Inténtalo de nuevo." };
    return { ok: true, files: paths.length };
  } catch (e) {
    console.error("[eliminar cuenta] error:", e);
    return { ok: false, error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };
  }
}
