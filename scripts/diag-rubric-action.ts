// Diagnóstico: repite lo que hace la acción parseRubric, pero con la clave de servicio, y limpia lo creado.
import { createClient } from "@supabase/supabase-js";
import { extractParts } from "../src/lib/extract";
import { getProvider } from "../src/lib/ai";
import { parseRubricWithAI } from "../src/lib/rubric-parse";
import { validateRubric } from "../src/lib/rubric-validate";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: lab } = await sb.from("labs").select("id,user_id,name,objectives,rubric_material_id").ilike("name", "%Primer%").single();
  const { data: mat } = await sb.from("reference_materials").select("id,title,storage_path").eq("id", lab!.rubric_material_id).single();
  const t0 = Date.now();
  const { data: blob, error: dl } = await sb.storage.from("documents").download(mat!.storage_path!);
  console.log("1 descarga:", dl ? "ERROR " + dl.message : "ok", Date.now() - t0, "ms");
  const ex = extractParts(mat!.title, "docx", new Uint8Array(await blob!.arrayBuffer()));
  console.log("2 extracción:", ex.mode, ex.chars);
  const provider = getProvider();
  const parsed = await parseRubricWithAI(provider, ex.parts, { labName: lab!.name, objectives: lab!.objectives });
  console.log("3 IA:", parsed.hasRubric, parsed.criteria.length, "criterios", Date.now() - t0, "ms acumulados");
  const { data: r, error: e1 } = await sb.from("rubrics").insert({ user_id: lab!.user_id, lab_id: lab!.id, source_material_id: mat!.id, version: 1, title: parsed.title, scale_max: 5, issues: validateRubric(parsed.criteria), parsed_by: "diag" }).select("id").single();
  console.log("4 insert rúbrica:", e1 ? "ERROR " + JSON.stringify(e1) : "ok");
  if (r) {
    const { error: e2 } = await sb.from("rubric_criteria").insert(parsed.criteria.map((c, i) => ({ rubric_id: r.id, user_id: lab!.user_id, position: i, competency: c.competency, criterion: c.criterion, description: c.description, weight: c.weight, levels: c.levels })));
    console.log("5 insert criterios:", e2 ? "ERROR " + JSON.stringify(e2) : "ok");
    await sb.from("rubrics").delete().eq("id", r.id);
    console.log("6 limpieza hecha");
  }
}
main().catch((e) => { console.error("FALLÓ:", e.code ?? "", e.message); process.exit(1); });
