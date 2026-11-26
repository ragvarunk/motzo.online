export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return prefix + rand;
}

export const nowIso = () => new Date().toISOString();

/** "Tue, Nov 25, 2026 · 4:17:05 PM" in the viewer's own time zone. */
export function fullStamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
  return `${date} · ${time}`;
}

export function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const full = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (same(d, today)) return `Today · ${full}`;
  if (same(d, yesterday)) return `Yesterday · ${full}`;
  return full;
}

export function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "local time";
  }
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function vehicleName(v: { year?: string; make?: string; model?: string; nickname?: string } | null | undefined): string {
  if (!v) return "No vehicle";
  const base = [v.year, v.make, v.model].filter(Boolean).join(" ");
  return v.nickname ? `${v.nickname} (${base})` : base || "Vehicle";
}

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const SHOP_TYPE_LABEL: Record<string, string> = {
  glass: "Auto glass shop",
  body: "Auto body shop",
  repair: "Auto repair shop",
  tire: "Tire shop",
  oil: "Oil change / quick lube",
  other: "Auto service shop",
};
