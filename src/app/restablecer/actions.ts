"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const back = (msg: string) => redirect(`/restablecer?error=${encodeURIComponent(msg)}`);

/** Fija la contraseña nueva tras abrir el enlace de recuperación (la sesión de recuperación ya está abierta). */
export async function setNewPassword(formData: FormData) {
  const pw = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72).safeParse(formData.get("password"));
  if (!pw.success) back(pw.error.issues[0].message);
  if (formData.get("confirm") !== pw.data) back("Las dos contraseñas no coinciden.");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?error=${encodeURIComponent("El enlace expiró. Pide uno nuevo desde «Olvidé mi contraseña».")}`);

  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) {
    console.error("[restablecer] updateUser falló:", error.code, error.message);
    back(error.code === "same_password" ? "La contraseña nueva debe ser distinta de la anterior." : "No se pudo cambiar la contraseña. Pide un enlace nuevo e inténtalo de nuevo.");
  }
  // Se cierra la sesión de recuperación: se entra con la contraseña nueva, como en cualquier sitio.
  await supabase.auth.signOut().catch(() => undefined);
  redirect(`/login?ok=${encodeURIComponent("Contraseña actualizada. Inicia sesión con la nueva.")}`);
}
