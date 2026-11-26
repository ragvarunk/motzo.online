"use client";

import { useEffect, useState } from "react";
import { setAccessCode, type ServiceStatus } from "@/lib/api";
import { MotzoProvider, useMotzo } from "@/lib/store";
import { ChatEngineProvider, useEngine } from "@/components/ChatEngine";
import { Main } from "@/components/Main";
import { RobotFace, RobotProvider } from "@/components/Robot";
import { UiProvider } from "@/components/ui";
import { VehicleForm } from "@/components/VehicleForm";
import { CameraSheet } from "@/components/CameraSheet";
import { Icon, useUi } from "@/components/ui";

export default function Page() {
  return (
    <MotzoProvider>
      <RobotProvider>
        <UiProvider>
          <ChatEngineProvider>
            <App />
          </ChatEngineProvider>
        </UiProvider>
      </RobotProvider>
    </MotzoProvider>
  );
}

function App() {
  const { ready, state } = useMotzo();
  const { setServices } = useEngine();
  const [needCode, setNeedCode] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: ServiceStatus) => setServices({ ai: s.ai, maps: s.maps, voice: s.voice, mapEmbed: s.mapEmbed }))
      .catch(() => undefined);
    const onCode = () => setNeedCode(true);
    window.addEventListener("motzo:access-code", onCode);
    return () => window.removeEventListener("motzo:access-code", onCode);
  }, [setServices]);

  if (!ready) {
    return (
      <div className="grid h-dvh place-items-center">
        <RobotFace mood="thinking" size={72} />
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

function Welcome() {
  const [step, setStep] = useState<"hello" | "vehicle">("hello");
  const ui = useUi();
  const { state, update } = useMotzo();
  return (
    <div className="min-h-dvh px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-xl">
        {step === "hello" ? (
          <div className="rise flex flex-col items-center text-center">
            <RobotFace mood="happy" size={130} />
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Meet Motzo</h1>
            <p className="mt-2 text-lg text-ink-2">Your vehicle&apos;s own AI helper.</p>
            <ul className="mt-6 space-y-3 text-left text-[15px]">
              {[
                ["camera", "Send a photo or point the camera. Motzo tells you what's wrong, what it should cost, and which kind of shop fixes it."],
                ["map", "See the right shops near you, with ratings, reviews and whether they come to you."],
                ["quote", "Motzo asks several shops the same questions and lines up their quotes. No phone calls."],
                ["lock", "Your name and phone stay private until you accept a quote."],
              ].map(([icon, text]) => (
                <li key={icon} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon name={icon} className="h-5 w-5" />
                  </span>
                  <span className="pt-1.5 text-ink-2">{text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 w-full max-w-xs text-left">
              <label className="label" htmlFor="w-name">What should I call you?</label>
              <input
                id="w-name"
                className="field"
                placeholder="Your first name"
                autoComplete="given-name"
                value={state.owner.name}
                onChange={(e) => update((s) => ({ ...s, owner: { ...s.owner, name: e.target.value } }))}
              />
            </div>
            <button className="btn btn-primary mt-3 w-full max-w-xs text-base" onClick={() => setStep("vehicle")}>
              Add my vehicle
            </button>
            <p className="mt-3 text-xs text-ink-3">No sign-up needed. Everything is saved on this device.</p>
          </div>
        ) : (
          <div className="rise">
            <div className="mb-5 flex items-center gap-3">
              <RobotFace mood="idle" size={52} />
              <div>
                <h1 className="text-2xl font-bold">Your vehicle</h1>
                <p className="text-sm text-ink-2">Type the VIN or scan it and I&apos;ll fill in the rest.</p>
              </div>
            </div>
            <VehicleForm onDone={() => undefined} onCancel={() => setStep("hello")} />
          </div>
        )}
      </div>
      {ui.camera && <CameraSheet request={ui.camera} />}
    </div>
  );
}

function AccessCode({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4">
      <form
        className="card w-full max-w-sm space-y-3 p-5"
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
