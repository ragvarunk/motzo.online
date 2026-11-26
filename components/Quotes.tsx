"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { collectQuotes, newQuote, requestSummary } from "@/lib/quotes";
import { SHOP_QUESTIONS } from "@/lib/questions";
import { useMotzo } from "@/lib/store";
import type { Job, Quote, QuoteRequest, ShopSummary, ShopType } from "@/lib/types";
import { cls, fullStamp, money, nowIso, SHOP_TYPE_LABEL, uid, vehicleName } from "@/lib/util";
import { useEngine } from "./ChatEngine";
import { Icon, PanelHeader, useUi } from "./ui";

/** Confirm screen before Motzo asks any business for a quote. Nothing goes out until the owner presses the button. */
export function NewQuotePanel({ shopType, job: jobIn, onClose }: { shopType: ShopType; job: string; onClose: () => void }) {
  const { state, update, activeVehicle, addMessage } = useMotzo();
  const { location, requestLocation, services } = useEngine();
  const ui = useUi();
  const [job, setJob] = useState(jobIn);
  const [shops, setShops] = useState<ShopSummary[]>(state.lastShopSearch?.shopType === shopType ? state.lastShops : []);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [timing, setTiming] = useState("As soon as possible");
  const [area, setArea] = useState(state.owner.area);
  const [includeVin, setIncludeVin] = useState(Boolean(activeVehicle?.vin));
  const [insurancePay, setInsurancePay] = useState(false);

  const photos = useMemo(
    () =>
      state.messages
        .filter((m) => m.vehicleId === activeVehicle?.id && m.author === "owner")
        .flatMap((m) => (m.attachments ?? []).filter((a) => a.kind === "image" || a.kind === "video"))
        .slice(-8)
        .reverse(),
    [state.messages, activeVehicle?.id],
  );
  const [photoIds, setPhotoIds] = useState<string[]>(() => photos.slice(0, 4).map((p) => p.id));

  useEffect(() => {
    if (shops.length) {
      setPicked(shops.slice(0, 3).map((s) => s.placeId));
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const loc = services.maps ? location ?? (area ? null : await requestLocation()) : null;
        const q = new URLSearchParams({ type: shopType, q: SHOP_TYPE_LABEL[shopType] });
        if (loc) {
          q.set("lat", String(loc.lat));
          q.set("lng", String(loc.lng));
        }
        if (area) q.set("area", area);
        const r = await apiJson<{ shops: ShopSummary[] }>(`/api/shops?${q}`);
        setShops(r.shops);
        setPicked(r.shops.filter((s) => s.verdict.fit !== "poor").slice(0, 3).map((s) => s.placeId));
      } catch {
        /* shown below as an empty list */
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!activeVehicle) return null;
  const chosen = shops.filter((s) => picked.includes(s.placeId));
  const realChosen = chosen.filter((s) => !s.sample);
  const summary = requestSummary({
    vehicle: vehicleName({ ...activeVehicle, nickname: undefined }) + (activeVehicle.trim ? ` ${activeVehicle.trim}` : ""),
    vin: includeVin ? activeVehicle.vin : undefined,
    job,
    area,
    timing,
    photoCount: photoIds.length,
    insurancePay,
  });

  const confirm = () => {
    if (!chosen.length) return ui.toast("Pick at least one shop");
    if (!job.trim()) return ui.toast("Say what the job is");
    const req: QuoteRequest = {
      id: uid("qr_"),
      vehicleId: activeVehicle.id,
      job: job.trim(),
      shopType,
      area,
      timing,
      attachmentIds: photoIds,
      sentSummary: summary,
      quotes: chosen.map(newQuote),
      createdAt: nowIso(),
      confirmedAt: nowIso(),
      status: "collecting",
    };
    update((s) => ({ ...s, quoteRequests: [req, ...s.quoteRequests], owner: { ...s.owner, area } }));
    addMessage({
      id: uid("m_"),
      vehicleId: activeVehicle.id,
      author: "motzo",
      at: nowIso(),
      text:
        `You confirmed a quote request for "${req.job}" to ${chosen.length} shop${chosen.length > 1 ? "s" : ""}. ` +
        (realChosen.length
          ? `${realChosen.length} real shop${realChosen.length > 1 ? "s aren't" : " isn't"} connected to Motzo yet, so I didn't contact ${realChosen.length > 1 ? "them" : "it"} and nothing about you was sent. `
          : "") +
        (chosen.some((s) => s.sample) ? "Sample shops will answer with sample quotes so you can see how it works. " : "") +
        "Your name and phone stay private until you accept a quote.",
    });
    collectQuotes(update, req);
    ui.open({ type: "quotes", requestId: req.id });
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Get quotes" subtitle={`${SHOP_TYPE_LABEL[shopType]} · ${vehicleName(activeVehicle)}`} onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <label className="label" htmlFor="job">The job</label>
          <input id="job" className="field" value={job} onChange={(e) => setJob(e.target.value)} />
        </div>

        <section>
          <p className="label">Shops to ask (up to 5)</p>
          {loading && <p className="text-sm text-ink-3">Finding shops…</p>}
          {!loading && shops.length === 0 && <p className="text-sm text-ink-2">No shops loaded. Open the shop finder first, or check your location.</p>}
          <div className="space-y-2">
            {shops.map((s) => {
              const on = picked.includes(s.placeId);
              return (
                <button
                  key={s.placeId}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.placeId) : p.length >= 5 ? p : [...p, s.placeId]))}
                  className={cls("flex w-full items-center gap-3 rounded-xl border p-3 text-left", on ? "border-accent bg-accent-soft/50" : "border-line")}
                >
                  <span className={cls("grid h-6 w-6 shrink-0 place-items-center rounded-md border", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>
                    {on && <Icon name="check" className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {s.rating?.toFixed(1) ?? "—"}★ · {s.reviewCount} reviews{s.distanceMiles !== null ? ` · ${s.distanceMiles.toFixed(1)} mi` : ""}
                      {s.serviceAreaOnly ? " · mobile" : ""}
                    </span>
                  </span>
                  {s.sample ? (
                    <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[11px] font-semibold text-warn">Sample</span>
                  ) : (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">Not connected yet</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {photos.length > 0 && (
          <section>
            <p className="label">Photos to include</p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p) => {
                const on = photoIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setPhotoIds((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id]))} className={cls("relative aspect-square overflow-hidden rounded-xl border-2", on ? "border-accent" : "border-transparent opacity-50")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.thumb ? <img src={p.thumb} alt={p.reading || p.name} className="h-full w-full object-cover" /> : <span className="text-xs">{p.name}</span>}
                    {on && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-ink"><Icon name="check" className="h-3.5 w-3.5" /></span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="timing">When</label>
            <select id="timing" className="field" value={timing} onChange={(e) => setTiming(e.target.value)}>
              <option>As soon as possible</option>
              <option>Today</option>
              <option>This week</option>
              <option>Flexible</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="qarea">Area (city or ZIP)</label>
            <input id="qarea" className="field" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Shown to shops instead of your address" />
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {activeVehicle.vin && <Toggle on={includeVin} set={setIncludeVin} label="Include my VIN (helps shops find the exact part)" />}
          <Toggle on={insurancePay} set={setInsurancePay} label="I may pay through insurance" />
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-2 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Icon name="quote" className="h-4 w-4" /> What shops will see</p>
            <ul className="space-y-1 text-sm text-ink-2">
              {summary.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">Plus the questions: {SHOP_QUESTIONS.map((q) => q.topic.toLowerCase()).join(", ")}.</p>
          </div>
          <div className="rounded-2xl bg-good/10 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-good"><Icon name="lock" className="h-4 w-4" /> Never shared until you accept</p>
            <ul className="space-y-1 text-sm text-ink-2">
              <li>Your name</li>
              <li>Your phone number and email</li>
              <li>Your street address</li>
              <li>{includeVin ? "Your license plate" : "Your VIN and license plate"}</li>
              <li>Your insurance policy details</li>
            </ul>
          </div>
        </section>

        {realChosen.length > 0 && (
          <p className="rounded-xl bg-warn/10 p-3 text-sm text-ink-2">
            Real shops aren&apos;t connected to Motzo yet (no API, agent or text link set up), so Motzo won&apos;t contact {realChosen.length > 1 ? "them" : "it"}. Nothing about you will be sent. No phone calls are ever made.
          </p>
        )}
      </div>
      <div className="border-t border-line p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        <button className="btn btn-primary w-full" onClick={confirm} disabled={!chosen.length}>
          Ask {chosen.length || ""} shop{chosen.length === 1 ? "" : "s"} for quotes
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Quotes side by side, the full record of what each shop was asked and said, and accepting one. */
export function QuotesPanel({ requestId, onClose }: { requestId?: string; onClose: () => void }) {
  const { state, activeVehicle } = useMotzo();
  const [openId, setOpenId] = useState<string | undefined>(requestId);
  useEffect(() => setOpenId(requestId), [requestId]);
  const requests = state.quoteRequests.filter((r) => r.vehicleId === activeVehicle?.id);
  const req = requests.find((r) => r.id === openId);

  if (req) return <RequestView req={req} onClose={onClose} onBack={() => setOpenId(undefined)} />;
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Quotes" subtitle={vehicleName(activeVehicle)} onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-4">
        {requests.length === 0 && <p className="text-sm text-ink-2">No quote requests yet. Send Motzo a photo of the problem and it will offer to get quotes.</p>}
        {requests.map((r) => {
          const answered = r.quotes.filter((q) => q.status === "answered" || q.status === "accepted").length;
          return (
            <button key={r.id} className="card block w-full p-4 text-left hover:border-accent" onClick={() => setOpenId(r.id)}>
              <div className="flex justify-between gap-2">
                <p className="font-semibold">{r.job}</p>
                <span className={cls("text-xs font-semibold", r.status === "accepted" ? "text-good" : "text-ink-3")}>{r.status === "accepted" ? "Accepted" : `${answered}/${r.quotes.length} answered`}</span>
              </div>
              <p className="text-xs text-ink-3">{fullStamp(r.confirmedAt)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RequestView({ req, onClose, onBack }: { req: QuoteRequest; onClose: () => void; onBack: () => void }) {
  const { state, update, addMessage } = useMotzo();
  const ui = useUi();
  const [detail, setDetail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<Quote | null>(null);
  const job = state.jobs.find((j) => j.requestId === req.id);
  const answered = req.quotes.filter((q) => q.total !== null);
  const cheapest = answered.length ? Math.min(...answered.map((q) => q.total ?? Infinity)) : null;

  const setJobStatus = (status: Job["status"]) =>
    update((s) => ({
      ...s,
      jobs: s.jobs.map((j) => (j.id === job?.id ? { ...j, status, history: [...j.history, { at: nowIso(), status, note: status === "done" ? "Marked done by owner" : `Marked ${status.replace("_", " ")}` }] } : j)),
    }));

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={req.job} subtitle={`Requested ${fullStamp(req.confirmedAt)}`} onClose={onClose} onBack={onBack} />
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {job && (
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Job</p>
            <p className="font-semibold">
              {job.shopName} · {money(job.total)}
            </p>
            <div className="mt-3 flex gap-1">
              {(["booked", "in_progress", "done"] as const).map((st, i) => {
                const reached = ["booked", "in_progress", "done"].indexOf(job.status) >= i;
                return (
                  <button key={st} onClick={() => setJobStatus(st)} className={cls("flex-1 rounded-lg py-2 text-xs font-semibold", reached ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3")}>
                    {st === "in_progress" ? "In progress" : st[0].toUpperCase() + st.slice(1)}
                  </button>
                );
              })}
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-ink-3">
              {job.history.map((h, i) => (
                <li key={i}>
                  {fullStamp(h.at)}: {h.note}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="scroll-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible xl:grid-cols-3">
          {req.quotes.map((q) => (
            <div key={q.id} className={cls("card w-[78vw] max-w-xs shrink-0 snap-start p-4 lg:w-auto lg:max-w-none", q.status === "accepted" && "border-good ring-2 ring-good/30")}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-tight">{q.shop.name}</p>
                <QuoteBadge q={q} />
              </div>
              <p className="text-xs text-ink-3">
                {q.shop.rating?.toFixed(1) ?? "—"}★ · {q.shop.reviewCount} reviews{q.shop.distanceMiles !== null ? ` · ${q.shop.distanceMiles.toFixed(1)} mi` : ""}
              </p>
              {q.status === "waiting" && <p className="mt-4 text-sm text-ink-3">Waiting for an answer…</p>}
              {q.status === "unreachable" && <p className="mt-4 text-sm text-ink-2">Not contacted: this shop isn&apos;t connected to Motzo yet. Nothing about you was sent.</p>}
              {q.total !== null && (
                <>
                  <p className="mt-3 text-2xl font-bold">
                    {money(q.total)}
                    {q.total === cheapest && answered.length > 1 && <span className="ml-2 align-middle text-xs font-semibold text-good">Lowest</span>}
                  </p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="Parts" v={q.partsType} />
                    <Row k="Earliest" v={q.earliest} />
                    <Row k="Where" v={q.mobile ? "Comes to you" : "At the shop"} />
                    <Row k="Warranty" v={q.warranty} />
                  </dl>
                </>
              )}
              <div className="mt-3 flex gap-2">
                <button className="btn btn-ghost flex-1 text-sm" onClick={() => setDetail(detail === q.id ? null : q.id)}>
                  {detail === q.id ? "Hide" : "Full answers"}
                </button>
                {q.status === "answered" && req.status === "collecting" && (
                  <button className="btn btn-primary flex-1 text-sm" onClick={() => setAccepting(q)}>
                    Accept
                  </button>
                )}
              </div>
              {detail === q.id && (
                <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm">
                  {q.answers.map((a) => (
                    <div key={a.topic}>
                      <p className="font-semibold">{a.topic}</p>
                      <p className="text-xs text-ink-3">{a.question}</p>
                      <p className="text-ink-2">{a.answer}</p>
                    </div>
                  ))}
                  <div>
                    <p className="font-semibold">Conversation record</p>
                    <ul className="mt-1 space-y-2">
                      {q.exchange.map((x, i) => (
                        <li key={i} className="rounded-lg bg-surface-2 p-2 text-xs">
                          <span className="font-semibold">{x.from === "motzo" ? "Motzo" : q.shop.name}</span> · {fullStamp(x.at)}
                          <p className="mt-0.5 whitespace-pre-wrap text-ink-2">{x.text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <details className="rounded-xl bg-surface-2 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Exactly what was sent</summary>
          <ul className="mt-2 space-y-0.5 text-ink-2">
            {req.sentSummary.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      </div>
      {accepting && (
        <AcceptSheet
          quote={accepting}
          req={req}
          onCancel={() => setAccepting(null)}
          onDone={(shared) => {
            const q = accepting;
            const isSample = q.channel === "sample";
            update((s) => ({
              ...s,
              quoteRequests: s.quoteRequests.map((r) =>
                r.id === req.id
                  ? {
                      ...r,
                      status: "accepted",
                      quotes: r.quotes.map((x) => (x.id === q.id ? { ...x, status: "accepted", exchange: [...x.exchange, { at: nowIso(), from: "motzo", text: `Owner accepted. Shared: ${shared.join(", ")}.${isSample ? " (Sample shop: nothing actually sent.)" : ""}` }] } : x.status === "answered" ? { ...x, status: "not_chosen" } : x)),
                    }
                  : r,
              ),
              sharing: [...s.sharing, { id: uid("sh_"), at: nowIso(), shopName: q.shop.name + (isSample ? " (sample)" : ""), requestId: req.id, shared }],
              jobs: [
                ...s.jobs,
                { id: uid("j_"), vehicleId: req.vehicleId, requestId: req.id, quoteId: q.id, shopName: q.shop.name, job: req.job, total: q.total, status: "booked", history: [{ at: nowIso(), status: "booked", note: `Accepted ${money(q.total)} quote` }] },
              ],
            }));
            addMessage({
              id: uid("m_"),
              vehicleId: req.vehicleId,
              author: "motzo",
              at: nowIso(),
              text: `You accepted ${q.shop.name}'s quote of ${money(q.total)} for "${req.job}". ${isSample ? "This is a sample shop, so nothing was actually sent." : `I shared ${shared.join(", ")} with them.`} The other shops were told no thanks. I'll keep the job in your service history.`,
              cards: [{ kind: "quote", requestId: req.id, quoteId: q.id }],
            });
            setAccepting(null);
            ui.toast("Quote accepted");
          }}
        />
      )}
    </div>
  );
}

function AcceptSheet({ quote, req, onCancel, onDone }: { quote: Quote; req: QuoteRequest; onCancel: () => void; onDone: (shared: string[]) => void }) {
  const { state, update } = useMotzo();
  const [name, setName] = useState(state.owner.name);
  const [phone, setPhone] = useState(state.owner.phone);
  const [email, setEmail] = useState(state.owner.email);
  const [shareEmail, setShareEmail] = useState(false);
  const [shareInsurance, setShareInsurance] = useState(false);
  const policy = state.insurance.find((p) => p.vehicleIds.includes(req.vehicleId)) ?? state.insurance[0];

  const go = () => {
    if (!name.trim() || !phone.trim()) return;
    update((s) => ({ ...s, owner: { ...s.owner, name: name.trim(), phone: phone.trim(), email: email.trim() } }));
    const shared = ["your name", "your phone number"];
    if (shareEmail && email.trim()) shared.push("your email");
    if (shareInsurance && policy) shared.push(`your insurance (${policy.insurer}, policy ${policy.policyNumber})`);
    onDone(shared);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/40 md:items-center" onClick={onCancel}>
      <div className="sheet-up w-full max-w-md space-y-4 rounded-t-3xl bg-surface p-5 pb-[max(env(safe-area-inset-bottom),20px)] md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold">Accept {quote.shop.name}?</h3>
          <p className="text-sm text-ink-2">
            {money(quote.total)} · {quote.earliest}. Only this shop gets your contact details, so they can book you in.
          </p>
        </div>
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="oname">Your name</label>
            <input id="oname" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="ophone">Your phone</label>
            <input id="ophone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          </div>
          <div>
            <label className="label" htmlFor="oemail">Your email (optional)</label>
            <input id="oemail" className="field" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {email.trim() && <Toggle on={shareEmail} set={setShareEmail} label="Share my email too" />}
          {policy && <Toggle on={shareInsurance} set={setShareInsurance} label={`Share my insurance (${policy.insurer}) so they can bill it`} />}
        </div>
        {quote.channel === "sample" && <p className="rounded-xl bg-warn/10 p-3 text-xs text-ink-2">This is a sample shop. Accepting shows how it works; nothing is sent anywhere.</p>}
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onCancel}>
            Not yet
          </button>
          <button className="btn btn-primary flex-1" onClick={go} disabled={!name.trim() || !phone.trim()}>
            Accept and share
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-3">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function QuoteBadge({ q }: { q: Quote }) {
  const map: Record<Quote["status"], [string, string]> = {
    waiting: ["Asking", "bg-surface-2 text-ink-3"],
    answered: [q.channel === "sample" ? "Sample quote" : "Quoted", "bg-accent-soft text-accent"],
    unreachable: ["Not contacted", "bg-surface-2 text-ink-3"],
    declined: ["Declined", "bg-bad/10 text-bad"],
    accepted: ["Accepted", "bg-good/15 text-good"],
    not_chosen: ["Not chosen", "bg-surface-2 text-ink-3"],
  };
  const [t, c] = map[q.status];
  return <span className={cls("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", c)}>{t}</span>;
}
