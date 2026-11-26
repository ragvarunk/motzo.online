"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { blobToBase64, compressImage } from "@/lib/media";
import { cls } from "@/lib/util";
import { useEngine } from "./ChatEngine";
import { Icon, useUi, type CameraRequest } from "./ui";

interface Finding {
  kind: string;
  label: string;
  value: string;
}

/** Camera in the chat: photos, short videos, and lens mode that reads what it sees live. */
export function CameraSheet({ request }: { request: CameraRequest }) {
  const ui = useUi();
  const { send, services } = useEngine();
  const [mode, setMode] = useState<CameraRequest["mode"]>(request.mode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [recording, setRecording] = useState<number | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [hint, setHint] = useState("Point at damage, a VIN, a plate, a warning light or a document");
  const [lensBusy, setLensBusy] = useState(false);
  const lensBusyRef = useRef(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [, setTick] = useState(0);
  const fallbackPhoto = useRef<HTMLInputElement>(null);
  const fallbackVideo = useRef<HTMLInputElement>(null);

  // Start the camera.
  useEffect(() => {
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera here. Use the buttons below instead.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => undefined);
        }
        setError(null);
      } catch {
        setError("Camera permission is off. Allow the camera, or use the buttons below.");
      }
    })();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [recording]);

  const grab = useCallback(async (max = 1920): Promise<Blob | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob((b) => r(b), "image/jpeg", 0.88));
  }, []);

  // Lens: read a frame every few seconds while the lens is open.
  useEffect(() => {
    if (mode !== "lens" || error) return;
    let alive = true;
    const run = async () => {
      if (!alive || lensBusyRef.current) return;
      const b = await grab(1024);
      if (!b) return;
      lensBusyRef.current = true;
      setLensBusy(true);
      try {
        const res = await api("/api/lens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: await blobToBase64(b), mime: "image/jpeg" }),
        });
        const j = (await res.json()) as { findings?: Finding[]; hint?: string; error?: string };
        if (!alive) return;
        if (j.findings) setFindings(j.findings.filter((f) => f.label));
        if (j.hint) setHint(j.hint);
        if (j.error) setHint(j.error);
      } catch {
        /* keep the last reading */
      } finally {
        lensBusyRef.current = false;
        if (alive) setLensBusy(false);
      }
    };
    const first = setTimeout(run, 900);
    const t = setInterval(run, services.ai ? 2600 : 6000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [mode, error, grab, services.ai]);

  const takePhoto = async () => {
    const b = await grab();
    if (!b) return;
    setShots((s) => [...s, new File([b], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })]);
  };

  const startVideo = () => {
    const s = streamRef.current;
    if (!s || typeof MediaRecorder === "undefined") {
      fallbackVideo.current?.click();
      return;
    }
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(s);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const type = mr.mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      setShots((x) => [...x, new File([new Blob(chunks, { type })], `video-${Date.now()}.${ext}`, { type })]);
      setRecording(null);
    };
    mr.start();
    recRef.current = mr;
    setRecording(Date.now());
    setTimeout(() => mr.state === "recording" && mr.stop(), 30000);
  };
  const stopVideo = () => recRef.current?.state === "recording" && recRef.current.stop();

  const sendShots = async (extra?: File[], fromLens?: boolean, text?: string) => {
    const files = [...shots, ...(extra ?? [])];
    if (!files.length) return;
    ui.closeCamera();
    await send({ text: text ?? caption, files, fromLens });
  };

  const askAboutFrame = async () => {
    const b = await grab();
    if (!b) return;
    const small = await compressImage(b);
    const f = new File([small], `lens-${Date.now()}.jpg`, { type: "image/jpeg" });
    const seen = findings.map((x) => `${x.label}${x.value ? `: ${x.value}` : ""}`).join("; ");
    await sendShots([f], true, caption || (seen ? `What do you see here? (Lens saw: ${seen})` : "What do you see here?"));
  };

  const vin = findings.find((f) => f.kind === "vin" && /^[A-HJ-NPR-Z0-9]{17}$/.test(f.value.replace(/\s/g, "").toUpperCase()));
  const secs = recording ? Math.floor((Date.now() - recording) / 1000) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={ui.closeCamera} aria-label="Close camera">
          <Icon name="close" />
        </button>
        <div className="flex rounded-full bg-white/10 p-1 text-sm font-semibold">
          {(["photo", "video", "lens"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cls("rounded-full px-4 py-1.5 capitalize", mode === m && "bg-white text-black")}>
              {m}
            </button>
          ))}
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} aria-label="Switch camera">
          ⟲
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-xs text-white/85">{error}</p>
            <div className="flex gap-2">
              <button className="btn bg-white text-black" onClick={() => fallbackPhoto.current?.click()}>
                Take photo
              </button>
              <button className="btn border border-white/40" onClick={() => fallbackVideo.current?.click()}>
                Record video
              </button>
            </div>
          </div>
        )}
        {mode === "lens" && !error && (
          <>
            <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/50" />
            <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/85 to-transparent p-4 pt-16">
              <p className="flex items-center gap-2 text-sm text-white/80">
                <Icon name="lens" className="h-4 w-4" />
                {lensBusy ? "Reading…" : hint}
              </p>
              <div className="flex flex-wrap gap-2">
                {findings.map((f, i) => (
                  <span key={i} className="pop-in rounded-full bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
                    <span className="font-semibold">{f.label}</span>
                    {f.value && <span className="ml-1 font-mono text-white/85">{f.value}</span>}
                  </span>
                ))}
              </div>
              {vin && request.onVin && (
                <button
                  className="btn w-full bg-white text-black"
                  onClick={() => {
                    request.onVin?.(vin.value.replace(/\s/g, "").toUpperCase());
                    ui.closeCamera();
                  }}
                >
                  Use VIN {vin.value}
                </button>
              )}
            </div>
          </>
        )}
        {recording && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-bad px-3 py-1 font-mono text-sm">
            ● {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} / 0:30
          </div>
        )}
      </div>

      {shots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto bg-black px-3 pt-3">
          {shots.map((s, i) => (
            <ShotThumb key={i} file={s} onRemove={() => setShots((x) => x.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      <div className="space-y-3 bg-black p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        {(shots.length > 0 || mode === "lens") && !request.onVin && (
          <input
            className="w-full rounded-full bg-white/10 px-4 py-2.5 text-base text-white placeholder:text-white/50"
            placeholder="Add a note (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        )}
        <div className="flex items-center justify-between">
          <button className="h-12 w-20 text-sm text-white/80" onClick={() => (mode === "video" ? fallbackVideo : fallbackPhoto).current?.click()}>
            Library
          </button>
          {mode === "photo" && (
            <button onClick={takePhoto} disabled={!!error} className="grid h-18 w-18 place-items-center rounded-full border-4 border-white disabled:opacity-40" aria-label="Take photo">
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
          )}
          {mode === "video" && (
            <button onClick={recording ? stopVideo : startVideo} disabled={!!error} className="grid h-18 w-18 place-items-center rounded-full border-4 border-white disabled:opacity-40" aria-label={recording ? "Stop recording" : "Record video"}>
              <span className={cls("bg-bad transition-all", recording ? "h-7 w-7 rounded-md" : "h-14 w-14 rounded-full")} />
            </button>
          )}
          {mode === "lens" && !request.onVin && (
            <button onClick={askAboutFrame} disabled={!!error} className="btn bg-white px-5 text-black">
              Ask Motzo about this
            </button>
          )}
          {mode === "lens" && request.onVin && <span className="text-sm text-white/70">Hold the VIN inside the frame</span>}
          <button onClick={() => sendShots()} disabled={!shots.length} className="h-12 w-20 rounded-full bg-accent text-sm font-semibold text-white disabled:opacity-30">
            Send{shots.length ? ` ${shots.length}` : ""}
          </button>
        </div>
      </div>

      <input ref={fallbackPhoto} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { setShots((s) => [...s, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
      <input ref={fallbackVideo} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { setShots((s) => [...s, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
    </div>
  );
}

function ShotThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/10">
      {url &&
        (file.type.startsWith("video/") ? (
          <video src={url} muted className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ))}
      <button onClick={onRemove} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70" aria-label="Remove">
        <Icon name="close" className="h-3 w-3" />
      </button>
    </div>
  );
}
