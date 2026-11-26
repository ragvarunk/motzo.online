"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { api, AccessCodeNeeded } from "@/lib/api";
import { blobToBase64, compressImage, kindOf, thumbnail, videoFrames } from "@/lib/media";
import { speak } from "@/lib/speech";
import { putFile, useMotzo } from "@/lib/store";
import type { Attachment, CardData, Message, MotzoState, ShopType } from "@/lib/types";
import { nowIso, timeZoneName, uid, vehicleName } from "@/lib/util";
import type { MotzoReply } from "@/lib/demo";
import { useRobot } from "./Robot";

interface SendInput {
  text: string;
  files?: File[];
  viaVoice?: boolean;
  fromLens?: boolean;
  /** Spoken aloud regardless of the setting (voice mode). */
  speakReply?: boolean;
  /** A voice note recorded in the chat, with what the browser heard. */
  voiceNote?: { blob: Blob; transcript: string };
}

interface Engine {
  send: (input: SendInput) => Promise<string | null>;
  busy: boolean;
  services: { ai: boolean; maps: boolean; voice: boolean; mapEmbed: boolean };
  setServices: (s: Engine["services"]) => void;
  location: { lat: number; lng: number } | null;
  requestLocation: () => Promise<{ lat: number; lng: number } | null>;
  postMotzo: (text: string, cards?: CardData[]) => void;
}

const EngineCtx = createContext<Engine | null>(null);

const MAX_DOC_BYTES = 3.2 * 1024 * 1024;
const MAX_VIDEO_STORE = 60 * 1024 * 1024;

function insuranceLine(state: MotzoState, vehicleId: string): string {
  const p = state.insurance.find((i) => i.vehicleIds.includes(vehicleId)) ?? state.insurance[0];
  if (!p) return "none";
  return [
    p.insurer,
    p.comprehensiveDeductible && `comprehensive deductible ${p.comprehensiveDeductible}`,
    p.collisionDeductible && `collision deductible ${p.collisionDeductible}`,
    p.glassCoverage && `glass: ${p.glassCoverage}`,
    p.roadside && `roadside: ${p.roadside}`,
    p.rental && `rental: ${p.rental}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function ChatEngineProvider({ children }: { children: ReactNode }) {
  const { state, activeVehicle, addMessage, patchMessage } = useMotzo();
  const robot = useRobot();
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState({ ai: false, maps: false, voice: false, mapEmbed: false });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const requestLocation = useCallback(async () => {
    if (location) return location;
    if (!("geolocation" in navigator)) return null;
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
          setLocation(loc);
          resolve(loc);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      );
    });
  }, [location]);

  const postMotzo = useCallback(
    (text: string, cards?: CardData[]) => {
      if (!activeVehicle) return;
      addMessage({ id: uid("m_"), vehicleId: activeVehicle.id, author: "motzo", text, at: nowIso(), cards });
    },
    [activeVehicle, addMessage],
  );

  const send = useCallback(
    async (input: SendInput): Promise<string | null> => {
      const vehicle = activeVehicle;
      if (!vehicle) return null;
      const files = input.files ?? [];
      if (!input.text.trim() && files.length === 0 && !input.voiceNote) return null;
      setBusy(true);
      robot.setMood("thinking");

      // 1. Prepare attachments: keep the original on the device, send a smaller copy to Motzo.
      const attachments: Attachment[] = [];
      const images: { mime: string; data: string; label: string }[] = [];
      const documents: { mime: string; data: string; name: string }[] = [];
      const notes: string[] = [];
      for (const file of files) {
        const id = uid("a_");
        const kind = kindOf(file.type, file.name);
        const att: Attachment = { id, kind, name: file.name || kind, mime: file.type, size: file.size, fromLens: input.fromLens };
        try {
          if (kind === "image") {
            const small = await compressImage(file);
            await putFile(id, small);
            att.thumb = await thumbnail(small);
            att.mime = "image/jpeg";
            images.push({ mime: "image/jpeg", data: await blobToBase64(small), label: `Photo ${images.length + 1}${input.fromLens ? " (from lens)" : ""}: ${file.name || "camera shot"}` });
          } else if (kind === "video") {
            if (file.size <= MAX_VIDEO_STORE) await putFile(id, file);
            const frames = await videoFrames(file, 4).catch(() => [] as Blob[]);
            if (frames[0]) att.thumb = await thumbnail(frames[0]);
            for (let i = 0; i < frames.length; i++) {
              images.push({ mime: "image/jpeg", data: await blobToBase64(frames[i]), label: `Video "${file.name || "clip"}", frame ${i + 1} of ${frames.length}` });
            }
            if (!frames.length) notes.push(`a video (${file.name}) that could not be opened on this device`);
          } else if (kind === "audio") {
            await putFile(id, file);
            const transcript = await transcribe(file);
            if (transcript) {
              att.transcript = transcript;
              notes.push(`an audio file "${file.name}". Transcript: ${transcript}`);
            } else {
              notes.push(`an audio file "${file.name}" (no transcript available: speech-to-text is not set up, so describe what you can't hear)`);
            }
          } else {
            await putFile(id, file);
            const okType = file.type === "application/pdf" || file.type.startsWith("text/");
            if (okType && file.size <= MAX_DOC_BYTES) {
              documents.push({ mime: file.type, data: await blobToBase64(file), name: file.name });
            } else if (/^image\//.test(file.type)) {
              /* handled above */
            } else {
              notes.push(`a document "${file.name}" Motzo can't open (send a PDF or a photo of it instead)`);
            }
          }
        } catch {
          notes.push(`"${file.name}" (could not be read on this device)`);
        }
        attachments.push(att);
      }

      if (input.voiceNote) {
        const id = uid("a_");
        await putFile(id, input.voiceNote.blob).catch(() => undefined);
        attachments.push({
          id,
          kind: "audio",
          name: "Voice note",
          mime: input.voiceNote.blob.type || "audio/webm",
          size: input.voiceNote.blob.size,
          transcript: input.voiceNote.transcript || (await transcribe(input.voiceNote.blob)),
        });
        if (!input.text.trim() && attachments[attachments.length - 1].transcript) {
          input = { ...input, text: attachments[attachments.length - 1].transcript ?? "" };
        }
        if (!input.text.trim()) notes.push("a voice note that could not be turned into text");
      }

      // 2. Show the owner's message right away, with its exact time.
      const ownerMsg: Message = {
        id: uid("m_"),
        vehicleId: vehicle.id,
        author: "owner",
        text: input.text.trim(),
        at: nowIso(),
        attachments: attachments.length ? attachments : undefined,
        viaVoice: input.viaVoice,
      };
      addMessage(ownerMsg);

      // 3. Ask Motzo.
      const s = stateRef.current;
      const history = s.messages
        .filter((m) => m.vehicleId === vehicle.id && !m.error)
        .slice(-30)
        .map((m) => ({
          author: m.author,
          text: m.text,
          at: m.at,
          notes: (m.attachments ?? []).map((a) => `${a.kind}${a.reading ? `: ${a.reading}` : ""}${a.transcript ? ` (transcript: ${a.transcript})` : ""}`),
        }));
      const vehicleDetails = [
        vehicle.trim,
        vehicle.engine,
        vehicle.vin && `VIN ${vehicle.vin}`,
        vehicle.plate && `plate ${vehicle.plate}`,
        vehicle.mileage && `${vehicle.mileage.toLocaleString()} miles`,
        vehicle.lastOilChangeMiles && `last oil change at ${vehicle.lastOilChangeMiles.toLocaleString()} miles`,
      ]
        .filter(Boolean)
        .join(", ");

      let replyText: string | null = null;
      try {
        const res = await api("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              now: new Date().toString(),
              timeZone: timeZoneName(),
              vehicle: vehicleName(vehicle),
              vehicleDetails,
              insurance: insuranceLine(s, vehicle.id),
              area: s.owner.area,
            },
            history,
            latest: { text: input.text.trim(), images, documents, notes },
          }),
        });
        const data = (await res.json()) as (MotzoReply & { demo?: boolean }) & { error?: string };
        if (!res.ok || data.error) throw new Error(data.error || "Motzo couldn't answer");

        // Motzo reacts to the owner's message, like a person would.
        if (data.reaction && data.reaction !== "none") {
          patchMessage(ownerMsg.id, (m) => ({ ...m, reactions: { ...m.reactions, motzo: data.reaction } }));
        }
        // Keep what Motzo read from each attachment, for later turns and the record.
        if (data.attachment_notes?.length) {
          patchMessage(ownerMsg.id, (m) => ({
            ...m,
            attachments: m.attachments?.map((a, i) => ({ ...a, reading: data.attachment_notes[i] ?? a.reading })),
          }));
        }

        const cards: CardData[] = [];
        if (data.estimate) {
          const e = data.estimate;
          cards.push({
            kind: "estimate",
            estimate: {
              part: e.part,
              work: e.work,
              costLow: e.cost_low,
              costHigh: e.cost_high,
              basis: e.basis,
              shopType: e.shop_type,
              today: e.today,
              urgency: e.urgency,
              insuranceNote: e.insurance_note,
            },
          });
        }
        if (data.insurance_found) {
          const docAtt = attachments.find((a) => a.kind === "document" || a.kind === "image");
          cards.push({
            kind: "insurance_found",
            insurance: {
              insurer: data.insurance_found.insurer,
              policyNumber: data.insurance_found.policy_number,
              claimsPhone: data.insurance_found.claims_phone,
              comprehensiveDeductible: data.insurance_found.comprehensive_deductible,
              collisionDeductible: data.insurance_found.collision_deductible,
              glassCoverage: data.insurance_found.glass_coverage,
              roadside: data.insurance_found.roadside,
              rental: data.insurance_found.rental,
              startDate: data.insurance_found.start_date,
              endDate: data.insurance_found.end_date,
              vehicles: data.insurance_found.vehicles,
            },
            documentId: docAtt?.id,
          });
        }
        if (data.vehicle_found && (data.vehicle_found.vin || data.vehicle_found.plate || data.vehicle_found.mileage)) {
          cards.push({ kind: "vehicle_found", found: data.vehicle_found });
        }
        if (data.photos_needed?.length) cards.push({ kind: "photos_needed", photos: data.photos_needed });
        if (data.shop_search) cards.push({ kind: "shop_search", search: { shopType: data.shop_search.shop_type, searchText: data.shop_search.search_text } });
        if (data.offer_quotes) {
          const job = data.estimate ? data.estimate.work : data.shop_search?.search_text || "Service";
          const type: ShopType = data.estimate?.shop_type ?? data.shop_search?.shop_type ?? "other";
          cards.push({ kind: "offer_quotes", shopType: type, job });
        }

        addMessage({
          id: uid("m_"),
          vehicleId: vehicle.id,
          author: "motzo",
          text: data.reply,
          at: nowIso(),
          cards: cards.length ? cards : undefined,
          demo: data.demo,
        });
        replyText = data.reply;
        const mood = data.mood === "happy" ? "happy" : data.mood === "concerned" ? "concerned" : "idle";
        if (input.speakReply || s.settings.speakAnswers) {
          robot.setMood("talking");
          await speak(data.reply, services.voice);
          robot.setMood(mood === "idle" ? "idle" : mood, 3000);
        } else {
          robot.setMood(mood, 3500);
        }
      } catch (err) {
        if (!(err instanceof AccessCodeNeeded)) {
          addMessage({
            id: uid("m_"),
            vehicleId: vehicle.id,
            author: "system",
            text: err instanceof Error ? err.message : "Motzo couldn't answer. Try again.",
            at: nowIso(),
            error: true,
          });
        }
        robot.setMood("concerned", 2500);
      } finally {
        setBusy(false);
      }
      return replyText;

      async function transcribe(file: Blob): Promise<string> {
        if (!services.voice || file.size > 4 * 1024 * 1024) return "";
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await api("/api/transcribe", { method: "POST", body: form });
          if (!res.ok) return "";
          const j = (await res.json()) as { text?: string };
          return j.text ?? "";
        } catch {
          return "";
        }
      }
    },
    [activeVehicle, addMessage, patchMessage, robot, services.voice],
  );

  const value = useMemo(
    () => ({ send, busy, services, setServices, location, requestLocation, postMotzo }),
    [send, busy, services, location, requestLocation, postMotzo],
  );
  return <EngineCtx.Provider value={value}>{children}</EngineCtx.Provider>;
}

export function useEngine() {
  const c = useContext(EngineCtx);
  if (!c) throw new Error("useEngine outside provider");
  return c;
}
