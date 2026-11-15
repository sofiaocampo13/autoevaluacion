import { z } from "zod";
import type { AIProvider, Part } from "./ai/types";
import type { Criterion } from "./rubric-validate";

const levelSchema = z.object({
  name: z.string().max(100),
  min_percent: z.number().min(0).max(100).nullable(),
  descriptor: z.string().max(1500),
});
const criterionSchema = z.object({
  competency: z.string().max(200),
  criterion: z.string().max(300),
  description: z.string().max(2000),
  weight_percent: z.number().min(0).max(100).nullable(),
  levels: z.array(levelSchema).max(8),
});
export const parsedRubricSchema = z.object({
  title: z.string().max(200),
  has_rubric: z.boolean(),
  criteria: z.array(criterionSchema).max(40),
  notes: z.string().max(1500),
});
export type ParsedRubric = z.infer<typeof parsedRubricSchema>;

// Mismo contrato en el dialecto de Gemini.
const S = (type: string, extra: object = {}) => ({ type, ...extra });
export const RUBRIC_GEMINI_SCHEMA = S("OBJECT", {
  properties: {
    title: S("STRING"),
    has_rubric: S("BOOLEAN"),
    notes: S("STRING"),
    criteria: S("ARRAY", {
      items: S("OBJECT", {
        properties: {
          competency: S("STRING"),
          criterion: S("STRING"),
          description: S("STRING"),
          weight_percent: S("NUMBER", { nullable: true }),
          levels: S("ARRAY", {
            items: S("OBJECT", {
              properties: { name: S("STRING"), min_percent: S("NUMBER", { nullable: true }), descriptor: S("STRING") },
              required: ["name", "min_percent", "descriptor"],
            }),
          }),
        },
        required: ["competency", "criterion", "description", "weight_percent", "levels"],
      }),
    }),
  },
  required: ["title", "has_rubric", "criteria", "notes"],
});

const SYSTEM = `Eres un asistente que convierte una rúbrica de evaluación universitaria en datos estructurados.
Reglas estrictas:
- Extrae SOLO lo que está escrito en el documento. No inventes criterios, niveles, descriptores ni pesos.
- Si el documento no contiene una rúbrica de evaluación (criterios con niveles o ponderaciones), devuelve has_rubric=false, criteria=[] y explica en notes qué contiene.
- weight_percent: el peso del criterio como porcentaje del total. Si el documento da puntos sobre un total (p. ej. 20 de 100 puntos), conviértelo a porcentaje proporcional. Si el documento NO indica el peso, devuelve null (no lo repartas tú).
- levels: los niveles de desempeño tal como aparecen (nombre y descriptor textual). min_percent solo si el documento da un rango o puntaje que permita derivarlo; si no, null.
- competency: la competencia o categoría a la que pertenece el criterio si el documento la indica; si no, cadena vacía.
- Conserva el idioma original del documento (español).
- En notes menciona cualquier ambigüedad, inconsistencia o dato faltante que notes (por ejemplo pesos que no suman 100).`;

export async function parseRubricWithAI(
  provider: AIProvider,
  parts: Part[],
  context: { labName: string; objectives: string },
): Promise<{ criteria: Criterion[]; title: string; hasRubric: boolean; notes: string }> {
  const raw = await provider.generateJSON({
    system: SYSTEM,
    schema: RUBRIC_GEMINI_SCHEMA,
    maxOutputTokens: 16384,
    thinking: "low", // extracción fiel de datos: con razonamiento bajo da lo mismo en menos de la mitad del tiempo
    parts: [
      { kind: "text", text: `Laboratorio: ${context.labName}\nObjetivos: ${context.objectives || "(no indicados)"}\n\nDocumento de la rúbrica a estructurar:` },
      ...parts,
    ],
  });
  const parsed = parsedRubricSchema.parse(raw);
  return {
    title: parsed.title,
    hasRubric: parsed.has_rubric,
    notes: parsed.notes,
    criteria: parsed.criteria.map((c) => ({
      competency: c.competency,
      criterion: c.criterion,
      description: c.description,
      weight: c.weight_percent,
      levels: c.levels,
    })),
  };
}
