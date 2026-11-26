"use client";

import { useMotzo } from "@/lib/store";
import type { CardData, InsurancePolicy, Message, VehicleIssue } from "@/lib/types";
import { cls, money, nowIso, SHOP_TYPE_LABEL, uid } from "@/lib/util";
import { Icon, useUi } from "./ui";

const URGENCY: Record<string, { text: string; tone: string }> = {
  safe_to_drive: { text: "Safe to drive for now", tone: "text-good" },
  drive_carefully: { text: "Drive carefully, fix soon", tone: "text-warn" },
  do_not_drive: { text: "Don't drive it until it's checked", tone: "text-bad" },
};
const TODAY: Record<string, string> = { likely: "Likely today", maybe: "Maybe today", unlikely: "Probably not today" };

export function MessageCards({ message }: { message: Message }) {
  if (!message.cards?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {message.cards.map((c, i) => (
        <Card key={i} card={c} index={i} message={message} />
      ))}
    </div>
  );
}

function Card({ card, index, message }: { card: CardData; index: number; message: Message }) {
  const ui = useUi();
  const { state, update, patchMessage, activeVehicle } = useMotzo();

  const markCard = (patch: Partial<CardData>) =>
    patchMessage(message.id, (m) => ({
      ...m,
      cards: m.cards?.map((c, i) => (i === index ? ({ ...c, ...patch } as CardData) : c)),
    }));

  switch (card.kind) {
    case "photo_report":
      return <PhotoReportCard card={card} message={message} onSaved={(id) => markCard({ savedIssueId: id })} />;

    case "estimate": {
      const e = card.estimate;
      const u = URGENCY[e.urgency] ?? URGENCY.safe_to_drive;
      return (
        <div className="card rise p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Estimate</p>
              <p className="font-semibold">{e.part}</p>
              <p className="text-sm text-ink-2">{e.work}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">
                {money(e.costLow)}–{money(e.costHigh)}
              </p>
              <p className="text-xs text-ink-3">typical range</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Fact icon="wrench" text={SHOP_TYPE_LABEL[e.shopType] ?? "Auto shop"} />
            <Fact icon="clock" text={TODAY[e.today] ?? e.today} />
            <Fact icon="shield" text={u.text} tone={u.tone} wide />
          </div>
          {e.insuranceNote && (
            <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
              <span className="font-semibold text-ink">Insurance: </span>
              {e.insuranceNote}
            </p>
          )}
          {e.basis && <p className="mt-2 text-xs text-ink-3">Based on: {e.basis}</p>}
        </div>
      );
    }

    case "photos_needed":
      return (
        <div className="card rise p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Photos that would help</p>
          <ul className="mt-2 space-y-2">
            {card.photos.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                <span>
                  <span className="font-semibold">{p.label}</span>
                  {p.why && <span className="text-ink-2">: {p.why}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => ui.openCamera({ mode: "photo" })}>
              <Icon name="camera" className="h-4 w-4" /> Take photos
            </button>
            <button className="btn btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent("motzo:attach"))}>
              Upload
            </button>
          </div>
        </div>
      );

    case "insurance_found": {
      const ins = card.insurance;
      const rows: [string, string][] = [
        ["Insurer", ins.insurer],
        ["Policy number", ins.policyNumber],
        ["Comprehensive deductible", ins.comprehensiveDeductible],
        ["Collision deductible", ins.collisionDeductible],
        ["Glass", ins.glassCoverage],
        ["Roadside", ins.roadside],
        ["Rental car", ins.rental],
        ["Claims phone", ins.claimsPhone],
        ["Dates", [ins.startDate, ins.endDate].filter(Boolean).join(" to ")],
      ];
      const save = () => {
        const policy: InsurancePolicy = {
          id: uid("ins_"),
          vehicleIds: activeVehicle ? [activeVehicle.id] : [],
          insurer: ins.insurer,
          policyNumber: ins.policyNumber,
          claimsPhone: ins.claimsPhone,
          comprehensiveDeductible: ins.comprehensiveDeductible,
          collisionDeductible: ins.collisionDeductible,
          glassCoverage: ins.glassCoverage,
          roadside: ins.roadside,
          rental: ins.rental,
          startDate: ins.startDate,
          endDate: ins.endDate,
          documentId: card.documentId,
          confirmedAt: nowIso(),
        };
        update((s) => ({
          ...s,
          insurance: [...s.insurance.filter((p) => !(activeVehicle && p.vehicleIds.includes(activeVehicle.id))), policy],
        }));
        markCard({ saved: true });
        ui.toast("Insurance saved to your profile");
      };
      return (
        <div className="card rise p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Insurance I read</p>
          <dl className="mt-2 divide-y divide-line text-sm">
            {rows
              .filter(([, val]) => val)
              .map(([k, val]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right font-medium">{val}</dd>
                </div>
              ))}
          </dl>
          {card.saved ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-good">
              <Icon name="check" className="h-4 w-4" /> Saved to your profile
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={save}>
                Save to my profile
              </button>
              <button className="btn btn-ghost" onClick={() => ui.open({ type: "garage", tab: "insurance" })}>
                Fill in by hand
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-3">Check these match your card. Nothing is shared with any shop unless you choose to.</p>
        </div>
      );
    }

    case "vehicle_found": {
      const f = card.found;
      const save = () => {
        if (!activeVehicle) return;
        update((s) => ({
          ...s,
          vehicles: s.vehicles.map((v) =>
            v.id === activeVehicle.id
              ? {
                  ...v,
                  vin: f.vin || v.vin,
                  plate: f.plate || v.plate,
                  mileage: f.mileage ?? v.mileage,
                  mileageUpdatedAt: f.mileage ? nowIso() : v.mileageUpdatedAt,
                }
              : v,
          ),
          mileageLog: f.mileage ? [...s.mileageLog, { vehicleId: activeVehicle.id, at: nowIso(), miles: f.mileage, source: "photo" as const }] : s.mileageLog,
        }));
        markCard({ saved: true });
        ui.toast("Vehicle updated");
      };
      return (
        <div className="card rise p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Read from your photo</p>
          {f.vin && <p className="mt-1">VIN <span className="font-mono font-semibold">{f.vin}</span></p>}
          {f.plate && <p>Plate <span className="font-semibold">{f.plate}</span></p>}
          {f.mileage && <p>Odometer <span className="font-semibold">{f.mileage.toLocaleString()} miles</span></p>}
          {card.saved ? (
            <p className="mt-2 flex items-center gap-1.5 font-semibold text-good">
              <Icon name="check" className="h-4 w-4" /> Saved
            </p>
          ) : (
            <button className="btn btn-soft mt-3" onClick={save}>
              Save to {activeVehicle?.model || "vehicle"}
            </button>
          )}
        </div>
      );
    }

    case "shop_search":
      return (
        <button
          className="card rise flex w-full items-center gap-3 p-4 text-left hover:border-accent"
          onClick={() => ui.open({ type: "shops", shopType: card.search.shopType, searchText: card.search.searchText })}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="map" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">See {SHOP_TYPE_LABEL[card.search.shopType]?.toLowerCase() ?? "shops"}s near you</span>
            <span className="block text-sm text-ink-2">Ratings, reviews, distance, mobile service and whether each is right for this job</span>
          </span>
          <Icon name="back" className="h-4 w-4 rotate-180 text-ink-3" />
        </button>
      );

    case "offer_quotes":
      return (
        <div className="card rise p-4">
          <p className="font-semibold">Want me to get quotes?</p>
          <p className="mt-1 text-sm text-ink-2">
            I&apos;ll ask a few {SHOP_TYPE_LABEL[card.shopType]?.toLowerCase() ?? "shop"}s the same questions (price, parts, materials, timing, warranty) and line up their answers. You confirm first,
            and your name and phone stay private until you accept a quote.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => ui.open({ type: "newQuote", shopType: card.shopType, job: card.job })}>
              Get quotes
            </button>
            <button className="btn btn-ghost" onClick={() => ui.open({ type: "shops", shopType: card.shopType })}>
              Just show shops
            </button>
          </div>
        </div>
      );

    case "reminder":
      return (
        <div className="card rise p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Oil change</p>
          <p className="mt-1 font-semibold">
            {card.milesSince >= card.interval
              ? `About ${(card.milesSince - card.interval).toLocaleString()} miles past due`
              : `Due in about ${(card.interval - card.milesSince).toLocaleString()} miles`}
          </p>
          <p className="text-sm text-ink-2">
            {card.milesSince.toLocaleString()} miles since the last one; your interval is {card.interval.toLocaleString()}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => ui.open({ type: "shops", shopType: "oil", searchText: "oil change" })}>
              Find an oil change
            </button>
            <button className="btn btn-ghost" onClick={() => ui.open({ type: "garage", tab: "reminders" })}>
              I already did it
            </button>
          </div>
        </div>
      );

    case "quote": {
      const r = state.quoteRequests.find((x) => x.id === card.requestId);
      const q = r?.quotes.find((x) => x.id === card.quoteId);
      if (!r || !q) return null;
      return (
        <button className="card rise flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => ui.open({ type: "quotes", requestId: r.id })}>
          <span>
            <span className="block font-semibold">{q.shop.name}</span>
            <span className="block text-sm text-ink-2">{q.earliest ?? "Waiting"}</span>
          </span>
          <span className="text-lg font-bold">{money(q.total)}</span>
        </button>
      );
    }
  }
}

function Fact({ icon, text, tone, wide }: { icon: string; text: string; tone?: string; wide?: boolean }) {
  return (
    <div className={cls("flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-2", wide && "col-span-2", tone)}>
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      <span className="font-medium">{text}</span>
    </div>
  );
}

const SAFETY: Record<string, { title: string; box: string; dot: string }> = {
  safe_to_drive: { title: "Safe to drive", box: "bg-good/10 text-good", dot: "bg-good" },
  drive_carefully: { title: "Drive carefully", box: "bg-warn/12 text-warn", dot: "bg-warn" },
  do_not_drive: { title: "Don't drive it", box: "bg-bad/10 text-bad", dot: "bg-bad" },
};
const SEVERITY: Record<string, string> = { minor: "Minor", moderate: "Moderate", serious: "Serious" };
const CONFIDENCE: Record<string, string> = { high: "Clear from the photo", medium: "Likely, a shop should confirm", low: "Hard to tell from this photo" };

/** Everything Motzo worked out from one photo, in one card: what it sees, what it means, what to do. */
function PhotoReportCard({
  card,
  message,
  onSaved,
}: {
  card: Extract<CardData, { kind: "photo_report" }>;
  message: Message;
  onSaved: (id: string) => void;
}) {
  const ui = useUi();
  const { state, update, activeVehicle } = useMotzo();
  const r = card.report;
  const e = card.estimate;
  const safety = SAFETY[r.urgency] ?? SAFETY.drive_carefully;
  const shopType = e?.shopType ?? card.search?.shopType ?? "other";
  const job = e?.work || card.search?.searchText || r.title;
  const saved = card.savedIssueId ? state.issues.find((i) => i.id === card.savedIssueId) : undefined;

  const save = () => {
    if (!activeVehicle) return;
    const issue: VehicleIssue = {
      id: uid("iss_"),
      vehicleId: message.vehicleId || activeVehicle.id,
      at: message.at || nowIso(),
      title: r.title,
      summary: r.problem,
      urgency: r.urgency,
      costLow: e?.costLow ?? null,
      costHigh: e?.costHigh ?? null,
      shopType: e?.shopType ?? card.search?.shopType ?? null,
      photoId: r.photoId,
      thumb: r.thumb,
      chatId: message.chatId,
      status: "open",
    };
    update((s) => ({ ...s, issues: [...(s.issues ?? []), issue] }));
    onSaved(issue.id);
    ui.toast(`Saved to ${activeVehicle.model || "your vehicle"}'s record`);
  };

  return (
    <div className="card rise overflow-hidden">
      <div className="flex gap-3 p-4 pb-3">
        {r.thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.thumb} alt="Your photo" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-line sm:h-20 sm:w-20" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">What I see</p>
          <p className="text-[1.05rem] font-bold leading-snug">{r.title}</p>
          <p className="mt-0.5 text-sm text-ink-2">{r.seen}</p>
        </div>
      </div>

      <div className={cls("mx-4 flex items-start gap-2.5 rounded-2xl px-3 py-2.5", safety.box)}>
        <span className={cls("mt-1.5 h-2 w-2 shrink-0 rounded-full", safety.dot)} />
        <div className="min-w-0 text-sm">
          <p className="font-bold">
            {safety.title}
            {r.fixBy && <span className="font-semibold opacity-80"> · fix {r.fixBy.charAt(0).toLowerCase() + r.fixBy.slice(1)}</span>}
          </p>
          {r.safetyReason && <p className="text-ink-2">{r.safetyReason}</p>}
        </div>
      </div>

      <div className="p-4 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">What it likely means</p>
        <p className="mt-0.5 text-sm">{r.problem}</p>
        <p className="mt-1 text-xs text-ink-3">
          {SEVERITY[r.severity] ?? ""}{r.severity ? " · " : ""}{CONFIDENCE[r.confidence] ?? ""}
        </p>

        {(e || r.findings.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {e && (
              <div className="col-span-2 rounded-xl bg-surface-2 px-3 py-2 sm:col-span-1">
                <p className="text-xs text-ink-3">Likely cost</p>
                <p className="text-lg font-bold leading-tight">
                  {money(e.costLow)}–{money(e.costHigh)}
                </p>
                <p className="text-xs text-ink-2">{e.work}</p>
              </div>
            )}
            {e && (
              <div className="rounded-xl bg-surface-2 px-3 py-2">
                <p className="text-xs text-ink-3">Who fixes it</p>
                <p className="font-semibold">{SHOP_TYPE_LABEL[e.shopType] ?? "Auto shop"}</p>
                <p className="text-xs text-ink-2">{TODAY[e.today] ?? e.today}</p>
              </div>
            )}
            {r.findings.slice(0, 4).map((f, i) => (
              <div key={i} className="rounded-xl bg-surface-2 px-3 py-2">
                <p className="text-xs text-ink-3">{f.label}</p>
                <p className="font-semibold">{f.value}</p>
              </div>
            ))}
          </div>
        )}

        {e?.insuranceNote && (
          <p className="mt-3 flex gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-sm text-ink-2">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              <span className="font-semibold text-ink">Insurance: </span>
              {e.insuranceNote}
            </span>
          </p>
        )}

        {r.doNow.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Until it&apos;s fixed</p>
            <ul className="mt-1 space-y-1 text-sm">
              {r.doNow.slice(0, 3).map((d, i) => (
                <li key={i} className="flex gap-2">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {card.photos && card.photos.length > 0 && (
          <div className="mt-3 rounded-xl border border-line p-3">
            <p className="text-sm font-semibold">Shops will also want</p>
            <ul className="mt-1 space-y-1 text-sm text-ink-2">
              {card.photos.slice(0, 3).map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                  <span>
                    <span className="font-medium text-ink">{p.label}</span>
                    {p.why && <span>: {p.why}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <button className="btn btn-soft mt-2 w-full sm:w-auto" onClick={() => ui.openCamera({ mode: "photo" })}>
              <Icon name="camera" className="h-4 w-4" /> Add photos
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {card.offerQuotes !== false && (
            <button className="btn btn-primary flex-1 sm:flex-none" onClick={() => ui.open({ type: "newQuote", shopType, job })}>
              <Icon name="quote" className="h-4 w-4" /> Get quotes
            </button>
          )}
          <button className="btn btn-ghost flex-1 sm:flex-none" onClick={() => ui.open({ type: "shops", shopType, searchText: card.search?.searchText ?? job })}>
            <Icon name="map" className="h-4 w-4" /> <span className="whitespace-nowrap">Nearby shops</span>
          </button>
          {saved ? (
            <button className="btn btn-ghost w-full text-good sm:w-auto" onClick={() => ui.open({ type: "garage", tab: "history" })}>
              <Icon name="check" className="h-4 w-4" /> Saved to record
            </button>
          ) : (
            <button className="btn btn-ghost w-full sm:w-auto" onClick={save} disabled={!activeVehicle}>
              <Icon name="garage" className="h-4 w-4" /> Save to car record
            </button>
          )}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
          <Icon name="lock" className="mt-px h-3.5 w-3.5 shrink-0" />
          {e?.basis ? `${e.basis} ` : ""}Shops never see your details until you accept a quote.
        </p>
      </div>
    </div>
  );
}
