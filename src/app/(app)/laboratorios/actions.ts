"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifyUpload } from "@/lib/storage-verify";

const optUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().uuid().nullable());

const labSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre del laboratorio").max(200),
  number: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(0).max(999).nullable(),
  ),
  cut: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(10).nullable()),
  description: z.string().trim().max(2000).default(""),
  objectives: z.string().trim().max(4000).default(""),
  repo: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().replace(/\.git$/, "") : null),
    z
      .string()
      .regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/, "El repositorio debe ser un enlace https://github.com/usuario/repositorio")
      .nullable(),
  ),
  instructions: optUuid,
  rubric: optUuid,
});

function parseLab(fd: FormData) {
  return labSchema.safeParse({
    name: fd.get("name"),
    number: fd.get("number"),
    cut: fd.get("cut"),
    description: fd.get("description") ?? "",
    objectives: fd.get("objectives") ?? "",
    repo: fd.get("repo"),
    instructions: fd.get("instructions"),
    rubric: fd.get("rubric"),
  });
}

/** RLS solo deja ver materiales propios o precargados: si no aparece, no se puede usar. */
async function materialUsable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  category: "guia" | "rubrica",
) {
  if (!id) return true;
  const { data } = await supabase.from("reference_materials").select("id").eq("id", id).eq("category", category).maybeSingle();
  return !!data;
}

export async function createLab(formData: FormData) {
  const parsed = parseLab(formData);
  if (!parsed.success) redirect(`/laboratorios/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("id").order("created_at").limit(1).single();
  if (!subject) redirect(`/?error=${encodeURIComponent("Primero crea tu asignatura")}`);

  if (!(await materialUsable(supabase, d.instructions, "guia")) || !(await materialUsable(supabase, d.rubric, "rubrica")))
    redirect(`/laboratorios/nuevo?error=${encodeURIComponent("Material de referencia no válido")}`);

  const { data, error } = await supabase
    .from("labs")
    .insert({
      subject_id: subject.id,
      name: d.name,
      number: d.number,
      cut: d.cut,
      description: d.description,
      objectives: d.objectives,
      repo_url: d.repo,
      instructions_material_id: d.instructions,
      rubric_material_id: d.rubric,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/laboratorios/nuevo?error=${encodeURIComponent("No se pudo crear el laboratorio")}`);
  revalidatePath("/laboratorios");
  redirect(`/laboratorios/${data.id}?ok=${encodeURIComponent("Laboratorio creado")}`);
}

const importSchema = z.object({
  name: z.string().trim().min(1).max(200),
  number: z.number().int().min(0).max(999).nullable(),
  cut: z.number().int().min(1).max(10).nullable(),
});

/** Crea un laboratorio vacío para la importación masiva. No duplica: mismo nombre y corte = ya existe. */
export async function createLabForImport(
  input: z.infer<typeof importSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de laboratorio no válidos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("id").order("created_at").limit(1).single();
  if (!subject) return { ok: false, error: "Primero crea tu asignatura." };

  let dup = supabase.from("labs").select("id").eq("subject_id", subject.id).eq("name", d.name);
  dup = d.cut == null ? dup.is("cut", null) : dup.eq("cut", d.cut);
  const { data: existing } = await dup.limit(1);
  if (existing?.length) return { ok: false, error: "Ya existe un laboratorio con ese nombre y corte." };

  const { data, error } = await supabase
    .from("labs")
    .insert({ subject_id: subject.id, name: d.name, number: d.number, cut: d.cut })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo crear el laboratorio." };
  revalidatePath("/laboratorios");
  return { ok: true, id: data.id };
}

export async function updateLab(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/laboratorios");
  const here = `/laboratorios/${id.data}`;
  const parsed = parseLab(formData);
  if (!parsed.success) redirect(`${here}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const d = parsed.data;

  const supabase = await createClient();
  if (!(await materialUsable(supabase, d.instructions, "guia")) || !(await materialUsable(supabase, d.rubric, "rubrica")))
    redirect(`${here}?error=${encodeURIComponent("Material de referencia no válido")}`);

  const { error } = await supabase
    .from("labs")
    .update({
      name: d.name,
      number: d.number,
      cut: d.cut,
      description: d.description,
      objectives: d.objectives,
      repo_url: d.repo,
      instructions_material_id: d.instructions,
      rubric_material_id: d.rubric,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data);
  if (error) redirect(`${here}?error=${encodeURIComponent("No se pudieron guardar los cambios")}`);
  revalidatePath("/laboratorios");
  redirect(`${here}?ok=${encodeURIComponent("Cambios guardados")}`);
}

export async function deleteLab(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/laboratorios");
  const supabase = await createClient();
  const { data: files } = await supabase.from("lab_files").select("storage_path").eq("lab_id", id.data);
  if (files?.length) await supabase.storage.from("documents").remove(files.map((f) => f.storage_path));
  await supabase.from("labs").delete().eq("id", id.data); // lab_files se borra en cascada
  revalidatePath("/laboratorios");
  redirect(`/laboratorios?ok=${encodeURIComponent("Laboratorio eliminado")}`);
}

const filesSchema = z.object({
  labId: z.string().uuid(),
  items: z
    .array(
      z.object({
        path: z.string().min(1),
        fileName: z.string().trim().min(1).max(255),
        relativePath: z.string().max(500),
      }),
    )
    .min(1)
    .max(30),
});

export type AddFilesResult = { failed: { fileName: string; error: string }[] };

/** Registra por lotes archivos ya subidos. Cada uno se verifica y los inválidos se informan sin frenar el resto. */
export async function addLabFiles(input: z.infer<typeof filesSchema>): Promise<AddFilesResult | { error: string }> {
  const parsed = filesSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos de archivo no válidos." };
  const { labId, items } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesión expirada." };
  const userId = auth.user.id;

  const checked = await Promise.all(items.map(async (it) => ({ it, v: await verifyUpload(supabase, userId, it.path) })));
  const failed: AddFilesResult["failed"] = [];
  const rows: object[] = [];
  for (const { it, v } of checked) {
    if (!v.ok) failed.push({ fileName: it.fileName, error: v.error });
    else
      rows.push({
        lab_id: labId,
        storage_path: it.path,
        file_name: it.fileName,
        relative_path: it.relativePath,
        mime_type: v.mime,
        size_bytes: v.size,
      });
  }
  if (rows.length) {
    const { error } = await supabase.from("lab_files").insert(rows);
    if (error) {
      await supabase.storage.from("documents").remove(checked.filter((c) => c.v.ok).map((c) => c.it.path));
      return { error: "No se pudieron asociar los archivos al laboratorio." };
    }
  }
  revalidatePath(`/laboratorios/${labId}`);
  return { failed };
}

export async function deleteLabFile(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: row } = await supabase.from("lab_files").select("storage_path, lab_id").eq("id", id.data).single();
  if (!row) return;
  await supabase.storage.from("documents").remove([row.storage_path]);
  await supabase.from("lab_files").delete().eq("id", id.data);
  revalidatePath(`/laboratorios/${row.lab_id}`);
}
