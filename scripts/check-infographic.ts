import { createClient } from "@supabase/supabase-js";
import { reconcileInfographic } from "../src/lib/infographic-data";
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: ev } = await sb.from("evaluations").select("id,infographic,feedback").eq("status", "completada").order("created_at", { ascending: false }).limit(1).single();
  const before = JSON.stringify(ev!.infographic);
  const r = reconcileInfographic(ev!.infographic, ev!.feedback.conceptos_a_reforzar);
  console.log("A reforzar según la retroalimentación:", ev!.feedback.conceptos_a_reforzar);
  for (const c of r.categorias) {
    console.log(`\n[${c.nombre}]`);
    for (const s of c.subcategorias) console.log(`  ${s.nombre}: ` + s.conceptos.map((k) => `${k.nombre}${k.estado !== "demostrado" ? ` «${k.estado}»` : ""}`).join(" · "));
  }
  console.log("\n¿Se modificó el original guardado?", before !== JSON.stringify(ev!.infographic));
}
main().catch((e) => console.error("FALLÓ", e.message));
