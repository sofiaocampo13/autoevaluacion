// Carga la evidencia real de un laboratorio (con la clave de servicio) y muestra el inventario. No llama a la IA.
// Uso: node --env-file=.env.local --import tsx scripts/test-evidence.ts "<parte del nombre del laboratorio>"
import { createClient } from "@supabase/supabase-js";
import { buildEvidencePackage, loadEvidence } from "../src/lib/evidence";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: lab } = await sb.from("labs").select("id,name,repo_url").ilike("name", `%${process.argv[2]}%`).limit(1).single();
  const { data: files } = await sb.from("lab_files").select("storage_path,file_name,relative_path,size_bytes").eq("lab_id", lab!.id);
  console.log(`Laboratorio "${lab!.name}": ${files!.length} archivos registrados`);
  const t = Date.now();
  const { items, problems } = await loadEvidence({
    files: files!.map((f) => ({ path: f.storage_path, name: f.file_name, relativePath: f.relative_path, size: f.size_bytes })),
    repoUrl: lab!.repo_url,
    download: async (p) => {
      const { data } = await sb.storage.from("documents").download(p);
      return data ? new Uint8Array(await data.arrayBuffer()) : null;
    },
  });
  const pkg = buildEvidencePackage(items, problems);
  console.log(`Carga y lectura: ${Date.now() - t} ms`);
  const by: Record<string, number> = {};
  pkg.inventory.forEach((i) => (by[i.mode] = (by[i.mode] ?? 0) + 1));
  console.log("Inventario por modo:", by);
  const chars = pkg.parts.reduce((s, p) => s + (p.kind === "text" ? p.text.length : 0), 0);
  const bytes = pkg.parts.reduce((s, p) => s + (p.kind === "file" ? p.base64.length * 0.75 : 0), 0);
  console.log(`Enviaría a la IA: ${pkg.parts.length} piezas · ${chars} caracteres de texto · ${(bytes / 1048576).toFixed(1)} MB en imágenes/PDF`);
  console.log("Omitidos / no soportados:", pkg.inventory.filter((i) => i.mode === "omitido" || i.mode === "unsupported").map((i) => `${i.location} (${i.note})`));
  console.log("Ejemplos de ubicaciones citables:", pkg.inventory.slice(0, 5).map((i) => i.location));
}
main().catch((e) => { console.error("FALLÓ:", e.message); process.exit(1); });
