"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifyUpload } from "@/lib/storage-verify";
import { CATEGORIES } from "@/lib/files";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const addSchema = z.object({
  path: z.string().min(1),
  title: z.string().trim().min(1, "Escribe un título").max(200),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  version: z.string().trim().min(1).max(30),
  labId: z.string().uuid().nullable(),
});

export async function addMaterial(input: z.infer<typeof addSchema>): Promise<Result> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sesión expirada." };

  const v = await verifyUpload(supabase, auth.user.id, parsed.data.path);
  if (!v.ok) return { ok: false, error: v.error };

  const { data: subject } = await supabase.from("subjects").select("id").order("created_at").limit(1).single();
  const { data: created, error } = await supabase
    .from("reference_materials")
    .insert({
      subject_id: subject?.id ?? null,
      lab_id: parsed.data.labId,
      category: parsed.data.category,
      title: parsed.data.title,
      version: parsed.data.version,
      storage_path: parsed.data.path,
      mime_type: v.mime,
      size_bytes: v.size,
    })
    .select("id")
    .single();
  if (error || !created) {
    await supabase.storage.from("documents").remove([parsed.data.path]);
    return { ok: false, error: "No se pudo guardar el material." };
  }

  // La asociación debe tener efecto: una guía o rúbrica ligada a un laboratorio pasa a ser la de ese laboratorio.
  let message = "Material guardado.";
  const { category, labId } = parsed.data;
  if (labId && (category === "guia" || category === "rubrica")) {
    const column = category === "guia" ? "instructions_material_id" : "rubric_material_id";
    const { data: lab } = await supabase.from("labs").update({ [column]: created.id }).eq("id", labId).select("name");
    if (lab?.length)
      message = `Material guardado y asignado como ${category === "guia" ? "guía" : "rúbrica"} del laboratorio "${lab[0].name}" (reemplaza la anterior, si había).`;
    revalidatePath(`/laboratorios/${labId}`);
  } else if (labId) {
    message = "Material guardado. Se usará como contexto al evaluar ese laboratorio.";
  }
  revalidatePath("/materiales");
  return { ok: true, message };
}

export async function deleteMaterial(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  // RLS: solo encuentra materiales propios (los precargados no se pueden borrar).
  const { data: row } = await supabase.from("reference_materials").select("storage_path").eq("id", id.data).single();
  if (!row) return;
  if (row.storage_path) await supabase.storage.from("documents").remove([row.storage_path]);
  await supabase.from("reference_materials").delete().eq("id", id.data);
  revalidatePath("/materiales");
}
