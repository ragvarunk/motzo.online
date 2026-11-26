import { badRequest, checkAccess } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turns an uploaded audio file or a recorded voice note into text with
// ElevenLabs speech-to-text.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return badRequest("voice_not_set", 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return badRequest("no_file");
  if (file.size > 20 * 1024 * 1024) return badRequest("too_big", 413);
  const out = new FormData();
  out.append("file", file, "audio");
  out.append("model_id", process.env.ELEVENLABS_STT_MODEL_ID || "scribe_v1");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: out,
  });
  if (!res.ok) return badRequest("transcribe_failed", 502);
  const json = (await res.json()) as { text?: string };
  return Response.json({ text: json.text ?? "" });
}
