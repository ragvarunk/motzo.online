import { demoShops } from "@/lib/demo";
import { searchShops } from "@/lib/places";
import { badRequest, checkAccess } from "@/lib/server";
import type { ShopType } from "@/lib/types";
import { shopVerdict } from "@/lib/verdict";

export const runtime = "nodejs";

const TYPES = new Set(["glass", "body", "repair", "tire", "oil", "other"]);

export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const u = new URL(req.url);
  const type = (TYPES.has(u.searchParams.get("type") ?? "") ? u.searchParams.get("type") : "other") as ShopType;
  const text = (u.searchParams.get("q") || "auto repair").slice(0, 120);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const area = (u.searchParams.get("area") || "").slice(0, 80);
  const origin = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    const shops = demoShops(type).map((s) => ({ ...s, verdict: shopVerdict(s, type) }));
    return Response.json({ sample: true, shops });
  }
  if (!origin && !area) return badRequest("need_location");
  try {
    const shops = await searchShops({ key, type, text, origin, area });
    return Response.json({ sample: false, shops });
  } catch (err) {
    console.error(err);
    return badRequest("Couldn't reach Google Maps right now.", 502);
  }
}
