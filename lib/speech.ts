"use client";

import { api } from "./api";

// Speaking and listening. Uses Motzo's own voice (ElevenLabs, or a self-hosted voice server) when set, otherwise the
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

/** Splits a reply into sentence-sized pieces so the first one can play while the rest are made. */
function chunksForSpeech(text: string, max = 220): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > max) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function fetchVoice(text: string): Promise<Blob | null> {
  try {
    const res = await api("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

function playBlob(blob: Blob): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  return new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url);
      resolve(ok && currentAudio === audio);
    };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    audio.play().catch(() => done(false));
  });
}

export async function speak(text: string, useCloudVoice: boolean, lang = "en-US"): Promise<void> {
  stopSpeaking();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  if (useCloudVoice) {
    const chunks = chunksForSpeech(clean);
    const first = await fetchVoice(chunks[0]);
    if (first) {
      let blob: Blob | null = first;
      for (let i = 0; blob; i++) {
        const next = i + 1 < chunks.length ? fetchVoice(chunks[i + 1]) : null;
        const finished = await playBlob(blob);
        if (!finished) return; // stopped, or playback blocked
        blob = next ? await next : null;
      }
      currentAudio = null;
      return;
    }
    // Voice server unreachable: fall back to the device voice.
  }
  if (typeof speechSynthesis === "undefined") return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.03;
    u.lang = lang;
    const voices = speechSynthesis.getVoices();
    const base = lang.split("-")[0].toLowerCase();
    const preferred =
      (base === "en" ? voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase() && /Samantha|Google US English|Aria|Jenny|Daniel/i.test(v.name)) : undefined) ??
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base));
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

export function makeRecognizer(lang?: string): Recognizer | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => Recognizer>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = lang || navigator.language || "en-US";
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
