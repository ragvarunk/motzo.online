"use client";

// Small fetch helper: adds the testing access code when one is set.

const CODE_KEY = "motzo-access-code";

export function getAccessCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    /* private mode: the code lasts for this visit only */
  }
  memoryCode = code;
}

let memoryCode = "";

export class AccessCodeNeeded extends Error {}

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const code = getAccessCode() || memoryCode;
  if (code) headers.set("x-motzo-access", code);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => null);
    if (body?.error === "access_code") {
      window.dispatchEvent(new CustomEvent("motzo:access-code"));
      throw new AccessCodeNeeded("access code needed");
    }
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await api(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  return body as T;
}

export interface ServiceStatus {
  ai: boolean;
  model: string | null;
  maps: boolean;
  mapEmbed: boolean;
  voice: boolean;
  accessCode: boolean;
}
