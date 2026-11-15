export type Part =
  | { kind: "text"; text: string }
  | { kind: "file"; mime: string; base64: string; name: string };

export type AIErrorCode = "rate_limit" | "unavailable" | "bad_response" | "config" | "blocked";

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type GenerateArgs = {
  system: string;
  parts: Part[];
  /** Esquema en el dialecto de Gemini (tipos en mayúscula). Siempre se revalida con zod al recibirlo. */
  schema: object;
  maxOutputTokens?: number;
  /** Esfuerzo de razonamiento. "low" basta para extraer datos y es bastante más rápido. Por defecto, el del modelo. */
  thinking?: "low";
};

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  /** Modelo que respondió en la última llamada, si el proveedor puede usar uno alterno. */
  readonly lastModelUsed?: string;
  generateJSON(args: GenerateArgs): Promise<unknown>;
}
