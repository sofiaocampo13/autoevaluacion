import assert from "node:assert/strict";
import { evaluateReview, isPlausibleToken, linkState } from "../src/lib/review-logic";

const criteria = [
  { position: 0, criterion: "1. Mapa mental", weight: 15, percent: 98 },
  { position: 1, criterion: "2. Cartografía", weight: 20, percent: 100 },
  { position: 2, criterion: "3. Ollama", weight: 20, percent: 95 },
  { position: 3, criterion: "4. Vibe Coding", weight: 20, percent: 96 },
  { position: 4, criterion: "5. Reto", weight: 25, percent: 97 },
];
const now = new Date("2026-11-20T12:00:00Z");
const d = (iso: string) => iso;
let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log("PASS ", name); };

ok("enlace vigente = activo", () => assert.equal(linkState({ expires_at: d("2026-11-25T00:00:00Z"), revoked_at: null, used_at: null }, now), "activo"));
ok("enlace vencido = expirado", () => assert.equal(linkState({ expires_at: d("2026-11-19T00:00:00Z"), revoked_at: null, used_at: null }, now), "expirado"));
ok("revocado manda sobre todo (aunque esté vigente)", () => assert.equal(linkState({ expires_at: d("2026-11-25T00:00:00Z"), revoked_at: d("2026-11-20T00:00:00Z"), used_at: null }, now), "revocado"));
ok("usado = ya hay una revisión", () => assert.equal(linkState({ expires_at: d("2026-11-25T00:00:00Z"), revoked_at: null, used_at: d("2026-11-20T01:00:00Z") }, now), "usado"));
ok("vence exactamente en este instante = expirado", () => assert.equal(linkState({ expires_at: now.toISOString(), revoked_at: null, used_at: null }, now), "expirado"));

ok("sin ajustes: la nota final es la del sistema y no hay cambios", () => {
  const r = evaluateReview(criteria, [], 5);
  assert.ok(r.ok && !r.changed && r.finalPercent === 97.15 && r.finalGrade === 4.9);
});
ok("un ajuste con justificación recalcula con los pesos (Vibe Coding 96 → 60)", () => {
  const r = evaluateReview(criteria, [{ position: 3, adjustedPercent: 60, justification: "No hay evidencia de la comparación" }], 5);
  assert.ok(r.ok && r.changed && r.adjustments.length === 1);
  if (r.ok) { assert.equal(r.finalPercent, 89.95); assert.equal(r.finalGrade, 4.5); assert.equal(r.adjustments[0].original_percent, 96); }
});
ok("ajustar sin justificar se rechaza", () => assert.equal(evaluateReview(criteria, [{ position: 3, adjustedPercent: 60, justification: "mal" }], 5).ok, false));
ok("enviar el mismo valor no cuenta como ajuste ni exige justificación", () => {
  const r = evaluateReview(criteria, [{ position: 3, adjustedPercent: 96, justification: "" }], 5);
  assert.ok(r.ok && !r.changed);
});
ok("porcentaje fuera de rango, NaN o criterio inexistente se rechazan", () => {
  assert.equal(evaluateReview(criteria, [{ position: 0, adjustedPercent: 101, justification: "justificación larga" }], 5).ok, false);
  assert.equal(evaluateReview(criteria, [{ position: 0, adjustedPercent: -1, justification: "justificación larga" }], 5).ok, false);
  assert.equal(evaluateReview(criteria, [{ position: 0, adjustedPercent: NaN, justification: "justificación larga" }], 5).ok, false);
  assert.equal(evaluateReview(criteria, [{ position: 9, adjustedPercent: 50, justification: "justificación larga" }], 5).ok, false);
});
ok("dos ajustes al mismo criterio se rechazan", () => assert.equal(evaluateReview(criteria, [{ position: 1, adjustedPercent: 50, justification: "justificación larga" }, { position: 1, adjustedPercent: 60, justification: "justificación larga" }], 5).ok, false));
ok("escala 0-100 también funciona", () => { const r = evaluateReview(criteria, [], 100); assert.ok(r.ok && r.finalGrade === 97.2); });
ok("el docente no puede 'inventar' una nota: solo cambia porcentajes y el resultado sale de los pesos", () => {
  const r = evaluateReview(criteria, criteria.map((c) => ({ position: c.position, adjustedPercent: 0, justification: "No cumple con lo solicitado" })), 5);
  assert.ok(r.ok && r.finalPercent === 0 && r.finalGrade === 0);
});
ok("formato de enlace: 43 caracteres base64url", () => {
  assert.equal(isPlausibleToken("A".repeat(43)), true);
  assert.equal(isPlausibleToken("A".repeat(42)), false);
  assert.equal(isPlausibleToken("../../etc/passwd" + "A".repeat(27)), false);
  assert.equal(isPlausibleToken(""), false);
});
console.log(`\n${n}/14 pruebas superadas`);
