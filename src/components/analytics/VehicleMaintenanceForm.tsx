"use client";
import React, { useState, useRef, useEffect } from "react";
import { X, Search, Save } from "lucide-react";
import type {
  Vehicle,
  MaintenanceProfile,
  VehicleServiceRecord,
  MaintenanceReading,
} from "@/types";
import {
  dateOnly,
  decodeVinResult,
  validateProfile,
  validateService,
} from "@/lib/maintenance";
import styles from "./analytics.module.css";
export type EditorMode = "profile" | "service" | "reading";
export default function VehicleMaintenanceForm({
  vehicle,
  mode,
  actor,
  demo,
  onClose,
  onSave,
}: {
  vehicle: Vehicle;
  mode: EditorMode;
  actor: string;
  demo: boolean;
  onClose: () => void;
  onSave: (
    mode: EditorMode,
    value: MaintenanceProfile | VehicleServiceRecord | MaintenanceReading,
  ) => Promise<void>;
}) {
  const [profile, setProfile] = useState<MaintenanceProfile>({
    ...vehicle.maintenance,
  });
  const [record, setRecord] = useState({
    kind: "oil" as VehicleServiceRecord["kind"],
    title: "Oil & filter change",
    date: dateOnly(new Date()),
    odometer: String(vehicle.odometer ?? ""),
    notes: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const decodeController = useRef<AbortController | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("button, input");
    first?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
      decodeController.current?.abort();
      previous?.focus();
    };
  }, []);
  const field = (
    name: keyof MaintenanceProfile,
    value: string | number | boolean | undefined,
  ) =>
    setProfile((p) => ({
      ...p,
      [name]: value,
      ...(name === "scheduleConfirmed" ? {} : { scheduleConfirmed: false }),
    }));
  async function decode() {
    const vin = profile.vin?.trim().toUpperCase() || "";
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      setError("Enter a valid 17-character VIN.");
      return;
    }
    setDecoding(true);
    setError("");
    const controller = new AbortController();
    decodeController.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error(
          "VIN service is unavailable. Enter details manually or try again later.",
        );
      const identity = decodeVinResult(await response.json());
      setProfile((p) => ({ ...p, ...identity, vin, scheduleConfirmed: false }));
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "AbortError"
          ? e.message
          : "VIN lookup timed out. You can enter details manually.",
      );
    } finally {
      clearTimeout(timer);
      setDecoding(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let value: MaintenanceProfile | VehicleServiceRecord | MaintenanceReading;
    if (mode === "profile") {
      const issue = validateProfile(profile);
      if (issue) {
        setError(issue);
        return;
      }
      value = profile;
    } else {
      if (!record.odometer.trim()) {
        setError("Enter the odometer reading.");
        return;
      }
      const odometer = Number(record.odometer);
      if (mode === "reading") {
        if (!Number.isInteger(odometer) || odometer < (vehicle.odometer ?? 0)) {
          setError(
            "Enter a whole-number reading at least as large as the previous mileage.",
          );
          return;
        }
        value = { date: dateOnly(new Date()), odometer, recordedBy: actor };
      } else {
        const issue = validateService(
          { ...record, odometer },
          vehicle.odometer,
        );
        if (issue) {
          setError(issue);
          return;
        }
        value = {
          ...record,
          odometer,
          id: crypto.randomUUID(),
          recordedBy: actor,
        };
      }
    }
    setBusy(true);
    try {
      await onSave(mode, value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const heading =
    mode === "profile"
      ? "Maintenance setup"
      : mode === "service"
        ? "Record completed service"
        : "Confirm current mileage";
  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-dialog-title"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const nodes = Array.from(
              panel.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input, select, textarea, a[href]",
              ) || [],
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className={styles.dialogHeader}>
          <div>
            <span className={styles.eyebrow}>
              {vehicle.vehicleNumber}
              {demo ? " · Sample mode" : ""}
            </span>
            <h2 id="maintenance-dialog-title">{heading}</h2>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            disabled={busy}
            aria-label="Close maintenance form"
          >
            <X size={20} />
          </button>
        </header>
        <form onSubmit={submit} className={styles.form}>
          {mode === "profile" ? (
            <>
              <label>
                VIN
                <div className={styles.inputAction}>
                  <input
                    value={profile.vin || ""}
                    maxLength={17}
                    onChange={(e) =>
                      field("vin", e.target.value.trim().toUpperCase())
                    }
                    placeholder="17-character VIN"
                  />
                  <button
                    type="button"
                    onClick={decode}
                    disabled={decoding || busy || demo}
                  >
                    <Search size={16} />
                    {decoding ? "Looking up…" : "Decode VIN"}
                  </button>
                </div>
              </label>
              <p className={styles.muted}>
                VIN lookup identifies the truck. Mileage, service history and
                the manufacturer’s applicable schedule determine maintenance.
              </p>
              <div className={styles.formGrid}>
                {(["make", "model", "engine", "drivetrain"] as const).map(
                  (key) => (
                    <label key={key}>
                      {key === "drivetrain"
                        ? "Drivetrain"
                        : key[0].toUpperCase() + key.slice(1)}
                      <input
                        value={profile[key] || ""}
                        onChange={(e) => field(key, e.target.value)}
                      />
                    </label>
                  ),
                )}
                <label>
                  Model year
                  <input
                    type="number"
                    min={1981}
                    max={new Date().getFullYear() + 1}
                    value={profile.year ?? ""}
                    onChange={(e) =>
                      field(
                        "year",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </label>
                <label>
                  Operating conditions
                  <select
                    value={profile.operatingProfile || ""}
                    onChange={(e) => field("operatingProfile", e.target.value)}
                  >
                    <option value="">Select conditions</option>
                    <option>Normal use</option>
                    <option>Frequent idling / short trips</option>
                    <option>Towing / heavy loads</option>
                    <option>Dusty / sandy conditions</option>
                  </select>
                </label>
              </div>
              <div className={styles.notice}>
                Use the vehicle’s oil-life warning if it calls for earlier
                service. Enter verified maximum limits below; the earliest limit
                applies.
              </div>
              <div className={styles.formGrid}>
                <label>
                  Oil interval (miles)
                  <input
                    type="number"
                    min={1}
                    value={profile.oilIntervalMiles ?? ""}
                    onChange={(e) =>
                      field(
                        "oilIntervalMiles",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </label>
                <label>
                  Oil interval (months)
                  <input
                    type="number"
                    min={1}
                    value={profile.oilIntervalMonths ?? ""}
                    onChange={(e) =>
                      field(
                        "oilIntervalMonths",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </label>
              </div>
              <label>
                Schedule source / reference
                <input
                  value={profile.scheduleSource || ""}
                  onChange={(e) => field("scheduleSource", e.target.value)}
                  placeholder="Manual edition, section or service advisor reference"
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={profile.scheduleConfirmed || false}
                  onChange={(e) => field("scheduleConfirmed", e.target.checked)}
                />
                I checked these intervals for this truck and its operating
                conditions.
              </label>
              <a
                className={styles.textLink}
                href="https://www.ford.com/support/maintenance-schedule/"
                target="_blank"
                rel="noreferrer"
              >
                Open Ford maintenance lookup ↗
              </a>
            </>
          ) : (
            <>
              {mode === "service" && (
                <>
                  <label>
                    Service type
                    <select
                      value={record.kind}
                      onChange={(e) => {
                        const kind = e.target
                          .value as VehicleServiceRecord["kind"];
                        setRecord((r) => ({
                          ...r,
                          kind,
                          title:
                            kind === "oil"
                              ? "Oil & filter change"
                              : kind === "tires"
                                ? "Tire service"
                                : kind === "filters"
                                  ? "Filter replacement"
                                  : "Other service",
                        }));
                      }}
                    >
                      <option value="oil">Oil & filter</option>
                      <option value="tires">Tires</option>
                      <option value="filters">Filters</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Description
                    <input
                      required
                      value={record.title}
                      onChange={(e) =>
                        setRecord((r) => ({ ...r, title: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Completed on
                    <input
                      type="date"
                      required
                      max={dateOnly(new Date())}
                      value={record.date}
                      onChange={(e) =>
                        setRecord((r) => ({ ...r, date: e.target.value }))
                      }
                    />
                  </label>
                </>
              )}
              <label>
                {mode === "service"
                  ? "Odometer at service (miles)"
                  : "Current odometer (miles)"}
                <input
                  type="number"
                  min={0}
                  required
                  value={record.odometer}
                  onChange={(e) =>
                    setRecord((r) => ({ ...r, odometer: e.target.value }))
                  }
                />
              </label>
              <p className={styles.muted}>
                Current recorded mileage:{" "}
                {vehicle.odometer?.toLocaleString() ?? "Unknown"} mi.{" "}
                {mode === "service"
                  ? "Update current mileage first if service mileage exceeds it."
                  : "Check the truck’s actual odometer before saving."}
              </p>
              {mode === "service" && (
                <label>
                  Notes
                  <textarea
                    value={record.notes}
                    onChange={(e) =>
                      setRecord((r) => ({ ...r, notes: e.target.value }))
                    }
                    placeholder="Shop, parts, oil-life reset, or other details"
                  />
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.dialogFooter}>
            <button
              type="button"
              className={styles.secondary}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button className={styles.primary} disabled={busy || decoding}>
              <Save size={16} />
              {busy ? "Saving…" : demo ? "Save sample change" : "Save record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
