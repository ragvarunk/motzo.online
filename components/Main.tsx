"use client";

import { useEffect, useRef, useState } from "react";
import { useMotzo } from "@/lib/store";
import { cls, milesBetween, nowIso, uid, vehicleName } from "@/lib/util";
import { CameraSheet } from "./CameraSheet";
import { ChatList } from "./Chat";
import { useEngine } from "./ChatEngine";
import { Composer } from "./Composer";
import { GaragePanel, SettingsPanel } from "./Garage";
import { NewQuotePanel, QuotesPanel } from "./Quotes";
import { FloatingRobot, RobotFace } from "./Robot";
import { ShopDetailsPanel, ShopsPanel } from "./Shops";
import { Icon, Sheet, useMinWidth, useUi, type Panel } from "./ui";
import { VehicleForm } from "./VehicleForm";
import { VoiceMode } from "./VoiceMode";

/** The main screen: chat in the middle, panels beside it on wide screens or as sheets on phones. */
export function Main() {
  const { state, activeVehicle, update } = useMotzo();
  const ui = useUi();
  const wide = useMinWidth(1024);
  const chatRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<Panel[]>([]);
  const [vehicleMenu, setVehicleMenu] = useState(false);

  // Keep a little back-stack so "back" on a shop returns to the list.
  useEffect(() => {
    if (ui.panel) setHistory((h) => (h[h.length - 1] === ui.panel ? h : [...h.slice(-5), ui.panel!]));
    else setHistory([]);
  }, [ui.panel]);
  const back = () => {
    const prev = history[history.length - 2];
    if (prev) {
      setHistory((h) => h.slice(0, -2));
      ui.open(prev);
    } else ui.close();
  };

  useOilReminder();
  useMileCounter();

  const panel = ui.panel ? renderPanel(ui.panel, ui.close, back) : null;
  const openCount = state.quoteRequests.filter((r) => r.vehicleId === activeVehicle?.id && r.status === "collecting").length;

  return (
    <div className="flex h-dvh">
      {/* Left rail on wide screens */}
      <nav className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2">
          <RobotFace mood="idle" size={36} />
          <span className="text-xl font-extrabold tracking-tight">Motzo</span>
        </div>
        <p className="label">Vehicles</p>
        <div className="space-y-1">
          {state.vehicles.map((v) => (
            <button key={v.id} onClick={() => update((s) => ({ ...s, activeVehicleId: v.id }))} className={cls("w-full truncate rounded-xl px-3 py-2 text-left text-sm", v.id === activeVehicle?.id ? "bg-accent-soft font-semibold text-accent" : "hover:bg-surface-2")}>
              {vehicleName(v)}
            </button>
          ))}
          <button onClick={() => ui.open({ type: "vehicle" })} className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
            <Icon name="plus" className="h-4 w-4" /> Add vehicle
          </button>
        </div>
        <div className="mt-6 space-y-1">
          <NavItem icon="map" label="Shops near me" onClick={() => ui.open({ type: "shops" })} />
          <NavItem icon="quote" label="Quotes" badge={openCount} onClick={() => ui.open({ type: "quotes" })} />
          <NavItem icon="garage" label="My garage" onClick={() => ui.open({ type: "garage" })} />
          <NavItem icon="settings" label="Settings" onClick={() => ui.open({ type: "settings" })} />
        </div>
        <p className="mt-auto text-xs text-ink-3">Your data stays on this device. Shops see your details only after you accept a quote.</p>
      </nav>

      {/* Chat column */}
      <main ref={chatRef} className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 pt-[max(env(safe-area-inset-top),8px)] backdrop-blur">
          <div className="lg:hidden">
            <RobotFace mood="idle" size={32} />
          </div>
          <div className="relative min-w-0 flex-1">
            <button className="flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-surface-2" onClick={() => setVehicleMenu((x) => !x)}>
              <span className="truncate font-bold">{vehicleName(activeVehicle)}</span>
              <Icon name="back" className="h-4 w-4 shrink-0 -rotate-90 text-ink-3" />
            </button>
            {vehicleMenu && (
              <div className="pop-in absolute left-0 top-11 z-40 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
                {state.vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      update((s) => ({ ...s, activeVehicleId: v.id }));
                      setVehicleMenu(false);
                    }}
                    className={cls("block w-full truncate px-4 py-3 text-left text-sm hover:bg-surface-2", v.id === activeVehicle?.id && "font-semibold text-accent")}
                  >
                    {vehicleName(v)}
                  </button>
                ))}
                <button onClick={() => { setVehicleMenu(false); ui.open({ type: "vehicle" }); }} className="block w-full px-4 py-3 text-left text-sm text-ink-2 hover:bg-surface-2">
                  + Add vehicle
                </button>
              </div>
            )}
            <p className="px-1.5 text-xs text-ink-3">
              {[activeVehicle?.plate, activeVehicle?.mileage && `${activeVehicle.mileage.toLocaleString()} mi`].filter(Boolean).join(" · ") || "Tap to switch vehicles"}
            </p>
          </div>
          <div className="flex items-center lg:hidden">
            <HeaderBtn icon="map" label="Shops" onClick={() => ui.open({ type: "shops" })} />
            <HeaderBtn icon="quote" label="Quotes" badge={openCount} onClick={() => ui.open({ type: "quotes" })} />
            <HeaderBtn icon="garage" label="Garage" onClick={() => ui.open({ type: "garage" })} />
            <HeaderBtn icon="settings" label="Settings" onClick={() => ui.open({ type: "settings" })} />
          </div>
        </header>
        <SampleBanner />
        <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto">
          <ChatList />
        </div>
        <Composer />
        <FloatingRobot bounds={chatRef} motion={state.settings.robotMotion} size={state.settings.robotSize} hidden={ui.voiceOpen || !!ui.camera || (!wide && !!panel)} />
      </main>

      {/* Panels */}
      {panel && wide && <aside className="sheet-up w-[420px] shrink-0 overflow-hidden border-l border-line bg-surface xl:w-[480px]">{panel}</aside>}
      {panel && !wide && (
        <Sheet onClose={ui.close} wide>
          <div className="flex h-[90dvh] flex-col">{panel}</div>
        </Sheet>
      )}

      {ui.camera && <CameraSheet request={ui.camera} />}
      {ui.voiceOpen && <VoiceMode />}
    </div>
  );
}

function renderPanel(p: Panel, close: () => void, back: () => void) {
  switch (p.type) {
    case "shops":
      return <ShopsPanel key={`${p.shopType}-${p.searchText}`} shopType={p.shopType} searchText={p.searchText} onClose={close} />;
    case "shop":
      return <ShopDetailsPanel key={p.placeId} placeId={p.placeId} shopType={p.shopType} job={p.job} onClose={close} onBack={back} />;
    case "quotes":
      return <QuotesPanel requestId={p.requestId} onClose={close} />;
    case "newQuote":
      return <NewQuotePanel key={`${p.shopType}-${p.job}`} shopType={p.shopType} job={p.job} onClose={close} />;
    case "garage":
      return <GaragePanel key={p.tab} tab={p.tab} onClose={close} />;
    case "settings":
      return <SettingsPanel onClose={close} />;
    case "vehicle":
      return <VehiclePanel vehicleId={p.vehicleId} onClose={close} />;
  }
}

function VehiclePanel({ vehicleId, onClose }: { vehicleId?: string; onClose: () => void }) {
  const { state } = useMotzo();
  const v = state.vehicles.find((x) => x.id === vehicleId);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-lg font-bold">{v ? "Edit vehicle" : "Add a vehicle"}</h2>
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        <VehicleForm vehicle={v} onDone={onClose} onCancel={onClose} />
      </div>
    </div>
  );
}

function SampleBanner() {
  const { services } = useEngine();
  const [hide, setHide] = useState(false);
  if (services.ai || hide) return null;
  return (
    <div className="flex items-center gap-2 bg-warn/12 px-4 py-2 text-xs text-ink-2">
      <span className="flex-1">
        <span className="font-semibold text-warn">Sample mode.</span> The AI key isn&apos;t set on this server yet, so Motzo gives sample answers. Everything else works.
      </span>
      <button onClick={() => setHide(true)} aria-label="Hide">
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}

function NavItem({ icon, label, onClick, badge }: { icon: string; label: string; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
      <Icon name={icon} className="h-5 w-5 text-ink-2" />
      <span className="flex-1 text-left">{label}</span>
      {badge ? <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-ink">{badge}</span> : null}
    </button>
  );
}

function HeaderBtn({ icon, label, onClick, badge }: { icon: string; label: string; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label={label} title={label}>
      <Icon name={icon} />
      {badge ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent" /> : null}
    </button>
  );
}

/** Posts an oil change reminder in the chat when one is due (at most once a week per vehicle). */
function useOilReminder() {
  const { state, activeVehicle, addMessage } = useMotzo();
  useEffect(() => {
    const v = activeVehicle;
    if (!v?.mileage || !v.lastOilChangeMiles) return;
    const interval = v.oilIntervalMiles ?? 5000;
    const since = v.mileage - v.lastOilChangeMiles;
    if (since < interval - 500) return;
    const weekAgo = Date.now() - 7 * 864e5;
    const recent = state.messages.some((m) => m.vehicleId === v.id && m.cards?.some((c) => c.kind === "reminder") && new Date(m.at).getTime() > weekAgo);
    if (recent) return;
    addMessage({
      id: uid("m_"),
      vehicleId: v.id,
      author: "motzo",
      at: nowIso(),
      text: since >= interval ? "Heads up: your oil change is due." : "Your oil change is coming up soon.",
      cards: [{ kind: "reminder", milesSince: since, interval }],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVehicle?.id, activeVehicle?.mileage, activeVehicle?.lastOilChangeMiles, activeVehicle?.oilIntervalMiles]);
}

/** While the app is open and the owner switched it on, adds up distance driven. Only miles are kept, never places. */
function useMileCounter() {
  const { state, activeVehicle, update } = useMotzo();
  const on = state.settings.countMiles;
  const vid = activeVehicle?.id;
  useEffect(() => {
    if (!on || !vid || !("geolocation" in navigator)) return;
    let last: { lat: number; lng: number } | null = null;
    let pending = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (p.coords.accuracy > 60) return;
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (last) {
          const d = milesBetween(last, here);
          if (d < 0.02) return; // ignore drift
          if (d < 5) pending += d;
        }
        last = here;
        if (pending >= 0.5) {
          const add = Math.floor(pending);
          const frac = pending - add;
          const whole = add || 0;
          if (whole > 0) {
            pending = frac;
            update((s) => ({
              ...s,
              vehicles: s.vehicles.map((v) => (v.id === vid && v.mileage ? { ...v, mileage: v.mileage + whole, mileageUpdatedAt: nowIso() } : v)),
              mileageLog: [...s.mileageLog, { vehicleId: vid, at: nowIso(), miles: (s.vehicles.find((v) => v.id === vid)?.mileage ?? 0) + whole, source: "phone" }],
            }));
          }
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on, vid, update]);
}
