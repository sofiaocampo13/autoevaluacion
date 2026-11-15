// Prueba del detector de estructura contra una carpeta real del disco.
// Uso: node scripts/test-import-plan.mjs "<ruta a la carpeta>"
import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { planImport } from "../src/lib/import-plan.ts";

const root = process.argv[2];
if (!root) throw new Error("Pasa la ruta de la carpeta como argumento");

const entries = [];
(function walk(dir, rel) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const r = `${rel}/${name}`;
    if (statSync(full).isDirectory()) walk(full, r);
    else entries.push({ item: name, rel: r });
  }
})(root, basename(root));

const groups = planImport(entries);
for (const g of groups) {
  console.log(`Corte ${g.cut ?? "-"} | n.º ${g.number ?? "-"} | "${g.name}" | ${g.entries.length} archivos | ej: ${g.entries[0].relativePath}`);
}
console.log(`\n${groups.length} laboratorios, ${entries.length} archivos en total`);
