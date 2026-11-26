"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Placeholder Motzo robot until Rag sends the real character picture. It has
// the states the spec asks for (idle, listening, thinking, talking, happy,
// concerned) and moves around the chat: up and down, toward and away from the
// owner (by growing and shrinking), and next to new cards.

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

const EYES: Record<RobotMood, { ry: number; dy: number }> = {
  idle: { ry: 5, dy: 0 },
  listening: { ry: 6, dy: 0 },
  thinking: { ry: 3, dy: -2 },
  talking: { ry: 5, dy: 0 },
  happy: { ry: 2.5, dy: 0 },
  concerned: { ry: 4, dy: 1 },
};

export function RobotFace({ mood, size = 64, speaking = false }: { mood: RobotMood; size?: number; speaking?: boolean }) {
  const eye = EYES[mood];
  const antenna = mood === "thinking" ? "#ffb020" : mood === "listening" ? "#21c07a" : mood === "concerned" ? "#ff7a59" : "#ffb020";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="overflow-visible">
      <defs>
        <linearGradient id="rb-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dfe6f7" />
        </linearGradient>
        <linearGradient id="rb-face" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#1d2a52" />
          <stop offset="100%" stopColor="#0d1530" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <line x1="50" y1="12" x2="50" y2="24" stroke="#9aa8c7" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="10" r="5" fill={antenna}>
        {mood === "thinking" && <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite" />}
      </circle>
      {/* head */}
      <rect x="18" y="24" width="64" height="50" rx="20" fill="url(#rb-body)" stroke="#c9d3ea" strokeWidth="1.5" />
      <rect x="26" y="32" width="48" height="32" rx="13" fill="url(#rb-face)" />
      {/* ears */}
      <rect x="11" y="40" width="8" height="18" rx="4" fill="#2f5bff" />
      <rect x="81" y="40" width="8" height="18" rx="4" fill="#2f5bff" />
      {/* eyes */}
      <g transform={`translate(0 ${eye.dy})`}>
        {mood === "happy" ? (
          <>
            <path d="M35 49 q5 -7 10 0" stroke="#7de3ff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M55 49 q5 -7 10 0" stroke="#7de3ff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="40" cy="47" rx="5" ry={eye.ry} fill="#7de3ff">
              {mood !== "thinking" && <animate attributeName="ry" values={`${eye.ry};0.6;${eye.ry}`} dur="4s" keyTimes="0;0.04;0.08" repeatCount="indefinite" />}
            </ellipse>
            <ellipse cx="60" cy="47" rx="5" ry={eye.ry} fill="#7de3ff">
              {mood !== "thinking" && <animate attributeName="ry" values={`${eye.ry};0.6;${eye.ry}`} dur="4s" keyTimes="0;0.04;0.08" repeatCount="indefinite" />}
            </ellipse>
          </>
        )}
        {mood === "concerned" && (
          <>
            <line x1="34" y1="39" x2="44" y2="41" stroke="#7de3ff" strokeWidth="2" strokeLinecap="round" />
            <line x1="66" y1="39" x2="56" y2="41" stroke="#7de3ff" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </g>
      {/* mouth: moves while talking */}
      {speaking || mood === "talking" ? (
        <rect x="44" y="55" width="12" height="4" rx="2" fill="#7de3ff">
          <animate attributeName="height" values="2;6;3;7;2" dur="0.5s" repeatCount="indefinite" />
          <animate attributeName="y" values="56;54;55.5;53.5;56" dur="0.5s" repeatCount="indefinite" />
        </rect>
      ) : mood === "happy" ? (
        <path d="M43 56 q7 6 14 0" stroke="#7de3ff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : mood === "concerned" ? (
        <path d="M44 59 q6 -4 12 0" stroke="#7de3ff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : (
        <rect x="45" y="56" width="10" height="2.5" rx="1.25" fill="#7de3ff" opacity="0.8" />
      )}
      {/* body */}
      <rect x="32" y="76" width="36" height="16" rx="8" fill="url(#rb-body)" stroke="#c9d3ea" strokeWidth="1.5" />
      <circle cx="50" cy="84" r="3.5" fill={mood === "listening" ? "#21c07a" : "#2f5bff"} />
    </svg>
  );
}

/**
 * The robot that floats around the chat. It never takes taps (pointer-events
 * off) and stays clear of the input bar.
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
  const [pos, setPos] = useState({ x: 0, y: 0, z: 1 });
  const [box, setBox] = useState<DOMRect | null>(null);
  const px = size === "small" ? 44 : 60;

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

  useEffect(() => {
    if (!box) return;
    const place = () => {
      // The right-hand gutter of the chat, above the input bar.
      const minX = box.right - px - 12;
      const maxX = box.right - px - 4;
      const minY = box.top + 70;
      const maxY = box.bottom - 190 - px;
      if (target) {
        const y = Math.min(Math.max(target.top + target.height / 2 - px / 2, minY), Math.max(minY, maxY));
        setPos({ x: maxX, y, z: 1.08 });
        return;
      }
      if (mood === "thinking" || mood === "talking" || mood === "listening") {
        setPos({ x: maxX, y: Math.max(minY, maxY), z: 1.05 });
        return;
      }
      if (motion === "still") {
        setPos({ x: maxX, y: minY, z: 1 });
        return;
      }
      setPos({
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * Math.max(0, maxY - minY),
        z: motion === "full" ? 0.85 + Math.random() * 0.3 : 1,
      });
    };
    place();
    if (motion === "still" || target) return;
    const t = setInterval(place, motion === "full" ? 5500 : 11000);
    return () => clearInterval(t);
  }, [box, mood, target, motion, px]);

  if (!box || hidden) return null;
  const bob = motion === "still" ? "" : "animate-[bob_3.2s_ease-in-out_infinite]";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px) scale(${pos.z})`,
        transition: motion === "still" ? "none" : "transform 1.6s cubic-bezier(0.45, 0.05, 0.25, 1)",
        filter: "drop-shadow(0 8px 14px rgba(20,40,120,0.25))",
      }}
    >
      <style>{`@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      <div className={bob}>
        <RobotFace mood={mood} size={px} />
      </div>
    </div>
  );
}
