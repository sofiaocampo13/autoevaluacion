// Prueba del árbol del mapa mental con datos sintéticos (no toca la base de datos).
// Uso: node --import tsx scripts/test-mindmap.ts
import assert from "node:assert/strict";
import { buildMindMap, countNodes, onlyStrengths, type LabDetail, type MindNode } from "../src/lib/mindmap-data";
import { computeSemesterStats, type SemesterLabInput } from "../src/lib/semester-stats";

let n = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("PASS ", name);
};
const find = (t: MindNode, label: string): MindNode | undefined => (t.label === label ? t : t.children.map((c) => find(c, label)).find(Boolean));
const ids = (t: MindNode): string[] => [t.id, ...t.children.flatMap(ids)];

const inputs: SemesterLabInput[] = [
  {
    lab: { id: "A", name: "Lab A", number: 1, cut: 1 },
    evaluation: { id: "eA", completedAt: "2026-01-01T10:00:00Z", overallPercent: 90, estimatedGrade: 4.5, reviewStatus: "aprobada", finalPercent: 80, finalGrade: 4, },
    criteria: [{ criterion: "Código", competency: "", weight: 50, percent: 95, evidence: "suficiente" }, { criterion: "Informe", competency: "", weight: 50, percent: 60, evidence: "parcial" }],
    strengths: [], weaknesses: [], toReinforce: ["Perplexity"], concepts: [{ name: "GGUF", status: "demostrado" }, { name: "Perplexity", status: "parcial" }],
  },
];
const details: LabDetail[] = [
  {
    labId: "A", evaluationId: "eA", name: "Lab A", cut: 1, number: 1, toReinforce: ["Perplexity"], recommendations: ["Documenta mejor"],
    infographic: { titulo: "x", categorias: [{ nombre: "Modelos", subcategorias: [{ nombre: "Compresión", conceptos: [{ nombre: "GGUF", estado: "demostrado" }, { nombre: "Perplexity", estado: "parcial" }] }] }] },
    criteria: [
      { criterion: "Código", percent: 95, evidence: "suficiente", recommendation: "", citations: [{ location: "main.py L3", quote: "def run()", status: "verificada" }] },
      { criterion: "Informe", percent: 60, evidence: "parcial", recommendation: "Añade capturas completas", citations: [] },
    ],
  },
];
const stats = computeSemesterStats(inputs, 3, 5);
stats.pendingLabs = ["Lab B", "Lab C"];
const tree = buildMindMap("IA", stats, details, null);

ok("la raíz es la asignatura y tiene las 3 ramas: Temas, Laboratorios, Qué profundizar", () => {
  assert.equal(tree.label, "IA");
  assert.deepEqual(tree.children.map((c) => c.label), ["Temas", "Laboratorios", "Qué profundizar"]);
});
ok("todos los id son únicos", () => assert.equal(new Set(ids(tree)).size, ids(tree).length));
ok("el laboratorio revisado usa la nota del docente (80 %) y avisa de la estimación de la IA (90 %)", () => {
  const lab = find(tree, "Lab A")!;
  assert.equal(lab.percent, 80);
  assert.ok(lab.detail.lines.some((l) => l.includes("revisada por un docente")));
  assert.ok(lab.detail.lines.some((l) => l.includes("90 %")));
  assert.equal(lab.detail.link?.href, "/laboratorios/A/evaluacion/eA");
});
ok("un criterio muestra sus citas reales y si están verificadas", () => {
  const c = find(tree, "Código")!;
  assert.deepEqual(c.detail.evidence, [{ label: "main.py L3", text: "def run()", verified: true }]);
  assert.equal(c.state, "demostrado");
});
ok("un criterio débil (60 %, evidencia parcial) queda 'refuerzo' y propone qué profundizar", () => {
  const c = find(tree, "Informe")!;
  assert.equal(c.state, "refuerzo");
  assert.deepEqual(c.detail.deepen, ["Añade capturas completas"]);
});
ok("el color de un grupo sale de su porcentaje (laboratorio, corte) y no se tiñe de naranja por un solo criterio débil", () => {
  assert.equal(find(tree, "Lab A")!.state, "parcial"); // 80 %
  assert.equal(find(tree, "Corte 1")!.state, "parcial");
  assert.deepEqual(find(tree, "Lab A")!.stats, { strong: 1, total: 2, weak: 1, unit: "criterios" });
});
ok("los laboratorios pendientes salen aparte como 'sin evaluar' y no tienen porcentaje inventado", () => {
  const p = find(tree, "Sin evaluar")!;
  assert.deepEqual(p.children.map((c) => c.label), ["Lab B", "Lab C"]);
  assert.ok(p.children.every((c) => c.state === "sin_evaluar" && c.percent === undefined));
});
ok("los temas salen de la infografía; lo pedido a reforzar prevalece sobre 'parcial' (Perplexity → refuerzo)", () => {
  assert.equal(find(tree, "Perplexity", )!.state, "refuerzo");
  assert.equal(find(tree, "GGUF")!.state, "demostrado");
  assert.equal(find(tree, "Modelos")!.state, "demostrado"); // 1 de 2 demostrado: manda la mitad
  assert.deepEqual(find(tree, "Modelos")!.stats, { strong: 1, total: 2, weak: 1, unit: "conceptos" });
});
ok("'Qué profundizar' lista el concepto por reforzar con el laboratorio donde apareció", () => {
  const g = find(find(tree, "Qué profundizar")!, "Perplexity")!;
  assert.equal(g.kind, "gap");
  assert.ok(g.detail.lines[0].includes("Lab A"));
});
ok("sin evaluaciones el árbol sigue siendo válido: 'Qué profundizar' dice que no hay nada y no hay porcentaje", () => {
  const empty = buildMindMap("IA", computeSemesterStats([], 2, 5), [], null);
  assert.equal(empty.percent, undefined);
  assert.deepEqual(empty.children.map((c) => c.label), ["Qué profundizar"]);
  assert.equal(countNodes(empty), 2);
});
ok("'solo fortalezas' deja lo demostrado, quita lo débil, lo pendiente y 'Qué profundizar', y recalcula el color de las ramas", () => {
  const s = onlyStrengths(tree)!;
  assert.ok(find(s, "Código"));
  assert.ok(find(s, "GGUF"));
  assert.equal(find(s, "Informe"), undefined);
  assert.equal(find(s, "Perplexity"), undefined);
  assert.equal(find(s, "Sin evaluar"), undefined);
  assert.equal(find(s, "Qué profundizar"), undefined);
  assert.equal(find(s, "Lab A")!.state, "demostrado");
  assert.equal(find(s, "Lab A")!.percent, 80);
  assert.ok(find(tree, "Informe"), "el árbol original no se modifica");
});
console.log(`\n${n} comprobaciones superadas`);
