import { badRequest, checkAccess } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Motzo's speaking voice through ElevenLabs. Without a key the app falls back
// to the device's built-in voice.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return badRequest("voice_not_set", 404);
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim().slice(0, 1200);
  if (!text) return badRequest("no_text");
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5" }),
  });
  if (!res.ok || !res.body) return badRequest("voice_failed", 502);
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
