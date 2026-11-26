// Demo answers used when no AI key is set, so the app can be clicked through
// end to end. Every demo answer is marked as a sample in the app.

import type { ShopSummary, ShopType } from "./types";

export interface MotzoReply {
  reply: string;
  reaction: string;
  mood: "neutral" | "happy" | "concerned";
  estimate: null | {
    part: string;
    work: string;
    cost_low: number;
    cost_high: number;
    basis: string;
    shop_type: ShopType;
    today: "likely" | "maybe" | "unlikely";
    urgency: "safe_to_drive" | "drive_carefully" | "do_not_drive";
    insurance_note: string;
  };
  photos_needed: { label: string; why: string }[];
  shop_search: null | { shop_type: ShopType; search_text: string };
  offer_quotes: boolean;
  insurance_found: null | {
    insurer: string;
    policy_number: string;
    claims_phone: string;
    comprehensive_deductible: string;
    collision_deductible: string;
    glass_coverage: string;
    roadside: string;
    rental: string;
    start_date: string;
    end_date: string;
    vehicles: string;
  };
  vehicle_found: null | { vin: string; plate: string; mileage: number | null };
  attachment_notes: string[];
}

const empty = (): MotzoReply => ({
  reply: "",
  reaction: "none",
  mood: "neutral",
  estimate: null,
  photos_needed: [],
  shop_search: null,
  offer_quotes: false,
  insurance_found: null,
  vehicle_found: null,
  attachment_notes: [],
});

export function demoReply(input: {
  text: string;
  imageCount: number;
  documentNames: string[];
  hasInsurance: boolean;
  vehicle: string;
}): MotzoReply {
  const t = input.text.toLowerCase();
  const r = empty();
  const docs = input.documentNames.map((n) => n.toLowerCase());

  if (docs.some((n) => n.includes("insur") || n.includes("policy") || n.includes("card")) || /insurance (card|policy)/.test(t)) {
    r.reply =
      "Sample answer (no AI key set yet): here is what an insurance card reading looks like. Check each field, then tap Save to add it to your profile.";
    r.insurance_found = {
      insurer: "Sample Insurance Co.",
      policy_number: "SAMPLE-123456",
      claims_phone: "",
      comprehensive_deductible: "$500",
      collision_deductible: "$1,000",
      glass_coverage: "Full glass (sample)",
      roadside: "Yes",
      rental: "",
      start_date: "",
      end_date: "",
      vehicles: input.vehicle,
    };
    r.attachment_notes = input.documentNames.map(() => "Insurance document (sample reading)");
    return r;
  }

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(t) && input.imageCount === 0) {
    r.reply = `Hi! I'm Motzo, your ${input.vehicle} helper. Send me a photo of any damage, ask about a noise or a warning light, or tell me what service you need.`;
    r.reaction = "😊";
    r.mood = "happy";
    return r;
  }

  if (/thank/.test(t)) {
    r.reply = "Anytime! I'm here whenever your vehicle needs something.";
    r.reaction = "❤️";
    r.mood = "happy";
    return r;
  }

  const glass = /windshield|windscreen|glass|crack|chip/.test(t) || (input.imageCount > 0 && !/dent|scratch|bumper|tire|oil/.test(t));
  if (glass) {
    r.mood = "concerned";
    r.reply =
      input.imageCount > 0
        ? "Sample answer (no AI key set yet): this looks like a crack across the windshield, which usually means a full replacement rather than a chip repair. A glass shop can often do it the same day, many of them at your home."
        : "Sample answer (no AI key set yet): a crack longer than a dollar bill usually means a new windshield; a small chip can often be repaired. Send me a photo and I'll take a closer look.";
    r.estimate = {
      part: "Windshield",
      work: "Windshield replacement",
      cost_low: 300,
      cost_high: 650,
      basis: "Sample range for a typical sedan without camera recalibration.",
      shop_type: "glass",
      today: "likely",
      urgency: "drive_carefully",
      insurance_note: input.hasInsurance
        ? "Your saved policy may cover glass. Check your comprehensive deductible."
        : "If you have comprehensive coverage, glass is often covered. Add your insurance card to check.",
    };
    r.photos_needed = [
      { label: "Close-up of the damage", why: "Shows the size and type of the crack" },
      { label: "Behind the rear-view mirror", why: "Cameras and sensors change the part and may need calibration" },
      { label: "VIN sticker or windshield VIN", why: "Lets shops find the exact glass" },
    ];
    r.shop_search = { shop_type: "glass", search_text: "windshield replacement" };
    r.offer_quotes = true;
    r.attachment_notes = Array.from({ length: input.imageCount }, () => "Photo of windshield damage (sample reading)");
    return r;
  }

  if (/dent|scratch|bumper|fender|paint|collision|accident/.test(t)) {
    r.mood = "concerned";
    r.reply =
      "Sample answer (no AI key set yet): body damage like this is a job for an auto body shop. Paintless dent repair can be much cheaper if the paint isn't cracked.";
    r.estimate = {
      part: "Body panel",
      work: "Dent and paint repair",
      cost_low: 250,
      cost_high: 1500,
      basis: "Sample range; depends a lot on size and whether paint is damaged.",
      shop_type: "body",
      today: "unlikely",
      urgency: "safe_to_drive",
      insurance_note: "Collision coverage may apply after your collision deductible.",
    };
    r.photos_needed = [
      { label: "Wide photo of the side of the vehicle", why: "Shows where the damage is" },
      { label: "Close-up at an angle", why: "Shows depth of the dent and paint damage" },
    ];
    r.shop_search = { shop_type: "body", search_text: "auto body collision repair" };
    r.offer_quotes = true;
    return r;
  }

  if (/oil/.test(t)) {
    r.reply =
      "Sample answer (no AI key set yet): most modern cars need an oil change every 5,000 to 7,500 miles with synthetic oil. Tell me your current mileage and when you last changed it, and I'll remind you.";
    r.shop_search = { shop_type: "oil", search_text: "oil change" };
    return r;
  }

  if (/tire|flat|tyre/.test(t)) {
    r.reply = "Sample answer (no AI key set yet): a tire shop can patch most tread punctures for $20 to $40. Sidewall damage means a new tire.";
    r.shop_search = { shop_type: "tire", search_text: "tire repair" };
    return r;
  }

  if (/brake|rotor|caliper|\bpads?\b/.test(t)) {
    r.mood = "concerned";
    r.reply =
      "Sample answer (no AI key set yet): a brake job usually means new pads, and often new rotors too. Most repair shops can do it the same day. If the pedal feels soft or you hear grinding, get it checked soon.";
    r.estimate = {
      part: "Brake pads and rotors",
      work: "Front brake pads and rotors",
      cost_low: 250,
      cost_high: 600,
      basis: "Sample range for one axle on a typical sedan; pads only is often $150 to $300.",
      shop_type: "repair",
      today: "likely",
      urgency: "drive_carefully",
      insurance_note: "Brake wear is normal upkeep, so insurance usually doesn't cover it.",
    };
    r.shop_search = { shop_type: "repair", search_text: "brake repair" };
    r.offer_quotes = true;
    return r;
  }

  if (/noise|sound|light|engine|check engine|warning/.test(t)) {
    r.mood = "concerned";
    r.reply =
      "Sample answer (no AI key set yet): that could have a few causes. Send a photo of the dashboard light or a short video with the noise, and I'll narrow it down. A repair shop should check it.";
    r.shop_search = { shop_type: "repair", search_text: "auto repair" };
    return r;
  }

  if (/weather|recipe|movie|stock|joke/.test(t)) {
    r.reply = "I only help with vehicles, but I'm happy to help with anything your car needs.";
    return r;
  }

  r.reply =
    "Sample answer (no AI key set yet). Once the AI key is added I'll answer this properly. Try sending a photo of damage, or ask about a windshield, a dent, an oil change or a warning light.";
  return r;
}

export function demoShops(type: ShopType): ShopSummary[] {
  const names: Record<ShopType, string[]> = {
    glass: ["Sample Glass Pros", "Sample Mobile Windshields", "Sample Auto Glass Center"],
    body: ["Sample Collision Works", "Sample Dent & Paint", "Sample Body Shop"],
    repair: ["Sample Auto Repair", "Sample Car Care", "Sample Motors Service"],
    tire: ["Sample Tire Center", "Sample Wheels & Tires", "Sample Tire Express"],
    oil: ["Sample Quick Lube", "Sample Oil & Go", "Sample Car Care"],
    other: ["Sample Auto Service", "Sample Garage", "Sample Car Care"],
  };
  const base = [
    { rating: 4.8, count: 312, mobile: true, dist: 2.1, open: true },
    { rating: 4.5, count: 88, mobile: false, dist: 3.4, open: true },
    { rating: 3.9, count: 41, mobile: false, dist: 5.8, open: false },
  ];
  return names[type].map((name, i) => ({
    placeId: `sample-${type}-${i}`,
    name,
    address: "Sample address (add a Google Maps key for real shops)",
    rating: base[i].rating,
    reviewCount: base[i].count,
    openNow: base[i].open,
    phone: "(555) 010-01" + (10 + i),
    website: null,
    mapsUrl: null,
    serviceAreaOnly: base[i].mobile,
    lat: null,
    lng: null,
    distanceMiles: base[i].dist,
    primaryType: null,
    verdict: { fit: i === 0 ? "good" : i === 1 ? "ok" : "poor", line: "" },
    sample: true,
  }));
}
