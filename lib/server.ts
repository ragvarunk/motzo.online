import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.MOTZO_MODEL || "claude-opus-5-5";

export function hasAnthropic() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Optional gate while testing in public: when MOTZO_ACCESS_CODE is set, every
 * API call must carry the same code, so strangers can't spend the AI credits.
 */
export function checkAccess(req: Request): Response | null {
  const code = process.env.MOTZO_ACCESS_CODE;
  if (!code) return null;
  if (req.headers.get("x-motzo-access") === code) return null;
  return Response.json({ error: "access_code" }, { status: 401 });
}

export function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * Ask Claude for a JSON answer that follows `schema`. Uses structured outputs,
 * opts into server-side fallbacks for safety declines, and checks the stop
 * reason before reading the answer.
 */
export async function askJson<T>(opts: {
  system: string;
  messages: Anthropic.Beta.Messages.BetaMessageParam[];
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: opts.messages,
    output_config: {
      effort: opts.effort ?? "medium",
      format: { type: "json_schema", schema: opts.schema },
    },
  });

  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "refusal" };
  }
  if (response.stop_reason === "max_tokens") {
    return { ok: false, reason: "too_long" };
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, reason: "bad_json" };
  }
}

export function apiErrorMessage(err: unknown): { message: string; status: number } {
  if (err instanceof Anthropic.AuthenticationError) return { message: "The AI key isn't valid. Check ANTHROPIC_API_KEY in Vercel.", status: 500 };
  if (err instanceof Anthropic.RateLimitError) return { message: "Motzo is busy right now. Try again in a moment.", status: 429 };
  if (err instanceof Anthropic.BadRequestError) return { message: "Motzo couldn't read that. Try a smaller photo or file.", status: 400 };
  if (err instanceof Anthropic.APIError) return { message: "Motzo had trouble answering. Try again.", status: 502 };
  return { message: "Something went wrong. Try again.", status: 500 };
}
