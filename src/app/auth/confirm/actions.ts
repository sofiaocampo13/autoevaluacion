"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  token_hash: z.string().min(10).max(300),
  type: z.enum(["email", "signup", "recovery"]),
  // Solo rutas internas, para evitar redirecciones abiertas.
  next: z.string().refine((n) => n.startsWith("/") && !n.startsWith("//"), "ruta no válida").default("/"),
});

const fail = () =>
  redirect(`/login?error=${encodeURIComponent("El enlace no es válido o ya se usó. Pide uno nuevo: si es para recuperar la contraseña, desde «Olvidé mi contraseña»; si es de registro, intenta iniciar sesión o regístrate de nuevo.")}`);

/**
 * Confirma el correo (o abre el restablecimiento de contraseña) con el código del enlace del correo.
 * A diferencia del flujo con «code», NO depende del navegador donde se hizo la solicitud: sirve abrir el enlace desde el celular.
 * Se ejecuta al pulsar un botón (no al abrir el enlace) para que los antivirus de correo que visitan los enlaces no lo gasten.
 */
export async function confirmToken(formData: FormData) {
  const parsed = schema.safeParse({
    token_hash: formData.get("token_hash"),
    type: formData.get("type"),
    next: formData.get("next") || "/",
  });
  if (!parsed.success) fail();
  const { token_hash, type, next } = parsed.data!;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) fail();

  // Primer acceso tras confirmar: guarda el consentimiento de IA que se aceptó al registrarse (si falta).
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase.from("profiles").update({ ai_consent_at: new Date().toISOString() }).eq("id", data.user.id).is("ai_consent_at", null);
  }
  redirect(type === "recovery" ? "/restablecer" : next);
}
