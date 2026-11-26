"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMotzo } from "@/lib/store";
import { canListen, makeRecognizer, readResults, stopSpeaking, type Recognizer } from "@/lib/speech";
import { useEngine } from "./ChatEngine";
import { RobotFace, useRobot } from "./Robot";
import { Icon, useUi } from "./ui";

type Phase = "idle" | "listening" | "thinking" | "speaking";

/** Talk with Motzo hands-free. Every turn is still saved to the chat with its time. */
export function VoiceMode() {
  const ui = useUi();
  const { send } = useEngine();
  const { state, activeVehicle } = useMotzo();
  const robot = useRobot();
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("");
  const [heardText, setHeardText] = useState("");
  const recog = useRef<Recognizer | null>(null);
  const open = useRef(true);
  const [supported] = useState(canListen);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const { services } = useEngine();

  const lastMotzo = [...state.messages].reverse().find((m) => m.vehicleId === activeVehicle?.id && m.author === "motzo");

  const turn = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setPhase("thinking");
      setCaption("");
      const reply = await send({ text, viaVoice: true, speakReply: true });
      if (!open.current) return;
      setCaption(reply ?? "");
      setPhase("idle");
    },
    [send],
  );

  const listen = useCallback(() => {
    stopSpeaking();
    const r = makeRecognizer();
    if (!r) return;
    recog.current?.abort();
    recog.current = r;
    let final = "";
    setHeardText("");
    setPhase("listening");
    robot.setMood("listening");
    r.onresult = (e) => {
      const { finalText, interim } = readResults(e);
      if (finalText) final = finalText;
      setHeardText([finalText, interim].filter(Boolean).join(" "));
    };
    r.onerror = () => undefined;
    r.onend = () => {
      if (!open.current) return;
      if (final.trim()) turn(final);
      else {
        setPhase("idle");
        robot.setMood("idle");
      }
    };
    r.start();
  }, [robot, turn]);

  // Keep the conversation going: after Motzo answers, listen again.
  useEffect(() => {
    if (supported && phase === "idle" && caption) {
      const t = setTimeout(() => open.current && listen(), 600);
      return () => clearTimeout(t);
    }
  }, [phase, caption, supported, listen]);

  useEffect(() => {
    open.current = true;
    if (supported) listen();
    return () => {
      open.current = false;
      recog.current?.abort();
      stopSpeaking();
      robot.setMood("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback for browsers without live speech recognition: record, then transcribe on the server.
  const recordFallback = async () => {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setPhase("thinking");
        const reply = await send({ text: "", voiceNote: { blob: new Blob(chunks, { type: mr.mimeType || "audio/webm" }), transcript: "" }, viaVoice: true, speakReply: true });
        if (open.current) {
          setCaption(reply ?? "");
          setPhase("idle");
        }
      };
      mr.start();
      mediaRef.current = mr;
      setPhase("listening");
      robot.setMood("listening");
    } catch {
      ui.toast("Microphone permission is needed");
    }
  };

  const tapRobot = () => {
    if (phase === "thinking") return;
    stopSpeaking();
    if (supported) {
      if (phase === "listening") recog.current?.stop();
      else listen();
    } else if (services.voice) recordFallback();
  };

  const status =
    phase === "listening" ? "Listening…" : phase === "thinking" ? "Thinking…" : supported || services.voice ? "Tap Motzo to talk" : "";

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-gradient-to-b from-[#0d1530] to-[#1d2a52] text-white">
      <div className="flex items-center justify-between p-4 pt-[max(env(safe-area-inset-top),16px)]">
        <span className="text-sm font-semibold text-white/70">Voice mode · saved to the chat</span>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={() => ui.setVoiceOpen(false)} aria-label="Close voice mode">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <button onClick={tapRobot} className="relative" aria-label={phase === "listening" ? "Stop listening" : "Talk"}>
          {phase === "listening" && <span className="pulse-ring absolute inset-0 rounded-full bg-[#21c07a]/40" />}
          <span className={phase === "thinking" ? "inline-block animate-pulse" : "inline-block"}>
            <RobotFace mood={robot.mood === "talking" ? "talking" : phase === "listening" ? "listening" : phase === "thinking" ? "thinking" : robot.mood} size={190} speaking={robot.mood === "talking"} />
          </span>
        </button>
        <p className="text-lg font-semibold">{robot.mood === "talking" ? "Motzo is talking · tap to interrupt" : status}</p>
        {heardText && phase !== "idle" && <p className="max-w-md text-xl text-white/90">“{heardText}”</p>}
        {(caption || (phase === "idle" && lastMotzo)) && phase !== "listening" && (
          <p className="max-w-lg text-base leading-relaxed text-white/75">{caption || lastMotzo?.text}</p>
        )}
        {!supported && !services.voice && (
          <p className="max-w-sm text-sm text-white/70">
            Listening isn&apos;t available in this browser. Chrome, Edge and Safari support it, or connect Motzo's voice server so it can transcribe recordings.
          </p>
        )}
      </div>
      <div className="flex justify-center gap-3 p-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <button className="btn border border-white/30 text-white" onClick={() => ui.setVoiceOpen(false)}>
          <Icon name="keyboard" className="h-4 w-4" /> Type instead
        </button>
        <button className="btn border border-white/30 text-white" onClick={() => { ui.setVoiceOpen(false); ui.openCamera({ mode: "photo" }); }}>
          <Icon name="camera" className="h-4 w-4" /> Show a photo
        </button>
      </div>
    </div>
  );
}
