import { z } from "zod";
import type { AIProvider, Part } from "./ai/types";

/** Datos que la IA propone para registrar un laboratorio a partir de su guía. Todo es editable antes de guardar. */
export const suggestionSchema = z.object({
  found: z.boolean(),
  name: z.string().max(200),
  description: z.string().max(2000),
  objectives: z.string().max(4000),
  cut: z.number().int().min(1).max(4).nullable(),
  number: z.number().int().min(0).max(999).nullable(),
});
export type LabSuggestion = z.infer<typeof suggestionSchema>;

const S = (type: string, extra: object = {}) => ({ type, ...extra });
const GEMINI_SCHEMA = S("OBJECT", {
  properties: {
    found: S("BOOLEAN"),
    name: S("STRING"),
    description: S("STRING"),
    objectives: S("STRING"),
    cut: S("INTEGER", { nullable: true }),
    number: S("INTEGER", { nullable: true }),
  },
  required: ["found", "name", "description", "objectives", "cut", "number"],
});

const SYSTEM = `Lees la guía o enunciado de un laboratorio universitario y propones los datos para registrarlo en una plataforma.
Reglas estrictas:
- Usa SOLO lo que está escrito en el documento. No inventes nada y no completes con suposiciones.
- found: false si el documento no es la guía o el enunciado de un laboratorio (en ese caso deja los textos vacíos y cut y number en null).
- name: el título del laboratorio tal como aparece, sin prefijos como "Guía de".
- description: de 2 a 4 frases que resuman de qué trata el laboratorio y qué debe entregar el estudiante, fieles al documento.
- objectives: los objetivos que el documento plantea, uno por línea, sin viñetas ni numeración. Si el documento no trae objetivos explícitos, deja una cadena vacía: no los deduzcas.
- cut: el número de corte (1 a 4) SOLO si el documento usa la palabra "corte" con un número. "Parcial", "unidad" o "módulo" NO son un corte: en ese caso, null.
- number: el número del laboratorio SOLO si el documento lo dice explícitamente (p. ej. "Laboratorio 3"); si no, null.
- Conserva el idioma original del documento (español).`;

export async function suggestLabFromGuide(provider: AIProvider, parts: Part[], guideTitle: string): Promise<LabSuggestion> {
  const raw = await provider.generateJSON({
    system: SYSTEM,
    schema: GEMINI_SCHEMA,
    maxOutputTokens: 4096,
    thinking: "low", // extracción fiel de datos
    parts: [{ kind: "text", text: `Título del archivo de la guía: ${guideTitle}\n\nDocumento:` }, ...parts],
  });
  return suggestionSchema.parse(raw);
}

export const FIELD_LABEL = { name: "nombre", description: "descripción", objectives: "objetivos", cut: "corte", number: "número" } as const;
export type FillField = keyof typeof FIELD_LABEL;

/**
 * Qué campos se rellenan: solo los que están VACÍOS (nunca se pisa lo que la persona ya escribió) y para los que la IA
 * encontró un dato. `skipped` son los campos con propuesta que no se aplicaron porque ya tenían contenido.
 */
export function fillPlan(current: Record<FillField, string>, s: LabSuggestion): { fill: Partial<Record<FillField, string>>; skipped: FillField[] } {
  const proposed: Partial<Record<FillField, string>> = {};
  if (s.name.trim()) proposed.name = s.name.trim();
  if (s.description.trim()) proposed.description = s.description.trim();
  if (s.objectives.trim()) proposed.objectives = s.objectives.trim();
  if (s.cut != null) proposed.cut = String(s.cut);
  if (s.number != null) proposed.number = String(s.number);

  const fill: Partial<Record<FillField, string>> = {};
  const skipped: FillField[] = [];
  for (const k of Object.keys(proposed) as FillField[]) {
    if (current[k].trim() === "") fill[k] = proposed[k];
    else skipped.push(k);
  }
  return { fill, skipped };
}
