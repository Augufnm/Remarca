/* Llamadas a la API de Anthropic. Solo se importa desde rutas del servidor. */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const MODEL_VISION = process.env.REMARCA_MODEL_VISION || "claude-sonnet-5-5";
export const MODEL_QUICK = process.env.REMARCA_MODEL_QUICK || "claude-haiku-5-5";

/** USD por millón de tokens (entrada, salida). Verificar en https://docs.claude.com antes de cambiar de modelo. */
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return _client;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type AiErrorCode = "not_configured" | "rate_limited" | "refused" | "invalid_json" | "image_rejected" | "prompt_too_large" | "connection";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

function usageOf(model: string, u: Anthropic.Usage): Usage {
  const inputTokens = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const outputTokens = u.output_tokens || 0;
  const [pi, po] = PRICES[model] || [0, 0];
  // cache reads cuestan ~10 % de la entrada; se cuenta aparte para no sobreestimar
  const billedIn = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  return { inputTokens, outputTokens, costUsd: (billedIn * pi + outputTokens * po) / 1e6 };
}

const addUsage = (a: Usage, b: Usage): Usage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, costUsd: a.costUsd + b.costUsd });

interface CallOpts<T extends z.ZodType> {
  model: string;
  system?: string;
  content: Anthropic.ContentBlockParam[];
  schema: T;
  maxTokens?: number;
  signal?: AbortSignal;
}

/** Pide salida JSON validada con el esquema. Si no se puede interpretar, reintenta una vez. */
export async function callJson<T extends z.ZodType>(o: CallOpts<T>): Promise<{ data: z.infer<T>; usage: Usage }> {
  if (!aiEnabled()) throw new AiError("not_configured");
  let usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await client().messages.parse(
        {
          model: o.model,
          max_tokens: o.maxTokens ?? 16000,
          ...(o.system ? { system: [{ type: "text" as const, text: o.system, cache_control: { type: "ephemeral" as const } }] } : {}),
          messages: [{ role: "user", content: o.content }],
          output_config: { format: zodOutputFormat(o.schema), effort: "low" },
        },
        { signal: o.signal },
      );
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limited");
      if (e instanceof Anthropic.BadRequestError) {
        const msg = String(e.message || "");
        if (/image/i.test(msg)) throw new AiError("image_rejected");
        if (/too long|too large|prompt is too/i.test(msg)) throw new AiError("prompt_too_large");
        throw new AiError("connection", msg);
      }
      if (e instanceof Anthropic.APIUserAbortError) throw e;
      if (e instanceof Anthropic.APIError) throw new AiError("connection", e.message);
      throw e;
    }
    usage = addUsage(usage, usageOf(o.model, res.usage));
    if (res.stop_reason === "refusal") throw new AiError("refused");
    if (res.parsed_output != null) return { data: res.parsed_output as z.infer<T>, usage };
  }
  throw new AiError("invalid_json");
}

/* ---------- esquemas ---------- */

export const ExtractSchema = z.object({
  iva: z.enum(["incluido", "no_incluido", "no_dice"]),
  columna: z.string(),
  items: z.array(z.object({ c: z.string(), d: z.string(), p: z.number(), u: z.number().int() })),
});

export const ColumnsSchema = z.object({
  fila_encabezado: z.number().int(),
  codigo: z.number().int(),
  descripcion: z.number().int(),
  costo: z.number().int(),
  iva: z.enum(["incluido", "no_incluido", "no_dice"]),
  columna: z.string(),
});

export const DoubtsSchema = z.object({
  pares: z.array(z.object({ i: z.number().int(), id: z.string().nullable() })),
});
