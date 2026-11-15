import { AIError, type AIProvider } from "./types";
import { GeminiProvider } from "./gemini";

export { AIError } from "./types";
export type { AIProvider, Part } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
// Modelo alterno OPCIONAL (GEMINI_FALLBACK_MODEL). Por defecto no hay: mezclar modelos dentro de una misma
// evaluación resta consistencia (un modelo ligero resultó más benévolo). Si se configura, queda registrado y avisado.

/** Proveedor configurado por variables de entorno (AI_PROVIDER, GEMINI_API_KEY, GEMINI_MODEL). */
export function getProvider(): AIProvider {
  const which = process.env.AI_PROVIDER ?? "gemini";
  if (which === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new AIError("config", "Falta GEMINI_API_KEY en la configuración del servidor.");
    return new GeminiProvider(key, process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL || undefined);
  }
  throw new AIError("config", `Proveedor de IA no soportado: ${which}`);
}
