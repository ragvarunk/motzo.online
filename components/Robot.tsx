"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Eagle, EagleAvatar, type WingMode } from "./Eagle";

// Motzo's character is an eagle (components/Eagle.tsx). The names here still
// say "robot" so the rest of the app didn't need to change. It has the states
// the spec asks for (idle, listening, thinking, talking, happy, concerned).

export type RobotMood = "idle" | "listening" | "thinking" | "talking" | "happy" | "concerned";

interface RobotCtx {
  mood: RobotMood;
  setMood: (m: RobotMood, holdMs?: number) => void;
  pointAt: (el: HTMLElement | null) => void;
  target: DOMRect | null;
}

const Ctx = createContext<RobotCtx | null>(null);

export function RobotProvider({ children }: { children: ReactNode }) {
  const [mood, setMoodState] = useState<RobotMood>("idle");
  const [target, setTarget] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMood = useCallback((m: RobotMood, holdMs?: number) => {
    if (timer.current) clearTimeout(timer.current);
    setMoodState(m);
    if (holdMs) timer.current = setTimeout(() => setMoodState("idle"), holdMs);
  }, []);

  const pointAt = useCallback((el: HTMLElement | null) => {
    if (targetTimer.current) clearTimeout(targetTimer.current);
    setTarget(el ? el.getBoundingClientRect() : null);
    if (el) targetTimer.current = setTimeout(() => setTarget(null), 4500);
  }, []);

  const value = useMemo(() => ({ mood, setMood, pointAt, target }), [mood, setMood, pointAt, target]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRobot() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRobot outside provider");
  return c;
}

const MOOD_MODE: Record<RobotMood, WingMode> = {
  idle: "glide",
  listening: "hover",
  thinking: "flap",
  talking: "hover",
  happy: "hover",
  concerned: "glide",
};

/**
 * Motzo's eagle in a fixed spot (welcome screen, voice mode, avatars). Small
 * sizes show a round head avatar; larger ones show the whole bird.
 */
export function RobotFace({ mood, size = 64, speaking = false }: { mood: RobotMood; size?: number; speaking?: boolean }) {
  const talking = speaking || mood === "talking";
  if (size <= 60) return <EagleAvatar size={size} talking={talking} />;
  return <Eagle width={size * 1.1} mode={MOOD_MODE[mood]} talking={talking} />;
}

type Phase = "here" | "leaving" | "away" | "returning";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The eagle that soars beside the chat. When Motzo starts looking something up
 * it says "Let me find this for you" and flies off; when the answer is ready it
 * flies back in and says "Hey, I'm back!". It never takes taps and stays clear
 * of the input bar.
 */
export function FloatingRobot({
  bounds,
  motion,
  size,
  hidden,
}: {
  bounds: React.RefObject<HTMLElement | null>;
  motion: "full" | "calm" | "still";
  size: "small" | "normal";
  hidden?: boolean;
}) {
  const { mood, target } = useRobot();
  const [box, setBox] = useState<DOMRect | null>(null);
  const [home, setHome] = useState({ x: 0, y: 0, z: 1 });
  const [phase, setPhase] = useState<Phase>("here");
  const [bubble, setBubble] = useState<string | null>(null);
  const [offPos, setOffPos] = useState<{ x: number; y: number } | null>(null);
  const [instant, setInstant] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phaseRef = useRef<Phase>("here");
  const wantBack = useRef(false);
  const w = size === "small" ? 60 : 84;
  const h = (w * 250) / 200;
  const flies = motion !== "still" && !prefersReducedMotion();

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const el = bounds.current;
    if (!el) return;
    const measure = () => setBox(el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [bounds]);

  // Where the eagle soars when it's here: the right side of the chat.
  useEffect(() => {
    if (!box) return;
    const place = () => {
      const maxX = box.right - w - 8;
      const minX = Math.max(box.left + 8, maxX - (motion === "full" ? 40 : 12));
      const minY = box.top + 64;
      const maxY = Math.max(minY, box.bottom - 170 - h);
      if (target) {
        const y = Math.min(Math.max(target.top + target.height / 2 - h / 2, minY), maxY);
        setHome({ x: maxX, y, z: 1.06 });
        return;
      }
      if (mood === "talking" || mood === "listening" || motion === "still") {
        setHome({ x: maxX, y: mood === "idle" || motion === "still" ? minY : maxY, z: 1 });
        return;
      }
      setHome({
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
        z: motion === "full" ? 0.9 + Math.random() * 0.2 : 1,
      });
    };
    place();
    if (motion === "still" || target) return;
    const t = setInterval(place, motion === "full" ? 6000 : 12000);
    return () => clearInterval(t);
  }, [box, mood, target, motion, w, h]);

  // Fly away to search, and back with the answer.
  useEffect(() => {
    const searching = mood === "thinking";
    const p = phaseRef.current;
    if (searching && (p === "here" || p === "returning")) {
      clearTimers();
      wantBack.current = false;
      go("here");
      setOffPos(null);
      setBubble("Let me find this for you");
      if (!flies) return;
      later(950, () => {
        setBubble(null);
        setInstant(false);
        setOffPos({ x: window.innerWidth + 60, y: Math.max(-h - 20, (box?.top ?? 0) - 140) });
        go("leaving");
        later(1300, () => {
          go("away");
          if (wantBack.current) later(500, comeBack);
        });
      });
      return;
    }
    if (!searching) {
      if (p === "leaving") {
        wantBack.current = true;
        return;
      }
      if (p === "away") {
        comeBack();
        return;
      }
      if (p === "here" && bubble === "Let me find this for you") {
        if (flies) {
          // Answer came before the eagle took off: it still makes the trip.
          wantBack.current = true;
          return;
        }
        clearTimers();
        setBubble("Hey, I'm back!");
        later(2200, () => setBubble(null));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  function comeBack() {
    clearTimers();
    wantBack.current = false;
    // Jump off screen to the left without animating, then fly in.
    setInstant(true);
    setOffPos({ x: -w - 60, y: (box?.top ?? 0) + 20 });
    go("returning");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setInstant(false);
        setOffPos(null);
        later(1100, () => setBubble("Hey, I'm back!"));
        later(1650, () => go("here"));
        later(3600, () => setBubble((b) => (b === "Hey, I'm back!" ? null : b)));
      }),
    );
  }

  if (!box || hidden) return null;

  const pos = offPos ? { ...offPos, z: 1 } : home;
  const travelling = phase === "leaving" || phase === "returning";
  const wing: WingMode = travelling ? "fast" : bubble === "Let me find this for you" ? "hover" : MOOD_MODE[mood === "thinking" ? "idle" : mood];
  const duration = phase === "leaving" ? 1.3 : phase === "returning" ? 1.6 : motion === "still" ? 0 : 2.2;
  // Bank into the turn while travelling.
  const tilt = phase === "leaving" ? -14 : phase === "returning" ? 6 : 0;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px) scale(${pos.z})`,
        transition: instant || duration === 0 ? "none" : `transform ${duration}s cubic-bezier(0.45, 0.05, 0.25, 1)`,
        filter: "drop-shadow(0 10px 12px rgba(20,30,60,0.22))",
      }}
    >
      {bubble && (
        <div
          key={bubble}
          style={{ top: h * 0.22 }}
          className="eagle-bubble absolute right-1 w-max max-w-[180px] -translate-y-full rounded-2xl rounded-br-sm bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-lg ring-1 ring-line"
          role="status"
        >
          {bubble}
        </div>
      )}
      <div style={{ transform: `rotate(${tilt}deg)`, transition: "transform 0.5s ease" }}>
        <Eagle width={w} mode={wing} talking={mood === "talking"} />
      </div>
    </div>
  );
}
