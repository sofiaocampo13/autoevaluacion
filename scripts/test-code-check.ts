// Corre la verificación técnica sobre el código real de un laboratorio (con la clave de servicio). No usa IA.
import { createClient } from "@supabase/supabase-js";
import { loadEvidence } from "../src/lib/evidence";
import { checkCodeEvidence, reportForPrompt } from "../src/lib/code-check";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: lab } = await sb.from("labs").select("id,name,repo_url").ilike("name", `%${process.argv[2]}%`).limit(1).single();
  const { data: files } = await sb.from("lab_files").select("storage_path,file_name,relative_path,size_bytes").eq("lab_id", lab!.id);
  const { items } = await loadEvidence({
    files: files!.map((f) => ({ path: f.storage_path, name: f.file_name, relativePath: f.relative_path, size: f.size_bytes })),
    repoUrl: lab!.repo_url,
    download: async (p) => { const { data } = await sb.storage.from("documents").download(p); return data ? new Uint8Array(await data.arrayBuffer()) : null; },
  });
  const t = Date.now();
  const r = await checkCodeEvidence(items);
  console.log(`Lab "${lab!.name}" · verificación en ${Date.now() - t} ms\n`);
  if (!r) return console.log("Sin código que analizar.");
  console.log(reportForPrompt(r));
  console.log("\nDetalle por archivo:");
  for (const f of r.files) console.log(`  ${f.status.padEnd(12)} ${f.language.padEnd(16)} ${f.lines} líneas · ${f.location}${f.totalDiagnostics ? ` · ${f.totalDiagnostics} hallazgo(s)` : ""}${f.note ? ` · ${f.note}` : ""}`);
}
main().catch((e) => { console.error("FALLÓ:", e.message); process.exit(1); });
