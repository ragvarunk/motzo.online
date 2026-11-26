import type Anthropic from "@anthropic-ai/sdk";
import { MOTZO_SYSTEM, REPLY_SCHEMA } from "@/lib/prompt";
import { apiErrorMessage, askJson, badRequest, checkAccess, hasAnthropic } from "@/lib/server";
import { demoReply, type MotzoReply } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 60;

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

interface HistoryItem {
  author: "owner" | "motzo" | "system";
  text: string;
  at: string;
  notes?: string[];
}

interface ChatBody {
  context: {
    now: string;
    timeZone: string;
    vehicle: string;
    vehicleDetails: string;
    insurance: string;
    area: string;
    language?: string;
    ownerName?: string;
  };
  history: HistoryItem[];
  latest: {
    text: string;
    images: { mime: string; data: string; label: string }[];
    documents: { mime: string; data: string; name: string }[];
    notes: string[];
  };
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return badRequest("bad_json");
  }
  const latest = body.latest;
  if (!latest || (!latest.text?.trim() && !latest.images?.length && !latest.documents?.length && !latest.notes?.length)) {
    return badRequest("empty_message");
  }

  if (!hasAnthropic()) {
    const reply = demoReply({
      text: latest.text || "",
      imageCount: latest.images?.length ?? 0,
      documentNames: (latest.documents ?? []).map((d) => d.name),
      hasInsurance: Boolean(body.context?.insurance && body.context.insurance !== "none"),
      vehicle: body.context?.vehicle || "vehicle",
    });
    return Response.json({ demo: true, ...reply });
  }

  // Earlier turns go as text; their photos are replaced by what Motzo read from
  // them at the time, which keeps requests small and fast.
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [];
  const push = (role: "user" | "assistant", text: string) => {
    const last = messages[messages.length - 1];
    if (last && last.role === role && typeof last.content === "string") {
      last.content += "\n\n" + text;
    } else {
      messages.push({ role, content: text });
    }
  };
  for (const h of (body.history ?? []).slice(-30)) {
    if (h.author === "system") continue;
    const notes = h.notes?.length ? `\n[Attached earlier: ${h.notes.join("; ")}]` : "";
    const text = `${h.text || ""}${notes}`.trim();
    if (!text) continue;
    push(h.author === "owner" ? "user" : "assistant", `[${h.at}] ${text}`);
  }
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: "(conversation start)" });

  const c = body.context ?? ({} as ChatBody["context"]);
  const content: Block[] = [];
  for (const doc of latest.documents ?? []) {
    if (doc.mime === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.data }, title: doc.name });
    } else if (doc.mime.startsWith("text/")) {
      const text = Buffer.from(doc.data, "base64").toString("utf8").slice(0, 60000);
      content.push({ type: "document", source: { type: "text", media_type: "text/plain", data: text }, title: doc.name });
    }
  }
  for (const img of (latest.images ?? []).slice(0, 8)) {
    if (!IMAGE_TYPES.has(img.mime)) continue;
    content.push({ type: "text", text: img.label });
    content.push({ type: "image", source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.data } });
  }
  const contextText = [
    `Now: ${c.now} (owner's time zone: ${c.timeZone})`,
    `Vehicle: ${c.vehicle}`,
    c.vehicleDetails ? `Vehicle details: ${c.vehicleDetails}` : "",
    `Insurance on file: ${c.insurance || "none"}`,
    c.area ? `Owner's area: ${c.area}` : "",
    c.ownerName ? `Owner's first name: ${String(c.ownerName).slice(0, 60)}` : "",
    `Reply language: ${String(c.language || "English").slice(0, 40)}`,
    latest.notes?.length ? `Also attached: ${latest.notes.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  content.push({ type: "text", text: `<app_context>\n${contextText}\n</app_context>\n\nOwner: ${latest.text || "(sent attachments without a message)"}` });

  const last = messages[messages.length - 1];
  if (last && last.role === "user") {
    const prev = typeof last.content === "string" ? [{ type: "text" as const, text: last.content }] : (last.content as Block[]);
    last.content = [...prev, ...content];
  } else {
    messages.push({ role: "user", content });
  }

  try {
    const result = await askJson<MotzoReply>({ system: MOTZO_SYSTEM, messages, schema: REPLY_SCHEMA, effort: "medium" });
    if (!result.ok) {
      const reply =
        result.reason === "refusal"
          ? "I can't help with that one, but I'm glad to help with anything else your vehicle needs."
          : "Sorry, I lost my train of thought there. Could you send that again?";
      return Response.json({ ...demoReply({ text: "", imageCount: 0, documentNames: [], hasInsurance: false, vehicle: "" }), reply, demo: false });
    }
    return Response.json({ demo: false, ...result.data });
  } catch (err) {
    const { message, status } = apiErrorMessage(err);
    console.error("chat error", err);
    return Response.json({ error: message }, { status });
  }
}
