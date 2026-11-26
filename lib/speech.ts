"use client";

import { api } from "./api";

// Speaking and listening. Uses ElevenLabs when its key is set, otherwise the
// voice built into the phone or computer. Listening uses the browser's speech
// recognition (Chrome, Edge, Safari).

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

function cleanForSpeech(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\*\*?|__|#+ /g, "")
    .replace(/\$(\d)/g, "$1 dollars ")
    .trim();
}

export async function speak(text: string, useCloudVoice: boolean): Promise<void> {
  stopSpeaking();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  if (useCloudVoice) {
    try {
      const res = await api("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        return;
      }
    } catch {
      /* fall back to the device voice */
    }
  }
  if (typeof speechSynthesis === "undefined") return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.03;
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find((v) => /en-US/i.test(v.lang) && /Samantha|Google US English|Aria|Jenny/i.test(v.name)) ?? voices.find((v) => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

// Minimal typing for the browser speech recognition API.
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
export interface Recognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

export function canListen(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function makeRecognizer(): Recognizer | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => Recognizer>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = navigator.language || "en-US";
  r.interimResults = true;
  r.continuous = false;
  return r;
}

/** Collects interim and final text from a recognizer event. */
export function readResults(e: RecognitionEvent): { finalText: string; interim: string } {
  let finalText = "";
  let interim = "";
  for (let i = 0; i < e.results.length; i++) {
    const r = e.results[i];
    if (r.isFinal) finalText += r[0].transcript;
    else interim += r[0].transcript;
  }
  return { finalText: finalText.trim(), interim: interim.trim() };
}
