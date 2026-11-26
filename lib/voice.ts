import "server-only";

/** ElevenLabs voice, used first whenever ELEVENLABS_API_KEY is set. */
export function elevenLabs() {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;
  return {
    key,
    voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || "JBFqnCBsd6RMkjVDRZzb",
    // Flash: ElevenLabs' fastest, lowest-cost voice model.
    ttsModel: process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5",
    sttModel: process.env.ELEVENLABS_STT_MODEL_ID?.trim() || "scribe_v2",
  };
}

// Later option, used only when ElevenLabs isn't set: a self-hosted open-source
// voice server with the OpenAI audio API (for example Speaches, which serves
// Kokoro for speech and faster-whisper for transcripts; see voice-server/).

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
