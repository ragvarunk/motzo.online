import type { ShopSummary, ShopType } from "./types";

const JOB_WORDS: Record<ShopType, string> = {
  glass: "glass",
  body: "body work",
  repair: "repairs",
  tire: "tires",
  oil: "oil changes",
  other: "this job",
};

/**
 * Motzo's short "is this the right shop?" line. It weighs what we know for
 * sure: rating, number of reviews, distance, open now, and whether the shop
 * comes to the owner. Review themes are added on the shop's detail screen.
 */
export function shopVerdict(s: Omit<ShopSummary, "verdict">, type: ShopType): ShopSummary["verdict"] {
  const parts: string[] = [];
  let score = 0;

  parts.push(`does ${JOB_WORDS[type]}`);
  if (s.serviceAreaOnly) {
    parts.push("comes to you");
    score += 1;
  }
  if (s.rating !== null) {
    parts.push(`${s.rating.toFixed(1)} from ${s.reviewCount.toLocaleString()} reviews`);
    if (s.rating >= 4.6 && s.reviewCount >= 50) score += 2;
    else if (s.rating >= 4.3 && s.reviewCount >= 15) score += 1;
    else if (s.rating < 4.0) score -= 2;
    if (s.reviewCount < 10) score -= 1;
  } else {
    parts.push("no Google rating yet");
    score -= 1;
  }
  if (s.distanceMiles !== null) {
    parts.push(`${s.distanceMiles.toFixed(1)} mi away`);
    if (s.distanceMiles > 15) score -= 1;
  }
  if (s.openNow === true) parts.push("open now");
  if (s.openNow === false) parts.push("closed now");

  const fit: ShopSummary["verdict"]["fit"] = score >= 2 ? "good" : score >= 0 ? "ok" : "poor";
  const lead = fit === "good" ? "Good fit" : fit === "ok" ? "Worth a look" : "Probably not the best pick";
  return { fit, line: `${lead}: ${parts.join(", ")}.` };
}
