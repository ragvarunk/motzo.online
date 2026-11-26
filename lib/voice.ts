import "server-only";

// Motzo's own voice runs on a self-hosted open-source voice server that
// speaks the OpenAI audio API (for example Speaches, which serves Kokoro for
// speech and faster-whisper for transcripts). Nothing here is tied to one
// vendor: point MOTZO_VOICE_URL at any compatible server.

export function voiceServer() {
  const url = process.env.MOTZO_VOICE_URL?.trim().replace(/\/+$/, "");
  if (!url) return null;
  const base = url.endsWith("/v1") ? url : `${url}/v1`;
  const headers: Record<string, string> = {};
  const key = process.env.MOTZO_VOICE_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return {
    base,
    headers,
    ttsModel: process.env.MOTZO_TTS_MODEL || "speaches-ai/Kokoro-82M-v1.0-ONNX",
    ttsVoice: process.env.MOTZO_TTS_VOICE || "af_heart",
    sttModel: process.env.MOTZO_STT_MODEL || "Systran/faster-whisper-small",
  };
}
