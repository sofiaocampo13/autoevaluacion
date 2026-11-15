import assert from "node:assert/strict";
import { finalizeAssessment, isSystemicVerificationFailure, quoteInText, type RawAssessment } from "../src/lib/assessment";
import { estimatedGrade, overallPercent } from "../src/lib/scoring";

const levels = [
  { name: "Excelente", min_percent: 90, descriptor: "" },
  { name: "Competente", min_percent: 70, descriptor: "" },
  { name: "Insuficiente", min_percent: 0, descriptor: "" },
];
const inventory = [
  { location: "lab/informe.md", origin: "archivo" as const, mode: "text" as const },
  { location: "lab/captura.png", origin: "archivo" as const, mode: "native" as const },
];
const texts = new Map([["lab/informe.md", "## Resultados\nEl modelo llegó a un RMSE de 2.4 °C en el conjunto de prueba."]]);
const base: RawAssessment = {
  rubric_level: "Excelente", percent: 95, evidence_sufficiency: "suficiente",
  citations: [{ location: "lab/informe.md", quote: "RMSE de 2.4 °C", supports: "métrica" }],
  argumentation: "", recommendation: "", confidence: "alta", concepts: [], injection_suspected: false, limitations: "",
};
const run = (over: Partial<RawAssessment>) => finalizeAssessment({ ...base, ...over }, { levels, texts, inventory });
let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log("PASS ", name); };

ok("cita real se verifica y se conserva el 95 %", () => { const r = run({}); assert.equal(r.citations[0].status, "verificada"); assert.equal(r.percent, 95); assert.equal(r.flags.length, 0); });
ok("cita inventada (no está en el texto) → evidencia inexistente y 0 %", () => { const r = run({ citations: [{ location: "lab/informe.md", quote: "obtuvo una exactitud del 99 % en validación cruzada", supports: "" }] }); assert.equal(r.evidence_sufficiency, "inexistente"); assert.equal(r.percent, 0); });
ok("archivo inventado → cita inválida y 0 %", () => { const r = run({ citations: [{ location: "lab/no_existe.py", quote: "def entrenar()", supports: "" }] }); assert.equal(r.citations[0].status, "invalida"); assert.equal(r.percent, 0); });
ok("sin citas pero 'suficiente' → 0 %", () => { const r = run({ citations: [] }); assert.equal(r.evidence_sufficiency, "inexistente"); assert.equal(r.percent, 0); });
ok("solo capturas (no verificables): cuenta pero queda como parcial y sin llegar al nivel más alto", () => { const r = run({ citations: [{ location: "lab/captura.png", quote: "[imagen] gráfica con la serie real y la predicha", supports: "" }] }); assert.equal(r.citations[0].status, "no_verificable"); assert.equal(r.evidence_sufficiency, "parcial"); assert.ok(r.percent < 90 && r.percent > 0, `fue ${r.percent}`); });
ok("captura + cita verificada de texto: evidencia suficiente, sin tope", () => { const r = run({ citations: [{ location: "lab/captura.png", quote: "[imagen] gráfica", supports: "" }, { location: "lab/informe.md", quote: "RMSE de 2.4 °C", supports: "" }] }); assert.equal(r.evidence_sufficiency, "suficiente"); assert.equal(r.percent, 95); });
ok("evidencia parcial no llega al nivel más alto", () => { const r = run({ evidence_sufficiency: "parcial", rubric_level: "Competente", percent: 95 }); assert.ok(r.percent < 90, `fue ${r.percent}`); });
ok("porcentaje fuera del rango del nivel se ajusta", () => { const r = run({ rubric_level: "Competente", percent: 99 }); assert.ok(r.percent >= 70 && r.percent < 90, `fue ${r.percent}`); });
ok("inyección detectada: se marca y baja la confianza", () => { const r = run({ injection_suspected: true }); assert.equal(r.confidence, "baja"); assert.ok(r.flags.some((f) => f.level === "aviso" && f.text.includes("instrucciones"))); });
ok("elipsis: trozos de la cita deben aparecer todos", () => { assert.equal(quoteInText("El modelo llegó … RMSE de 2.4", texts.get("lab/informe.md")!), true); assert.equal(quoteInText("El modelo llegó … RMSE de 9.9", texts.get("lab/informe.md")!), false); });
ok("la nota se calcula en código con los pesos", () => { const p = overallPercent([{ weight: 15, percent: 100 }, { weight: 20, percent: 80 }, { weight: 20, percent: 60 }, { weight: 20, percent: 0 }, { weight: 25, percent: 50 }]); assert.equal(p, 55.5); assert.equal(estimatedGrade(p, 5), 2.8); assert.equal(estimatedGrade(p, 100), 55.5); });
ok("Markdown y espacios distintos no invalidan una cita real (caso real del README)", () => { assert.equal(quoteInText('no debe responder a buscar un "mejor modelo universal", sino a un análisis de compromiso técnico (trade-off) considerando: tarea', 'no debe responder a buscar un \"mejor modelo universal\", sino a un análisis de compromiso técnico (*trade-off*) considerando: **tarea específica**'), true); });
ok("fila de tabla abreviada con celdas reales → válida; con una celda inventada → rechazada", () => {
  const t = "| **Errores** | `SyntaxError: unterminated string literal`, línea 28. También se vieron otros | `SyntaxError: invalid syntax`, línea 1 por Markdown |";
  assert.equal(quoteInText("| Errores | SyntaxError: unterminated string literal | SyntaxError: invalid syntax", t), true);
  assert.equal(quoteInText("| Errores | SyntaxError: unterminated string literal | TypeError: valor nulo inesperado", t), false);
});
ok("la IA copia el marcador completo en la ubicación y en la cita → se limpia y la cita sigue siendo válida (caso real que dio 0/5)", () => {
  const r = run({ citations: [
    { location: "[EVIDENCIA · ubicación: lab/informe.md]", quote: "[EVIDENCIA · ubicación: lab/informe.md]\nRMSE de 2.4 °C", supports: "" },
    { location: "[EVIDENCIA · ubicación: lab/captura.png]", quote: "[imagen] gráfica", supports: "" },
  ] });
  assert.equal(r.citations[0].status, "verificada");
  assert.equal(r.citations[0].location, "lab/informe.md");
  assert.equal(r.citations[1].status, "no_verificable");
  assert.equal(r.evidence_sufficiency, "suficiente");
  assert.equal(r.percent, 95);
});
ok("el marcador no hace válida una cita inventada", () => { const r = run({ citations: [{ location: "[EVIDENCIA · ubicación: lab/informe.md]", quote: "[EVIDENCIA · ubicación: lab/informe.md]\nobtuvo una exactitud del 99 % en validación", supports: "" }] }); assert.equal(r.citations[0].status, "invalida"); assert.equal(r.percent, 0); });
ok("freno: casi todos los criterios sin cita verificable = fallo del sistema, no se publica", () => {
  const bad = run({ citations: [{ location: "lab/no_existe.py", quote: "algo", supports: "" }] });
  const good = run({});
  assert.equal(isSystemicVerificationFailure(new Map([[0, bad], [1, bad], [2, bad], [3, good], [4, bad]])), true);
  assert.equal(isSystemicVerificationFailure(new Map([[0, good], [1, good], [2, bad], [3, good], [4, good]])), false);
  assert.equal(isSystemicVerificationFailure(new Map([[0, bad]])), false);
});
ok("código con líneas intermedias omitidas: cita real → válida", () => { assert.equal(quoteInText("def f(x):\n    return x + 1", "def f(x):\n    # suma uno\n    y = 2\n    return x + 1\n"), true); });
ok("código con una línea inventada → rechazada", () => { assert.equal(quoteInText("def f(x):\n    os.system('rm -rf /')", "def f(x):\n    return x + 1\n"), false); });
console.log(`\n${n}/18 pruebas superadas`);
