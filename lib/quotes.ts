"use client";

import { SHOP_QUESTIONS } from "./questions";
import type { MotzoState, Quote, QuoteRequest, ShopSummary } from "./types";
import { nowIso, sleep, uid } from "./util";

// How Motzo reaches businesses. No phone calls, by design. The real channels
// (businesses on motzo.shop, the business's own AI agent, or a text message)
// are not connected yet, so:
//  - sample shops answer with clearly-labelled sample quotes, to test the flow;
//  - real shops are marked "not contacted yet" and nothing is sent to them.

type Update = (fn: (s: MotzoState) => MotzoState) => void;

function patchQuote(update: Update, requestId: string, quoteId: string, fn: (q: Quote) => Quote) {
  update((s) => ({
    ...s,
    quoteRequests: s.quoteRequests.map((r) =>
      r.id === requestId ? { ...r, quotes: r.quotes.map((q) => (q.id === quoteId ? fn(q) : q)) } : r,
    ),
  }));
}

export function newQuote(shop: ShopSummary): Quote {
  return {
    id: uid("q_"),
    shop: {
      placeId: shop.placeId,
      name: shop.name,
      address: shop.address,
      rating: shop.rating,
      reviewCount: shop.reviewCount,
      distanceMiles: shop.distanceMiles,
      serviceAreaOnly: shop.serviceAreaOnly,
      phone: shop.phone,
    },
    status: "waiting",
    total: null,
    partsType: null,
    earliest: null,
    mobile: null,
    warranty: null,
    answers: [],
    exchange: [],
    channel: shop.sample ? "sample" : "none",
  };
}

function requestText(r: QuoteRequest): string {
  return [
    `Quote request from Motzo for a private vehicle owner (contact details are shared only if they accept your quote).`,
    ...r.sentSummary,
    `Please answer: ${SHOP_QUESTIONS.map((q) => q.topic.toLowerCase()).join(", ")}.`,
  ].join("\n");
}

function sampleAnswers(r: QuoteRequest, q: Quote, i: number) {
  const glass = r.shopType === "glass";
  const base = glass ? [389, 445, 512][i % 3] : r.shopType === "body" ? [640, 780, 925][i % 3] : [180, 240, 310][i % 3];
  const partsType = glass ? ["OEM-equivalent (sample brand)", "Aftermarket (sample brand)", "OEM (dealer glass)"][i % 3] : ["OEM", "OEM-equivalent", "Aftermarket"][i % 3];
  const earliest = ["Today, 3:00 PM", "Tomorrow, 9:00 AM", "Friday, 1:00 PM"][i % 3];
  const mobile = q.shop.serviceAreaOnly || i === 0;
  const answers = [
    { topic: "Price", answer: `$${base} total: parts $${Math.round(base * 0.55)}, labor $${Math.round(base * 0.35)}, fees and tax $${base - Math.round(base * 0.55) - Math.round(base * 0.35)}. Price holds unless the part number changes after we see the vehicle.` },
    { topic: "Parts", answer: `${partsType}. In stock.` },
    { topic: "Materials", answer: glass ? "Urethane adhesive; safe to drive after 1 hour." : "Factory-matched paint and filler." },
    { topic: "How the work is done", answer: `${mobile ? "At your location" : "In our shop"}, about ${glass ? "1 hour" : "3 hours"}.` },
    { topic: "Timing", answer: earliest },
    { topic: "Who does it", answer: `${3 + i} technicians, ${8 + i * 4} years in business, certified technicians.` },
    { topic: "Safety systems", answer: glass ? "If your vehicle has a camera behind the mirror, we recalibrate it for $150 (not included above)." : "No calibration needed for this job." },
    { topic: "Warranty", answer: ["Lifetime on workmanship, 1 year on leaks", "12 months", "Lifetime against leaks"][i % 3] },
    { topic: "Insurance", answer: "We can bill most insurers directly; you pay your deductible." },
    { topic: "Payment", answer: "Card or cash when the job is done." },
  ].map((a) => ({ ...a, question: SHOP_QUESTIONS.find((x) => x.topic === a.topic)?.question ?? "" }));
  return { total: base, partsType, earliest, mobile, warranty: answers[7].answer, answers };
}

/** Starts collecting quotes for a confirmed request. */
export async function collectQuotes(update: Update, request: QuoteRequest) {
  const text = requestText(request);
  // Log what was sent to each business, with its time.
  for (const q of request.quotes) {
    if (q.channel === "none") {
      patchQuote(update, request.id, q.id, (x) => ({
        ...x,
        status: "unreachable",
        exchange: [
          ...x.exchange,
          {
            at: nowIso(),
            from: "motzo",
            text: "Not contacted. Motzo has no connection to this business yet (no API, agent or text channel set up). Nothing about you was sent.",
          },
        ],
      }));
    } else {
      patchQuote(update, request.id, q.id, (x) => ({ ...x, exchange: [...x.exchange, { at: nowIso(), from: "motzo", text }] }));
    }
  }

  const samples = request.quotes.filter((q) => q.channel === "sample");
  for (let i = 0; i < samples.length; i++) {
    await sleep(1800 + i * 1500);
    const q = samples[i];
    const a = sampleAnswers(request, q, i);
    patchQuote(update, request.id, q.id, (x) => ({
      ...x,
      status: "answered",
      total: a.total,
      partsType: a.partsType,
      earliest: a.earliest,
      mobile: a.mobile,
      warranty: a.warranty,
      answers: a.answers,
      exchange: [
        ...x.exchange,
        {
          at: nowIso(),
          from: "shop",
          text: `SAMPLE REPLY (not a real business): ${a.answers.map((y) => `${y.topic}: ${y.answer}`).join(" | ")}`,
        },
      ],
    }));
  }
}

export function requestSummary(input: {
  vehicle: string;
  vin?: string;
  job: string;
  area: string;
  timing: string;
  photoCount: number;
  insurancePay: boolean;
}): string[] {
  return [
    `Vehicle: ${input.vehicle}`,
    input.vin ? `VIN: ${input.vin}` : "VIN: not provided",
    `Job: ${input.job}`,
    `Photos: ${input.photoCount}`,
    `Area: ${input.area || "near the owner"}`,
    `Preferred timing: ${input.timing}`,
    `Insurance: ${input.insurancePay ? "may go through insurance" : "paying directly"}`,
  ];
}
