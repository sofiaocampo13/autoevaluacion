import { AIError, type AIProvider, type GenerateArgs, type Part } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRY_DELAYS_MS = [2000, 6000];
const REQUEST_TIMEOUT_MS = 100_000; // una llamada colgada no puede bloquear la evaluación indefinidamente
const MAX_QUOTA_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lee del 429 cuánto esperar y si el límite agotado es el diario (no se arregla esperando segundos). */
async function readQuotaInfo(res: Response): Promise<{ daily: boolean; retryAfterSeconds: number | null; quotaIds: string[] }> {
  const body = await res.json().catch(() => null);
  const details: { "@type"?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[] = body?.error?.details ?? [];
  const quotaIds = details.flatMap((d) => d.violations?.map((v) => v.quotaId ?? "") ?? []).filter(Boolean);
  const delay = details.find((d) => d.retryDelay)?.retryDelay; // p. ej. "37s"
  const secs = delay ? Number.parseFloat(delay) : NaN;
  return { daily: quotaIds.some((id) => /PerDay/i.test(id)), retryAfterSeconds: Number.isFinite(secs) ? Math.ceil(secs) : null, quotaIds };
}

const toPart = (p: Part) =>
  p.kind === "text" ? { text: p.text } : { inlineData: { mimeType: p.mime, data: p.base64 } };

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  /** Modelo que realmente respondió en la última llamada (puede ser el alterno). Se guarda en la trazabilidad. */
  lastModelUsed: string;

  constructor(
    private apiKey: string,
    readonly model: string,
    private fallbackModel?: string,
  ) {
    this.lastModelUsed = model;
  }

  async generateJSON(args: GenerateArgs): Promise<unknown> {
    const models = [this.model, ...(this.fallbackModel && this.fallbackModel !== this.model ? [this.fallbackModel] : [])];
    let last: AIError | undefined;
    for (const model of models) {
      try {
        const out = await this.callModel(model, args);
        this.lastModelUsed = model;
        return out;
      } catch (e) {
        // Solo se cambia de modelo si el servicio no está disponible o está saturado. Otros errores se propagan.
        if (e instanceof AIError && (e.code === "unavailable" || e.code === "rate_limit")) last = e;
        else throw e;
      }
    }
    throw last!;
  }

  private async callModel(model: string, { system, parts, schema, maxOutputTokens = 8192, thinking }: GenerateArgs): Promise<unknown> {
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: parts.map(toPart) }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0, // evaluaciones lo más reproducibles posible
        maxOutputTokens,
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      },
    });

    let quotaRetries = 0;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${BASE}/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": this.apiKey, "content-type": "application/json" },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (e) {
        const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        throw new AIError("unavailable", timedOut ? "El servicio de IA tardó demasiado en responder." : "No se pudo contactar con el servicio de IA.");
      }

      if (res.status === 429) {
        const q = await readQuotaInfo(res);
        console.error(`[gemini] 429 en ${model}: cuota=${q.quotaIds.join(",") || "?"} espera=${q.retryAfterSeconds ?? "?"}s`);
        if (q.daily)
          throw new AIError("rate_limit", "Se agotó la cuota DIARIA gratuita de la IA. Se renueva cada 24 horas; inténtalo de nuevo más tarde o mañana.");
        if (quotaRetries < MAX_QUOTA_RETRIES) {
          quotaRetries++;
          await sleep(Math.min(q.retryAfterSeconds ?? 15, 30) * 1000 + 1000); // límite por minuto: basta con esperar lo que indica el servicio
          continue;
        }
        throw new AIError("rate_limit", `Se alcanzó el límite por minuto de la IA gratuita. Espera ${q.retryAfterSeconds ?? 60} segundos y pulsa Reintentar.`);
      }
      if (res.status === 503 && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (res.status === 503) throw new AIError("unavailable", "El servicio de IA está saturado. Inténtalo de nuevo en un momento.");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new AIError("bad_response", `El servicio de IA rechazó la solicitud (${res.status}): ${j?.error?.message?.slice(0, 200) ?? "sin detalle"}`);
      }

      const j = await res.json();
      const cand = j.candidates?.[0];
      if (!cand) throw new AIError("blocked", `La IA no devolvió respuesta (${j.promptFeedback?.blockReason ?? "sin motivo"}).`);
      if (cand.finishReason === "MAX_TOKENS") throw new AIError("bad_response", "La respuesta de la IA se cortó por ser demasiado larga.");
      const text = cand.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      try {
        return JSON.parse(text);
      } catch {
        throw new AIError("bad_response", "La IA devolvió una respuesta que no es JSON válido.");
      }
    }
  }
}
