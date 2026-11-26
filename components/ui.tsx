"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ShopType } from "@/lib/types";
import { cls } from "@/lib/util";

export type Panel =
  | { type: "shops"; shopType?: ShopType; searchText?: string }
  | { type: "shop"; placeId: string; shopType: ShopType; job?: string }
  | { type: "quotes"; requestId?: string }
  | { type: "newQuote"; shopType: ShopType; job: string }
  | { type: "garage"; tab?: "vehicles" | "insurance" | "reminders" | "history" | "record" | "privacy" }
  | { type: "vehicle"; vehicleId?: string }
  | { type: "settings" }
  | { type: "profile" }
  | { type: "language" }
  | { type: "usage" }
  | { type: "help" }
  | { type: "learn" };

interface UiCtx {
  panel: Panel | null;
  open: (p: Panel) => void;
  close: () => void;
  camera: CameraRequest | null;
  openCamera: (r: CameraRequest) => void;
  closeCamera: () => void;
  voiceOpen: boolean;
  setVoiceOpen: (v: boolean) => void;
  toast: (text: string) => void;
}

export interface CameraRequest {
  mode: "photo" | "video" | "lens";
  /** When set, lens results go here (for example VIN scan in the vehicle form) instead of the chat. */
  onVin?: (vin: string) => void;
}

const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo(
    () => ({
      panel,
      open: setPanel,
      close: () => setPanel(null),
      camera,
      openCamera: setCamera,
      closeCamera: () => setCamera(null),
      voiceOpen,
      setVoiceOpen,
      toast,
    }),
    [panel, camera, voiceOpen, toast],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="rise rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useUi() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUi outside provider");
  return c;
}

/** True on screens at least `px` wide. */
export function useMinWidth(px: number) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [px]);
  return ok;
}

export function PanelHeader({ title, subtitle, onClose, onBack }: { title: string; subtitle?: string; onClose: () => void; onBack?: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
      {onBack && (
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Back">
          <Icon name="back" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold">{title}</h2>
        {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
        <Icon name="close" />
      </button>
    </div>
  );
}

export function Sheet({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cls(
          "sheet-up scroll-thin flex max-h-[94dvh] w-full flex-col overflow-y-auto rounded-t-3xl bg-surface shadow-2xl md:rounded-3xl",
          wide ? "md:max-w-2xl" : "md:max-w-lg",
        )}
      >
        {children}
      </div>
    </div>
  );
}

const PATHS: Record<string, string> = {
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 18l-6-6 6-6",
  plus: "M12 5v14M5 12h14",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  mic: "M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zM19 11a7 7 0 01-14 0M12 18v3",
  send: "M4 12l16-8-6 16-2-7-8-1z",
  wave: "M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2",
  car: "M5 16h14M6 16l1.5-5h9L18 16M7 16v2M17 16v2M8 13.5h.01M16 13.5h.01M7.5 11L9 7h6l1.5 4",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  quote: "M5 5h14v10H8l-3 3zM8 9h8M8 12h5",
  garage: "M3 10l9-6 9 6v10H3zM7 20v-6h10v6",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z",
  check: "M5 12l5 5 9-10",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 118 0v3",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5",
  video: "M4 7h11v10H4zM15 10l5-3v10l-5-3",
  lens: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5M8 11h6M11 8v6",
  stop: "M7 7h10v10H7z",
  pin: "M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  wrench: "M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  bolt: "M13 3L4 14h7l-1 7 9-11h-7z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  menu: "M4 7h16M4 12h16M4 17h16",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  sidebar: "M4 5h16v14H4zM9 5v14",
  compose: "M12 4H5v15h15v-7M18 3l3 3-8 8H10v-3z",
};

export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: { name: keyof typeof PATHS | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
