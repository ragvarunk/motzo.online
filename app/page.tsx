"use client";

import { useEffect, useState } from "react";
import { setAccessCode, type ServiceStatus } from "@/lib/api";
import { MotzoProvider, useMotzo } from "@/lib/store";
import { accountName, AuthProvider, useAuth } from "@/lib/auth";
import { SyncProvider, useSync } from "@/lib/sync";
import { AuthForm } from "@/components/Account";
import { EagleAvatar } from "@/components/Eagle";
import { ChatEngineProvider, useEngine } from "@/components/ChatEngine";
import { Main } from "@/components/Main";
import { RobotFace, RobotProvider } from "@/components/Robot";
import { UiProvider } from "@/components/ui";
import { VehicleForm } from "@/components/VehicleForm";
import { CameraSheet } from "@/components/CameraSheet";
import { Icon, useUi } from "@/components/ui";

export default function Page() {
  return (
    <AuthProvider>
      <MotzoProvider>
        <SyncProvider>
          <RobotProvider>
            <UiProvider>
              <ChatEngineProvider>
                <App />
              </ChatEngineProvider>
            </UiProvider>
          </RobotProvider>
        </SyncProvider>
      </MotzoProvider>
    </AuthProvider>
  );
}

function App() {
  const { ready, state } = useMotzo();
  const auth = useAuth();
  const sync = useSync();
  const { setServices } = useEngine();
  const [needCode, setNeedCode] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: ServiceStatus) => setServices({ ai: s.ai, maps: s.maps, voice: s.voice, mapEmbed: s.mapEmbed, known: true }))
      .catch(() => undefined);
    const onCode = () => setNeedCode(true);
    window.addEventListener("motzo:access-code", onCode);
    return () => window.removeEventListener("motzo:access-code", onCode);
  }, [setServices]);

  // Wait for a signed-in owner's account to load, so the welcome page doesn't flash first.
  const loadingAccount =
    auth.status === "signed_in" && sync.linkedTo !== auth.user?.id && sync.status !== "error" && sync.status !== "offline" && state.vehicles.length === 0;

  if (!ready || auth.status === "loading" || loadingAccount) {
    return (
      <div className="grid h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <RobotFace mood="thinking" size={72} />
          {loadingAccount && <p className="text-sm text-ink-2">Loading your garage…</p>}
        </div>
      </div>
    );
  }
  return (
    <>
      {state.vehicles.length === 0 ? <Welcome /> : <Main />}
      {needCode && <AccessCode onDone={() => setNeedCode(false)} />}
    </>
  );
}

const FEATURES: [string, string, string][] = [
  ["camera", "Snap it, understand it", "Send a photo or point the camera. Motzo explains what it sees, how serious it is and what it should cost."],
  ["shield", "Know if it's safe", "A clear call on whether you can keep driving, and how soon it needs fixing."],
  ["quote", "Quotes without calls", "Motzo asks several shops the same questions and lines up their answers side by side."],
  ["lock", "Private until you choose", "Shops never see your name or phone until you accept a quote."],
];

function Welcome() {
  const ui = useUi();
  const auth = useAuth();
  const { state, update } = useMotzo();
  const signedIn = auth.status === "signed_in";
  const [mode, setMode] = useState<"start" | "signin" | "vehicle">(signedIn ? "vehicle" : "start");
  const greetName = state.owner.name || accountName(auth.user);

  useEffect(() => {
    if (signedIn && mode === "signin") setMode("vehicle");
  }, [signedIn, mode]);

  useEffect(() => {
    // A Google sign-in gives us a first name: use it when the owner hasn't typed one.
    const n = accountName(auth.user);
    if (n && !state.owner.name) update((s) => ({ ...s, owner: { ...s.owner, name: n } }));
  }, [auth.user, state.owner.name, update]);

  return (
    <div className="relative min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-4 pt-[max(env(safe-area-inset-top),16px)] sm:px-6 lg:px-8">
        <EagleAvatar size={34} />
        <span className="flex-1 text-xl font-extrabold tracking-tight">Motzo</span>
        {auth.status === "signed_out" && mode !== "signin" && (
          <button className="btn glass !min-h-10 px-4 text-sm text-ink" onClick={() => setMode("signin")}>
            Sign in
          </button>
        )}
        {signedIn && <span className="glass truncate rounded-full px-3 py-1.5 text-xs text-ink-2">{auth.user?.email}</span>}
      </header>

      {mode === "vehicle" ? (
        <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
          <div className="glass-strong rise rounded-[28px] p-5 shadow-[0_30px_80px_-30px_rgba(15,23,41,0.35)] sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <RobotFace mood="idle" size={52} />
              <div>
                <h1 className="text-2xl font-bold">{greetName ? `${greetName}, add your vehicle` : "Add your vehicle"}</h1>
                <p className="text-sm text-ink-2">Type the VIN or scan it and I&apos;ll fill in the rest.</p>
              </div>
            </div>
            <VehicleForm onDone={() => undefined} onCancel={() => setMode(signedIn ? "vehicle" : "start")} />
          </div>
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-12 lg:px-8 lg:pt-16">
          <section className="rise">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-2">
              <span className="h-2 w-2 rounded-full bg-good" /> Your vehicle&apos;s personal AI expert
            </span>
            <h1 className="mt-5 text-[2.15rem] font-extrabold leading-[1.06] min-[400px]:text-[2.4rem] tracking-tight sm:text-6xl lg:text-[3rem] xl:text-[3.3rem]">
              Snap a photo.
              <span className="block bg-gradient-to-r from-[#2f5bff] via-[#7a4dff] to-[#14b8b8] bg-clip-text text-transparent">Know what&apos;s wrong.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-2 sm:text-xl">
              Motzo looks at your car, tells you how serious it is and what it should cost, then gets quotes from the right shops near you.
            </p>
            <div className="mt-7 hidden gap-3 lg:grid lg:grid-cols-2">
              {FEATURES.map(([icon, title, text]) => (
                <Feature key={icon} icon={icon} title={title} text={text} />
              ))}
            </div>
          </section>

          <section className="rise lg:justify-self-end lg:w-full lg:max-w-md">
            <div className="glass-strong rounded-[28px] p-5 shadow-[0_30px_80px_-30px_rgba(15,23,41,0.35)] sm:p-7">
              {mode === "signin" ? (
                <>
                  <AuthForm />
                  <button className="mt-4 text-sm font-semibold text-ink-2 hover:text-ink" onClick={() => setMode("start")}>
                    ← Back
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <RobotFace mood="happy" size={64} />
                    <div>
                      <h2 className="text-xl font-bold">Hi, I&apos;m Motzo</h2>
                      <p className="text-sm text-ink-2">Let&apos;s set up your garage. It takes a minute.</p>
                    </div>
                  </div>
                  <label className="label mt-5" htmlFor="w-name">
                    What should I call you?
                  </label>
                  <input
                    id="w-name"
                    className="field"
                    placeholder="Your first name"
                    autoComplete="given-name"
                    value={state.owner.name}
                    onChange={(e) => update((s) => ({ ...s, owner: { ...s.owner, name: e.target.value } }))}
                    onKeyDown={(e) => e.key === "Enter" && setMode("vehicle")}
                  />
                  <button className="btn btn-primary mt-3 w-full text-base" onClick={() => setMode("vehicle")}>
                    Add my vehicle
                  </button>
                  {auth.status === "signed_out" ? (
                    <>
                      <div className="my-4 flex items-center gap-3 text-xs text-ink-3">
                        <span className="h-px flex-1 bg-line" /> Already use Motzo? <span className="h-px flex-1 bg-line" />
                      </div>
                      <button className="btn btn-ghost w-full" onClick={() => setMode("signin")}>
                        Sign in to your account
                      </button>
                      <p className="mt-3 text-center text-xs text-ink-3">You can start now and sign in later to save your garage to an account.</p>
                    </>
                  ) : (
                    <p className="mt-3 text-center text-xs text-ink-3">No sign-up needed. Everything is saved on this device.</p>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {FEATURES.map(([icon, title, text]) => (
              <Feature key={icon} icon={icon} title={title} text={text} />
            ))}
          </section>

          <section className="lg:col-span-2">
            <ReportPreview />
          </section>
        </main>
      )}
      {ui.camera && <CameraSheet request={ui.camera} />}
    </div>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="glass flex gap-3 rounded-2xl p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-2">{text}</span>
      </span>
    </div>
  );
}

/** A worked example of what a photo answer looks like, so new owners know what to expect. */
function ReportPreview() {
  return (
    <div className="glass grid gap-6 rounded-[28px] p-5 sm:p-7 md:grid-cols-[0.9fr_1.1fr] md:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">How it helps</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">One photo, a clear answer</h2>
        <ol className="mt-4 space-y-3 text-[15px] text-ink-2">
          {[
            ["Snap or upload", "A photo, a short video, or a picture of a warning light."],
            ["Motzo explains", "What it sees, the likely problem, whether it's safe to drive and a fair price range."],
            ["You choose the next step", "See the right shops, get quotes, or save it to your car's record."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">{i + 1}</span>
              <span>
                <span className="font-semibold text-ink">{t}.</span> {d}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="glass-strong rounded-3xl p-4 sm:p-5" aria-label="Example photo answer">
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#8db3d6] to-[#2d3e50]">
            <svg viewBox="0 0 80 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <path d="M10 50 L34 30 L46 36 L70 14" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <path d="M34 30 L30 18" stroke="white" strokeWidth="1.1" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Photo report · Example</p>
            <p className="font-semibold">Windshield crack from the edge</p>
            <p className="text-sm text-ink-2">About 10 inches, driver&apos;s side</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-warn/12 px-3 py-2.5 text-sm font-semibold text-warn">
          <Icon name="shield" className="h-4 w-4" /> Drive carefully. Replace it this week.
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["$350–750", "Typical cost"],
            ["Auto glass", "Shop type"],
            ["Today", "Often possible"],
          ].map(([v, k]) => (
            <div key={k} className="rounded-2xl bg-surface-2 px-2 py-2.5">
              <p className="text-sm font-bold sm:text-base">{v}</p>
              <p className="text-[11px] text-ink-3">{k}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="btn btn-primary !min-h-9 px-3.5 text-sm">Get quotes</span>
          <span className="btn btn-ghost !min-h-9 px-3.5 text-sm">See shops</span>
        </div>
      </div>
    </div>
  );
}

function AccessCode({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4">
      <form
        className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setAccessCode(code.trim());
          onDone();
        }}
      >
        <h2 className="text-lg font-bold">Testing access code</h2>
        <p className="text-sm text-ink-2">This test version is private. Enter the access code to use Motzo&apos;s AI.</p>
        <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" aria-label="Access code" />
        <button className="btn btn-primary w-full">Continue</button>
      </form>
    </div>
  );
}
