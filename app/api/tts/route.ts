import { badRequest, checkAccess } from "@/lib/server";
import { elevenLabs, voiceServer } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 30;

// Motzo's speaking voice: ElevenLabs when its key is set, otherwise the
// self-hosted voice server (Speaches) when set. With neither, the app falls back
// to the device's built-in voice.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const el = elevenLabs();
  const server = el ? null : voiceServer();
  if (!el && !server) return badRequest("voice_not_set", 404);
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim().slice(0, 1200);
  if (!text) return badRequest("no_text");

  const res = el
    ? await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(el.voiceId)}?output_format=mp3_44100_64`, {
        method: "POST",
        headers: { "xi-api-key": el.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: el.ttsModel }),
      }).catch(() => null)
    : await fetch(`${server!.base}/audio/speech`, {
        method: "POST",
        headers: { ...server!.headers, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ model: server!.ttsModel, voice: server!.ttsVoice, input: text, response_format: "mp3" }),
      }).catch(() => null);
  if (!res || !res.ok || !res.body) return badRequest("voice_failed", 502);
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
