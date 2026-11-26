"use client";

import { useState } from "react";
import { apiJson } from "@/lib/api";
import { useMotzo } from "@/lib/store";
import type { Vehicle } from "@/lib/types";
import { nowIso, uid } from "@/lib/util";
import { Icon, useUi } from "./ui";

interface VinResult {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  ok: boolean;
  note: string;
}

const YEARS = Array.from({ length: 2027 - 1980 + 1 }, (_, i) => String(2027 - i));

/** Adds or edits a vehicle: year, make, model, VIN, license plate, mileage. */
export function VehicleForm({ vehicle, onDone, onCancel }: { vehicle?: Vehicle; onDone: (v: Vehicle) => void; onCancel?: () => void }) {
  const { update } = useMotzo();
  const ui = useUi();
  const [v, setV] = useState<Vehicle>(
    vehicle ?? { id: uid("v_"), year: "", make: "", model: "", createdAt: nowIso(), oilIntervalMiles: 5000 },
  );
  const [vinBusy, setVinBusy] = useState(false);
  const [vinMsg, setVinMsg] = useState("");
  const set = (patch: Partial<Vehicle>) => setV((x) => ({ ...x, ...patch }));

  const decode = async (vinIn?: string) => {
    const vin = (vinIn ?? v.vin ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    set({ vin });
    if (vin.length !== 17) {
      setVinMsg("A VIN has 17 letters and numbers. It's on the dashboard by the windshield, the driver's door frame, or your insurance card.");
      return;
    }
    setVinBusy(true);
    setVinMsg("");
    try {
      const r = await apiJson<VinResult>(`/api/vin?vin=${vin}`);
      if (r.ok) {
        setV((x) => ({ ...x, vin, year: r.year || x.year, make: r.make || x.make, model: r.model || x.model, trim: r.trim || x.trim, engine: r.engine || x.engine }));
        setVinMsg(`Found: ${[r.year, r.make, r.model, r.trim].filter(Boolean).join(" ")}. Check it's right.`);
      } else {
        setVinMsg(r.note || "That VIN didn't decode. Check the letters, or fill in the details by hand.");
      }
    } catch (e) {
      setVinMsg(e instanceof Error ? e.message : "Couldn't look up the VIN. Fill in the details by hand.");
    } finally {
      setVinBusy(false);
    }
  };

  const save = () => {
    if (!v.year || !v.make.trim() || !v.model.trim()) {
      ui.toast("Year, make and model are needed");
      return;
    }
    const clean: Vehicle = { ...v, make: v.make.trim(), model: v.model.trim(), plate: v.plate?.toUpperCase().trim() || undefined };
    if (clean.mileage && clean.mileage !== vehicle?.mileage) clean.mileageUpdatedAt = nowIso();
    update((s) => {
      const exists = s.vehicles.some((x) => x.id === clean.id);
      const mileageLog =
        clean.mileage && clean.mileage !== vehicle?.mileage
          ? [...s.mileageLog, { vehicleId: clean.id, at: nowIso(), miles: clean.mileage, source: "owner" as const }]
          : s.mileageLog;
      return {
        ...s,
        startedAt: s.startedAt ?? nowIso(),
        vehicles: exists ? s.vehicles.map((x) => (x.id === clean.id ? clean : x)) : [...s.vehicles, clean],
        activeVehicleId: exists ? s.activeVehicleId : clean.id,
        mileageLog,
      };
    });
    onDone(clean);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="label" htmlFor="vin">VIN (fills the rest for you)</label>
        <div className="flex gap-2">
          <input
            id="vin"
            className="field font-mono uppercase tracking-wider"
            placeholder="17 characters"
            maxLength={17}
            value={v.vin ?? ""}
            autoComplete="off"
            onChange={(e) => set({ vin: e.target.value.toUpperCase() })}
          />
          <button className="btn btn-soft shrink-0" onClick={() => decode()} disabled={vinBusy}>
            {vinBusy ? "Looking…" : "Look up"}
          </button>
        </div>
        <button
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
          onClick={() => ui.openCamera({ mode: "lens", onVin: (vin) => decode(vin) })}
        >
          <Icon name="lens" className="h-4 w-4" /> Scan the VIN with the camera
        </button>
        {vinMsg && <p className="mt-2 text-sm text-ink-2">{vinMsg}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="year">Year</label>
          <select id="year" className="field" value={v.year} onChange={(e) => set({ year: e.target.value })}>
            <option value="">Year</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="make">Make</label>
          <input id="make" className="field" placeholder="Toyota" value={v.make} onChange={(e) => set({ make: e.target.value })} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="model">Model</label>
          <input id="model" className="field" placeholder="Camry" value={v.model} onChange={(e) => set({ model: e.target.value })} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="trim">Trim (optional)</label>
          <input id="trim" className="field" placeholder="SE" value={v.trim ?? ""} onChange={(e) => set({ trim: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="plate">License plate</label>
          <input id="plate" className="field uppercase" placeholder="ABC1234" value={v.plate ?? ""} onChange={(e) => set({ plate: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="state">Plate state</label>
          <input id="state" className="field uppercase" placeholder="CA" maxLength={2} value={v.plateState ?? ""} onChange={(e) => set({ plateState: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="label" htmlFor="miles">Mileage now</label>
          <input
            id="miles"
            className="field"
            inputMode="numeric"
            placeholder="48,200"
            value={v.mileage ? v.mileage.toLocaleString() : ""}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9]/g, ""));
              set({ mileage: n || undefined });
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="oil">Last oil change at (miles)</label>
          <input
            id="oil"
            className="field"
            inputMode="numeric"
            placeholder="45,000"
            value={v.lastOilChangeMiles ? v.lastOilChangeMiles.toLocaleString() : ""}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9]/g, ""));
              set({ lastOilChangeMiles: n || undefined });
            }}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="nick">Nickname (optional)</label>
          <input id="nick" className="field" placeholder="Family car" value={v.nickname ?? ""} onChange={(e) => set({ nickname: e.target.value })} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button className="btn btn-ghost flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary flex-1" onClick={save}>
          {vehicle ? "Save changes" : "Save vehicle"}
        </button>
      </div>
    </div>
  );
}
