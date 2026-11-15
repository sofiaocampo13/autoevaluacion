// Valora TODOS los criterios de un laboratorio en UNA petición. Uso: GEMINI_MODEL=... --import tsx scripts/test-batch.ts "<lab>"
import { createClient } from "@supabase/supabase-js";
import { buildEvidencePackage, loadEvidence } from "../src/lib/evidence";
import { extractParts } from "../src/lib/extract";
import { getProvider } from "../src/lib/ai";
import { assessCriteriaBatch } from "../src/lib/evaluate-criterion";
import { estimatedGrade, overallPercent } from "../src/lib/scoring";
import { extOf } from "../src/lib/files";
import type { Criterion } from "../src/lib/rubric-validate";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const dl = async (p: string) => { const { data } = await sb.storage.from("documents").download(p); return data ? new Uint8Array(await data.arrayBuffer()) : null; };
  const { data: lab } = await sb.from("labs").select("*").ilike("name", `%${process.argv[2]}%`).limit(1).single();
  const { data: rubric } = await sb.from("rubrics").select("*").eq("lab_id", lab!.id).eq("status", "confirmada").order("version", { ascending: false }).limit(1).single();
  const { data: rows } = await sb.from("rubric_criteria").select("*").eq("rubric_id", rubric!.id).order("position");
  const criteria: Criterion[] = rows!.map((r) => ({ competency: r.competency, criterion: r.criterion, description: r.description, weight: r.weight, levels: r.levels }));
  const { data: files } = await sb.from("lab_files").select("storage_path,file_name,relative_path,size_bytes").eq("lab_id", lab!.id);
  let guideText = "";
  const matId = lab!.instructions_material_id ?? lab!.rubric_material_id;
  if (matId) { const { data: m } = await sb.from("reference_materials").select("title,storage_path").eq("id", matId).single(); const b = await dl(m!.storage_path!); const ex = b && extractParts(m!.title, extOf(m!.storage_path!), b); const p = ex?.parts[0]; if (p?.kind === "text") guideText = p.text; }
  const { items, problems } = await loadEvidence({ files: files!.map((f) => ({ path: f.storage_path, name: f.file_name, relativePath: f.relative_path, size: f.size_bytes })), repoUrl: lab!.repo_url, download: dl });
  // Prueba de sensibilidad: EXCLUDE="regex" quita evidencias cuya ubicación coincida (no toca la base de datos).
  const drop = process.env.EXCLUDE ? new RegExp(process.env.EXCLUDE) : null;
  const kept = drop ? items.filter((i) => !drop.test(i.location)) : items;
  if (drop) console.log(`EXCLUDE=${process.env.EXCLUDE}: se quitan ${items.length - kept.length} de ${items.length} evidencias`);
  const pkg = buildEvidencePackage(kept, drop ? [] : problems);
  const provider = getProvider();
  console.log(`Lab "${lab!.name}" · ${provider.id}:${provider.model} · ${criteria.length} criterios en UNA petición · ${pkg.parts.length} piezas\n`);
  const t = Date.now();
  const res = await assessCriteriaBatch(provider, { criteria: criteria.map((c, i) => ({ position: i, criterion: c })), lab: { name: lab!.name, objectives: lab!.objectives }, guideText, evidenceParts: pkg.parts, evidenceInventory: pkg.inventory, texts: pkg.texts });
  console.log(`Petición completa en ${((Date.now() - t) / 1000).toFixed(1)} s (modelo que respondió: ${provider.lastModelUsed})\n`);
  const scored: { weight: number; percent: number }[] = [];
  for (const [i, c] of criteria.entries()) {
    const a = res.get(i)!;
    scored.push({ weight: c.weight!, percent: a.percent });
    const cit: Record<string, number> = {};
    a.citations.forEach((x) => (cit[x.status] = (cit[x.status] ?? 0) + 1));
    console.log(`#${i + 1} ${c.criterion} [${c.weight} %] → ${a.rubric_level} · ${a.percent} % · ${a.evidence_sufficiency} · conf=${a.confidence} · citas=${JSON.stringify(cit)}`);
    console.log(`   ${a.argumentation.slice(0, 260)}`);
    a.citations.forEach((x) => console.log(`   · [${x.status}] ${x.location} → ${JSON.stringify(x.quote.slice(0, 90))}`));
    a.flags.forEach((f) => console.log(`   [${f.level}] ${f.text.slice(0, 120)}`));
  }
  const p = overallPercent(scored);
  console.log(`\nRESULTADO (en código): ${p} % · nota ${estimatedGrade(p, rubric!.scale_max)} / ${rubric!.scale_max}`);
}
main().catch((e) => { console.error("FALLÓ:", e.code ?? "", e.message); process.exit(1); });
