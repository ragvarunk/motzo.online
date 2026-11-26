import { badRequest, checkAccess } from "@/lib/server";
import { voiceServer } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 30;

// Motzo's speaking voice from the self-hosted open-source voice server.
// Without one the app falls back to the device's built-in voice.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const server = voiceServer();
  if (!server) return badRequest("voice_not_set", 404);
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim().slice(0, 1200);
  if (!text) return badRequest("no_text");
  const res = await fetch(`${server.base}/audio/speech`, {
    method: "POST",
    headers: { ...server.headers, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ model: server.ttsModel, voice: server.ttsVoice, input: text, response_format: "mp3" }),
  }).catch(() => null);
  if (!res || !res.ok || !res.body) return badRequest("voice_failed", 502);
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
