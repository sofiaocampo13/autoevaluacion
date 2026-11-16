// Prueba de las estadísticas del semestre con datos sintéticos (no toca la base de datos).
// Uso: node --import tsx scripts/test-semester-stats.ts
import assert from "node:assert/strict";
import { bandOf, computeSemesterStats, type SemesterLabInput } from "../src/lib/semester-stats";

let n = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("PASS ", name);
};

const lab = (id: string, cut: number, number: number, percents: [string, string, number, "suficiente" | "parcial" | "inexistente"][], extra: Partial<SemesterLabInput> = {}): SemesterLabInput => ({
  lab: { id, name: `Lab ${id}`, number, cut },
  evaluation: { id: "e" + id, completedAt: `2026-0${cut}-0${number}T10:00:00Z`, overallPercent: 80, estimatedGrade: 4, reviewStatus: "preliminar", finalPercent: null, finalGrade: null },
  criteria: percents.map(([criterion, competency, percent, evidence]) => ({ criterion, competency, weight: 50, percent, evidence })),
  strengths: [],
  weaknesses: [],
  toReinforce: [],
  concepts: [],
  ...extra,
});

const A = lab("A", 1, 1, [["c1", "Modelado", 60, "suficiente"], ["c2", "Código", 90, "suficiente"]], { concepts: [{ name: "Cuantización", status: "demostrado" }], toReinforce: ["Perplexity"], strengths: ["Buen código"], weaknesses: ["Falta análisis"] });
const B = lab("B", 1, 2, [["c1", "modelado", 80, "parcial"], ["c2", "Código", 100, "suficiente"]], { toReinforce: ["perplexity"], strengths: ["buen código"], weaknesses: ["Falta análisis"], evaluation: { id: "eB", completedAt: "2026-01-02T10:00:00Z", overallPercent: 90, estimatedGrade: 4.5, reviewStatus: "ajustada", finalPercent: 70, finalGrade: 3.5 } });
const C = lab("C", 2, 1, [["c1", "Modelado", 100, "suficiente"]], { concepts: [{ name: "Cuantización", status: "refuerzo" }] });

const s = computeSemesterStats([C, A, B], 4, 5);

ok("bandas: 85/70/50", () => {
  assert.equal(bandOf(85), "dominio");
  assert.equal(bandOf(84.9), "competente");
  assert.equal(bandOf(70), "competente");
  assert.equal(bandOf(50), "en_desarrollo");
  assert.equal(bandOf(49.9), "inicial");
});
ok("orden cronológico por corte y número, sin importar el orden de entrada", () => assert.deepEqual(s.points.map((p) => p.labId), ["A", "B", "C"]));
ok("la nota revisada por el docente reemplaza a la de la IA (90 → 70)", () => {
  const b = s.points[1];
  assert.equal(b.percent, 70);
  assert.equal(b.aiPercent, 90);
  assert.equal(b.reviewed, true);
  assert.equal(s.reviewedLabs, 1);
});
ok("una evaluación 'devuelta' no cuenta como revisada", () => {
  const d = lab("D", 1, 3, [["c", "X", 50, "suficiente"]], { evaluation: { id: "eD", completedAt: "2026-01-03T10:00:00Z", overallPercent: 77, estimatedGrade: 3.8, reviewStatus: "devuelta", finalPercent: null, finalGrade: null } });
  const r = computeSemesterStats([d], 1, 5);
  assert.equal(r.points[0].percent, 77);
  assert.equal(r.points[0].reviewed, false);
});
ok("promedio y totales (80 + 70 + 80 = 76,67)", () => {
  assert.equal(s.labsEvaluated, 3);
  assert.equal(s.labsTotal, 4);
  assert.equal(s.averagePercent, 76.67);
});
ok("por corte: corte 1 = (80+70)/2, corte 2 = 80", () => {
  assert.deepEqual(s.byCut.map((c) => [c.cut, c.labs, c.averagePercent]), [[1, 2, 75], [2, 1, 80]]);
});
ok("tendencia: primero vs último laboratorio", () => assert.deepEqual(s.trend, { first: 80, last: 80, delta: 0 }));
ok("con un solo laboratorio no hay tendencia ni delta inventado", () => {
  const r = computeSemesterStats([A], 1, 5);
  assert.equal(r.trend, null);
  assert.ok(r.competencies.every((c) => c.delta === null));
});
ok("competencias se unen sin importar mayúsculas y se ordenan de menor a mayor", () => {
  const m = s.competencies.find((c) => c.competency.toLowerCase() === "modelado")!;
  assert.equal(m.labs, 3);
  assert.equal(m.first, 60);
  assert.equal(m.last, 100);
  assert.equal(m.delta, 40);
  assert.equal(m.percent, 80); // (60+80+100)/3 con pesos iguales
  assert.equal(m.weakEvidence, 1);
  assert.equal(s.competencies[0].competency.toLowerCase(), "modelado");
});
ok("brechas: solo criterios bajo 85 % o con evidencia no suficiente, de menor a mayor", () => {
  assert.deepEqual(s.gaps.map((g) => [g.criterion, g.lab, g.percent]), [["c1", "Lab A", 60], ["c1", "Lab B", 80]]);
});
ok("concepto 'Perplexity' pedido a reforzar en 2 laboratorios (con otra mayúscula) → recurrente", () => {
  const p = s.concepts.find((c) => c.name.toLowerCase() === "perplexity")!;
  assert.equal(p.states.refuerzo, 2);
  assert.equal(p.recurrent, true);
  assert.equal(s.concepts[0].name.toLowerCase(), "perplexity");
});
ok("concepto cuyo estado más reciente es 'refuerzo' queda como actual aunque antes fuera demostrado", () => {
  const q = s.concepts.find((c) => c.name === "Cuantización")!;
  assert.equal(q.current, "refuerzo");
  assert.deepEqual(q.states, { demostrado: 1, parcial: 0, refuerzo: 1 });
});
ok("fortalezas y debilidades solo si se repiten en 2 o más laboratorios", () => {
  assert.deepEqual(s.recurringWeaknesses, ["Falta análisis"]);
  assert.equal(s.recurringStrengths.length, 1);
});
ok("sin competencias en la rúbrica, cada criterio hace de competencia y se marca como derivado", () => {
  const r = computeSemesterStats([lab("E", 1, 1, [["Calidad del código", "", 90, "suficiente"], ["Informe", "", 70, "suficiente"]])], 1, 5);
  assert.deepEqual(r.competencies.map((c) => [c.competency, c.derived]), [["Informe", true], ["Calidad del código", true]]);
  assert.ok(!r.competencies.some((c) => c.competency.includes("Sin competencia")));
});
ok("sin evaluaciones: todo vacío y sin NaN", () => {
  const r = computeSemesterStats([], 3, 5);
  assert.equal(r.labsEvaluated, 0);
  assert.equal(r.averagePercent, 0);
  assert.equal(r.trend, null);
  assert.equal(JSON.stringify(r).includes("null,null"), false);
  assert.ok(!JSON.stringify(r).includes("NaN"));
});
console.log(`\n${n} comprobaciones superadas`);
