"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const email = z.string().trim().toLowerCase().email("Correo no válido");
const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72);

const back = (path: string, msg: string, kind: "error" | "ok" = "error") =>
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

export async function login(formData: FormData) {
  const parsed = z.object({ email, password: z.string().min(1) }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) back("/login", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data!);
  if (error) back("/login", "Correo o contraseña incorrectos");
  redirect("/");
}

export async function register(formData: FormData) {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Escribe tu nombre").max(120),
      email,
      password,
      consent: z.literal("on", { message: "Debes aceptar el aviso de privacidad de la IA" }),
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      consent: formData.get("consent"),
    });
  if (!parsed.success) back("/registro", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data!.email,
    password: parsed.data!.password,
    options: {
      data: { full_name: parsed.data!.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) console.error("[register] signUp falló:", error.status, error.code, error.message);
  if (error?.code === "over_email_send_rate_limit")
    back("/registro", "Se alcanzó el límite de correos de confirmación. Espera un rato e inténtalo de nuevo.");
  if (error) back("/registro", "No se pudo crear la cuenta. Verifica los datos o intenta iniciar sesión.");

  // Registra el consentimiento solo si ya hay sesión (confirmación de correo desactivada).
  if (data.session) {
    await supabase.from("profiles").update({ ai_consent_at: new Date().toISOString() }).eq("id", data.user!.id);
    redirect("/");
  }
  back("/login", "Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.", "ok");
}

export async function requestReset(formData: FormData) {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) back("/recuperar", parsed.error.issues[0].message);
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data!, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/perfil`,
  });
  // Misma respuesta exista o no la cuenta (no revela qué correos están registrados).
  back("/recuperar", "Si el correo está registrado, recibirás un enlace para restablecer la contraseña.", "ok");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
