"use client";

// Photo, video and file helpers. Photos are shrunk on the device before they
// are sent, so they upload fast on a phone connection.

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

function drawScaled(source: CanvasImageSource, w: number, h: number, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", quality),
  );
}

/** Shrinks a photo to at most `max` pixels on its long side, as JPEG. */
export async function compressImage(file: Blob, max = 1568, quality = 0.84): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return await drawScaled(img, img.naturalWidth, img.naturalHeight, max, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function thumbnail(file: Blob): Promise<string> {
  const small = await compressImage(file, 360, 0.7);
  return blobToDataUrl(small);
}

/** Grabs a few still frames from a video so Motzo can look at it. */
export async function videoFrames(file: Blob, count = 4): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
      setTimeout(() => reject(new Error("video timeout")), 15000);
    });
    let duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) duration = 1;
    const frames: Blob[] = [];
    for (let i = 0; i < count; i++) {
      const t = Math.min(duration - 0.05, (duration * (i + 0.5)) / count);
      await new Promise<void>((resolve) => {
        const done = () => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        video.currentTime = Math.max(0, t);
        setTimeout(done, 3000);
      });
      frames.push(await drawScaled(video, video.videoWidth, video.videoHeight, 1024, 0.8));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function kindOf(mime: string, name: string): "image" | "video" | "document" | "audio" {
  if (mime.startsWith("image/") || /\.(heic|heif)$/i.test(name)) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
