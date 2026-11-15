import { readFileSync } from "node:fs";
import { expandZip } from "../src/lib/evidence";
const r = expandZip(new Uint8Array(readFileSync(process.argv[2])));
console.log("Aceptados:", r.files.map((f) => f.name));
console.log("Rechazados:", r.skipped);
