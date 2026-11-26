"use client";

import { useState } from "react";
import { getAccessCode, setAccessCode } from "@/lib/api";
import { useMotzo } from "@/lib/store";
import type { InsurancePolicy, Message } from "@/lib/types";
import { cls, fullStamp, money, nowIso, uid, vehicleName } from "@/lib/util";
import { useEngine } from "./ChatEngine";
import { VehicleForm } from "./VehicleForm";
import { Icon, PanelHeader, useUi, type Panel } from "./ui";

type Tab = NonNullable<Extract<Panel, { type: "garage" }>["tab"]>;
const TABS: [Tab, string][] = [
  ["vehicles", "Vehicles"],
  ["insurance", "Insurance"],
  ["reminders", "Oil & miles"],
  ["history", "Service history"],
  ["record", "Conversation record"],
  ["privacy", "Privacy"],
];

/** The owner's profile: vehicles, insurance, reminders, history, the full record, and what's been shared. */
export function GaragePanel({ tab: tabIn = "vehicles", onClose }: { tab?: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(tabIn);
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="My garage" subtitle="Saved on this device" onClose={onClose} />
      <div className="scroll-thin flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
        {TABS.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={cls("shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold", tab === t ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2")}>
            {label}
          </button>
        ))}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        {tab === "vehicles" && <Vehicles />}
        {tab === "insurance" && <Insurance />}
        {tab === "reminders" && <Reminders />}
        {tab === "history" && <History />}
        {tab === "record" && <Record />}
        {tab === "privacy" && <Privacy />}
      </div>
    </div>
  );
}

function Vehicles() {
  const { state, update, activeVehicle } = useMotzo();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  if (editing) {
    const v = state.vehicles.find((x) => x.id === editing);
    return <VehicleForm vehicle={v} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />;
  }
  return (
    <div className="space-y-2">
      {state.vehicles.map((v) => (
        <div key={v.id} className={cls("card p-4", v.id === activeVehicle?.id && "border-accent")}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{vehicleName(v)}</p>
              <p className="text-xs text-ink-3">
                {[v.trim, v.vin && `VIN ${v.vin}`, v.plate && `Plate ${v.plate}${v.plateState ? ` (${v.plateState})` : ""}`, v.mileage && `${v.mileage.toLocaleString()} mi`].filter(Boolean).join(" · ") || "Add VIN, plate and mileage"}
              </p>
            </div>
            {v.id === activeVehicle?.id ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Chatting</span>
            ) : (
              <button className="text-sm font-semibold text-accent" onClick={() => update((s) => ({ ...s, activeVehicleId: v.id }))}>
                Switch
              </button>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-ghost text-sm" onClick={() => setEditing(v.id)}>
              Edit
            </button>
            {state.vehicles.length > 1 && (
              <button
                className="btn btn-ghost text-sm text-bad"
                onClick={() => {
                  if (!confirm(`Remove ${vehicleName(v)} and its chat from this device?`)) return;
                  update((s) => ({
                    ...s,
                    vehicles: s.vehicles.filter((x) => x.id !== v.id),
                    messages: s.messages.filter((m) => m.vehicleId !== v.id),
                    activeVehicleId: s.activeVehicleId === v.id ? s.vehicles.find((x) => x.id !== v.id)?.id ?? null : s.activeVehicleId,
                  }));
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
      <button className="btn btn-soft w-full" onClick={() => setEditing("new")}>
        <Icon name="plus" className="h-4 w-4" /> Add another vehicle
      </button>
    </div>
  );
}

const EMPTY_POLICY = (vehicleId: string): InsurancePolicy => ({
  id: uid("ins_"),
  vehicleIds: [vehicleId],
  insurer: "",
  policyNumber: "",
  claimsPhone: "",
  comprehensiveDeductible: "",
  collisionDeductible: "",
  glassCoverage: "",
  roadside: "",
  rental: "",
  startDate: "",
  endDate: "",
  confirmedAt: nowIso(),
});

function Insurance() {
  const { state, update, activeVehicle } = useMotzo();
  const ui = useUi();
  const existing = state.insurance.find((p) => activeVehicle && p.vehicleIds.includes(activeVehicle.id));
  const [p, setP] = useState<InsurancePolicy | null>(existing ?? null);
  if (!activeVehicle) return null;

  const fields: [keyof InsurancePolicy, string, string][] = [
    ["insurer", "Insurance company", "Geico"],
    ["policyNumber", "Policy number", ""],
    ["comprehensiveDeductible", "Comprehensive deductible", "$500"],
    ["collisionDeductible", "Collision deductible", "$1,000"],
    ["glassCoverage", "Glass coverage", "Full glass, $0 deductible"],
    ["roadside", "Roadside assistance", "Yes / No"],
    ["rental", "Rental car coverage", "$40/day"],
    ["claimsPhone", "Claims phone", ""],
    ["startDate", "Start date", ""],
    ["endDate", "End date", ""],
  ];

  if (!p)
    return (
      <div className="space-y-3">
        <div className="card p-4 text-sm text-ink-2">
          No insurance saved for {vehicleName(activeVehicle)} yet. Send Motzo a photo or PDF of your insurance card or declarations page and it reads the deductibles for you, or type them in.
        </div>
        <button className="btn btn-primary w-full" onClick={() => { ui.close(); window.dispatchEvent(new CustomEvent("motzo:attach")); }}>
          Upload insurance card or policy
        </button>
        <button className="btn btn-ghost w-full" onClick={() => setP(EMPTY_POLICY(activeVehicle.id))}>
          Type it in
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label, ph]) => (
          <div key={k}>
            <label className="label" htmlFor={`ins-${k}`}>{label}</label>
            <input id={`ins-${k}`} className="field" placeholder={ph} value={String(p[k] ?? "")} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {existing && (
          <button
            className="btn btn-ghost text-bad"
            onClick={() => {
              update((s) => ({ ...s, insurance: s.insurance.filter((x) => x.id !== existing.id) }));
              setP(null);
            }}
          >
            Remove
          </button>
        )}
        <button
          className="btn btn-primary flex-1"
          onClick={() => {
            const saved = { ...p, confirmedAt: nowIso() };
            update((s) => ({ ...s, insurance: [...s.insurance.filter((x) => x.id !== saved.id && !x.vehicleIds.includes(activeVehicle.id)), saved] }));
            ui.toast("Insurance saved");
          }}
        >
          Save insurance
        </button>
      </div>
      <p className="text-xs text-ink-3">Motzo uses this to say whether a repair is likely covered. It&apos;s only shared with a shop if you tick that when accepting a quote.</p>
    </div>
  );
}

function Reminders() {
  const { state, update, activeVehicle } = useMotzo();
  const ui = useUi();
  const [miles, setMiles] = useState("");
  if (!activeVehicle) return null;
  const v = activeVehicle;
  const interval = v.oilIntervalMiles ?? 5000;
  const since = v.mileage && v.lastOilChangeMiles ? v.mileage - v.lastOilChangeMiles : null;
  const patch = (p: Partial<typeof v>) => update((s) => ({ ...s, vehicles: s.vehicles.map((x) => (x.id === v.id ? { ...x, ...p } : x)) }));

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Oil change</p>
        {since !== null ? (
          <>
            <p className="mt-1 text-lg font-bold">{since >= interval ? `${(since - interval).toLocaleString()} miles overdue` : `Due in ${(interval - since).toLocaleString()} miles`}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className={cls("h-full rounded-full", since >= interval ? "bg-bad" : since >= interval * 0.85 ? "bg-warn" : "bg-good")} style={{ width: `${Math.min(100, (since / interval) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {since.toLocaleString()} of {interval.toLocaleString()} miles since the last change (at {v.lastOilChangeMiles?.toLocaleString()} mi)
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-2">Add your current mileage and the mileage at your last oil change to get reminders.</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="interval">Change every</label>
            <select id="interval" className="field" value={interval} onChange={(e) => patch({ oilIntervalMiles: Number(e.target.value) })}>
              {[3000, 5000, 7500, 10000].map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()} miles
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              className="btn btn-soft w-full"
              disabled={!v.mileage}
              onClick={() => {
                patch({ lastOilChangeMiles: v.mileage });
                update((s) => ({
                  ...s,
                  jobs: [...s.jobs, { id: uid("j_"), vehicleId: v.id, requestId: "", quoteId: "", shopName: "Owner noted", job: `Oil change at ${v.mileage?.toLocaleString()} mi`, total: null, status: "done", history: [{ at: nowIso(), status: "done", note: "Oil change noted by owner" }] }],
                }));
                ui.toast("Oil change noted");
              }}
            >
              I just changed it
            </button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Mileage</p>
        <p className="mt-1 text-lg font-bold">{v.mileage ? `${v.mileage.toLocaleString()} miles` : "Not set"}</p>
        {v.mileageUpdatedAt && <p className="text-xs text-ink-3">Updated {fullStamp(v.mileageUpdatedAt)}</p>}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(miles.replace(/[^0-9]/g, ""));
            if (!n) return;
            patch({ mileage: n, mileageUpdatedAt: nowIso() });
            update((s) => ({ ...s, mileageLog: [...s.mileageLog, { vehicleId: v.id, at: nowIso(), miles: n, source: "owner" }] }));
            setMiles("");
            ui.toast("Mileage updated");
          }}
        >
          <input className="field" inputMode="numeric" placeholder="Odometer reading" value={miles} onChange={(e) => setMiles(e.target.value)} aria-label="Odometer reading" />
          <button className="btn btn-primary shrink-0">Update</button>
        </form>
        <button className="mt-2 text-sm font-semibold text-accent" onClick={() => { ui.close(); ui.openCamera({ mode: "photo" }); }}>
          Or send a photo of the odometer
        </button>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-[var(--accent)]"
            checked={state.settings.countMiles}
            onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, countMiles: e.target.checked } }))}
          />
          <span>
            <span className="font-semibold">Count miles while Motzo is open</span>
            <span className="block text-ink-3">Uses your phone&apos;s location only to add up distance; places are never saved. A website can only count while it&apos;s open, so a phone app will do this in the background later.</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function History() {
  const { state, activeVehicle } = useMotzo();
  const jobs = state.jobs.filter((j) => j.vehicleId === activeVehicle?.id).slice().reverse();
  const log = state.mileageLog.filter((m) => m.vehicleId === activeVehicle?.id).slice(-10).reverse();
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        {jobs.length === 0 && <p className="text-sm text-ink-2">No jobs yet. Accepted quotes and oil changes show up here.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="card p-4 text-sm">
            <div className="flex justify-between gap-2">
              <p className="font-semibold">{j.job}</p>
              <span className={cls("text-xs font-semibold", j.status === "done" ? "text-good" : "text-accent")}>{j.status === "in_progress" ? "In progress" : j.status[0].toUpperCase() + j.status.slice(1)}</span>
            </div>
            <p className="text-ink-2">
              {j.shopName}
              {j.total !== null ? ` · ${money(j.total)}` : ""}
            </p>
            <p className="text-xs text-ink-3">{fullStamp(j.history[j.history.length - 1].at)}</p>
          </div>
        ))}
      </section>
      {log.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-bold">Mileage log</h3>
          <ul className="space-y-0.5 text-sm text-ink-2">
            {log.map((m, i) => (
              <li key={i}>
                {m.miles.toLocaleString()} mi · {m.source === "photo" ? "from a photo" : m.source === "phone" ? "counted by phone" : "entered"} · {fullStamp(m.at)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function recordText(messages: Message[], name: string) {
  const lines = [`Motzo conversation record · ${name}`, `Exported ${fullStamp(nowIso())}`, ""];
  for (const m of messages) {
    const who = m.author === "owner" ? "You" : m.author === "motzo" ? "Motzo" : "Notice";
    lines.push(`[${fullStamp(m.at)}] ${who}${m.viaVoice ? " (voice)" : ""}: ${m.text}`);
    for (const a of m.attachments ?? []) lines.push(`    attached ${a.kind}: ${a.name}${a.reading ? ` (Motzo read: ${a.reading})` : ""}${a.transcript ? ` (transcript: ${a.transcript})` : ""}`);
    if (m.reactions?.owner) lines.push(`    you reacted ${m.reactions.owner}`);
    if (m.reactions?.motzo) lines.push(`    Motzo reacted ${m.reactions.motzo}`);
  }
  return lines.join("\n");
}

function Record() {
  const { state, activeVehicle } = useMotzo();
  const msgs = state.messages.filter((m) => m.vehicleId === activeVehicle?.id);
  const download = () => {
    const blob = new Blob([recordText(msgs, vehicleName(activeVehicle))], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `motzo-record-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-2">{msgs.length} messages, both sides, each with its exact date and time.</p>
        <button className="btn btn-soft shrink-0 text-sm" onClick={download} disabled={!msgs.length}>
          Download
        </button>
      </div>
      <ol className="space-y-2 text-sm">
        {msgs.map((m) => (
          <li key={m.id} className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-ink-3">
              <span className="font-semibold text-ink-2">{m.author === "owner" ? "You" : m.author === "motzo" ? "Motzo" : "Notice"}</span> · {fullStamp(m.at)}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap">{m.text || (m.attachments?.length ? `(${m.attachments.length} attachment${m.attachments.length > 1 ? "s" : ""})` : "")}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Privacy() {
  const { state, update } = useMotzo();
  const o = state.owner;
  const set = (k: keyof typeof o, v: string) => update((s) => ({ ...s, owner: { ...s.owner, [k]: v } }));
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-good/10 p-4 text-sm text-ink-2">
        <p className="mb-1 flex items-center gap-1.5 font-bold text-good">
          <Icon name="lock" className="h-4 w-4" /> Your details stay private
        </p>
        Shops never see your name, phone, email, address, plate or insurance while they quote. Only the one shop whose quote you accept gets what you choose to share.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pn">Name</label>
          <input id="pn" className="field" value={o.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="pp">Phone</label>
          <input id="pp" className="field" value={o.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" />
        </div>
        <div>
          <label className="label" htmlFor="pe">Email</label>
          <input id="pe" className="field" value={o.email} onChange={(e) => set("email", e.target.value)} inputMode="email" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="pa">Area (city or ZIP)</label>
          <input id="pa" className="field" value={o.area} onChange={(e) => set("area", e.target.value)} />
        </div>
      </div>
      <section>
        <h3 className="mb-2 text-sm font-bold">What you&apos;ve shared</h3>
        {state.sharing.length === 0 && <p className="text-sm text-ink-2">Nothing yet.</p>}
        <ul className="space-y-2 text-sm">
          {state.sharing
            .slice()
            .reverse()
            .map((r) => (
              <li key={r.id} className="rounded-xl bg-surface-2 p-3">
                <p className="font-semibold">{r.shopName}</p>
                <p className="text-ink-2">{r.shared.join(", ")}</p>
                <p className="text-xs text-ink-3">{fullStamp(r.at)}</p>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

/** App settings: voice, robot, testing access code, and deleting everything. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, update, resetAll } = useMotzo();
  const { services } = useEngine();
  const ui = useUi();
  const [code, setCode] = useState(getAccessCode());
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Settings" onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--accent)]" checked={s.speakAnswers} onChange={(e) => set({ speakAnswers: e.target.checked })} />
          <span>
            <span className="font-semibold">Read Motzo&apos;s answers out loud</span>
            <span className="block text-ink-3">{services.voice ? "Uses Motzo's own voice." : "Uses your device's voice (add the voice key for Motzo's own voice)."}</span>
          </span>
        </label>
        <div>
          <p className="label">Robot movement</p>
          <Segmented value={s.robotMotion} options={[["full", "Moves around"], ["calm", "Calm"], ["still", "Still"]]} onChange={(v) => set({ robotMotion: v })} />
        </div>
        <div>
          <p className="label">Robot size</p>
          <Segmented value={s.robotSize} options={[["normal", "Normal"], ["small", "Small"]]} onChange={(v) => set({ robotSize: v })} />
        </div>
        <div className="card space-y-1 p-4">
          <p className="font-semibold">What&apos;s switched on</p>
          <Status on={services.ai} label="AI answers and photo reading" />
          <Status on={services.maps} label="Real shops from Google Maps" />
          <Status on={services.mapEmbed} label="Maps on shop pages" />
          <Status on={services.voice} label="Motzo's voice and audio transcripts" />
          <p className="pt-1 text-xs text-ink-3">Anything switched off runs in sample mode, clearly labelled.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAccessCode(code.trim());
            ui.toast("Access code saved");
          }}
        >
          <label className="label" htmlFor="code">Testing access code</label>
          <div className="flex gap-2">
            <input id="code" className="field" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            <button className="btn btn-soft shrink-0">Save</button>
          </div>
        </form>
        <div className="border-t border-line pt-4">
          <p className="font-semibold">Delete everything</p>
          <p className="mb-2 text-ink-3">Removes your vehicles, chats, photos, insurance and history from this device. This can&apos;t be undone.</p>
          <button
            className="btn btn-ghost text-bad"
            onClick={async () => {
              if (!confirm("Delete all your Motzo data from this device?")) return;
              await resetAll();
              onClose();
            }}
          >
            <Icon name="trash" className="h-4 w-4" /> Delete all my data
          </button>
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-surface-2 p-1">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={cls("flex-1 rounded-full py-2 text-sm font-semibold", v === value ? "bg-surface shadow" : "text-ink-3")}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Status({ on, label }: { on: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className={cls("h-2.5 w-2.5 rounded-full", on ? "bg-good" : "bg-ink-3")} />
      {label}
      <span className="text-ink-3">· {on ? "on" : "sample"}</span>
    </p>
  );
}
