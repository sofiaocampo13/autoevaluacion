// Uso: node --env-file=.env.local --import tsx scripts/test-rubric-parse.ts "<archivo>"
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { extractParts } from "../src/lib/extract";
import { getProvider } from "../src/lib/ai";
import { parseRubricWithAI } from "../src/lib/rubric-parse";
import { sumWeights, validateRubric } from "../src/lib/rubric-validate";

async function main() {
const path = process.argv[2];
const ex = extractParts(basename(path), extname(path).slice(1).toLowerCase(), new Uint8Array(readFileSync(path)));
console.log("Lectura:", ex.mode, ex.chars ?? "", ex.note ?? "");
const provider = getProvider();
const t = Date.now();
const r = await parseRubricWithAI(provider, ex.parts, { labName: "Prueba", objectives: "" });
console.log(`IA (${provider.id}:${provider.model}) en ${Date.now() - t} ms | has_rubric=${r.hasRubric} | título="${r.title}"`);
console.log("Criterios:", r.criteria.length, "| suma de pesos:", sumWeights(r.criteria));
for (const c of r.criteria) console.log(` - [${c.weight ?? "s/peso"}%] ${c.criterion} (${c.competency || "sin competencia"}) · ${c.levels.length} niveles`);
console.log("Inconsistencias:", validateRubric(r.criteria).map((i) => `${i.severity}: ${i.message}`));
console.log("Notas de la IA:", r.notes);
}
main().catch((e) => { console.error('FALLÓ:', e.code ?? '', e.message); process.exit(1); });
