// Shared types for motzo.online. Everything the owner creates is kept on their
// own device for now (IndexedDB). A server database comes later.

export type ShopType = "glass" | "body" | "repair" | "tire" | "oil" | "other";

export interface Vehicle {
  id: string;
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  vin?: string;
  plate?: string;
  plateState?: string;
  nickname?: string;
  mileage?: number;
  mileageUpdatedAt?: string;
  lastOilChangeMiles?: number;
  oilIntervalMiles?: number;
  photoId?: string;
  createdAt: string;
}

export interface InsurancePolicy {
  id: string;
  vehicleIds: string[];
  insurer: string;
  policyNumber: string;
  claimsPhone: string;
  comprehensiveDeductible: string;
  collisionDeductible: string;
  glassCoverage: string;
  roadside: string;
  rental: string;
  startDate: string;
  endDate: string;
  documentId?: string;
  confirmedAt: string;
}

export type AttachmentKind = "image" | "video" | "document" | "audio";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  /** Small preview for images and video posters. */
  thumb?: string;
  /** What Motzo read from it, kept so later turns can refer back without resending. */
  reading?: string;
  /** Transcript for voice notes and audio files. */
  transcript?: string;
  /** True when the photo came from lens mode. */
  fromLens?: boolean;
}

export type Author = "owner" | "motzo" | "system";

export interface Estimate {
  part: string;
  work: string;
  costLow: number;
  costHigh: number;
  basis: string;
  shopType: ShopType;
  today: "likely" | "maybe" | "unlikely";
  urgency: "safe_to_drive" | "drive_carefully" | "do_not_drive";
  insuranceNote: string;
}

export interface PhotoNeeded {
  label: string;
  why: string;
}

export interface InsuranceFound {
  insurer: string;
  policyNumber: string;
  claimsPhone: string;
  comprehensiveDeductible: string;
  collisionDeductible: string;
  glassCoverage: string;
  roadside: string;
  rental: string;
  startDate: string;
  endDate: string;
  vehicles: string;
}

export interface VehicleFound {
  vin: string;
  plate: string;
  mileage: number | null;
}

export interface ShopSearch {
  shopType: ShopType;
  searchText: string;
}

export type CardData =
  | { kind: "estimate"; estimate: Estimate }
  | { kind: "photos_needed"; photos: PhotoNeeded[] }
  | { kind: "insurance_found"; insurance: InsuranceFound; documentId?: string; saved?: boolean }
  | { kind: "vehicle_found"; found: VehicleFound; saved?: boolean }
  | { kind: "shop_search"; search: ShopSearch }
  | { kind: "offer_quotes"; shopType: ShopType; job: string }
  | { kind: "reminder"; milesSince: number; interval: number }
  | { kind: "quote"; requestId: string; quoteId: string };

export interface Message {
  id: string;
  vehicleId: string;
  author: Author;
  text: string;
  /** ISO timestamp, the exact moment the message was sent. Never edited. */
  at: string;
  attachments?: Attachment[];
  cards?: CardData[];
  /** Reactions on this message, keyed by who reacted. */
  reactions?: { owner?: string; motzo?: string };
  /** Set when the owner sent it by voice. */
  viaVoice?: boolean;
  /** Set on Motzo answers produced without an AI key (demo mode). */
  demo?: boolean;
  error?: boolean;
}

export interface ShopSummary {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number;
  openNow: boolean | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  serviceAreaOnly: boolean;
  lat: number | null;
  lng: number | null;
  distanceMiles: number | null;
  primaryType: string | null;
  verdict: { fit: "good" | "ok" | "poor"; line: string };
  sample?: boolean;
}

export interface ShopReview {
  author: string;
  authorUrl: string | null;
  rating: number;
  text: string;
  when: string;
  publishTime: string | null;
  googleUrl: string | null;
}

export interface ShopDetails extends ShopSummary {
  hours: string[];
  reviews: ShopReview[];
  reviewTakeaway: string | null;
  editorialSummary: string | null;
}

export type QuoteStatus = "waiting" | "answered" | "unreachable" | "declined" | "accepted" | "not_chosen";

export interface QuoteAnswer {
  topic: string;
  question: string;
  answer: string;
}

/** One line in Motzo's conversation with a business. Never edited, only added to. */
export interface ShopExchange {
  at: string;
  from: "motzo" | "shop";
  text: string;
}

export interface Quote {
  id: string;
  shop: Pick<ShopSummary, "placeId" | "name" | "address" | "rating" | "reviewCount" | "distanceMiles" | "serviceAreaOnly" | "phone">;
  status: QuoteStatus;
  total: number | null;
  partsType: string | null;
  earliest: string | null;
  mobile: boolean | null;
  warranty: string | null;
  answers: QuoteAnswer[];
  exchange: ShopExchange[];
  channel: "sample" | "motzo_shop" | "agent" | "text" | "none";
}

export interface QuoteRequest {
  id: string;
  vehicleId: string;
  job: string;
  shopType: ShopType;
  area: string;
  timing: string;
  attachmentIds: string[];
  /** Exactly what went to businesses: never the owner's name, phone, email or street address. */
  sentSummary: string[];
  quotes: Quote[];
  createdAt: string;
  confirmedAt: string;
  status: "collecting" | "accepted" | "cancelled";
}

export interface Job {
  id: string;
  vehicleId: string;
  requestId: string;
  quoteId: string;
  shopName: string;
  job: string;
  total: number | null;
  status: "booked" | "in_progress" | "done";
  history: { at: string; status: Job["status"]; note: string }[];
}

export interface SharingRecord {
  id: string;
  at: string;
  shopName: string;
  requestId: string;
  shared: string[];
}

export interface OwnerProfile {
  name: string;
  phone: string;
  email: string;
  area: string;
}

export interface Settings {
  speakAnswers: boolean;
  robotMotion: "full" | "calm" | "still";
  robotSize: "small" | "normal";
  countMiles: boolean;
}

export interface MotzoState {
  version: 1;
  startedAt: string | null;
  owner: OwnerProfile;
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  insurance: InsurancePolicy[];
  messages: Message[];
  quoteRequests: QuoteRequest[];
  jobs: Job[];
  sharing: SharingRecord[];
  savedShops: { placeId: string; name: string; note: string }[];
  lastShops: ShopSummary[];
  lastShopSearch: ShopSearch | null;
  settings: Settings;
  mileageLog: { vehicleId: string; at: string; miles: number; source: "owner" | "photo" | "phone" }[];
}
