"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFile, useMotzo } from "@/lib/store";
import type { Attachment, Message } from "@/lib/types";
import { prettySize } from "@/lib/media";
import { cls, dayLabel, fullStamp, timeOnly, timeZoneName } from "@/lib/util";
import { MessageCards } from "./Cards";
import { useEngine } from "./ChatEngine";
import { RobotFace, useRobot } from "./Robot";
import { Icon } from "./ui";

const REACTIONS = ["👍", "❤️", "😊", "😮", "🙏", "👎"];

/** The conversation for the active vehicle. Every message shows its exact time. */
export function ChatList() {
  const { state, activeChat } = useMotzo();
  const { busy } = useEngine();
  const robot = useRobot();
  const endRef = useRef<HTMLDivElement>(null);
  const lastCardRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => (activeChat ? state.messages.filter((m) => m.chatId === activeChat.id) : []),
    [state.messages, activeChat],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    const last = messages[messages.length - 1];
    if (last?.author === "motzo" && last.cards?.length && lastCardRef.current) robot.pointAt(lastCardRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, busy]);

  let lastDay = "";
  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-6 pt-3 sm:px-5">
      {messages.length === 0 && !busy && <EmptyChat />}
      {messages.length > 0 && (
        <p className="mb-3 text-center text-xs text-ink-3">
          Every message is saved on this device with its exact date and time ({timeZoneName()}). Tap a time to see it in full.
        </p>
      )}
      {messages.map((m, i) => {
        const day = new Date(m.at).toDateString();
        const showDay = day !== lastDay;
        lastDay = day;
        const isLast = i === messages.length - 1;
        return (
          <div key={m.id} ref={isLast && m.cards?.length ? lastCardRef : undefined}>
            {showDay && (
              <div className="my-4 flex items-center gap-3 text-xs font-semibold text-ink-3">
                <span className="h-px flex-1 bg-line" />
                {dayLabel(m.at)}
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <Bubble message={m} />
          </div>
        );
      })}
      {busy && (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-3">
          <RobotFace mood="thinking" size={28} />
          <span className="flex gap-1">
            <span className="dot h-1.5 w-1.5 rounded-full bg-ink-3" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-ink-3 [animation-delay:0.15s]" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-ink-3 [animation-delay:0.3s]" />
          </span>
          Motzo is out looking…
        </div>
      )}
      <div ref={endRef} className="h-2" />
    </div>
  );
}

function EmptyChat() {
  const { send } = useEngine();
  const { state, activeVehicle } = useMotzo();
  const first = state.owner.name.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const ideas: [string, string][] = [
    ["camera", "My windshield has a crack, what will it cost?"],
    ["car", "There's a dent on my rear bumper"],
    ["clock", "When is my next oil change due?"],
    ["bolt", "My check engine light is on"],
  ];
  return (
    <div className="rise flex min-h-[52dvh] flex-col items-center justify-center text-center">
      <RobotFace mood="happy" size={96} />
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {hello}
        {first ? `, ${first}` : ""}
      </h2>
      <p className="mt-2 max-w-md text-sm text-ink-2">
        Ask me anything about your {activeVehicle?.model ?? "vehicle"}. Send a photo of damage and I&apos;ll tell you what it is, what it should cost and who can fix it.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {ideas.map(([icon, t]) => (
          <button key={t} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left text-sm hover:border-ink-3/60" onClick={() => send({ text: t })}>
            <Icon name={icon} className="h-4 w-4 shrink-0 text-ink-3" />
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ message: m }: { message: Message }) {
  const { patchMessage } = useMotzo();
  const [showFull, setShowFull] = useState(false);
  const [picker, setPicker] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mine = m.author === "owner";

  if (m.author === "system") {
    return (
      <div className="my-2 flex justify-center">
        <div className="max-w-md rounded-xl bg-bad/10 px-3 py-2 text-center text-sm text-bad">
          {m.text}
          <span className="ml-2 text-xs opacity-70">{timeOnly(m.at)}</span>
        </div>
      </div>
    );
  }

  const react = (e: string) => {
    patchMessage(m.id, (x) => ({ ...x, reactions: { ...x.reactions, owner: x.reactions?.owner === e ? undefined : e } }));
    setPicker(false);
  };
  const startPress = () => {
    press.current = setTimeout(() => setPicker(true), 450);
  };
  const endPress = () => press.current && clearTimeout(press.current);
  const reactions = [m.reactions?.owner, m.reactions?.motzo].filter(Boolean) as string[];

  return (
    <div className={cls("group my-1.5 flex gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <div className="mt-auto hidden shrink-0 sm:block">
          <RobotFace mood="idle" size={30} />
        </div>
      )}
      <div className={cls("relative flex max-w-[88%] flex-col sm:max-w-[78%]", mine ? "items-end" : "items-start")}>
        <div
          onDoubleClick={() => react(mine ? "❤️" : "👍")}
          onContextMenu={(e) => {
            e.preventDefault();
            setPicker(true);
          }}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onTouchMove={endPress}
          className={cls(
            "relative select-text rounded-2xl px-3.5 py-2.5 shadow-sm",
            mine ? "rounded-br-md bg-owner text-owner-ink" : "rounded-bl-md border border-line bg-surface",
          )}
        >
          {m.attachments?.length ? <Attachments items={m.attachments} mine={mine} /> : null}
          {m.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.text}</p>}
          {m.demo && <p className={cls("mt-1 text-[11px] font-semibold uppercase tracking-wide", mine ? "text-owner-ink/70" : "text-warn")}>Sample mode</p>}
          {reactions.length > 0 && (
            <button
              onClick={() => setPicker(true)}
              className={cls("pop-in absolute -bottom-3 flex gap-0.5 rounded-full border border-line bg-surface px-1.5 py-0.5 text-sm shadow", mine ? "left-2" : "right-2")}
              aria-label="Reactions"
            >
              {reactions.map((r, i) => (
                <span key={i}>{r}</span>
              ))}
            </button>
          )}
        </div>
        <div className={cls("mt-1 flex items-center gap-2 px-1 text-[11px] text-ink-3", reactions.length > 0 && "mt-3.5")}>
          <button onClick={() => setShowFull((x) => !x)} className="hover:text-ink-2" title={fullStamp(m.at)}>
            {showFull ? fullStamp(m.at) : timeOnly(m.at)}
          </button>
          {m.viaVoice && <span>· by voice</span>}
          <span>· {mine ? "You" : "Motzo"}</span>
          <button onClick={() => setPicker((p) => !p)} className="opacity-0 transition group-hover:opacity-100" aria-label="React">
            ☺︎
          </button>
        </div>
        {picker && (
          <div className={cls("pop-in absolute -top-11 z-20 flex gap-1 rounded-full border border-line bg-surface p-1 shadow-lg", mine ? "right-0" : "left-0")}>
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => react(e)} className={cls("grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-surface-2", m.reactions?.owner === e && "bg-accent-soft")}>
                {e}
              </button>
            ))}
            <button onClick={() => setPicker(false)} className="grid h-9 w-9 place-items-center rounded-full text-ink-3" aria-label="Close">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}
        {m.author === "motzo" && <div className="w-full sm:min-w-[380px]"><MessageCards message={m} /></div>}
      </div>
    </div>
  );
}

function Attachments({ items, mine }: { items: Attachment[]; mine: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const visual = items.filter((a) => a.kind === "image" || a.kind === "video");
  const other = items.filter((a) => a.kind !== "image" && a.kind !== "video");
  return (
    <div className="mb-1.5 space-y-1.5">
      {visual.length > 0 && (
        <div className={cls("grid gap-1.5", visual.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {visual.map((a) => (
            <button key={a.id} onClick={() => setOpen(a.id)} className="relative overflow-hidden rounded-xl bg-black/10">
              {a.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumb} alt={a.reading || a.name} className="max-h-60 w-full object-cover" />
              ) : (
                <div className="grid h-28 place-items-center text-sm">{a.name}</div>
              )}
              {a.kind === "video" && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white">▶</span>
                </span>
              )}
              {a.fromLens && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">Lens</span>}
            </button>
          ))}
        </div>
      )}
      {other.map((a) => (
        <FileChip key={a.id} a={a} mine={mine} />
      ))}
      {open && <Viewer att={items.find((x) => x.id === open)!} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FileChip({ a, mine }: { a: Attachment; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (a.kind !== "audio") return;
    let u: string | null = null;
    getFile(a.id).then((b) => {
      if (b) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [a.id, a.kind]);
  const openDoc = async () => {
    const b = await getFile(a.id);
    if (b) window.open(URL.createObjectURL(b), "_blank", "noopener");
  };
  return (
    <div className={cls("rounded-xl px-3 py-2 text-sm", mine ? "bg-white/15" : "bg-surface-2")}>
      <div className="flex items-center gap-2">
        <Icon name={a.kind === "audio" ? "mic" : "doc"} className="h-4 w-4 shrink-0" />
        {a.kind === "document" ? (
          <button onClick={openDoc} className="min-w-0 truncate text-left font-medium underline-offset-2 hover:underline">
            {a.name}
          </button>
        ) : (
          <span className="min-w-0 truncate font-medium">{a.name}</span>
        )}
        <span className="shrink-0 text-xs opacity-70">{prettySize(a.size)}</span>
      </div>
      {url && <audio src={url} controls className="mt-1.5 h-9 w-full max-w-[260px]" />}
      {a.transcript && <p className="mt-1 text-xs italic opacity-80">“{a.transcript}”</p>}
    </div>
  );
}

function Viewer({ att, onClose }: { att: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    getFile(att.id).then((b) => {
      if (b) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [att.id]);
  const src = url ?? att.thumb ?? null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex justify-end p-3">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white" aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
        {att.kind === "video" && url ? (
          <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg" />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={att.name} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <p className="text-white">This file isn&apos;t on this device any more.</p>
        )}
      </div>
      {att.reading && <p className="p-4 text-center text-sm text-white/80">Motzo read: {att.reading}</p>}
    </div>
  );
}
