// Uso: npx tsx scripts/test-extract.ts "<archivo>"
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { extractParts } from "../src/lib/extract";

const path = process.argv[2];
const ext = extname(path).slice(1).toLowerCase();
const r = extractParts(basename(path), ext, new Uint8Array(readFileSync(path)));
console.log("modo:", r.mode, "| chars:", r.chars ?? "-", "| nota:", r.note ?? "-");
const t = r.parts[0];
if (t?.kind === "text") console.log(t.text.slice(0, Number(process.argv[3] ?? 1500)));
