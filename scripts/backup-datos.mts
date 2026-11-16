// Copia de seguridad MANUAL de los datos (el plan gratuito de Supabase no ofrece copias automáticas descargables).
// Exporta cada tabla a un archivo JSON dentro de backups/<fecha>/ y, con --archivos, también descarga los archivos de Storage.
// Contiene datos personales y académicos: guárdala en un lugar privado. La carpeta backups/ está en .gitignore.
// Uso: node --env-file=.env.local --import tsx scripts/backup-datos.mts [--archivos]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const TABLES = [
  "profiles", "subjects", "reference_materials", "labs", "lab_files", "rubrics", "rubric_criteria", "evaluations", "criterion_results",
  "reports", "semester_analyses", "review_links", "teacher_reviews", "ai_usage", "app_limits",
];
const withFiles = process.argv.includes("--archivos");
const out = join("backups", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(out, { recursive: true });

async function allRows(table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

async function listFiles(prefix: string): Promise<string[]> {
  const found: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from("documents").list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id) found.push(path);
      else found.push(...(await listFiles(path)));
    }
    if (data.length < 100) break;
  }
  return found;
}

async function main() {
  const summary: Record<string, number> = {};
  for (const t of TABLES) {
    const rows = await allRows(t);
    summary[t] = rows.length;
    writeFileSync(join(out, `${t}.json`), JSON.stringify(rows, null, 1));
    console.log(`${t}: ${rows.length} filas`);
  }
  // Usuarios de autenticación (sin contraseñas: Supabase no las expone).
  const users = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));
  writeFileSync(join(out, "auth_users.json"), JSON.stringify(users, null, 1));
  console.log(`auth_users: ${users.length}`);

  if (withFiles) {
    const files = await listFiles("");
    let bytes = 0;
    for (const path of files) {
      const { data, error } = await admin.storage.from("documents").download(path);
      if (error || !data) {
        console.warn(`  no se pudo descargar ${path}`);
        continue;
      }
      const buf = Buffer.from(await data.arrayBuffer());
      bytes += buf.length;
      const dest = join(out, "archivos", path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
    }
    console.log(`archivos: ${files.length} (${(bytes / 1048576).toFixed(1)} MB)`);
    summary.archivos = files.length;
  }
  writeFileSync(join(out, "RESUMEN.json"), JSON.stringify({ fecha: new Date().toISOString(), filas: summary, incluye_archivos: withFiles }, null, 1));
  console.log(`\nCopia guardada en ${out}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
