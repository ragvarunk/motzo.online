"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { useMotzo } from "@/lib/store";
import type { ShopDetails, ShopSummary, ShopType } from "@/lib/types";
import { cls, SHOP_TYPE_LABEL } from "@/lib/util";
import { useEngine } from "./ChatEngine";
import { Icon, PanelHeader, useUi } from "./ui";

const TYPES: ShopType[] = ["glass", "body", "repair", "tire", "oil"];
const SHORT: Record<ShopType, string> = { glass: "Glass", body: "Body", repair: "Repair", tire: "Tires", oil: "Oil change", other: "Other" };

/** Nearest shops of the right kind, with a plain verdict on whether each is right for the job. */
export function ShopsPanel({ shopType = "repair", searchText, onClose }: { shopType?: ShopType; searchText?: string; onClose: () => void }) {
  const { state, update } = useMotzo();
  const { location, requestLocation, services } = useEngine();
  const ui = useUi();
  const [type, setType] = useState<ShopType>(shopType);
  const [area, setArea] = useState(state.owner.area);
  const [shops, setShops] = useState<ShopSummary[] | null>(null);
  const [sample, setSample] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useCallback(
    async (t: ShopType, loc: { lat: number; lng: number } | null, where: string) => {
      setBusy(true);
      setMsg(null);
      try {
        const q = new URLSearchParams({ type: t, q: searchText && t === shopType ? searchText : SHOP_TYPE_LABEL[t] });
        if (loc) {
          q.set("lat", String(loc.lat));
          q.set("lng", String(loc.lng));
        }
        if (where) q.set("area", where);
        const r = await apiJson<{ sample: boolean; shops: ShopSummary[] }>(`/api/shops?${q}`);
        setShops(r.shops);
        setSample(r.sample);
        update((s) => ({ ...s, lastShops: r.shops, lastShopSearch: { shopType: t, searchText: q.get("q") ?? "" } }));
      } catch (e) {
        const m = e instanceof Error ? e.message : "";
        setMsg(m === "need_location" ? "Share your location or type your city or ZIP so I can find shops near you." : m || "Couldn't load shops.");
        setShops(null);
      } finally {
        setBusy(false);
      }
    },
    [searchText, shopType, update],
  );

  useEffect(() => {
    if (!services.maps) {
      search(type, null, "");
      return;
    }
    if (location || area) search(type, location, area);
    else
      requestLocation().then((loc) => {
        if (loc) search(type, loc, "");
        else setMsg("Share your location or type your city or ZIP so I can find shops near you.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Shops near you" subtitle={sample ? "Sample shops: add the Google Maps key for real ones" : "From Google Maps"} onClose={onClose} />
      <div className="space-y-3 border-b border-line p-4">
        <div className="scroll-thin flex gap-2 overflow-x-auto">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)} className={cls("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold", t === type ? "border-accent bg-accent text-accent-ink" : "border-line")}>
              {SHORT[t]}
            </button>
          ))}
        </div>
        {services.maps && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update((s) => ({ ...s, owner: { ...s.owner, area } }));
              search(type, null, area);
            }}
          >
            <input className="field" placeholder="City or ZIP" value={area} onChange={(e) => setArea(e.target.value)} aria-label="City or ZIP" />
            <button className="btn btn-soft shrink-0" type="button" onClick={async () => { const l = await requestLocation(); if (l) search(type, l, ""); else ui.toast("Location is off"); }} aria-label="Use my location">
              <Icon name="pin" className="h-4 w-4" />
            </button>
            <button className="btn btn-primary shrink-0" type="submit">
              Search
            </button>
          </form>
        )}
      </div>
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-4">
        {busy && <p className="text-sm text-ink-3">Finding {SHOP_TYPE_LABEL[type].toLowerCase()}s…</p>}
        {msg && <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">{msg}</p>}
        {shops?.length === 0 && !busy && <p className="text-sm text-ink-2">No {SHOP_TYPE_LABEL[type].toLowerCase()}s found there. Try a nearby city.</p>}
        {shops?.map((s) => (
          <ShopRow key={s.placeId} shop={s} onOpen={() => ui.open({ type: "shop", placeId: s.placeId, shopType: type, job: searchText })} />
        ))}
        {shops && shops.length > 0 && (
          <button className="btn btn-primary mt-2 w-full" onClick={() => ui.open({ type: "newQuote", shopType: type, job: searchText || SHOP_TYPE_LABEL[type] })}>
            Get quotes from these shops
          </button>
        )}
        {!sample && shops && shops.length > 0 && <p className="pt-2 text-center text-[11px] text-ink-3">Shop data © Google</p>}
      </div>
    </div>
  );
}

const FIT = { good: "bg-good/12 text-good", ok: "bg-warn/12 text-warn", poor: "bg-bad/12 text-bad" };

function ShopRow({ shop: s, onOpen }: { shop: ShopSummary; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card block w-full p-3.5 text-left hover:border-accent">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{s.name}</p>
          <p className="truncate text-xs text-ink-3">{s.address}</p>
        </div>
        <div className="shrink-0 text-right text-sm">
          {s.rating !== null && (
            <p className="flex items-center justify-end gap-1 font-semibold">
              <Icon name="star" className="h-4 w-4 fill-current text-warn" />
              {s.rating.toFixed(1)}
            </p>
          )}
          <p className="text-xs text-ink-3">{s.reviewCount.toLocaleString()} reviews</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {s.distanceMiles !== null && <span className="rounded-full bg-surface-2 px-2 py-1">{s.distanceMiles.toFixed(1)} mi</span>}
        {s.serviceAreaOnly && <span className="rounded-full bg-accent-soft px-2 py-1 font-semibold text-accent">Comes to you</span>}
        {s.openNow !== null && <span className={cls("rounded-full px-2 py-1", s.openNow ? "bg-good/12 text-good" : "bg-surface-2 text-ink-3")}>{s.openNow ? "Open now" : "Closed now"}</span>}
        {s.sample && <span className="rounded-full bg-warn/12 px-2 py-1 font-semibold text-warn">Sample</span>}
      </div>
      {s.verdict.line && <p className={cls("mt-2 rounded-lg px-2.5 py-1.5 text-xs font-medium", FIT[s.verdict.fit])}>{s.verdict.line}</p>}
    </button>
  );
}

/** One shop in full: reviews, what people complain about, hours, and how to reach it through Motzo. */
export function ShopDetailsPanel({ placeId, shopType, job, onClose, onBack }: { placeId: string; shopType: ShopType; job?: string; onClose: () => void; onBack: () => void }) {
  const { update, state } = useMotzo();
  const { location, services } = useEngine();
  const ui = useUi();
  const [d, setD] = useState<ShopDetails | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showPhone, setShowPhone] = useState(false);
  const saved = state.savedShops.some((x) => x.placeId === placeId);

  useEffect(() => {
    const q = new URLSearchParams({ id: placeId, type: shopType });
    if (job) q.set("job", job);
    if (location) {
      q.set("lat", String(location.lat));
      q.set("lng", String(location.lng));
    }
    apiJson<ShopDetails>(`/api/shops/details?${q}`)
      .then(setD)
      .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load this shop."));
  }, [placeId, shopType, job, location]);

  const embed = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const badReviews = d?.reviews.filter((r) => r.rating <= 2) ?? [];

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={d?.name ?? "Shop"} subtitle={d?.sample ? "Sample shop" : d?.address} onClose={onClose} onBack={onBack} />
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {err && <p className="rounded-xl bg-surface-2 p-3 text-sm">{err}</p>}
        {!d && !err && <p className="text-sm text-ink-3">Loading…</p>}
        {d && (
          <>
            {services.mapEmbed && embed && !d.sample && (
              <iframe
                title={`Map of ${d.name}`}
                className="h-48 w-full rounded-2xl border border-line"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(embed)}&q=place_id:${encodeURIComponent(d.placeId)}`}
              />
            )}
            <div className={cls("rounded-xl p-3 text-sm font-medium", FIT[d.verdict.fit])}>{d.verdict.line}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat big={d.rating !== null ? d.rating.toFixed(1) : "—"} small="rating" />
              <Stat big={d.reviewCount.toLocaleString()} small="reviews" />
              <Stat big={d.distanceMiles !== null ? `${d.distanceMiles.toFixed(1)} mi` : "—"} small="away" />
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {d.serviceAreaOnly && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent">Mobile: comes to you</span>}
              {d.openNow !== null && <span className="rounded-full bg-surface-2 px-2.5 py-1">{d.openNow ? "Open now" : "Closed now"}</span>}
            </div>

            {d.reviewTakeaway && (
              <section>
                <h3 className="mb-1 text-sm font-bold">What reviewers say</h3>
                <p className="text-sm text-ink-2">{d.reviewTakeaway}</p>
              </section>
            )}
            {badReviews.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-bold">Low ratings among the latest reviews</h3>
                <p className="text-sm text-ink-2">
                  {badReviews.length} of the {d.reviews.length} most relevant reviews Google shares rated 2 stars or less, most recent {badReviews[0].when}.
                </p>
              </section>
            )}
            <section>
              <h3 className="mb-2 text-sm font-bold">Reviews</h3>
              <div className="space-y-2">
                {d.reviews.map((r, i) => (
                  <div key={i} className="rounded-xl bg-surface-2 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      {r.authorUrl ? (
                        <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                          {r.author}
                        </a>
                      ) : (
                        <span className="font-semibold">{r.author}</span>
                      )}
                      <span className="text-ink-3">
                        {"★".repeat(Math.round(r.rating))}
                        {"☆".repeat(5 - Math.round(r.rating))} · {r.when}
                      </span>
                    </div>
                    <p className="mt-1 text-ink-2">{r.text}</p>
                    {r.googleUrl && (
                      <a href={r.googleUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-ink-3 hover:underline">
                        On Google Maps
                      </a>
                    )}
                  </div>
                ))}
                {d.reviews.length === 0 && <p className="text-sm text-ink-3">No reviews shared.</p>}
              </div>
              {!d.sample && <p className="mt-2 text-[11px] text-ink-3">Reviews from Google. Google shares up to 5 per shop; years in business and number of technicians come from the shop's own answers when you request a quote.</p>}
            </section>
            {d.editorialSummary && <p className="text-sm text-ink-2">{d.editorialSummary}</p>}
            {d.hours.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-bold">Hours</h3>
                <ul className="text-sm text-ink-2">
                  {d.hours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="space-y-2">
              <button className="btn btn-primary w-full" onClick={() => ui.open({ type: "newQuote", shopType, job: job || SHOP_TYPE_LABEL[shopType] })}>
                Ask for a quote through Motzo
              </button>
              <p className="text-center text-xs text-ink-3">Motzo asks for you. Your name and phone stay private until you accept a quote.</p>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost flex-1"
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      savedShops: saved ? s.savedShops.filter((x) => x.placeId !== placeId) : [...s.savedShops, { placeId, name: d.name, note: "" }],
                    }))
                  }
                >
                  {saved ? "Saved ✓" : "Save shop"}
                </button>
                {d.phone &&
                  (showPhone ? (
                    <a className="btn btn-ghost flex-1" href={`tel:${d.phone.replace(/[^0-9+]/g, "")}`}>
                      <Icon name="phone" className="h-4 w-4" /> {d.phone}
                    </a>
                  ) : (
                    <button className="btn btn-ghost flex-1" onClick={() => setShowPhone(true)}>
                      Show phone number
                    </button>
                  ))}
              </div>
              <div className="flex gap-2 text-sm">
                {d.website && (
                  <a className="text-accent hover:underline" href={d.website} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                )}
                {d.mapsUrl && (
                  <a className="text-accent hover:underline" href={d.mapsUrl} target="_blank" rel="noopener noreferrer">
                    Open in Google Maps
                  </a>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <p className="text-lg font-bold">{big}</p>
      <p className="text-xs text-ink-3">{small}</p>
    </div>
  );
}
