"use client";

import { useId } from "react";

// Motzo's character: a bald eagle drawn in layers (far wing, tail, body, head,
// near wing) so the wings can flap like a real bird's. Each wing is a group
// hinged at the shoulder; the flap squashes it through the body line (the
// wing sweeping toward and past the viewer), skews it so the tips trail, and
// bends the primary feathers a little behind the rest of the wing. The body
// rises on each downstroke. Animations live in globals.css (.eagle-*).

export type WingMode = "glide" | "hover" | "flap" | "fast" | "still";

interface Feather {
  d: string;
}

/** A long primary feather from base to tip, as a slim leaf shape. */
function feather(bx: number, by: number, tx: number, ty: number, w: number): Feather {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  const m1x = bx + dx * 0.45;
  const m1y = by + dy * 0.45;
  return {
    d: `M${bx - nx * 0.6},${by - ny * 0.6} Q${m1x - nx},${m1y - ny} ${tx},${ty} Q${m1x + nx * 1.1},${m1y + ny * 1.1} ${bx + nx * 0.6},${by + ny * 0.6} Z`,
  };
}

// Wing drawn pointing up and back from the shoulder at (0,0).
const PRIMARIES: Feather[] = [
  feather(-26, -56, -24, -86, 3.6),
  feather(-31, -55, -34, -86, 3.8),
  feather(-36, -53, -44, -82, 3.8),
  feather(-41, -50, -53, -76, 3.6),
  feather(-45, -46, -60, -67, 3.4),
  feather(-48, -41, -64, -57, 3.2),
];

const SECONDARY_EDGE = (() => {
  // Trailing edge of the arm: a row of rounded secondary feather tips.
  const pts: string[] = [];
  const start = { x: -49, y: -38 };
  const end = { x: -24, y: 6 };
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const x0 = start.x + (end.x - start.x) * t0;
    const y0 = start.y + (end.y - start.y) * t0;
    const x1 = start.x + (end.x - start.x) * t1;
    const y1 = start.y + (end.y - start.y) * t1;
    pts.push(`Q${(x0 + x1) / 2 - 5},${(y0 + y1) / 2 + 2} ${x1},${y1}`);
  }
  return pts.join(" ");
})();

const WING_BODY = `M0,0 C-3,-13 -7,-25 -12,-35 C-16,-44 -21,-51 -26,-57 L-48,-40 ${SECONDARY_EDGE} C-15,8 -6,6 0,0 Z`;
const COVERTS = `M0,0 C-3,-13 -7,-25 -12,-35 C-15,-41 -19,-46 -23,-50 C-28,-42 -31,-30 -30,-18 C-26,-8 -15,-1 0,0 Z`;

function Wing({ ids, far }: { ids: Record<string, string>; far?: boolean }) {
  return (
    <g>
      <g className="eagle-primaries">
        {PRIMARIES.map((f, i) => (
          <path key={i} d={f.d} fill={far ? "#1a0f07" : `url(#${ids.primary})`} stroke={far ? "none" : "#120a04"} strokeWidth={0.4} />
        ))}
      </g>
      <path d={WING_BODY} fill={far ? "#24150a" : `url(#${ids.wing})`} />
      {!far && (
        <>
          <path d={COVERTS} fill={`url(#${ids.coverts})`} opacity={0.95} />
          {/* feather rows */}
          <path d="M-8,-20 C-16,-18 -24,-12 -30,-4 M-12,-33 C-22,-30 -32,-22 -40,-12 M-18,-45 C-28,-42 -38,-34 -46,-26" stroke="#1d1108" strokeWidth={0.7} fill="none" opacity={0.55} />
          <path d="M-2,-6 C-8,-8 -14,-6 -18,-1" stroke="#a37a52" strokeWidth={0.6} fill="none" opacity={0.5} />
        </>
      )}
    </g>
  );
}

export function Eagle({
  width = 120,
  mode = "glide",
  talking = false,
  crop,
  className,
}: {
  width?: number;
  mode?: WingMode;
  talking?: boolean;
  /** "head" shows only the head, for small avatars. */
  crop?: "head";
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const ids = {
    body: `eb-${uid}`,
    head: `eh-${uid}`,
    wing: `ew-${uid}`,
    coverts: `ec-${uid}`,
    primary: `ep-${uid}`,
    tail: `et-${uid}`,
    beak: `ek-${uid}`,
  };
  const viewBox = crop === "head" ? "120 36 62 62" : "0 0 200 150";
  const height = crop === "head" ? width : (width * 150) / 200;
  return (
    <svg width={width} height={height} viewBox={viewBox} aria-hidden="true" className={`eagle eagle-${mode} ${className ?? ""}`} overflow="visible">
      <defs>
        <linearGradient id={ids.body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4426" />
          <stop offset="0.45" stopColor="#4a2d17" />
          <stop offset="1" stopColor="#2b190c" />
        </linearGradient>
        <radialGradient id={ids.head} cx="0.55" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f1efe9" />
          <stop offset="1" stopColor="#cfcac0" />
        </radialGradient>
        <linearGradient id={ids.wing} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#4d2f18" />
          <stop offset="1" stopColor="#2a180b" />
        </linearGradient>
        <linearGradient id={ids.coverts} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#8a5f39" />
          <stop offset="1" stopColor="#53331b" />
        </linearGradient>
        <linearGradient id={ids.primary} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2e1c0e" />
          <stop offset="1" stopColor="#150c05" />
        </linearGradient>
        <linearGradient id={ids.tail} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#e9e6df" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={ids.beak} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd34d" />
          <stop offset="1" stopColor="#e9a514" />
        </linearGradient>
      </defs>

      <g className="eagle-bodybob">
        {/* far wing, behind everything */}
        <g transform="translate(108 72)" opacity={0.95}>
          <g className="eagle-wing eagle-wing-far">
            <Wing ids={ids} far />
          </g>
        </g>

        {/* tail: white fan with feather tips */}
        <path
          d="M68,78 C55,75 43,71 31,69 Q26,70 27,73 Q23,75 24,78 Q20,80 23,83 Q20,86 23,88 Q22,92 27,93 C40,92 54,90 68,88 Z"
          fill={`url(#${ids.tail})`}
          stroke="#cfc9bd"
          strokeWidth={0.6}
        />
        <path d="M60,80 L30,73 M60,83 L26,80 M60,86 L27,88" stroke="#d9d3c7" strokeWidth={0.6} />

        {/* legs tucked under, yellow feet showing */}
        <path d="M86,92 C88,99 94,103 101,103 C104,101 103,97 99,95 Z" fill="#3a2312" />
        <path d="M97,101 C101,104 106,104 109,102 L110,104 C106,107 100,107 96,104 Z" fill="#f0b323" />
        <path d="M106,103 l3,2.5 M103,104 l2,3" stroke="#2a2a2a" strokeWidth={0.9} strokeLinecap="round" />

        {/* body */}
        <path d="M62,80 C70,69 92,65 113,67 C125,68 134,69 141,72 C139,81 131,89 116,93 C98,98 76,97 62,88 Z" fill={`url(#${ids.body})`} />
        {/* breast feather texture */}
        <path d="M118,86 q-4,3 -9,3 M106,90 q-4,2 -9,2 M94,91 q-4,1 -9,1 M124,80 q-4,3 -8,3" stroke="#2a180b" strokeWidth={0.7} fill="none" opacity={0.6} />
        <path d="M80,72 C92,68 106,67 120,69" stroke="#8a5f39" strokeWidth={1.2} fill="none" opacity={0.35} />

        {/* head and neck: white with a ragged nape */}
        <path
          d="M127,69 C130,60 140,55 151,56 C159,57 165,61 167,66 C164,70 158,72 151,74 C147,76 143,77 140,79 L137,77 L135,80 L132,77 L129,79 L128,75 Z"
          fill={`url(#${ids.head})`}
        />
        <path d="M134,64 C138,60 144,58 150,58" stroke="#ffffff" strokeWidth={1} fill="none" opacity={0.8} />
        {/* brow ridge and eye */}
        <path d="M150,60.5 C153,59 157,59 160,61" stroke="#8d8577" strokeWidth={1.4} strokeLinecap="round" fill="none" />
        <circle cx="155.5" cy="63.2" r="2.3" fill="#f2c230" />
        <circle cx="156" cy="63.2" r="1.15" fill="#1a1205" />
        <circle cx="156.5" cy="62.6" r="0.4" fill="#fff" />

        {/* beak: hooked upper and a lower mandible that opens to talk */}
        <g transform="translate(162 69.5)">
          <g className={talking ? "eagle-jaw-talk" : undefined}>
            <path d="M0,0.5 L8,0.5 C9.5,2 7,3.6 3.6,3.6 C1.8,3.6 0.5,2.5 0,0.5 Z" fill="#e2a11a" />
          </g>
        </g>
        <path d="M160,64.5 C165,62.2 172,62.4 176.5,65.8 C179,68.4 178.6,72.4 175.6,74.4 C175.4,71.8 173.7,70.4 171,70.3 L161.5,70.6 Z" fill={`url(#${ids.beak})`} />
        <path d="M161,66 C163,64.8 165,64.4 167,64.6" stroke="#f7e08a" strokeWidth={0.8} fill="none" />
        <circle cx="166.5" cy="66.2" r="0.6" fill="#7a5507" />

        {/* near wing, in front of the body */}
        <g transform="translate(101 75)">
          <g className="eagle-wing eagle-wing-near">
            <Wing ids={ids} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Round avatar with the eagle's head, for message rows and headers. */
export function EagleAvatar({ size = 32, talking = false }: { size?: number; talking?: boolean }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full"
      style={{ width: size, height: size, background: "linear-gradient(160deg, #cfe3ff 0%, #8fb6f2 100%)" }}
    >
      <Eagle width={size * 1.05} crop="head" mode="still" talking={talking} />
    </span>
  );
}
