// Postproceso determinista de la valoración de un criterio hecha por la IA.
// La IA propone; este módulo verifica las citas contra el texto real y aplica reglas de coherencia.
import { z } from "zod";
import type { Level } from "./rubric-validate";
import type { InventoryEntry } from "./evidence";

export const assessmentSchema = z.object({
  rubric_level: z.string().max(100),
  percent: z.number().min(0).max(100),
  evidence_sufficiency: z.enum(["suficiente", "parcial", "inexistente"]),
  citations: z
    .array(z.object({ location: z.string().max(500), quote: z.string().max(600), supports: z.string().max(400) }))
    .max(12),
  argumentation: z.string().max(3000),
  recommendation: z.string().max(2000),
  confidence: z.enum(["alta", "media", "baja"]),
  concepts: z.array(z.object({ name: z.string().max(120), status: z.enum(["demostrado", "parcial", "refuerzo"]) })).max(15),
  injection_suspected: z.boolean(),
  limitations: z.string().max(1000),
});
export type RawAssessment = z.infer<typeof assessmentSchema>;

export const NO_VERIFIABLE_CITATIONS = "La valoración no tiene ninguna cita verificable; se trata como evidencia inexistente.";

export type VerifiedCitation = { location: string; quote: string; supports: string; status: "verificada" | "no_verificable" | "invalida" };

/** "aviso" = algo que el estudiante debería revisar; "nota" = información sobre cómo se hizo la verificación. */
export type Flag = { level: "aviso" | "nota"; text: string };

export type FinalAssessment = Omit<RawAssessment, "citations"> & {
  citations: VerifiedCitation[];
  flags: Flag[];
};

// Se comparan solo letras y números: la IA suele quitar o cambiar marcas de Markdown, comillas y espacios
// al citar, pero una frase inventada no coincidirá en sus palabras.
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * ¿La cita es real? Se parte por saltos de línea, elipsis y celdas de tabla, y CADA trozo significativo debe aparecer
 * literalmente en el texto. No se exige que sean contiguos: al citar código, la IA suele omitir líneas
 * intermedias, pero una línea inventada no estará en el archivo y la cita se rechaza.
 */
export function quoteInText(quote: string, text: string): boolean {
  const hay = norm(text);
  const chunks = quote
    .split(/…|\.\.\.|\r?\n|\|/) // también por celdas de tabla Markdown
    .map(norm)
    .filter((c) => c.length >= 8); // al menos 8 letras/números por trozo
  if (chunks.length === 0) return false;
  return chunks.every((c) => hay.includes(c));
}

/** Resuelve la ubicación citada contra el inventario (exacta, o única por sufijo). */
/**
 * La IA a veces copia el marcador completo "[EVIDENCIA · ubicación: ruta]" en vez de solo la ruta, tanto en la
 * ubicación como dentro de la cita. Es un defecto de formato, no de contenido: se limpia antes de verificar.
 */
export function cleanRef(s: string): string {
  return s
    .replace(/\[\s*EVIDENCIA\s*[·.:\-–]*\s*ubicaci[oó]n\s*:\s*([^\]]*)\]/gi, (_m, path: string) => path)
    .replace(/^\s*ubicaci[oó]n\s*:\s*/i, "")
    .trim();
}

function resolveLocation(cited: string, known: string[]): string | null {
  const c = cleanRef(cited);
  if (known.includes(c)) return c;
  const matches = known.filter((k) => k.endsWith(c) || c.endsWith(k));
  return matches.length === 1 ? matches[0] : null;
}

function levelRanges(levels: Level[]) {
  const withMin = levels.filter((l) => l.min_percent != null).sort((a, b) => b.min_percent! - a.min_percent!);
  return withMin.map((l, i) => ({ name: l.name, min: l.min_percent!, max: i === 0 ? 100 : withMin[i - 1].min_percent! - 0.01 }));
}

export function finalizeAssessment(
  raw: RawAssessment,
  ctx: { levels: Level[]; texts: Map<string, string>; inventory: InventoryEntry[] },
): FinalAssessment {
  const flags: Flag[] = [];
  const usable = new Set(ctx.inventory.filter((i) => i.mode === "text" || i.mode === "native").map((i) => i.location));
  const known = [...usable];

  // 1) Verificar cada cita contra el texto real.
  const citations: VerifiedCitation[] = raw.citations.map((original) => {
    // Si la IA copió el marcador de evidencia dentro de la cita, se quita (la ruta ya viene en location).
    const c = { ...original, location: cleanRef(original.location), quote: cleanRef(original.quote.replace(/\[\s*EVIDENCIA[^\]]*\]/gi, "")) };
    const loc = resolveLocation(c.location, known);
    if (!loc) return { ...c, status: "invalida" as const };
    const text = ctx.texts.get(loc);
    if (text === undefined) return { ...c, location: loc, status: "no_verificable" as const }; // imagen o PDF: no hay texto contra el que comparar
    return { ...c, location: loc, status: quoteInText(c.quote, text) ? ("verificada" as const) : ("invalida" as const) };
  });
  const good = citations.filter((c) => c.status !== "invalida").length;
  const bad = citations.filter((c) => c.status === "invalida").length;
  if (bad > 0)
    flags.push({ level: "nota", text: `Se descartaron ${bad} cita(s) de la IA que no coinciden con los archivos; no se usaron como evidencia y no afectan tu trabajo.` });

  let { evidence_sufficiency: sufficiency, percent, confidence } = raw;

  // 2) Sin evidencia verificable no hay mérito: la regla central contra la invención.
  if (sufficiency !== "inexistente" && good === 0) {
    flags.push({ level: "aviso", text: NO_VERIFIABLE_CITATIONS });
    sufficiency = "inexistente";
  }
  if (sufficiency === "inexistente") percent = 0;

  // 2b) Solo citas de imágenes/PDF (no comprobables): vale como evidencia parcial, nunca como suficiente.
  const verifiedCount = citations.filter((c) => c.status === "verificada").length;
  if (sufficiency === "suficiente" && verifiedCount === 0) {
    sufficiency = "parcial";
    flags.push({ level: "nota", text: "Todas las citas de este criterio son capturas o PDF que el sistema no puede comprobar; se trata como evidencia parcial y no puede alcanzar el nivel más alto." });
  }

  // 3) El porcentaje debe caer dentro del rango del nivel elegido.
  const ranges = levelRanges(ctx.levels);
  if (ranges.length) {
    const bare = (x: string) => x.replace(/[\[(].*?[\])]/g, "").trim().toLowerCase();
    const chosen = ranges.find((r) => bare(r.name) === bare(raw.rubric_level));
    if (chosen && sufficiency !== "inexistente") {
      if (percent < chosen.min || percent > chosen.max) {
        flags.push({ level: "nota", text: `El porcentaje propuesto (${percent} %) no correspondía al nivel "${chosen.name}"; se ajustó a su rango.` });
        percent = Math.min(Math.max(percent, chosen.min), chosen.max);
      }
    } else if (!chosen && sufficiency !== "inexistente") {
      flags.push({ level: "nota", text: `El nivel "${raw.rubric_level}" no existe en la rúbrica; se conserva solo el porcentaje.` });
    }
    // 4) Evidencia parcial no alcanza el nivel superior.
    if (sufficiency === "parcial" && ranges.length > 1 && percent >= ranges[0].min) {
      percent = Math.round((ranges[0].min - 0.01) * 100) / 100;
      flags.push({ level: "nota", text: "Con evidencia parcial no se puede alcanzar el nivel más alto de la rúbrica." });
    }
  }

  if (raw.injection_suspected) {
    flags.push({ level: "aviso", text: "Se detectó texto en los archivos que intenta dar instrucciones a quien evalúa; se ignoró. Revisa el trabajo." });
    confidence = "baja";
  }
  if (bad > 0 && confidence === "alta") confidence = "media";
  // Citas solo sobre imágenes/PDF: no hay texto contra el que compararlas.
  const verified = citations.filter((c) => c.status === "verificada").length;
  if (sufficiency !== "inexistente" && verified === 0) {
    flags.push({ level: "nota", text: "Este criterio se apoya en capturas o PDF, cuyo contenido el sistema no puede comprobar automáticamente: comprueba que lo descrito coincide con tus imágenes." });
    if (confidence === "alta") confidence = "media";
  }

  return { ...raw, evidence_sufficiency: sufficiency, percent: Math.round(percent * 100) / 100, confidence, citations, flags };
}

/**
 * Freno de seguridad: si la gran mayoría de los criterios queda sin ninguna cita verificable, lo más probable es que
 * haya fallado la IA o el formato (no que el estudiante no haya entregado nada). Un 0 así no debe publicarse como nota.
 */
export function isSystemicVerificationFailure(results: Map<number, FinalAssessment>): boolean {
  const all = [...results.values()];
  if (all.length < 2) return false;
  const failed = all.filter((a) => a.flags.some((f) => f.text === NO_VERIFIABLE_CITATIONS)).length;
  return failed / all.length >= 0.6;
}
