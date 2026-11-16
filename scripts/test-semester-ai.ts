// Prueba de los controles del análisis global (sin llamar a la IA).
// Uso: node --import tsx scripts/test-semester-ai.ts
import assert from "node:assert/strict";
import { allowedDeltas, allowedPercents, keepKnownReferences, semesterSchema, unknownPercents, type SemesterAnalysis } from "../src/lib/evaluate-semester";
import { computeSemesterStats, type SemesterLabInput } from "../src/lib/semester-stats";

let n = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("PASS ", name);
};

const lab = (id: string, number: number, percent: number, extra: Partial<SemesterLabInput> = {}): SemesterLabInput => ({
  lab: { id, name: `Lab ${id}`, number, cut: 1 },
  evaluation: { id: "e" + id, completedAt: `2026-01-0${number}T10:00:00Z`, overallPercent: percent, estimatedGrade: 4, reviewStatus: "preliminar", finalPercent: null, finalGrade: null },
  criteria: [{ criterion: "c1", competency: "Modelado", weight: 50, percent, evidence: "suficiente" }, { criterion: "c2", competency: "Modelado", weight: 50, percent, evidence: "suficiente" }],
  strengths: [],
  weaknesses: [],
  toReinforce: [],
  concepts: [],
  ...extra,
});
const stats = computeSemesterStats([lab("A", 1, 60, { toReinforce: ["MoE"] }), lab("B", 2, 80, { toReinforce: ["Perplexity"] })], 3, 5);
stats.pendingLabs = ["Lab C"];
const allowed = allowedPercents(stats);
const deltas = allowedDeltas(stats);

const action = { prioridad: "alta" as const, tema: "t", pasos: ["a"], conceptos: [] as string[], laboratorios: [] as string[], logro: "l", tiempo: "una semana" };
const base: SemesterAnalysis = {
  diagnostico: "Tu promedio es 70 %.",
  evolucion: "Pasaste de 60 % a 80 %.",
  competencias: [{ competencia: "modelado", lectura: "Sube 20 puntos." }, { competencia: "Inventada", lectura: "x" }],
  brechas: [{ tema: "t", por_que: "p", conceptos: ["moe", "Concepto Falso"], laboratorios: ["Lab B"] }],
  fortalezas: [],
  plan: { objetivo: "o", acciones: [{ ...action, conceptos: ["Perplexity"], laboratorios: ["lab c", "Lab Z"] }], orden_sugerido: "", habitos: [] },
};

ok("porcentajes calculados (70, 60, 80) se aceptan en el análisis", () => assert.deepEqual(unknownPercents(base, allowed, deltas), []));
ok("una cifra inventada (93,5 %) se detecta, también con coma decimal", () => {
  const x = { ...base, diagnostico: "Estás en 93,5 % y subiste 12 %." };
  assert.deepEqual(unknownPercents(x, allowed, deltas).sort(), ["12 %", "93,5 %"]);
});
ok("la cifra inventada dentro del plan también se detecta", () => {
  const x = structuredClone(base);
  x.plan.acciones[0].pasos = ["Llega al 99 % en el próximo lab"];
  assert.deepEqual(unknownPercents(x, allowed, deltas), ["99 %"]);
});
ok("en el plan no vale ni un umbral de banda como meta ('el 85 % de los labs'), pero sí en el análisis", () => {
  const x = structuredClone(base);
  x.diagnostico = "Superaste el 85 % de umbral de dominio.";
  assert.deepEqual(unknownPercents(x, allowed, deltas), []);
  x.plan.acciones[0].logro = "Evaluar al menos el 85 % de los laboratorios";
  assert.deepEqual(unknownPercents(x, allowed, deltas), ["85 %"]);
});
ok("«puntos» solo vale para diferencias calculadas: '98,73 puntos' o '100 puntos' (un nivel) se rechazan; '20 puntos' (cambio real) se acepta", () => {
  const d = allowedDeltas(stats); // Modelado pasó de 60 a 80: cambio de 20
  const x = structuredClone(base);
  x.diagnostico = "Subiste 20 puntos en total.";
  assert.deepEqual(unknownPercents(x, allowed, d), []);
  x.diagnostico = "Tu promedio es de 70 puntos y sacaste 100 puntos.";
  assert.deepEqual(unknownPercents(x, allowed, d).sort(), ["100 puntos", "70 puntos"]);
});
ok("los laboratorios de una brecha los deriva el sistema del concepto (MoE → solo Lab A), no lo que diga la IA", () => {
  const { analysis } = keepKnownReferences(base, stats);
  assert.deepEqual(analysis.brechas[0].conceptos, ["MoE"]);
  assert.deepEqual(analysis.brechas[0].laboratorios, ["Lab A"]); // la IA dijo "Lab B": se ignora
});
ok("en el plan: laboratorios de los conceptos + pendientes reales; un laboratorio inexistente se descarta", () => {
  const { analysis } = keepKnownReferences(base, stats);
  assert.deepEqual(analysis.plan.acciones[0].laboratorios.sort(), ["Lab B", "Lab C"]); // Perplexity → Lab B; "lab c" es pendiente
});
ok("se descartan competencias y conceptos inexistentes y se cuentan (3: competencia, concepto, laboratorio)", () => {
  const { analysis, removed } = keepKnownReferences(base, stats);
  assert.equal(removed, 3);
  assert.deepEqual(analysis.competencias.map((c) => c.competencia), ["modelado"]);
});
ok("un laboratorio ya evaluado no se acepta como 'pendiente' en una acción", () => {
  const x = structuredClone(base);
  x.plan.acciones[0].conceptos = [];
  x.plan.acciones[0].laboratorios = ["Lab A"];
  const { analysis } = keepKnownReferences(x, stats);
  assert.deepEqual(analysis.plan.acciones[0].laboratorios, []);
});
ok("el esquema rechaza prioridades inválidas y acciones sin pasos; acepta respuestas sin 'laboratorios'", () => {
  assert.throws(() => semesterSchema.parse({ ...base, plan: { ...base.plan, acciones: [{ ...action, prioridad: "urgente" }] } }));
  assert.throws(() => semesterSchema.parse({ ...base, plan: { ...base.plan, acciones: [{ ...action, pasos: [] }] } }));
  semesterSchema.parse({ ...base, brechas: [{ tema: "t", por_que: "p", conceptos: ["MoE"] }] });
});
console.log(`\n${n} comprobaciones superadas`);

