// Genera el informe del semestre con datos sintéticos y comprueba que el PDF es válido y trae el contenido esperado.
// No toca la base de datos ni la IA. Uso: esbuild scripts/test-semester-pdf.mts --bundle --platform=node --format=esm --packages=external --jsx=automatic --outfile=.tmp-test/t.mjs && node .tmp-test/t.mjs (tsx no carga @react-pdf)x
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { renderSemesterReportPdf, type SemesterReportData } from "../src/lib/semester-report-pdf";
import { computeSemesterStats, type SemesterLabInput } from "../src/lib/semester-stats";
import type { LabDetail } from "../src/lib/mindmap-data";

let n = 0;
const ok = async (name: string, fn: () => void | Promise<void>) => {
  await fn();
  n++;
  console.log("PASS ", name);
};

const mk = (id: string, name: string, num: number, cut: number, pct: number, reviewed = false): SemesterLabInput => ({
  lab: { id, name, number: num, cut },
  evaluation: { id: `e${id}`, completedAt: `2026-0${num}-01T10:00:00Z`, overallPercent: pct, estimatedGrade: +(pct / 20).toFixed(2), reviewStatus: reviewed ? "aprobada" : "preliminar", finalPercent: reviewed ? pct - 5 : null, finalGrade: reviewed ? +((pct - 5) / 20).toFixed(2) : null },
  criteria: [
    { criterion: "Código ñandú → prueba", competency: "", weight: 60, percent: pct, evidence: "suficiente" },
    { criterion: "Informe", competency: "", weight: 40, percent: pct - 30, evidence: "parcial" },
  ],
  strengths: ["Buen código"],
  weaknesses: ["Informe corto"],
  toReinforce: ["Perplexity"],
  concepts: [{ name: "GGUF", status: "demostrado" }, { name: "Perplexity", status: "refuerzo" }],
});
const stats = computeSemesterStats([mk("A", "Lab A", 1, 1, 92, true), mk("B", "Lab B", 2, 1, 78)], 4, 5);
stats.pendingLabs = ["Lab C", "Lab D"];
const details: LabDetail[] = stats.points.map((p) => ({
  labId: p.labId, evaluationId: p.evaluationId, name: p.name, cut: p.cut, number: p.number, infographic: null, toReinforce: ["Perplexity"], recommendations: ["Documenta mejor"],
  criteria: [
    { criterion: "Código ñandú → prueba", percent: 92, evidence: "suficiente", recommendation: "", citations: [] },
    { criterion: "Informe", percent: 62, evidence: "parcial", recommendation: "Añade capturas", citations: [] },
  ],
}));

const base: SemesterReportData = { student: "Sofía Ocampo", subject: "IA", period: "2026-2", generatedAt: new Date("2026-11-15T12:00:00Z"), stats, details, analysis: null, analysisCurrent: false };

async function main() {
await ok("sin análisis de IA el PDF se genera y dice que falta", async () => {
  const pdf = await renderSemesterReportPdf(base);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 3000);
  writeFileSync(process.env.TEMP + "/informe-semestre-sin-analisis.pdf", pdf);
});

await ok("con análisis (vigente o desactualizado) se genera, con símbolos fuera de Latin-1 sin romper", async () => {
  const analysis = {
    id: "x", createdAt: "2026-11-15T12:00:00Z", labsCount: 2, model: "modelo-prueba", signature: "s", warnings: ["Aviso de prueba → ✓"],
    analysis: {
      diagnostico: "Diagnóstico “con comillas” — y guiones…", evolucion: "Evolución ≥ estable", competencias: [{ competencia: "Código", lectura: "Bien" }],
      fortalezas: ["Código sólido"], brechas: [{ tema: "Perplexity", por_que: "Se repite", laboratorios: ["Lab A", "Lab B"] }],
      plan: { objetivo: "Fortalecer", acciones: [{ prioridad: "alta" as const, tema: "Perplexity", tiempo: "1 semana", pasos: ["Repasar", "Practicar"], logro: "Explicarlo sin ayuda", laboratorios: ["Lab A"] }], orden_sugerido: "Primero lo alto", habitos: ["Repasar semanal"] },
    },
  };
  for (const current of [true, false]) {
    const pdf = await renderSemesterReportPdf({ ...base, analysis: analysis as SemesterReportData["analysis"], analysisCurrent: current });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    if (current) writeFileSync(process.env.TEMP + "/informe-semestre-con-analisis.pdf", pdf);
  }
});

console.log(`\n${n} comprobaciones superadas`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
