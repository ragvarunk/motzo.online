"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMotzo } from "@/lib/store";
import { LANGUAGES, languageByCode } from "@/lib/languages";
import { cls, fullStamp, nowIso, uid } from "@/lib/util";
import { EagleAvatar } from "./Eagle";
import { Icon, PanelHeader, useUi } from "./ui";

/** First letter(s) of the owner's name for the round badge. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function OwnerBadge({ size = 32 }: { size?: number }) {
  const { state } = useMotzo();
  const ini = initials(state.owner.name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-ink font-bold text-bg"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {ini || <Icon name="user" className="h-1/2 w-1/2" />}
    </span>
  );
}

/**
 * The button at the bottom of the sidebar with the owner's name. It opens a
 * menu upward: profile, settings, language, usage, help, learn more, log out.
 */
export function ProfileButton({ onNavigate }: { onNavigate?: () => void }) {
  const { state } = useMotzo();
  const ui = useUi();
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = state.owner.name.trim();
  const lang = languageByCode(state.settings.language);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (fn: () => void) => () => {
    setOpen(false);
    onNavigate?.();
    fn();
  };

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="pop-in absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-line bg-surface py-1.5 text-sm shadow-xl" role="menu">
          <div className="truncate px-4 pb-2 pt-1.5 text-xs text-ink-3">{state.owner.email || name || "Your profile"}</div>
          <MenuItem icon="user" label="Profile" onClick={go(() => ui.open({ type: "profile" }))} />
          <MenuItem icon="settings" label="Settings" onClick={go(() => ui.open({ type: "settings" }))} />
          <MenuItem icon="globe" label="Language" detail={lang.native} onClick={go(() => ui.open({ type: "language" }))} />
          <MenuItem icon="chart" label="Usage" onClick={go(() => ui.open({ type: "usage" }))} />
          <div className="my-1.5 h-px bg-line" />
          <MenuItem icon="help" label="Get help" onClick={go(() => ui.open({ type: "help" }))} />
          <MenuItem icon="info" label="Learn more" onClick={go(() => ui.open({ type: "learn" }))} />
          <div className="my-1.5 h-px bg-line" />
          <MenuItem
            icon="logout"
            label="Log out"
            onClick={() => {
              setOpen(false);
              setConfirmOut(true);
            }}
          />
        </div>
      )}
      <button
        onClick={() => setOpen((x) => !x)}
        className={cls("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2", open && "bg-surface-2")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <OwnerBadge size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name || "Add your name"}</span>
          <span className="block truncate text-xs text-ink-3">Free · on this device</span>
        </span>
        <Icon name="back" className="h-4 w-4 rotate-90 text-ink-3" />
      </button>
      {confirmOut && <LogOutDialog onCancel={() => setConfirmOut(false)} />}
    </div>
  );
}

function MenuItem({ icon, label, detail, onClick }: { icon: string; label: string; detail?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} role="menuitem" className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
      <Icon name={icon} className="h-[18px] w-[18px] text-ink-2" />
      <span className="flex-1">{label}</span>
      {detail && <span className="truncate text-xs text-ink-3">{detail}</span>}
    </button>
  );
}

function LogOutDialog({ onCancel }: { onCancel: () => void }) {
  const { resetAll } = useMotzo();
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="pop-in w-full max-w-sm rounded-3xl bg-surface p-5 shadow-2xl" role="alertdialog" aria-labelledby="lo-t">
        <h2 id="lo-t" className="text-lg font-bold">Log out of Motzo?</h2>
        <p className="mt-2 text-sm text-ink-2">
          There are no accounts yet, so logging out clears your vehicles, chats and details from this device. Once sign-in arrives, logging out will keep everything saved in your account.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn bg-bad text-white"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await resetAll();
            }}
          >
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Name and contact details. */
export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { state, update } = useMotzo();
  const ui = useUi();
  const o = state.owner;
  const set = (k: keyof typeof o, v: string) => update((s) => ({ ...s, owner: { ...s.owner, [k]: v } }));
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Profile" onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <div className="flex items-center gap-3">
          <OwnerBadge size={56} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{o.name || "Your name"}</p>
            <p className="text-ink-3">Using Motzo since {state.startedAt ? new Date(state.startedAt).toLocaleDateString() : "today"}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf-n">Name</label>
            <input id="pf-n" className="field" value={o.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" placeholder="What should Motzo call you?" />
          </div>
          <div>
            <label className="label" htmlFor="pf-e">Email</label>
            <input id="pf-e" className="field" value={o.email} onChange={(e) => set("email", e.target.value)} inputMode="email" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="pf-p">Phone</label>
            <input id="pf-p" className="field" value={o.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" />
          </div>
          <div>
            <label className="label" htmlFor="pf-a">Area (city or ZIP)</label>
            <input id="pf-a" className="field" value={o.area} onChange={(e) => set("area", e.target.value)} />
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-2xl bg-accent-soft p-3 text-ink-2">
          <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>Motzo uses your first name to talk to you. Shops never see these details unless you accept their quote.</span>
        </div>
        <button className="btn btn-soft" onClick={() => ui.open({ type: "garage", tab: "privacy" })}>
          See what you&apos;ve shared
        </button>
      </div>
    </div>
  );
}

/** Pick the language Motzo talks in. */
export function LanguagePanel({ onClose }: { onClose: () => void }) {
  const { state, update } = useMotzo();
  const ui = useUi();
  const [q, setQ] = useState("");
  const current = state.settings.language;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? LANGUAGES.filter((l) => l.name.toLowerCase().includes(t) || l.native.toLowerCase().includes(t)) : LANGUAGES;
  }, [q]);
  const pick = (code: string) => {
    update((s) => ({ ...s, settings: { ...s.settings, language: code } }));
    ui.toast(`Motzo will talk in ${languageByCode(code).name}`);
  };
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Language" subtitle="Motzo answers, listens and speaks in this language" onClose={onClose} />
      <div className="border-b border-line p-3">
        <input className="field" placeholder="Search languages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search languages" />
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {list.map((l) => (
          <button key={l.code} onClick={() => pick(l.code)} className={cls("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface-2", l.code === current && "bg-accent-soft")}>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{l.native}</span>
              <span className="block text-xs text-ink-3">{l.name}</span>
            </span>
            {l.code === current && <Icon name="check" className="h-5 w-5 text-accent" />}
          </button>
        ))}
        {list.length === 0 && <p className="p-4 text-sm text-ink-3">No match. You can still write to Motzo in any language and it will answer in yours.</p>}
      </div>
      <p className="border-t border-line p-3 text-xs text-ink-3">
        You can also just write in your language and Motzo will reply in it. The app&apos;s buttons stay in English for now.
      </p>
    </div>
  );
}

/** What this person has used Motzo for, counted on this device. */
export function UsagePanel({ onClose }: { onClose: () => void }) {
  const { state } = useMotzo();
  const stats = useMemo(() => {
    const mine = state.messages.filter((m) => m.author === "owner");
    const att = mine.flatMap((m) => m.attachments ?? []);
    const weekAgo = Date.now() - 7 * 864e5;
    return {
      chats: state.chats.length,
      questions: mine.length,
      thisWeek: mine.filter((m) => new Date(m.at).getTime() > weekAgo).length,
      photos: att.filter((a) => a.kind === "image" || a.kind === "video").length,
      docs: att.filter((a) => a.kind === "document").length,
      voice: mine.filter((m) => m.viaVoice).length,
      quotes: state.quoteRequests.length,
      vehicles: state.vehicles.length,
    };
  }, [state]);
  const rows: [string, number][] = [
    ["Questions asked", stats.questions],
    ["Chats", stats.chats],
    ["Photos and videos read", stats.photos],
    ["Documents read", stats.docs],
    ["Voice messages", stats.voice],
    ["Quote requests", stats.quotes],
    ["Vehicles", stats.vehicles],
  ];
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Usage" onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Plan</p>
          <p className="mt-1 text-lg font-bold">Free preview</p>
          <p className="mt-1 text-ink-2">Motzo is free while it&apos;s being built. Plans and limits come with sign-in.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Questions this week" value={stats.thisWeek} />
          <Stat label="Chats" value={stats.chats} />
        </div>
        <div className="card divide-y divide-line">
          {rows.map(([label, n]) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-ink-2">{label}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-3">Counted on this device{state.startedAt ? ` since ${fullStamp(state.startedAt)}` : ""}.</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink-3">{label}</p>
    </div>
  );
}

const FAQ: [string, string][] = [
  ["Who sees my details?", "Nobody, until you accept a quote. Shops see the job, the photos and your area while they quote. Only the shop you pick gets the contact details you choose to share."],
  ["Does Motzo call shops?", "No. Motzo never phones anyone. It asks shops for quotes by message, and only after you say yes."],
  ["How good are the price estimates?", "They're a starting range from the photos and your vehicle. The shop's quote is the real price."],
  ["Where are my chats kept?", "On this device for now. Clearing your browser or logging out removes them."],
  ["How do I change the language?", "Open your profile menu, tap Language and pick one. Motzo will answer and speak in it."],
];

/** Help: common questions and a way to report a problem. */
export function HelpPanel({ onClose }: { onClose: () => void }) {
  const ui = useUi();
  const { state } = useMotzo();
  const [kind, setKind] = useState("Something isn't working");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  const submit = () => {
    const report = { id: uid("r_"), at: nowIso(), kind, text: text.trim(), page: typeof location !== "undefined" ? location.pathname : "", language: state.settings.language };
    try {
      const prev = JSON.parse(localStorage.getItem("motzo-reports") || "[]");
      localStorage.setItem("motzo-reports", JSON.stringify([...prev, report].slice(-50)));
    } catch {
      /* storage full or blocked: the email below still works */
    }
    if (support) {
      const body = `${kind}\n\n${report.text}\n\n(Sent from Motzo, ${new Date().toLocaleString()})`;
      window.location.href = `mailto:${support}?subject=${encodeURIComponent(`Motzo: ${kind}`)}&body=${encodeURIComponent(body)}`;
    }
    setSent(true);
    setText("");
    ui.toast("Thanks, your report is saved");
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Get help" onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <section>
          <h3 className="mb-2 font-bold">Common questions</h3>
          <div className="space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
                  {q}
                  <Icon name="plus" className="h-4 w-4 shrink-0 text-ink-3 transition group-open:rotate-45" />
                </summary>
                <p className="mt-2 text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="card space-y-3 p-4">
          <h3 className="font-bold">Report a problem</h3>
          <div className="flex flex-wrap gap-2">
            {["Something isn't working", "Wrong answer", "A shop problem", "Idea"].map((k) => (
              <button key={k} onClick={() => setKind(k)} className={cls("rounded-full border px-3 py-1.5", kind === k ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line")}>
                {k}
              </button>
            ))}
          </div>
          <textarea className="field min-h-28" placeholder="Tell us what happened" value={text} onChange={(e) => setText(e.target.value)} aria-label="What happened" />
          <button className="btn btn-primary w-full" disabled={!text.trim()} onClick={submit}>
            {support ? "Send report" : "Save report"}
          </button>
          {sent && <p className="text-xs text-good">Got it. {support ? "Your email app opened with the report." : "It's saved on this device for the Motzo team."}</p>}
          {!support && <p className="text-xs text-ink-3">Reports are kept on this device until the support inbox is connected.</p>}
        </section>
      </div>
    </div>
  );
}

/** What Motzo is and how it works. */
export function LearnPanel({ onClose }: { onClose: () => void }) {
  const points: [string, string, string][] = [
    ["camera", "Show it the damage", "Send a photo or video and Motzo tells you what part it is, what it should cost and which kind of shop fixes it."],
    ["quote", "Quotes without phone calls", "With your OK, Motzo asks several shops for prices and compares them for you. It never calls anyone."],
    ["shield", "Your details stay yours", "Shops see your contact details only after you accept a quote, and only what you choose."],
    ["clock", "Keeps track for you", "Mileage, oil changes, insurance and every repair, with the exact time of each message."],
    ["globe", "Your language", "Talk or type in your language and Motzo answers in it."],
  ];
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Learn more" onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <div className="flex items-center gap-3">
          <EagleAvatar size={56} />
          <div>
            <p className="text-lg font-bold">Motzo</p>
            <p className="text-ink-2">Your personal expert for your vehicle.</p>
          </div>
        </div>
        <div className="space-y-3">
          {points.map(([icon, title, body]) => (
            <div key={title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={icon} className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-ink-2">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-3">Motzo gives estimates and suggestions. Always follow a qualified technician&apos;s advice for safety repairs.</p>
      </div>
    </div>
  );
}
