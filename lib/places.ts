import "server-only";
import type { ShopDetails, ShopReview, ShopSummary, ShopType } from "./types";
import { milesBetween } from "./util";
import { shopVerdict } from "./verdict";

// Google Places API (New). Only the place ID may be stored for good; other
// details are fetched fresh each time they are shown, per Google's terms.

const BASE = "https://places.googleapis.com/v1";

interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  pureServiceAreaBusiness?: boolean;
  location?: { latitude: number; longitude: number };
  primaryTypeDisplayName?: { text: string };
  editorialSummary?: { text: string };
  reviews?: {
    rating?: number;
    text?: { text: string };
    originalText?: { text: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
    googleMapsUri?: string;
    authorAttribution?: { displayName?: string; uri?: string };
  }[];
}

const SUMMARY_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "currentOpeningHours.openNow",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "pureServiceAreaBusiness",
  "location",
  "primaryTypeDisplayName",
];

function toSummary(p: GPlace, type: ShopType, origin: { lat: number; lng: number } | null): ShopSummary {
  const lat = p.location?.latitude ?? null;
  const lng = p.location?.longitude ?? null;
  const base = {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed shop",
    address: p.formattedAddress ?? "",
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? 0,
    openNow: p.currentOpeningHours?.openNow ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    serviceAreaOnly: Boolean(p.pureServiceAreaBusiness),
    lat,
    lng,
    distanceMiles: origin && lat !== null && lng !== null ? milesBetween(origin, { lat, lng }) : null,
    primaryType: p.primaryTypeDisplayName?.text ?? null,
  };
  return { ...base, verdict: shopVerdict(base, type) };
}

export async function searchShops(opts: {
  key: string;
  type: ShopType;
  text: string;
  origin: { lat: number; lng: number } | null;
  area: string;
}): Promise<ShopSummary[]> {
  const query = opts.origin ? opts.text : `${opts.text} near ${opts.area}`;
  const body: Record<string, unknown> = { textQuery: query, pageSize: 10 };
  if (opts.origin) {
    body.locationBias = { circle: { center: { latitude: opts.origin.lat, longitude: opts.origin.lng }, radius: 25000 } };
  }
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": opts.key,
      "X-Goog-FieldMask": SUMMARY_FIELDS.map((f) => `places.${f}`).join(","),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`places ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { places?: GPlace[] };
  const shops = (json.places ?? []).map((p) => toSummary(p, opts.type, opts.origin));
  const rank = { good: 0, ok: 1, poor: 2 } as const;
  return shops.sort((a, b) => rank[a.verdict.fit] - rank[b.verdict.fit] || (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));
}

export async function shopDetails(opts: {
  key: string;
  placeId: string;
  type: ShopType;
  origin: { lat: number; lng: number } | null;
}): Promise<ShopDetails> {
  const fields = [...SUMMARY_FIELDS.filter((f) => f !== "currentOpeningHours.openNow"), "currentOpeningHours", "regularOpeningHours", "reviews", "editorialSummary"];
  const res = await fetch(`${BASE}/places/${encodeURIComponent(opts.placeId)}`, {
    headers: { "X-Goog-Api-Key": opts.key, "X-Goog-FieldMask": fields.join(",") },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`place ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const p = (await res.json()) as GPlace;
  const summary = toSummary(p, opts.type, opts.origin);
  const reviews: ShopReview[] = (p.reviews ?? []).map((r) => ({
    author: r.authorAttribution?.displayName ?? "Google user",
    authorUrl: r.authorAttribution?.uri ?? null,
    rating: r.rating ?? 0,
    text: r.text?.text ?? r.originalText?.text ?? "",
    when: r.relativePublishTimeDescription ?? "",
    publishTime: r.publishTime ?? null,
    googleUrl: r.googleMapsUri ?? null,
  }));
  return {
    ...summary,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? p.currentOpeningHours?.weekdayDescriptions ?? [],
    reviews,
    reviewTakeaway: null,
    editorialSummary: p.editorialSummary?.text ?? null,
  };
}
