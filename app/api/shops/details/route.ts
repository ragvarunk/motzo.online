import { demoShops } from "@/lib/demo";
import { shopDetails } from "@/lib/places";
import { REVIEWS_SYSTEM } from "@/lib/prompt";
import { anthropic, badRequest, checkAccess, hasAnthropic, MODEL } from "@/lib/server";
import type { ShopDetails, ShopType } from "@/lib/types";
import { shopVerdict } from "@/lib/verdict";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const u = new URL(req.url);
  const placeId = u.searchParams.get("id") ?? "";
  const type = (u.searchParams.get("type") || "other") as ShopType;
  const job = (u.searchParams.get("job") || "").slice(0, 120);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const origin = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
  if (!placeId) return badRequest("no_id");

  if (placeId.startsWith("sample-")) {
    const s = demoShops(type).find((x) => x.placeId === placeId) ?? demoShops(type)[0];
    const details: ShopDetails = {
      ...s,
      verdict: shopVerdict(s, type),
      hours: ["Monday: 8:00 AM – 6:00 PM (sample)", "Saturday: 9:00 AM – 2:00 PM (sample)", "Sunday: Closed (sample)"],
      reviews: [
        { author: "Sample reviewer", authorUrl: null, rating: 5, text: "Sample review: came to my house, replaced the windshield in an hour.", when: "2 weeks ago", publishTime: null, googleUrl: null },
        { author: "Sample reviewer", authorUrl: null, rating: 2, text: "Sample review: had to reschedule twice.", when: "4 months ago", publishTime: null, googleUrl: null },
      ],
      reviewTakeaway: "Sample: people like the mobile service; one complaint about rescheduling four months ago.",
      editorialSummary: null,
    };
    return Response.json(details);
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return badRequest("maps_not_set", 400);
  try {
    const details = await shopDetails({ key, placeId, type, origin });
    if (hasAnthropic() && details.reviews.length) {
      try {
        const text = details.reviews
          .map((r) => `${r.rating} stars, ${r.when}: ${r.text.slice(0, 800)}`)
          .join("\n---\n");
        const response = await anthropic().messages.create({
          model: MODEL,
          max_tokens: 1500,
          output_config: { effort: "low" },
          system: REVIEWS_SYSTEM,
          messages: [{ role: "user", content: `Job: ${job || type}\nShop: ${details.name}\nReviews:\n${text}` }],
        });
        if (response.stop_reason !== "refusal") {
          details.reviewTakeaway =
            response.content
              .filter((b) => b.type === "text")
              .map((b) => (b.type === "text" ? b.text : ""))
              .join("")
              .trim() || null;
        }
      } catch (e) {
        console.error("review summary", e);
      }
    }
    return Response.json(details);
  } catch (err) {
    console.error(err);
    return badRequest("Couldn't reach Google Maps right now.", 502);
  }
}
