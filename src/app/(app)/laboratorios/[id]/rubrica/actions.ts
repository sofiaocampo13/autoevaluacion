"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AIError, getProvider } from "@/lib/ai";
import { releaseAi, reserveAi } from "@/lib/ai-budget";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractParts } from "@/lib/extract";
import { extOf } from "@/lib/files";
import { parseRubricWithAI } from "@/lib/rubric-parse";
import { hasErrors, validateRubric, type Criterion } from "@/lib/rubric-validate";

type Supa = Awaited<ReturnType<typeof createClient>>;
const uuid = z.string().uuid();
const here = (labId: string, qs: string) => `/laboratorios/${labId}/rubrica?${qs}`;
const fail = (labId: string, msg: string): never => redirect(here(labId, `error=${encodeURIComponent(msg)}`));

const criterionSchema = z.object({
  competency: z.string().max(200),
  criterion: z.string().max(300),
  description: z.string().max(2000),
  weight: z.number().min(0).max(100).nullable(),
  levels: z
    .array(z.object({ name: z.string().max(100), min_percent: z.number().min(0).max(100).nullable(), descriptor: z.string().max(1500) }))
    .max(8),
});
const saveSchema = z.object({
  rubricId: uuid,
  title: z.string().max(200),
  scale: z.union([z.literal(5), z.literal(100)]),
  criteria: z.array(criterionSchema).max(40),
});

async function nextVersion(supabase: Supa, labId: string) {
  const { data } = await supabase.from("rubrics").select("version").eq("lab_id", labId).order("version", { ascending: false }).limit(1);
  return (data?.[0]?.version ?? 0) + 1;
}

async function insertCriteria(supabase: Supa, rubricId: string, criteria: Criterion[]) {
  if (!criteria.length) return null;
  const { data, error } = await supabase
    .from("rubric_criteria")
    .insert(
      criteria.map((c, i) => ({
        rubric_id: rubricId,
        position: i,
        competency: c.competency,
        criterion: c.criterion.slice(0, 300) || `Criterio ${i + 1}`,
        description: c.description,
        weight: c.weight,
        levels: c.levels,
      })),
    )
    .select("id");
  return error ? null : data;
}

async function subjectScale(supabase: Supa) {
  const { data } = await supabase.from("subjects").select("grade_scale_max").order("created_at").limit(1).single();
  return data?.grade_scale_max === 100 ? 100 : 5;
}

/** Lee el documento de rúbrica asociado al laboratorio y deja un BORRADOR para que el estudiante lo revise. */
export async function parseRubric(formData: FormData) {
  const labId = uuid.parse(formData.get("labId"));
  const supabase = await createClient();
  const { data: lab } = await supabase.from("labs").select("name, objectives, rubric_material_id").eq("id", labId).single();
  if (!lab) return fail(labId, "Laboratorio no encontrado.");
  if (!lab.rubric_material_id)
    return fail(labId, "Este laboratorio no tiene un documento de rúbrica asociado. Súbelo en Materiales y asóciala al laboratorio.");

  const { data: mat } = await supabase.from("reference_materials").select("id, title, storage_path").eq("id", lab.rubric_material_id).single();
  if (!mat?.storage_path) return fail(labId, "No se encontró el archivo de la rúbrica.");
  const { data: blob, error: dlErr } = await supabase.storage.from("documents").download(mat.storage_path);
  if (dlErr || !blob) return fail(labId, "No se pudo descargar el archivo de la rúbrica.");

  const ex = extractParts(mat.title, extOf(mat.storage_path), new Uint8Array(await blob.arrayBuffer()));
  if (ex.mode === "unsupported") return fail(labId, `No se puede leer ese documento: ${ex.note}`);

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(labId, "Tu sesión expiró. Vuelve a iniciar sesión.");
  const admin = createAdminClient();
  const reservation = await reserveAi(admin, auth.user.id, "rubrica");
  if (!reservation.ok) return fail(labId, reservation.error);

  let parsed;
  let modelTag = "";
  try {
    const provider = getProvider();
    modelTag = `${provider.id}:${provider.model}`;
    parsed = await parseRubricWithAI(provider, ex.parts, { labName: lab.name, objectives: lab.objectives });
  } catch (e) {
    await releaseAi(admin, reservation.id); // la IA no devolvió nada utilizable: no se cobra el intento
    if (e instanceof AIError) return fail(labId, e.message);
    if (e instanceof z.ZodError) return fail(labId, "La IA devolvió una estructura inesperada. Inténtalo de nuevo.");
    throw e;
  }
  if (!parsed.hasRubric || parsed.criteria.length === 0)
    return fail(labId, `La IA no encontró una rúbrica de evaluación en ese documento. ${parsed.notes}`);

  const version = await nextVersion(supabase, labId);
  const { data: rubric, error } = await supabase
    .from("rubrics")
    .insert({
      lab_id: labId,
      source_material_id: mat.id,
      version,
      title: parsed.title,
      scale_max: await subjectScale(supabase),
      issues: validateRubric(parsed.criteria),
      parsed_by: modelTag,
    })
    .select("id")
    .single();
  if (error || !rubric) return fail(labId, "No se pudo guardar la rúbrica.");
  if (!(await insertCriteria(supabase, rubric.id, parsed.criteria))) {
    await supabase.from("rubrics").delete().eq("id", rubric.id);
    return fail(labId, "No se pudieron guardar los criterios de la rúbrica.");
  }
  revalidatePath(`/laboratorios/${labId}/rubrica`);
  redirect(here(labId, `v=${version}&ok=${encodeURIComponent("Rúbrica interpretada. Revísala y corrígela antes de confirmarla." + (parsed.notes ? " Nota de la IA: " + parsed.notes : ""))}`));
}

export async function createBlankRubric(formData: FormData) {
  const labId = uuid.parse(formData.get("labId"));
  const supabase = await createClient();
  const version = await nextVersion(supabase, labId);
  const { error } = await supabase.from("rubrics").insert({
    lab_id: labId,
    version,
    title: "",
    scale_max: await subjectScale(supabase),
    issues: validateRubric([]),
  });
  if (error) return fail(labId, "No se pudo crear la rúbrica.");
  revalidatePath(`/laboratorios/${labId}/rubrica`);
  redirect(here(labId, `v=${version}`));
}

type Result = { ok: true; message: string } | { ok: false; error: string };

export async function saveRubric(input: z.infer<typeof saveSchema>): Promise<Result> {
  const p = saveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos de rúbrica no válidos." };
  const { rubricId, title, scale, criteria } = p.data;
  const supabase = await createClient();

  // RLS solo deja editar borradores propios: si no devuelve fila, no se puede.
  const { data: updated } = await supabase
    .from("rubrics")
    .update({ title, scale_max: scale, issues: validateRubric(criteria) })
    .eq("id", rubricId)
    .select("lab_id");
  if (!updated?.length) return { ok: false, error: "Esta rúbrica ya está confirmada o no existe; no se puede editar." };

  // Inserta primero y borra después, para no perder criterios si algo falla a medias.
  const { data: old } = await supabase.from("rubric_criteria").select("id").eq("rubric_id", rubricId);
  const created = await insertCriteria(supabase, rubricId, criteria);
  if (criteria.length && !created) return { ok: false, error: "No se pudieron guardar los criterios." };
  if (old?.length) await supabase.from("rubric_criteria").delete().in("id", old.map((o) => o.id));
  revalidatePath(`/laboratorios/${updated[0].lab_id}/rubrica`);
  return { ok: true, message: "Cambios guardados." };
}

export async function confirmRubric(rubricId: string): Promise<Result> {
  if (!uuid.safeParse(rubricId).success) return { ok: false, error: "Rúbrica no válida." };
  const supabase = await createClient();
  const { data: rows } = await supabase.from("rubric_criteria").select("*").eq("rubric_id", rubricId).order("position");
  const criteria: Criterion[] = (rows ?? []).map((r) => ({
    competency: r.competency,
    criterion: r.criterion,
    description: r.description,
    weight: r.weight,
    levels: r.levels,
  }));
  const issues = validateRubric(criteria);
  if (hasErrors(issues)) return { ok: false, error: "Corrige los errores antes de confirmar: " + issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ") };

  const { data, error } = await supabase.from("rubrics").update({ status: "confirmada", issues }).eq("id", rubricId).select("lab_id");
  if (error || !data?.length) return { ok: false, error: error?.message.replace(/^.*?: /, "") || "No se pudo confirmar la rúbrica." };
  revalidatePath(`/laboratorios/${data[0].lab_id}/rubrica`);
  return { ok: true, message: "Rúbrica confirmada. Ya puede usarse para evaluar." };
}

/** Copia una rúbrica (normalmente una confirmada) como nuevo borrador con la versión siguiente. */
export async function newRubricVersion(formData: FormData) {
  const rubricId = uuid.parse(formData.get("rubricId"));
  const supabase = await createClient();
  const { data: src } = await supabase.from("rubrics").select("*").eq("id", rubricId).single();
  if (!src) return redirect("/laboratorios");
  const { data: rows } = await supabase.from("rubric_criteria").select("*").eq("rubric_id", rubricId).order("position");
  const version = await nextVersion(supabase, src.lab_id);
  const { data: nr, error } = await supabase
    .from("rubrics")
    .insert({ lab_id: src.lab_id, source_material_id: src.source_material_id, version, title: src.title, scale_max: src.scale_max, issues: src.issues, parsed_by: src.parsed_by })
    .select("id")
    .single();
  if (error || !nr) return fail(src.lab_id, "No se pudo crear la nueva versión.");
  await insertCriteria(supabase, nr.id, (rows ?? []).map((r) => ({ competency: r.competency, criterion: r.criterion, description: r.description, weight: r.weight, levels: r.levels })));
  revalidatePath(`/laboratorios/${src.lab_id}/rubrica`);
  redirect(here(src.lab_id, `v=${version}&ok=${encodeURIComponent(`Nueva versión ${version} creada como borrador.`)}`));
}

export async function deleteDraftRubric(formData: FormData) {
  const rubricId = uuid.parse(formData.get("rubricId"));
  const supabase = await createClient();
  const { data } = await supabase.from("rubrics").delete().eq("id", rubricId).select("lab_id"); // RLS: solo borradores
  const labId = data?.[0]?.lab_id;
  if (!labId) return redirect("/laboratorios");
  revalidatePath(`/laboratorios/${labId}/rubrica`);
  redirect(here(labId, `ok=${encodeURIComponent("Borrador eliminado.")}`));
}
