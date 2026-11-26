import { badRequest, checkAccess } from "@/lib/server";
import { voiceServer } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turns an uploaded audio file or a recorded voice note into text with the
// self-hosted open-source voice server (Whisper).
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const server = voiceServer();
  if (!server) return badRequest("voice_not_set", 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return badRequest("no_file");
  if (file.size > 20 * 1024 * 1024) return badRequest("too_big", 413);
  const type = file.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("mpeg") || type.includes("mp3") ? "mp3" : type.includes("wav") ? "wav" : type.includes("ogg") ? "ogg" : "webm";
  const out = new FormData();
  out.append("file", file, `audio.${ext}`);
  out.append("model", server.sttModel);
  const res = await fetch(`${server.base}/audio/transcriptions`, {
    method: "POST",
    headers: server.headers,
    body: out,
  }).catch(() => null);
  if (!res || !res.ok) return badRequest("transcribe_failed", 502);
  const json = (await res.json().catch(() => ({}))) as { text?: string };
  return Response.json({ text: json.text ?? "" });
}
