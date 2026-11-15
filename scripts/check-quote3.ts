import { createClient } from "@supabase/supabase-js";
import { quoteInText } from "../src/lib/assessment";
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const get = async (rel: string) => { const { data: f } = await sb.from("lab_files").select("storage_path").eq("relative_path", rel).limit(1).single(); const { data } = await sb.storage.from("documents").download(f!.storage_path); return data!.text(); };
  const t1 = await get("fundamentos-ia-lab/cartografia_modelos/README.md");
  console.log("--- filas reales que mencionan Qwen2.5-Coder:");
  t1.split(/\r?\n/).filter((l) => /Qwen2\.5-Coder/.test(l)).slice(0, 2).forEach((l) => console.log(JSON.stringify(l.slice(0, 220))));
  const t2 = await get("fundamentos-ia-lab/vibe_coding/comparativo.md");
  console.log("--- filas reales 'Errores encontrados':");
  t2.split(/\r?\n/).filter((l) => /Errores encontrados/.test(l)).forEach((l) => console.log(JSON.stringify(l.slice(0, 260))));
}
main().catch((e) => console.error("FALLÓ", e.message));
