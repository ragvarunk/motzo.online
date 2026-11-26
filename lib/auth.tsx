"use client";

// Accounts. Sign-in runs on Supabase Auth: a one-time code by email, or Google.
// The server tells the app the project address and its public key at run
// time (/api/auth/config), so accounts switch on as soon as the keys are in
// Vercel. Without them the app keeps working with everything on this device.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "off" | "signed_out" | "signed_in";

interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  client: SupabaseClient | null;
  /** Google sign-in is switched on in the auth project. */
  google: boolean;
  sendCode: (email: string) => Promise<string | null>;
  verifyCode: (email: string, code: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

let cached: SupabaseClient | null = null;

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) return "That code didn't work. Check it, or send a new one.";
  if (m.includes("email") && m.includes("valid")) return "That email address doesn't look right.";
  if (m.includes("provider") && m.includes("not enabled")) return "Google sign-in isn't switched on yet. Use your email instead.";
  if (m.includes("fetch") || m.includes("network")) return "Couldn't reach the sign-in service. Check your connection.";
  return "Something went wrong signing in. Try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(cached);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((cfg: { url: string | null; key: string | null }) => {
        if (cancelled) return;
        if (!cfg.url || !cfg.key) {
          setStatus("off");
          return;
        }
        cached ??= createClient(cfg.url, cfg.key, {
          auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "motzo-auth" },
        });
        setClient(cached);
        fetch(`${cfg.url}/auth/v1/settings`, { headers: { apikey: cfg.key } })
          .then((r) => r.json())
          .then((st: { external?: Record<string, boolean> }) => !cancelled && setGoogle(Boolean(st.external?.google)))
          .catch(() => undefined);
      })
      .catch(() => !cancelled && setStatus("off"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      setStatus(data.session ? "signed_in" : "signed_out");
      // Clean the sign-in code out of the address bar after a Google or email-link return.
      if (data.session && /[?&]code=|access_token=/.test(window.location.href)) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session ? "signed_in" : "signed_out");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const sendCode = useCallback(
    async (email: string) => {
      if (!client) return "Sign-in isn't set up yet.";
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
      });
      return error ? friendly(error.message) : null;
    },
    [client],
  );

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      if (!client) return "Sign-in isn't set up yet.";
      const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.replace(/\s+/g, ""), type: "email" });
      return error ? friendly(error.message) : null;
    },
    [client],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!client) return "Sign-in isn't set up yet.";
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    return error ? friendly(error.message) : null;
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    setUser(null);
    setStatus("signed_out");
  }, [client]);

  const value = useMemo(
    () => ({ status, user, client, google, sendCode, verifyCode, signInWithGoogle, signOut }),
    [status, user, client, google, sendCode, verifyCode, signInWithGoogle, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}

/** The name to greet a signed-in owner by, from their Google profile or email. */
export function accountName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as { full_name?: string; name?: string; given_name?: string } | undefined;
  return meta?.given_name || (meta?.full_name || meta?.name || "").split(" ")[0] || "";
}
