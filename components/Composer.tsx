"use client";

import { useEffect, useRef, useState } from "react";
import { useMotzo } from "@/lib/store";
import { canListen, makeRecognizer, readResults, stopSpeaking, type Recognizer } from "@/lib/speech";
import { prettySize } from "@/lib/media";
import { cls } from "@/lib/util";
import { useEngine } from "./ChatEngine";
import { useRobot } from "./Robot";
import { Icon, useUi } from "./ui";

/** The input bar: type, attach, camera, voice note, voice mode, send. */
export function Composer() {
  const { send, busy } = useEngine();
  const { state } = useMotzo();
  const ui = useUi();
  const robot = useRobot();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [menu, setMenu] = useState(false);
  const [rec, setRec] = useState<{ started: number; interim: string } | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recogRef = useRef<Recognizer | null>(null);
  const heard = useRef("");
  const cancelled = useRef(false);
  const [tick, setTick] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const pickAny = useRef<HTMLInputElement>(null);
  const pickMedia = useRef<HTMLInputElement>(null);
  const pickDoc = useRef<HTMLInputElement>(null);
  const pickAudio = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onAttach = () => pickMedia.current?.click();
    window.addEventListener("motzo:attach", onAttach);
    return () => window.removeEventListener("motzo:attach", onAttach);
  }, []);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [text]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((f) => [...f, ...Array.from(list)].slice(0, 10));
    setMenu(false);
  };

  const submit = async () => {
    if (busy || (!text.trim() && files.length === 0)) return;
    stopSpeaking();
    const t = text;
    const f = files;
    setText("");
    setFiles([]);
    await send({ text: t, files: f });
  };

  const startVoiceNote = async () => {
    stopSpeaking();
    if (!navigator.mediaDevices?.getUserMedia) {
      ui.toast("This browser can't record audio");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      heard.current = "";
      cancelled.current = false;
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (cancelled.current) return;
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size > 0) send({ text: "", voiceNote: { blob, transcript: heard.current.trim() }, viaVoice: true });
      };
      mr.start();
      mediaRef.current = mr;
      setRec({ started: Date.now(), interim: "" });
      robot.setMood("listening");
      if (canListen()) {
        const r = makeRecognizer(state.settings.language);
        if (r) {
          r.continuous = true;
          r.onresult = (e) => {
            const { finalText, interim } = readResults(e);
            heard.current = finalText || heard.current;
            setRec((x) => (x ? { ...x, interim: [finalText, interim].filter(Boolean).join(" ") } : x));
          };
          r.onerror = () => undefined;
          r.start();
          recogRef.current = r;
        }
      }
    } catch {
      ui.toast("Microphone permission is needed for voice notes");
    }
  };

  const stopVoiceNote = (cancel = false) => {
    cancelled.current = cancel;
    recogRef.current?.stop();
    recogRef.current = null;
    // Give the recognizer a moment to deliver its last words.
    setTimeout(() => mediaRef.current?.state === "recording" && mediaRef.current.stop(), cancel ? 0 : 350);
    setRec(null);
    robot.setMood(cancel ? "idle" : "thinking");
  };

  const secs = rec ? Math.floor((Date.now() - rec.started) / 1000) : 0;
  void tick;

  return (
    <div className="px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-1 sm:px-4">
      <div className="mx-auto max-w-3xl">
        {files.length > 0 && (
          <div className="scroll-thin mb-2 flex gap-2 overflow-x-auto pb-1">
            {files.map((f, i) => (
              <PendingFile key={i} file={f} onRemove={() => setFiles((x) => x.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}

        {rec ? (
          <div className="flex items-center gap-2">
            <button className="grid h-11 w-11 place-items-center rounded-full text-bad" onClick={() => stopVoiceNote(true)} aria-label="Cancel voice note">
              <Icon name="trash" />
            </button>
            <div className="flex min-h-11 flex-1 items-center gap-2 rounded-full bg-surface-2 px-4">
              <span className="relative flex h-3 w-3">
                <span className="pulse-ring absolute inset-0 rounded-full bg-bad" />
                <span className="relative h-3 w-3 rounded-full bg-bad" />
              </span>
              <span className="font-mono text-sm">
                {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
              </span>
              <span className="truncate text-sm text-ink-2">{rec.interim || "Listening…"}</span>
            </div>
            <button className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-ink" onClick={() => stopVoiceNote(false)} aria-label="Send voice note">
              <Icon name="send" />
            </button>
          </div>
        ) : (
          <div className="glass rounded-[26px] p-2 shadow-[var(--shadow)] focus-within:border-ink-3/50">
            <textarea
              ref={area}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="How can I help with your vehicle?"
              className="block max-h-40 min-h-11 w-full resize-none bg-transparent px-2.5 py-2 leading-snug outline-none placeholder:text-ink-3"
              aria-label="Message"
            />
            <div className="flex items-center gap-1">
              <div className="relative">
                <button className={cls("grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-surface-2", menu && "bg-surface-2")} onClick={() => setMenu((m) => !m)} aria-label="Attach">
                  <Icon name="plus" className="h-[18px] w-[18px]" />
                </button>
                {menu && (
                  <div className="pop-in absolute bottom-12 left-0 z-30 w-60 overflow-hidden rounded-2xl border border-line glass-strong shadow-xl">
                    <MenuItem icon="camera" label="Camera" sub="Photo, video or lens" onClick={() => { setMenu(false); ui.openCamera({ mode: "photo" }); }} />
                    <MenuItem icon="video" label="Photos & videos" sub="From your library" onClick={() => pickMedia.current?.click()} />
                    <MenuItem icon="doc" label="Document" sub="Insurance card, invoice, PDF" onClick={() => pickDoc.current?.click()} />
                    <MenuItem icon="mic" label="Audio file" sub="A recording of a noise" onClick={() => pickAudio.current?.click()} />
                    <MenuItem icon="plus" label="Any file" onClick={() => pickAny.current?.click()} />
                  </div>
                )}
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-surface-2" onClick={() => ui.openCamera({ mode: "photo" })} aria-label="Open camera">
                <Icon name="camera" className="h-[18px] w-[18px]" />
              </button>
              <span className="flex-1" />
              {text.trim() || files.length ? (
                <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-50" onClick={submit} disabled={busy} aria-label="Send">
                  <Icon name="send" className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <>
                  <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface-2" onClick={startVoiceNote} aria-label="Record a voice note">
                    <Icon name="mic" className="h-[18px] w-[18px]" />
                  </button>
                  <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" onClick={() => ui.setVoiceOpen(true)} aria-label="Talk with Motzo (voice mode)">
                    <Icon name="wave" className="h-[18px] w-[18px]" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <p className="mt-1.5 text-center text-[11px] text-ink-3">Motzo gives estimates. Check safety repairs with a technician.</p>
        <input ref={pickMedia} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={pickDoc} type="file" accept="application/pdf,image/*,text/plain,.doc,.docx" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={pickAudio} type="file" accept="audio/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={pickAny} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function MenuItem({ icon, label, sub, onClick }: { icon: string; label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
      <Icon name={icon} className="h-5 w-5 text-accent" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {sub && <span className="block text-xs text-ink-3">{sub}</span>}
      </span>
    </button>
  );
}

function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="relative flex h-16 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface-2 pr-7 text-xs">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-16 w-16 rounded-xl object-cover" />
      ) : (
        <span className="max-w-36 truncate pl-3">
          <span className="block truncate font-semibold">{file.name}</span>
          {prettySize(file.size)}
        </span>
      )}
      <button onClick={onRemove} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-bg" aria-label={`Remove ${file.name}`}>
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
