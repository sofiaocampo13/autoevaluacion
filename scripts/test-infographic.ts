import assert from "node:assert/strict";
import { reconcileInfographic, PENDING_CATEGORY } from "../src/lib/infographic-data";

const info = { titulo: "T", categorias: [{ nombre: "Fundamentos", subcategorias: [{ nombre: "Modelos", conceptos: [
  { nombre: "Cuantización GGUF", estado: "demostrado" as const }, { nombre: "Transformers", estado: "demostrado" as const }] }] }] };
let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log("PASS ", name); };

ok("sin conceptos a reforzar: no cambia nada", () => assert.deepEqual(reconcileInfographic(info, []), info));
ok("lo pendiente 'Cuantización' (amplio) marca como refuerzo al concepto más específico 'Cuantización GGUF'", () => {
  const r = reconcileInfographic(info, ["Cuantización"]);
  assert.equal(r.categorias[0].subcategorias[0].conceptos[0].estado, "refuerzo");
  assert.equal(r.categorias[0].subcategorias[0].conceptos[1].estado, "demostrado");
  assert.equal(r.categorias.length, 1);
});
ok("lo pendiente MÁS ESPECÍFICO no degrada al concepto amplio ya demostrado: se agrega como nuevo (caso real)", () => {
  const r = reconcileInfographic(info, ["Relación entre cuantización y Perplexity"]);
  const conceptos = r.categorias[0].subcategorias[0].conceptos;
  assert.equal(conceptos[0].estado, "demostrado"); // "Cuantización GGUF" sigue demostrado
  const cat = r.categorias.find((c) => c.nombre === PENDING_CATEGORY)!;
  assert.equal(cat.subcategorias[0].conceptos[0].nombre, "Relación entre cuantización y Perplexity");
  assert.equal(cat.subcategorias[0].conceptos[0].estado, "refuerzo");
});
ok("un concepto ausente se agrega en 'Por reforzar'", () => {
  const r = reconcileInfographic(info, ["Modelos Mixture of Experts (MoE)", "Relación entre cuantización y perplexity"]);
  const cat = r.categorias.find((c) => c.nombre === PENDING_CATEGORY)!;
  assert.ok(cat);
  assert.equal(cat.subcategorias[0].conceptos.length, 2);
  assert.ok(cat.subcategorias[0].conceptos.every((k) => k.estado === "refuerzo"));
});
ok("tolera acentos y mayúsculas; no muta el original", () => {
  const copia = JSON.stringify(info);
  const r = reconcileInfographic(info, ["TRANSFORMERS"]);
  assert.equal(r.categorias[0].subcategorias[0].conceptos[1].estado, "refuerzo");
  assert.equal(JSON.stringify(info), copia);
});
ok("sin infografía guardada: crea una con lo pendiente", () => assert.equal(reconcileInfographic(null, ["X concepto largo"]).categorias.length, 1));
console.log(`\n${n}/6 pruebas superadas`);
