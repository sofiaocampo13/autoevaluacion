"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const go = (path: string, msg: string, kind: "error" | "ok" = "error") =>
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de la asignatura").max(200),
  period: z.string().trim().max(40),
  scale: z.enum(["5", "100"]),
});

export async function createSubject(formData: FormData) {
  const parsed = subjectSchema.safeParse({
    name: formData.get("name"),
    period: formData.get("period") ?? "",
    scale: formData.get("scale"),
  });
  if (!parsed.success) go("/", parsed.error.issues[0].message);

  const supabase = await createClient();
  // user_id se completa con auth.uid() por defecto en la BD; RLS impide falsearlo.
  const { error } = await supabase.from("subjects").insert({
    name: parsed.data!.name,
    academic_period: parsed.data!.period,
    grade_scale_max: Number(parsed.data!.scale),
  });
  if (error) go("/", "No se pudo crear la asignatura");
  revalidatePath("/");
  redirect("/");
}

export async function updateProfile(formData: FormData) {
  const name = z.string().trim().min(2).max(120).safeParse(formData.get("fullName"));
  if (!name.success) go("/perfil", "Escribe un nombre válido");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase.from("profiles").update({ full_name: name.data }).eq("id", data.user.id);
  if (error) go("/perfil", "No se pudo guardar el perfil");
  revalidatePath("/", "layout");
  go("/perfil", "Perfil actualizado", "ok");
}

export async function updateSubject(formData: FormData) {
  const parsed = subjectSchema.extend({ id: z.string().uuid() }).safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    period: formData.get("period") ?? "",
    scale: formData.get("scale"),
  });
  if (!parsed.success) go("/perfil", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .update({
      name: parsed.data!.name,
      academic_period: parsed.data!.period,
      grade_scale_max: Number(parsed.data!.scale),
    })
    .eq("id", parsed.data!.id);
  if (error) go("/perfil", "No se pudo guardar la asignatura");
  revalidatePath("/", "layout");
  go("/perfil", "Asignatura actualizada", "ok");
}

export async function changePassword(formData: FormData) {
  const pw = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72).safeParse(formData.get("password"));
  if (!pw.success) go("/perfil", pw.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) go("/perfil", "No se pudo cambiar la contraseña");
  go("/perfil", "Contraseña actualizada", "ok");
}
