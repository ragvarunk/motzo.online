"use client";

import { useEffect, useRef, useState } from "react";
import { useMotzo } from "@/lib/store";
import type { ChatThread } from "@/lib/types";
import { cls, vehicleName } from "@/lib/util";
import { EagleAvatar } from "./Eagle";
import { ProfileButton } from "./Profile";
import { Icon, useUi } from "./ui";

/**
 * The left side of the app, laid out like a chat assistant: new chat, the main
 * places, the owner's vehicles, recent chats, and the profile button at the
 * bottom. On phones it slides in as a drawer.
 */
export function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const { state, activeVehicle, update, vehicleChats, activeChat, newChat, openChat } = useMotzo();
  const ui = useUi();
  const openCount = state.quoteRequests.filter((r) => r.vehicleId === activeVehicle?.id && r.status === "collecting").length;
  const nav = (fn: () => void) => () => {
    fn();
    onNavigate?.();
  };

  return (
    <div className="flex h-full w-full flex-col bg-surface">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[max(env(safe-area-inset-top),14px)]">
        <EagleAvatar size={30} />
        <span className="flex-1 text-lg font-extrabold tracking-tight">Motzo</span>
        {onClose && (
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close menu">
            <Icon name="close" className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-0.5 px-2">
        <button onClick={nav(newChat)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-surface-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-ink">
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} />
          </span>
          New chat
        </button>
        <SideItem icon="map" label="Shops near me" onClick={nav(() => ui.open({ type: "shops" }))} />
        <SideItem icon="quote" label="Quotes" badge={openCount} onClick={nav(() => ui.open({ type: "quotes" }))} />
        <SideItem icon="garage" label="My garage" onClick={nav(() => ui.open({ type: "garage" }))} />
      </div>

      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <p className="text-xs font-semibold text-ink-3">Vehicles</p>
          <button onClick={nav(() => ui.open({ type: "vehicle" }))} className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Add vehicle" title="Add vehicle">
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>
        {state.vehicles.map((v) => (
          <button
            key={v.id}
            onClick={() => update((s) => ({ ...s, activeVehicleId: v.id, activeChatId: s.activeVehicleId === v.id ? s.activeChatId : null }))}
            className={cls("flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-sm", v.id === activeVehicle?.id ? "font-semibold text-ink" : "text-ink-2 hover:bg-surface-2")}
          >
            <Icon name="car" className={cls("h-4 w-4 shrink-0", v.id === activeVehicle?.id ? "text-accent" : "text-ink-3")} />
            <span className="truncate">{vehicleName(v)}</span>
          </button>
        ))}

        <p className="px-2 pb-1 pt-4 text-xs font-semibold text-ink-3">Recents</p>
        {vehicleChats.length === 0 && <p className="px-2 py-1 text-sm text-ink-3">Your chats about this vehicle show up here.</p>}
        {vehicleChats.map((c) => (
          <ChatRow key={c.id} chat={c} active={c.id === activeChat?.id} onOpen={nav(() => openChat(c.id))} />
        ))}
      </div>

      <div className="border-t border-line p-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        <ProfileButton onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function SideItem({ icon, label, onClick, badge }: { icon: string; label: string; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-2">
      <span className="grid h-7 w-7 place-items-center">
        <Icon name={icon} className="h-[18px] w-[18px] text-ink-2" />
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge ? <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-ink">{badge}</span> : null}
    </button>
  );
}

function ChatRow({ chat, active, onOpen }: { chat: ChatThread; active: boolean; onOpen: () => void }) {
  const { renameChat, deleteChat } = useMotzo();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sure, setSure] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenu(false);
        setSure(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  if (editing) {
    return (
      <form
        className="px-1 py-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          renameChat(chat.id, title.trim() || chat.title);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          className="field !py-1.5 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            renameChat(chat.id, title.trim() || chat.title);
            setEditing(false);
          }}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          aria-label="Chat name"
        />
      </form>
    );
  }

  return (
    <div ref={ref} className={cls("group relative flex items-center rounded-lg", active ? "bg-surface-2" : "hover:bg-surface-2")}>
      <button onClick={onOpen} className={cls("min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm", active ? "font-semibold" : "text-ink-2")} title={chat.title}>
        {chat.title}
      </button>
      <button
        onClick={() => setMenu((x) => !x)}
        className={cls("mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-3 hover:text-ink", menu || active ? "opacity-100" : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100")}
        aria-label={`Options for ${chat.title}`}
      >
        <Icon name="dots" className="h-4 w-4" strokeWidth={3.2} />
      </button>
      {menu && (
        <div className="pop-in absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm shadow-xl">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
            onClick={() => {
              setMenu(false);
              setTitle(chat.title);
              setEditing(true);
            }}
          >
            <Icon name="edit" className="h-4 w-4 text-ink-2" /> Rename
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-bad hover:bg-surface-2"
            onClick={() => {
              if (!sure) return setSure(true);
              deleteChat(chat.id);
              setMenu(false);
            }}
          >
            <Icon name="trash" className="h-4 w-4" /> {sure ? "Tap to confirm" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}
