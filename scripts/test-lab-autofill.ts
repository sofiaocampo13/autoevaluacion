// Prueba de la lógica de «rellenar laboratorio con IA» (sin llamar a la IA ni tocar la base de datos).
// Uso: node --import tsx scripts/test-lab-autofill.ts
import assert from "node:assert/strict";
import { fillPlan, suggestionSchema, type LabSuggestion } from "../src/lib/lab-autofill";

let n = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("PASS ", name);
};
const empty = { name: "", description: "", objectives: "", cut: "", number: "" };
const sug: LabSuggestion = { found: true, name: "Laboratorio 2", description: "Describe la práctica.", objectives: "Comprender X\nAplicar Y", cut: 1, number: 2 };

ok("con el formulario vacío se rellenan todos los campos que la IA encontró", () => {
  const { fill, skipped } = fillPlan(empty, sug);
  assert.deepEqual(fill, { name: "Laboratorio 2", description: "Describe la práctica.", objectives: "Comprender X\nAplicar Y", cut: "1", number: "2" });
  assert.deepEqual(skipped, []);
});
ok("nunca se pisa lo que la persona ya escribió: esos campos quedan como omitidos", () => {
  const { fill, skipped } = fillPlan({ ...empty, name: "Mi nombre", cut: "3" }, sug);
  assert.equal(fill.name, undefined);
  assert.equal(fill.cut, undefined);
  assert.deepEqual(skipped.sort(), ["cut", "name"]);
  assert.equal(fill.description, "Describe la práctica.");
});
ok("un campo en blanco con solo espacios cuenta como vacío", () => {
  const { fill } = fillPlan({ ...empty, description: "   " }, sug);
  assert.equal(fill.description, "Describe la práctica.");
});
ok("lo que la IA no encontró (texto vacío, corte o número en null) no se rellena ni se inventa", () => {
  const { fill, skipped } = fillPlan(empty, { ...sug, objectives: "", cut: null, number: null });
  assert.deepEqual(Object.keys(fill).sort(), ["description", "name"]);
  assert.deepEqual(skipped, []);
});
ok("el esquema acepta una propuesta válida y rechaza un corte fuera de rango o textos demasiado largos", () => {
  assert.ok(suggestionSchema.safeParse(sug).success);
  assert.ok(!suggestionSchema.safeParse({ ...sug, cut: 9 }).success);
  assert.ok(!suggestionSchema.safeParse({ ...sug, description: "x".repeat(2001) }).success);
  assert.ok(!suggestionSchema.safeParse({ name: "solo nombre" }).success);
});
console.log(`\n${n} comprobaciones superadas`);
