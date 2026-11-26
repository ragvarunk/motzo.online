import { badRequest } from "@/lib/server";

export const runtime = "nodejs";

// Decodes a VIN with NHTSA's free public decoder (no key needed).
export async function GET(req: Request) {
  const vin = new URL(req.url).searchParams.get("vin")?.trim().toUpperCase() ?? "";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return badRequest("A VIN has 17 letters and numbers (no I, O or Q).");
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return badRequest("The VIN decoder didn't answer. Enter the details by hand.", 502);
    const json = (await res.json()) as { Results?: Record<string, string>[] };
    const r = json.Results?.[0] ?? {};
    const engineParts = [r.DisplacementL ? `${Number(r.DisplacementL).toFixed(1)}L` : "", r.EngineCylinders ? `${r.EngineCylinders}-cyl` : "", r.FuelTypePrimary || ""]
      .filter(Boolean)
      .join(" ");
    const out = {
      vin,
      year: r.ModelYear || "",
      make: r.Make ? r.Make.charAt(0) + r.Make.slice(1).toLowerCase() : "",
      model: r.Model || "",
      trim: r.Trim || r.Series || "",
      body: r.BodyClass || "",
      engine: engineParts,
      ok: Boolean(r.ModelYear && r.Make),
      note: r.ErrorCode && r.ErrorCode !== "0" ? r.ErrorText || "" : "",
    };
    return Response.json(out);
  } catch {
    return badRequest("The VIN decoder didn't answer. Enter the details by hand.", 502);
  }
}
