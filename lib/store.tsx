"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createStore, del, get, set } from "idb-keyval";
import type { ChatThread, MotzoState, Message, Vehicle } from "./types";
import { defaultLanguage } from "./languages";

// Everything is kept on the owner's device for this first version.

const STATE_KEY = "motzo-state-v1";

export const initialState = (): MotzoState => ({
  version: 1,
  startedAt: null,
  owner: { name: "", phone: "", email: "", area: "" },
  vehicles: [],
  activeVehicleId: null,
  insurance: [],
  messages: [],
  chats: [],
  activeChatId: null,
  quoteRequests: [],
  jobs: [],
  sharing: [],
  savedShops: [],
  lastShops: [],
  lastShopSearch: null,
  settings: { speakAnswers: false, robotMotion: "full", robotSize: "normal", countMiles: false, language: "en-US" },
  mileageLog: [],
});

let idbStore: ReturnType<typeof createStore> | null = null;
function store() {
  if (!idbStore) idbStore = createStore("motzo", "kv");
  return idbStore;
}

export async function putFile(id: string, blob: Blob) {
  await set(`att:${id}`, blob, store());
}
export async function getFile(id: string): Promise<Blob | undefined> {
  return get(`att:${id}`, store());
}

type Updater = (s: MotzoState) => MotzoState;

interface Ctx {
  state: MotzoState;
  ready: boolean;
  update: (fn: Updater) => void;
  activeVehicle: Vehicle | null;
  addMessage: (m: Message) => void;
  patchMessage: (id: string, patch: Partial<Message> | ((m: Message) => Message)) => void;
  resetAll: () => Promise<void>;
  /** Conversations of the active vehicle, newest first. */
  vehicleChats: ChatThread[];
  activeChat: ChatThread | null;
  newChat: () => void;
  openChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
}

const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  return t.length > 42 ? `${t.slice(0, 40).trimEnd()}…` : t;
}

/** Older saves kept one long conversation per vehicle: give each its own chat. */
function migrate(s: MotzoState): MotzoState {
  if (s.messages.every((m) => m.chatId)) return s;
  const chats = [...s.chats];
  const byVehicle = new Map<string, string>();
  const messages = s.messages.map((m) => {
    if (m.chatId) return m;
    let id = byVehicle.get(m.vehicleId);
    if (!id) {
      id = newId("c_");
      byVehicle.set(m.vehicleId, id);
      const mine = s.messages.filter((x) => x.vehicleId === m.vehicleId && !x.chatId);
      const firstOwner = mine.find((x) => x.author === "owner" && x.text);
      chats.push({ id, vehicleId: m.vehicleId, title: firstOwner ? titleFrom(firstOwner.text) : "Earlier chat", createdAt: mine[0].at, updatedAt: mine[mine.length - 1].at });
    }
    return { ...m, chatId: id };
  });
  return { ...s, chats, messages, activeChatId: s.activeChatId ?? [...byVehicle.values()].pop() ?? null };
}

/** Adds a message to the open chat of its vehicle, starting a chat when none is open. */
function withMessage(s: MotzoState, m: Message): MotzoState {
  let chatId = m.chatId;
  let chats = s.chats;
  let activeChatId = s.activeChatId;
  if (!chatId) {
    const open = s.chats.find((c) => c.id === s.activeChatId && c.vehicleId === m.vehicleId);
    if (open) chatId = open.id;
  }
  if (!chatId || !chats.some((c) => c.id === chatId)) {
    // A new conversation: the first message names it and opens it.
    chatId = chatId || newId("c_");
    chats = [...chats, { id: chatId, vehicleId: m.vehicleId, title: m.author === "owner" ? titleFrom(m.text) : "New chat", createdAt: m.at, updatedAt: m.at }];
    activeChatId = chatId;
  }
  chats = chats.map((c) => {
    if (c.id !== chatId) return c;
    const title = c.title === "New chat" && m.author === "owner" && m.text ? titleFrom(m.text) : c.title;
    return { ...c, title, updatedAt: m.at };
  });
  return { ...s, chats, activeChatId, messages: [...s.messages, { ...m, chatId }] };
}

const MotzoCtx = createContext<Ctx | null>(null);

export function MotzoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MotzoState>(initialState);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<MotzoState>(STATE_KEY, store())
      .then((saved) => {
        if (cancelled) return;
        if (saved && saved.version === 1) {
          const base = initialState();
          const merged: MotzoState = {
            ...base,
            ...saved,
            chats: saved.chats ?? [],
            activeChatId: saved.activeChatId ?? null,
            settings: { ...base.settings, ...saved.settings, language: saved.settings?.language || defaultLanguage() },
            owner: { ...base.owner, ...saved.owner },
          };
          setState(migrate(merged));
        } else {
          setState((s) => ({ ...s, settings: { ...s.settings, language: defaultLanguage() } }));
        }
      })
      .catch(() => {
        /* storage blocked: the app still works for this visit */
      })
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      set(STATE_KEY, state, store()).catch(() => undefined);
    }, 250);
  }, [state, ready]);

  const update = useCallback((fn: Updater) => setState((s) => fn(s)), []);

  const addMessage = useCallback((m: Message) => setState((s) => withMessage(s, m)), []);

  const newChat = useCallback(() => setState((s) => ({ ...s, activeChatId: null })), []);
  const openChat = useCallback(
    (id: string) =>
      setState((s) => {
        const c = s.chats.find((x) => x.id === id);
        return c ? { ...s, activeChatId: id, activeVehicleId: c.vehicleId } : s;
      }),
    [],
  );
  const renameChat = useCallback(
    (id: string, title: string) => setState((s) => ({ ...s, chats: s.chats.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c)) })),
    [],
  );
  const deleteChat = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        chats: s.chats.filter((c) => c.id !== id),
        messages: s.messages.filter((m) => m.chatId !== id),
        activeChatId: s.activeChatId === id ? null : s.activeChatId,
      })),
    [],
  );

  const patchMessage = useCallback(
    (id: string, patch: Partial<Message> | ((m: Message) => Message)) =>
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === id ? (typeof patch === "function" ? patch(m) : { ...m, ...patch }) : m)),
      })),
    [],
  );

  const resetAll = useCallback(async () => {
    try {
      const { keys } = await import("idb-keyval");
      const all = await keys(store());
      await Promise.all(all.map((k) => del(k, store())));
    } catch {
      /* ignore */
    }
    setState(initialState());
  }, []);

  const activeVehicle = useMemo(
    () => state.vehicles.find((v) => v.id === state.activeVehicleId) ?? state.vehicles[0] ?? null,
    [state.vehicles, state.activeVehicleId],
  );

  const vehicleChats = useMemo(
    () => state.chats.filter((c) => c.vehicleId === activeVehicle?.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.chats, activeVehicle?.id],
  );
  const activeChat = useMemo(
    () => state.chats.find((c) => c.id === state.activeChatId && c.vehicleId === activeVehicle?.id) ?? null,
    [state.chats, state.activeChatId, activeVehicle?.id],
  );

  const value = useMemo(
    () => ({ state, ready, update, activeVehicle, addMessage, patchMessage, resetAll, vehicleChats, activeChat, newChat, openChat, renameChat, deleteChat }),
    [state, ready, update, activeVehicle, addMessage, patchMessage, resetAll, vehicleChats, activeChat, newChat, openChat, renameChat, deleteChat],
  );
  return <MotzoCtx.Provider value={value}>{children}</MotzoCtx.Provider>;
}

export function useMotzo(): Ctx {
  const ctx = useContext(MotzoCtx);
  if (!ctx) throw new Error("useMotzo outside provider");
  return ctx;
}
