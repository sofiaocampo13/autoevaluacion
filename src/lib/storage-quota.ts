import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_FILE_BYTES, formatSize } from "./files";

export type StorageQuota = { usedBytes: number; usedFiles: number; limitBytes: number; limitFiles: number };

/** Consumo y topes del usuario con sesión (las funciones SQL usan auth.uid(): solo ve lo suyo). null si no se pudo consultar. */
export async function getStorageQuota(supabase: SupabaseClient): Promise<StorageQuota | null> {
  const [usage, limits] = await Promise.all([supabase.rpc("my_storage_usage"), supabase.rpc("storage_limits")]);
  if (usage.error || limits.error || !usage.data || !limits.data) return null;
  return {
    usedBytes: Number(usage.data.bytes),
    usedFiles: Number(usage.data.files),
    limitBytes: Number(limits.data.user_bytes),
    limitFiles: Number(limits.data.user_files),
  };
}

/**
 * La política de Storage frena la subida cuando el usuario YA alcanzó su tope, pero no sabe cuánto pesa el archivo que llega:
 * puede pasarse por un archivo (máx. MAX_FILE_BYTES). Aquí se pone el techo duro: más allá de tope + un archivo, no se registra.
 */
export const overHardCap = (q: StorageQuota) => q.usedBytes > q.limitBytes + MAX_FILE_BYTES || q.usedFiles > q.limitFiles + 30;

export const quotaMessage = (q: StorageQuota) =>
  `Alcanzaste tu límite de almacenamiento (${formatSize(q.usedBytes)} de ${formatSize(q.limitBytes)}, ${q.usedFiles} de ${q.limitFiles} archivos). Elimina archivos o materiales que ya no necesites y vuelve a intentarlo.`;
