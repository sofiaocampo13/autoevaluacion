// Genera el informe PDF de la última evaluación completada (con la clave de servicio) y lo guarda en un archivo.
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadReportData } from "../src/lib/report-data";
import { renderReportPdf } from "../src/lib/report-pdf";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: ev } = await sb.from("evaluations").select("id,lab_id").eq("status", "completada").order("created_at", { ascending: false }).limit(1).single();
  const t = Date.now();
  const data = await loadReportData(sb, ev!.lab_id, ev!.id);
  if (!data) throw new Error("No se pudieron cargar los datos del informe");
  const buf = await renderReportPdf(data);
  writeFileSync(process.argv[2], buf);
  console.log(`PDF generado en ${Date.now() - t} ms · ${(buf.length / 1024).toFixed(0)} KB · estudiante: ${data.student} · criterios: ${data.criteria.length}`);
}
main().catch((e) => { console.error("FALLÓ:", e.message); process.exit(1); });
