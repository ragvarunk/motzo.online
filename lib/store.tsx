"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createStore, del, get, set } from "idb-keyval";
import type { MotzoState, Message, Vehicle } from "./types";

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
  quoteRequests: [],
  jobs: [],
  sharing: [],
  savedShops: [],
  lastShops: [],
  lastShopSearch: null,
  settings: { speakAnswers: false, robotMotion: "full", robotSize: "normal", countMiles: false },
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
          setState({ ...base, ...saved, settings: { ...base.settings, ...saved.settings }, owner: { ...base.owner, ...saved.owner } });
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

  const addMessage = useCallback((m: Message) => setState((s) => ({ ...s, messages: [...s.messages, m] })), []);

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

  const value = useMemo(
    () => ({ state, ready, update, activeVehicle, addMessage, patchMessage, resetAll }),
    [state, ready, update, activeVehicle, addMessage, patchMessage, resetAll],
  );
  return <MotzoCtx.Provider value={value}>{children}</MotzoCtx.Provider>;
}

export function useMotzo(): Ctx {
  const ctx = useContext(MotzoCtx);
  if (!ctx) throw new Error("useMotzo outside provider");
  return ctx;
}
