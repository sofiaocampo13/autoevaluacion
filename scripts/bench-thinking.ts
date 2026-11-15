import { readFileSync } from "node:fs";
import { extractParts } from "../src/lib/extract";
import { RUBRIC_GEMINI_SCHEMA, parsedRubricSchema } from "../src/lib/rubric-parse";

async function main() {
  const f = "C:/Users/sofia/Desktop/Profundización I (IA)/Laboratorio_Fundamentos_IA_Desarrollo_Software_Aumentado (1).docx";
  const ex = extractParts("lab.docx", "docx", new Uint8Array(readFileSync(f)));
  const text = ex.parts[0].kind === "text" ? ex.parts[0].text : "";
  for (const thinking of [undefined, { thinkingLevel: "low" }, { thinkingLevel: "minimal" }]) {
    const t = Date.now();
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Extrae la rúbrica de evaluación del documento sin inventar nada. weight_percent null si no se indica." }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: RUBRIC_GEMINI_SCHEMA, temperature: 0, maxOutputTokens: 16384, ...(thinking ? { thinkingConfig: thinking } : {}) },
      }),
    });
    const j = await r.json();
    let info = "";
    if (r.ok) {
      const p = parsedRubricSchema.safeParse(JSON.parse(j.candidates[0].content.parts.map((x: { text?: string }) => x.text ?? "").join("")));
      info = p.success ? `${p.data.criteria.length} criterios, pesos=${p.data.criteria.map((c) => c.weight_percent).join("/")}` : "esquema inválido";
    } else info = j.error?.message?.slice(0, 120);
    console.log(JSON.stringify(thinking ?? "por defecto"), "→ HTTP", r.status, `${Date.now() - t} ms`, "|", info, "| tokens razonamiento:", j.usageMetadata?.thoughtsTokenCount ?? "-");
  }
}
main().catch((e) => console.error("FALLÓ", e.message));
