"use client";

// Keeps a signed-in owner's data in their account, so their vehicles, chats,
// quotes and photos follow them to every device. Nothing here is ever shared
// with shops: the account row and file folder can only be read by the owner.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { getFile, localFileIds, normalizeState, setRemoteFileLoader, useMotzo } from "./store";
import type { MotzoState } from "./types";

export type SyncStatus = "off" | "syncing" | "saved" | "offline" | "error";

interface SyncCtx {
  status: SyncStatus;
  lastSaved: string | null;
  /** The account whose data this device has loaded, once loading is done. */
  linkedTo: string | null;
  /** Saves anything still waiting, then resolves. Used before signing out. */
  flush: () => Promise<void>;
}

const Ctx = createContext<SyncCtx>({ status: "off", lastSaved: null, linkedTo: null, flush: async () => undefined });

const TABLE = "motzo_accounts";
const BUCKET = "motzo-files";
const OWNER_KEY = "motzo-device-owner";

function deviceId(): string {
  try {
    let id = localStorage.getItem("motzo-device-id");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("motzo-device-id", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function hasData(s: MotzoState) {
  return s.vehicles.length > 0 || s.messages.length > 0;
}

function unionBy<T>(a: T[], b: T[], key: (x: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const x of a) seen.set(key(x), x);
  for (const x of b) if (!seen.has(key(x))) seen.set(key(x), x);
  return [...seen.values()];
}

/** Puts what's on this device together with what's in the account, keeping both. */
export function mergeStates(account: MotzoState, device: MotzoState): MotzoState {
  const pick = (a: string, b: string) => (a?.trim() ? a : b);
  const messages = unionBy(account.messages, device.messages, (m) => m.id).sort((x, y) => x.at.localeCompare(y.at));
  return {
    ...account,
    startedAt: [account.startedAt, device.startedAt].filter(Boolean).sort()[0] ?? null,
    owner: {
      name: pick(account.owner.name, device.owner.name),
      phone: pick(account.owner.phone, device.owner.phone),
      email: pick(account.owner.email, device.owner.email),
      area: pick(account.owner.area, device.owner.area),
    },
    vehicles: unionBy(account.vehicles, device.vehicles, (v) => v.id),
    activeVehicleId: account.activeVehicleId ?? device.activeVehicleId,
    insurance: unionBy(account.insurance, device.insurance, (i) => i.id),
    messages,
    chats: unionBy(account.chats, device.chats, (c) => c.id),
    activeChatId: device.activeChatId ?? account.activeChatId,
    quoteRequests: unionBy(account.quoteRequests, device.quoteRequests, (r) => r.id),
    jobs: unionBy(account.jobs, device.jobs, (j) => j.id),
    sharing: unionBy(account.sharing, device.sharing, (x) => x.id),
    savedShops: unionBy(account.savedShops, device.savedShops, (x) => x.placeId),
    mileageLog: unionBy(account.mileageLog, device.mileageLog, (x) => `${x.vehicleId}|${x.at}`),
    issues: unionBy(account.issues ?? [], device.issues ?? [], (x) => x.id),
  };
}

/** What goes to the account: everything except short-lived caches. */
function forAccount(s: MotzoState): MotzoState {
  return { ...s, lastShops: [], lastShopSearch: null };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { client, user, status: authStatus } = useAuth();
  const { state, ready, replaceState } = useMotzo();
  const [status, setStatus] = useState<SyncStatus>("off");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [linkedTo, setLinkedTo] = useState<string | null>(null);
  const linked = useRef<string | null>(null); // user id whose data this device now mirrors
  const lastPushed = useRef<string>("");
  const lastSeen = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pushing = useRef<Promise<void> | null>(null);
  const uploading = useRef(false);

  const uid = user?.id ?? null;

  // Files: read from the account when this device doesn't have them.
  useEffect(() => {
    if (!client || !uid) {
      setRemoteFileLoader(null);
      return;
    }
    setRemoteFileLoader(async (id) => {
      const { data, error } = await client.storage.from(BUCKET).download(`${uid}/${id}`);
      return error ? undefined : data;
    });
    return () => setRemoteFileLoader(null);
  }, [client, uid]);

  const uploadFiles = useCallback(async () => {
    if (!client || !uid || uploading.current) return;
    uploading.current = true;
    try {
      const key = `motzo-uploaded-${uid}`;
      let done: string[] = [];
      try {
        done = JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        done = [];
      }
      const todo = (await localFileIds()).filter((id) => !done.includes(id));
      for (const id of todo) {
        const blob = await getFile(id);
        if (!blob) continue;
        const { error } = await client.storage.from(BUCKET).upload(`${uid}/${id}`, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
        if (!error || /exists/i.test(error.message)) {
          done.push(id);
          try {
            localStorage.setItem(key, JSON.stringify(done));
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      uploading.current = false;
    }
  }, [client, uid]);

  const push = useCallback(async () => {
    if (!client || !uid || linked.current !== uid) return;
    const body = forAccount(stateRef.current);
    const json = JSON.stringify(body);
    if (json === lastPushed.current) return;
    setStatus("syncing");
    const at = new Date().toISOString();
    const { error } = await client.from(TABLE).upsert({ user_id: uid, state: body, device_id: deviceId(), updated_at: at });
    if (error) {
      setStatus(navigator.onLine ? "error" : "offline");
      return;
    }
    lastPushed.current = json;
    lastSeen.current = at;
    setLastSaved(at);
    setStatus("saved");
    void uploadFiles();
  }, [client, uid, uploadFiles]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (pushing.current) await pushing.current;
    pushing.current = push();
    await pushing.current;
    pushing.current = null;
  }, [push]);

  // First load after signing in: bring the account and this device together.
  useEffect(() => {
    if (!ready || !client) return;
    if (authStatus !== "signed_in" || !uid) {
      linked.current = null;
      setLinkedTo(null);
      setStatus(authStatus === "signed_out" || authStatus === "off" ? "off" : "syncing");
      return;
    }
    if (linked.current === uid) return;
    let cancelled = false;
    (async () => {
      setStatus("syncing");
      const { data, error } = await client.from(TABLE).select("state, updated_at").eq("user_id", uid).maybeSingle();
      if (cancelled) return;
      if (error) {
        setStatus(navigator.onLine ? "error" : "offline");
        return;
      }
      let owner: string | null = null;
      try {
        owner = localStorage.getItem(OWNER_KEY);
      } catch {
        /* ignore */
      }
      const device = stateRef.current;
      // Device data belongs to this owner if it was made here while signed out, or by them before.
      const deviceIsTheirs = !owner || owner === uid;
      let next: MotzoState;
      if (data?.state) {
        const account = normalizeState(data.state as MotzoState);
        next = deviceIsTheirs && hasData(device) ? mergeStates(account, device) : account;
        lastSeen.current = data.updated_at as string;
      } else {
        next = deviceIsTheirs ? device : normalizeState(null);
      }
      try {
        localStorage.setItem(OWNER_KEY, uid);
      } catch {
        /* ignore */
      }
      linked.current = uid;
      setLinkedTo(uid);
      if (next !== device) replaceState(next);
      stateRef.current = next;
      lastPushed.current = data?.state ? JSON.stringify(forAccount(normalizeState(data.state as MotzoState))) : "";
      await push();
      if (!cancelled) setStatus("saved");
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, client, uid, authStatus, replaceState, push]);

  // Every change is saved to the account a moment later.
  useEffect(() => {
    if (!uid || linked.current !== uid) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1500);
  }, [state, uid, flush]);

  // Picks up changes made on another device when the owner comes back to this one.
  useEffect(() => {
    if (!client || !uid) return;
    const check = async () => {
      if (document.visibilityState !== "visible" || linked.current !== uid) return;
      if (JSON.stringify(forAccount(stateRef.current)) !== lastPushed.current) return; // local edits win; they save next
      const { data } = await client.from(TABLE).select("state, updated_at, device_id").eq("user_id", uid).maybeSingle();
      if (!data || data.device_id === deviceId() || (data.updated_at as string) <= lastSeen.current) return;
      const account = normalizeState(data.state as MotzoState);
      lastSeen.current = data.updated_at as string;
      lastPushed.current = JSON.stringify(forAccount(account));
      replaceState({ ...account, activeVehicleId: stateRef.current.activeVehicleId ?? account.activeVehicleId, activeChatId: stateRef.current.activeChatId, lastShops: stateRef.current.lastShops });
    };
    const onVis = () => void check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    const every = setInterval(onVis, 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      clearInterval(every);
    };
  }, [client, uid, replaceState]);

  const value = useMemo(() => ({ status, lastSaved, linkedTo, flush }), [status, lastSaved, linkedTo, flush]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync() {
  return useContext(Ctx);
}

/** Forgets which account this device's data belonged to (after signing out and clearing it). */
export function forgetDeviceOwner() {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* ignore */
  }
}
