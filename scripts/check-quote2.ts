import { createClient } from "@supabase/supabase-js";
import { quoteInText } from "../src/lib/assessment";
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: f } = await sb.from("lab_files").select("storage_path").eq("relative_path", "fundamentos-ia-lab/cartografia_modelos/README.md").limit(1).single();
  const { data } = await sb.storage.from("documents").download(f!.storage_path);
  const text = await data!.text();
  const i = text.indexOf("mejor modelo");
  console.log("Texto real alrededor de 'mejor modelo':\n" + JSON.stringify(text.slice(Math.max(0, i - 60), i + 260)));
  const quote = 'La selección de un modelo de IA no debe responder a buscar un "mejor modelo universal", sino a un análisis de compromiso técnico (trade-off) considerando: tarea';
  console.log("\n¿La cita pasa ahora?", quoteInText(quote, text));
}
main().catch((e) => console.error("FALLÓ", e.message));
