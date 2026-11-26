"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMotzo } from "@/lib/store";
import { forgetDeviceOwner, useSync } from "@/lib/sync";
import { cls, fullStamp } from "@/lib/util";
import { Icon, PanelHeader, Portal } from "./ui";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Sign up and sign in are the same step: the owner types their email, gets a
 * one-time code (or taps the link in the email), and they're in. A new email
 * makes a new account. Google is offered when it's switched on.
 */
export function AuthForm({ onDone, title = true }: { onDone?: () => void; title?: boolean }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    if (auth.status === "signed_in") onDone?.();
  }, [auth.status, onDone]);

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await auth.sendCode(email);
    setBusy(false);
    if (err) return setError(err);
    setStep("code");
    setWait(30);
  };

  const verify = async () => {
    if (code.replace(/\D/g, "").length < 6) {
      setError("Enter the code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await auth.verifyCode(email, code);
    setBusy(false);
    if (err) setError(err);
  };

  if (auth.status === "off") {
    return (
      <div className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
        <p className="font-semibold text-ink">Accounts are almost ready</p>
        <p className="mt-1">Sign-in isn&apos;t switched on for this site yet. Until it is, everything you add is saved on this device.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title && (
        <div>
          <h3 className="text-lg font-bold">{step === "email" ? "Sign in or create an account" : "Check your email"}</h3>
          <p className="text-sm text-ink-2">
            {step === "email" ? "Your garage, chats and photos follow you to every device." : (
              <>
                We sent a sign-in code to <span className="font-semibold text-ink">{email.trim()}</span>. Type it here, or tap the link in the email.
              </>
            )}
          </p>
        </div>
      )}

      {step === "email" ? (
        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {auth.google && (
            <>
              <button
                type="button"
                className="btn btn-ghost w-full !bg-surface-solid text-ink"
                disabled={busy}
                onClick={async () => {
                  setError(null);
                  const err = await auth.signInWithGoogle();
                  if (err) setError(err);
                }}
              >
                <GoogleMark /> Continue with Google
              </button>
              <div className="flex items-center gap-3 text-xs text-ink-3">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <label className="label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="field"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-primary w-full" disabled={busy || auth.status === "loading"}>
            {busy ? "Sending…" : "Continue with email"}
          </button>
        </form>
      ) : (
        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <label className="label" htmlFor="auth-code">
            Sign-in code
          </label>
          <input
            id="auth-code"
            className="field text-center font-mono text-xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
            autoFocus
          />
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-ink-2 hover:text-ink" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
              Use another email
            </button>
            <button type="button" className="font-semibold text-accent disabled:text-ink-3" disabled={wait > 0 || busy} onClick={() => void send()}>
              {wait > 0 ? `Send again in ${wait}s` : "Send a new code"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-ink-3">
        <Icon name="lock" className="mt-px h-3.5 w-3.5 shrink-0" />
        Only you can see your account. Shops never get your details until you accept a quote.
      </p>
    </div>
  );
}

export function SyncLine({ className }: { className?: string }) {
  const sync = useSync();
  const text =
    sync.status === "syncing"
      ? "Saving to your account…"
      : sync.status === "saved"
        ? "Saved to your account"
        : sync.status === "offline"
          ? "Offline: changes save when you're back online"
          : sync.status === "error"
            ? "Couldn't save to your account just now"
            : "";
  if (!text) return null;
  return (
    <p className={cls("flex items-center gap-1.5 text-xs", sync.status === "error" ? "text-bad" : sync.status === "offline" ? "text-warn" : "text-ink-3", className)}>
      <span className={cls("h-1.5 w-1.5 rounded-full", sync.status === "saved" ? "bg-good" : sync.status === "syncing" ? "animate-pulse bg-accent" : "bg-current")} />
      {text}
    </p>
  );
}

/** Account panel: sign in when signed out; who you are, sync and sign out when signed in. */
export function AccountPanel({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const sync = useSync();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Account" onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {auth.status === "signed_in" && auth.user ? (
          <>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Signed in as</p>
              <p className="mt-1 break-all text-lg font-semibold">{auth.user.email}</p>
              <SyncLine className="mt-2" />
              {sync.lastSaved && <p className="mt-1 text-xs text-ink-3">Last saved {fullStamp(sync.lastSaved)}</p>}
            </div>
            <div className="card space-y-2 p-4 text-sm text-ink-2">
              <p className="flex gap-2">
                <Icon name="check" className="h-4 w-4 shrink-0 text-good" /> Your vehicles, chats, quotes, insurance and photos are saved to your account.
              </p>
              <p className="flex gap-2">
                <Icon name="check" className="h-4 w-4 shrink-0 text-good" /> Sign in on any phone or computer to pick up where you left off.
              </p>
              <p className="flex gap-2">
                <Icon name="lock" className="h-4 w-4 shrink-0 text-accent" /> Only you can see it. Shops get your name and phone only after you accept a quote.
              </p>
            </div>
            <button className="btn btn-ghost w-full" onClick={() => setConfirm(true)}>
              <Icon name="logout" className="h-4 w-4" /> Sign out
            </button>
          </>
        ) : (
          <div className="card p-4">
            <AuthForm />
          </div>
        )}
      </div>
      {confirm && <SignOutDialog onCancel={() => setConfirm(false)} />}
    </div>
  );
}

/**
 * Signing out saves anything still waiting, then clears this device, so the
 * next person using it sees nothing of yours. Everything stays in the account.
 */
export function SignOutDialog({ onCancel }: { onCancel: () => void }) {
  const auth = useAuth();
  const sync = useSync();
  const { resetAll } = useMotzo();
  const [busy, setBusy] = useState(false);
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={onCancel}>
        <div onClick={(e) => e.stopPropagation()} className="pop-in glass-strong w-full max-w-sm rounded-3xl p-5 shadow-2xl" role="alertdialog" aria-labelledby="so-t">
          <h2 id="so-t" className="text-lg font-bold">Sign out of Motzo?</h2>
          <p className="mt-2 text-sm text-ink-2">Everything stays saved in your account. This device is cleared, so sign back in to see your garage and chats here again.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await sync.flush().catch(() => undefined);
                await auth.signOut();
                forgetDeviceOwner();
                await resetAll();
              }}
            >
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
