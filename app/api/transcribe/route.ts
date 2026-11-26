import { badRequest, checkAccess } from "@/lib/server";
import { elevenLabs, voiceServer } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turns an uploaded audio file or a recorded voice note into text: ElevenLabs
// speech-to-text when its key is set, otherwise the self-hosted voice server (Whisper).
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const el = elevenLabs();
  const server = el ? null : voiceServer();
  if (!el && !server) return badRequest("voice_not_set", 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return badRequest("no_file");
  if (file.size > 20 * 1024 * 1024) return badRequest("too_big", 413);
  const type = file.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("mpeg") || type.includes("mp3") ? "mp3" : type.includes("wav") ? "wav" : type.includes("ogg") ? "ogg" : "webm";
  const out = new FormData();
  out.append("file", file, `audio.${ext}`);
  let res: Response | null;
  if (el) {
    out.append("model_id", el.sttModel);
    res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": el.key },
      body: out,
    }).catch(() => null);
  } else {
    out.append("model", server!.sttModel);
    res = await fetch(`${server!.base}/audio/transcriptions`, {
      method: "POST",
      headers: server!.headers,
      body: out,
    }).catch(() => null);
  }
  if (!res || !res.ok) return badRequest("transcribe_failed", 502);
  const json = (await res.json().catch(() => ({}))) as { text?: string };
  return Response.json({ text: json.text ?? "" });
}
