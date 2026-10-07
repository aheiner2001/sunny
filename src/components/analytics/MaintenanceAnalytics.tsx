"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { addDays, addMonths, format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  Gauge,
  Plus,
  ShieldCheck,
  Truck,
  Wrench,
  Droplets,
  Search,
  SlidersHorizontal,
  FlaskConical,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { dbService } from "@/lib/db";
import { computeLifespanStatus } from "@/lib/lifespan";
import {
  buildOilTimeline,
  forecastOil,
  dateOnly,
  type OilStatus,
} from "@/lib/maintenance";
import type {
  Vehicle,
  Equipment,
  Inspection,
  MaintenanceReading,
  MaintenanceProfile,
  VehicleServiceRecord,
} from "@/types";
import VehicleMaintenanceForm, {
  type EditorMode,
} from "./VehicleMaintenanceForm";
import styles from "./analytics.module.css";
const MaintenanceChart = dynamic(() => import("./MaintenanceChart"), {
  ssr: false,
  loading: () => <div className={styles.chartLoading}>Loading chart…</div>,
});
const labels: Record<OilStatus, string> = {
  needs_setup: "Needs setup",
  overdue: "Due now",
  due_soon: "Due soon",
  scheduled: "On track",
};
function sampleFleet(now: Date): Vehicle[] {
  return [0, 1, 2].map((i) => {
    const odometer = [28400, 41250, 16800][i];
    const lastMiles = [24000, 36000, 15500][i];
    return {
      id: `sample-${i}`,
      vehicleNumber: `Mav ${i + 1}`,
      name: `Ford Maverick ${i === 1 ? "EcoBoost" : "Hybrid"}`,
      licensePlate: "SAMPLE",
      qrCodeToken: `sample-${i}`,
      status: "active",
      odometer,
      maintenance: {
        year: i === 2 ? 2022 : 2023,
        make: "Ford",
        model: "Maverick",
        engine: i === 1 ? "2.0L EcoBoost" : "2.5L Hybrid",
        drivetrain: i === 1 ? "AWD" : "FWD",
        operatingProfile: "Frequent idling / short trips",
        oilIntervalMiles: 5000,
        oilIntervalMonths: 6,
        scheduleConfirmed: true,
        scheduleSource: "Sample policy only — not a Ford recommendation",
      },
      maintenanceReadings: [
        {
          date: dateOnly(addDays(now, -30)),
          odometer: odometer - [1200, 1800, 800][i],
        },
        { date: dateOnly(now), odometer },
      ],
      serviceHistory: [
        {
          id: `sample-oil-${i}`,
          kind: "oil",
          title: "Oil & filter change",
          date: dateOnly(addMonths(now, -[4, 5, 1][i])),
          odometer: lastMiles,
          recordedBy: "Sample manager",
          notes: "Illustrative service history",
        },
      ],
    };
  });
}
function TruckGraphic() {
  return (
    <svg
      viewBox="0 0 270 100"
      aria-hidden="true"
      className={styles.truckGraphic}
    >
      <path
        d="M20 59h17l15-25h68l34 25h80l13 11v12H20z"
        fill="currentColor"
        opacity=".1"
      />
      <path
        d="M23 59h16l15-25h65l36 25h78l12 12v11H23zM54 37l-11 22h101l-29-22zM155 60v22M162 60h64M66 61h15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle
        cx="66"
        cy="81"
        r="14"
        fill="#fff"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle
        cx="205"
        cy="81"
        r="14"
        fill="#fff"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="66" cy="81" r="5" fill="currentColor" />
      <circle cx="205" cy="81" r="5" fill="currentColor" />
    </svg>
  );
}
export default function MaintenanceAnalytics() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [equipment, setEquipment] = useState<Equipment[]>([]),
    [inspections, setInspections] = useState<Inspection[]>([]);
  const [demo, setDemo] = useState(false),
    [samples, setSamples] = useState<Vehicle[]>([]),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState<"overview" | "timeline" | "equipment">("overview");
  const [editor, setEditor] = useState<{ id: string; mode: EditorMode } | null>(
      null,
    ),
    [message, setMessage] = useState(""),
    [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const load = () => {
      setVehicles(dbService.getVehicles());
      setEquipment(dbService.getEquipment());
      setInspections(dbService.getInspections());
    };
    load();
    window.addEventListener("sunny_db_update", load);
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      window.removeEventListener("sunny_db_update", load);
      clearInterval(timer);
    };
  }, []);
  const source = demo ? samples : vehicles;
  const rows = useMemo(
    () =>
      source
        .filter((v) =>
          `${v.vehicleNumber} ${v.name} ${v.maintenance?.vin || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((vehicle) => {
          const readings: MaintenanceReading[] = [
            ...(vehicle.maintenanceReadings || []),
            ...(!demo
              ? inspections
                  .filter(
                    (i) =>
                      i.vehicleId === vehicle.id &&
                      i.odometer != null &&
                      i.status !== "rejected",
                  )
                  .map((i) => ({ date: i.dateString, odometer: i.odometer! }))
              : []),
          ];
          const oil = forecastOil(vehicle, readings, now);
          return { vehicle, readings, oil };
        }),
    [source, query, demo, inspections, now],
  );
  const events = useMemo(
    () =>
      rows
        .flatMap((r) => buildOilTimeline(r.vehicle, r.readings, now))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows, now],
  );
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(now, i),
      key = format(d, "yyyy-MM");
    return {
      month: format(d, "MMM yy"),
      count: events.filter((e) => e.date.startsWith(key)).length,
    };
  });
  const items = demo
    ? ([
        {
          id: "sample-brush",
          name: "Detailing brush",
          status: "working",
          category: "equipment",
          lifespanEnabled: true,
          lifespanMode: "usage",
          expectedCars: 300,
          carsUsed: 260,
        },
        {
          id: "sample-hose",
          name: "Pressure washer hose",
          status: "working",
          category: "equipment",
          lifespanEnabled: true,
          lifespanMode: "time",
          dueDate: dateOnly(addDays(now, 20)),
          expectedMonths: 12,
        },
      ] as Equipment[])
    : equipment.filter((e) => !e.retiredAt);
  const lowTools = items.filter((e) => {
    const s = computeLifespanStatus(e, now);
    return s === "getting_low" || s === "due_for_review";
  });
  const selected = source.find((v) => v.id === editor?.id);
  function toggleDemo() {
    setEditor(null);
    setMessage("");
    setQuery("");
    if (!demo) setSamples(sampleFleet(now));
    setDemo(!demo);
  }
  async function save(
    mode: EditorMode,
    value: MaintenanceProfile | VehicleServiceRecord | MaintenanceReading,
  ) {
    if (!selected) return;
    if (demo) {
      setSamples((list) =>
        list.map((v) =>
          v.id !== selected.id
            ? v
            : mode === "profile"
              ? { ...v, maintenance: value as MaintenanceProfile }
              : mode === "service"
                ? {
                    ...v,
                    serviceHistory: [
                      ...(v.serviceHistory || []),
                      value as VehicleServiceRecord,
                    ],
                  }
                : {
                    ...v,
                    odometer: (value as MaintenanceReading).odometer,
                    maintenanceReadings: [
                      ...(v.maintenanceReadings || []),
                      value as MaintenanceReading,
                    ],
                  },
        ),
      );
      setMessage("Sample change saved for this session.");
      return;
    }
    if (mode === "profile")
      await dbService.saveMaintenanceProfile(
        selected.id,
        value as MaintenanceProfile,
      );
    else if (mode === "service")
      await dbService.recordVehicleService(
        selected.id,
        value as VehicleServiceRecord,
      );
    else
      await dbService.recordMaintenanceReading(
        selected.id,
        value as MaintenanceReading,
      );
    setMessage("Maintenance record saved.");
  }
  function exportPlan() {
    const lines = [
      ["Vehicle", "Service", "Planning date", "Status", "Basis"],
      ...events.map((e) => [
        e.vehicleNumber,
        e.title,
        e.date,
        e.overdue ? "Due now" : "Projection",
        e.detail,
      ]),
    ];
    const csv = lines
      .map((r) =>
        r
          .map(
            (c) =>
              `"${(/^[=+@-]/.test(c) ? "'" : "") + c.replace(/"/g, '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${demo ? "sample-" : ""}maintenance-plan-${dateOnly(now)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/settings">
        <ArrowLeft size={15} />
        Fleet settings
      </Link>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>
            <span className={styles.liveDot} />
            {demo ? "Sample workspace" : "Manager workspace"}
          </div>
          <h1>
            Keep your fleet
            <br />
            <span>one step ahead.</span>
          </h1>
          <p>
            Service history, upcoming maintenance and equipment life — together
            in one place.
          </p>
          <div className={styles.heroTags}>
            <span>
              <ShieldCheck size={14} />
              Manager analytics
            </span>
            <span>
              <CalendarDays size={14} />
              12-month outlook
            </span>
          </div>
        </div>
        <div className={styles.heroAside}>
          <span className={styles.heroLabel}>NEXT UP</span>
          <strong>
            {events[0]
              ? format(parseISO(events[0].date), "MMM d")
              : "Ready to plan"}
          </strong>
          <p>
            {events[0]
              ? `${events[0].vehicleNumber} · ${events[0].title}`
              : "Add an oil-service baseline to begin."}
          </p>
          <button
            className={styles.heroButton}
            onClick={() => setTab("timeline")}
          >
            Explore timeline <ArrowUpRight size={18} />
          </button>
        </div>
      </header>
      <div className={styles.toolbar}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Analytics views"
        >
          {(["overview", "timeline", "equipment"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls="analytics-panel"
              id={`tab-${t}`}
              onClick={() => setTab(t)}
              className={tab === t ? styles.activeTab : ""}
            >
              {t === "overview"
                ? "Fleet overview"
                : t === "timeline"
                  ? "Maintenance timeline"
                  : "Equipment life"}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={toggleDemo}>
            <FlaskConical size={16} />
            {demo ? "Use fleet data" : "Try sample data"}
          </button>
          <button
            className={styles.primary}
            onClick={exportPlan}
            disabled={!events.length}
          >
            <Download size={16} />
            Export plan
          </button>
        </div>
      </div>
      {demo && (
        <div className={styles.notice}>
          <FlaskConical size={18} />
          <span>
            <strong>Sample mode.</strong> Illustrative intervals and records.
            Changes stay in this session and do not modify fleet data.
          </span>
        </div>
      )}
      {message && (
        <div className={styles.success} role="status">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}
      <div className={styles.metrics}>
        {[
          {
            label: "Trucks in view",
            value: rows.length,
            icon: Truck,
            note: "Compare across the fleet",
          },
          {
            label: "Oil service due now",
            value: rows.filter((r) => r.oil.status === "overdue").length,
            icon: Droplets,
            note: "Reached mileage or time limit",
          },
          {
            label: "Baselines needed",
            value: rows.filter((r) => r.oil.status === "needs_setup").length,
            icon: SlidersHorizontal,
            note: "Complete setup to forecast",
          },
          {
            label: "Equipment to review",
            value: lowTools.length,
            icon: Wrench,
            note: "Based on existing lifespan rules",
          },
        ].map((m) => (
          <div className={styles.metric} key={m.label}>
            <div>
              <span>{m.label}</span>
              <m.icon size={18} />
            </div>
            <strong>{m.value.toString().padStart(2, "0")}</strong>
            <small>{m.note}</small>
          </div>
        ))}
      </div>
      <div id="analytics-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && (
          <>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>VEHICLE COMPARISON</span>
                <h2>Your trucks, side by side.</h2>
              </div>
              <label className={styles.search}>
                <Search size={16} />
                <input
                  aria-label="Search trucks"
                  placeholder="Find a truck or VIN"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.trucks}>
              {rows.map(({ vehicle: v, oil, readings }) => {
                const latest = [...readings].sort((a, b) =>
                  b.date.localeCompare(a.date),
                )[0];
                const stale =
                  !latest || latest.date < dateOnly(addDays(now, -14));
                const progress =
                  oil.lastService && v.maintenance?.oilIntervalMiles
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          (((v.odometer ?? 0) - oil.lastService.odometer) /
                            v.maintenance.oilIntervalMiles) *
                            100,
                        ),
                      )
                    : 0;
                return (
                  <article key={v.id} className={styles.truckCard}>
                    <div className={styles.cardTop}>
                      <span className={styles.truckName}>
                        {v.vehicleNumber}
                      </span>
                      <span className={`${styles.badge} ${styles[oil.status]}`}>
                        {labels[oil.status]}
                      </span>
                    </div>
                    <p className={styles.model}>
                      {[
                        v.maintenance?.year,
                        v.maintenance?.make,
                        v.maintenance?.model,
                      ]
                        .filter(Boolean)
                        .join(" ") || v.name}
                    </p>
                    <TruckGraphic />
                    <div className={styles.reading}>
                      <span>Recorded odometer</span>
                      <strong>
                        {v.odometer?.toLocaleString() ?? "—"} <small>mi</small>
                      </strong>
                      <small>
                        {latest
                          ? `Reading dated ${latest.date}`
                          : "No dated mileage reading"}
                        {stale ? " · Needs a fresh check" : ""}
                      </small>
                    </div>
                    <div className={styles.oilHeading}>
                      <span>
                        <Droplets size={15} />
                        Oil & filter
                      </span>
                      <strong>
                        {oil.remainingMiles != null
                          ? `${Math.max(0, oil.remainingMiles).toLocaleString()} mi left`
                          : "Baseline needed"}
                      </strong>
                    </div>
                    <div className={styles.progress}>
                      <div
                        style={{ width: `${progress}%` }}
                        className={
                          oil.status === "overdue" ? styles.progressOverdue : ""
                        }
                      />
                    </div>
                    <dl className={styles.truckFacts}>
                      <div>
                        <dt>Last oil change</dt>
                        <dd>{oil.lastService?.date ?? "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Next planning date</dt>
                        <dd>{oil.dueDate ?? "Not available"}</dd>
                      </div>
                      <div>
                        <dt>Mileage limit</dt>
                        <dd>
                          {oil.dueOdometer?.toLocaleString() ?? "—"}
                          {oil.dueOdometer ? " mi" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Configuration</dt>
                        <dd>{v.maintenance?.engine || "Needs setup"}</dd>
                      </div>
                    </dl>
                    <p className={styles.cardHint}>{oil.reason}</p>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.primary}
                        onClick={() => setEditor({ id: v.id, mode: "service" })}
                      >
                        <Plus size={15} />
                        Log service
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={() => setEditor({ id: v.id, mode: "reading" })}
                      >
                        <Gauge size={15} />
                        Mileage
                      </button>
                    </div>
                    <button
                      className={styles.setupLink}
                      onClick={() => setEditor({ id: v.id, mode: "profile" })}
                    >
                      Vehicle & schedule setup <ArrowUpRight size={14} />
                    </button>
                    <details className={styles.history}>
                      <summary>
                        Service history ({v.serviceHistory?.length || 0})
                      </summary>
                      {[...(v.serviceHistory || [])]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((s) => (
                          <div key={s.id}>
                            <strong>{s.title}</strong>
                            <span>
                              {s.date} · {s.odometer.toLocaleString()} mi
                            </span>
                            <small>
                              {s.recordedBy}
                              {s.notes ? ` · ${s.notes}` : ""}
                            </small>
                          </div>
                        ))}
                      {!v.serviceHistory?.length && (
                        <p>No completed services recorded.</p>
                      )}
                    </details>
                  </article>
                );
              })}
            </div>
            {!rows.length && (
              <div className={styles.empty}>
                <Truck size={28} />
                <h3>
                  {query ? "No matching trucks" : "No trucks available yet"}
                </h3>
                <p>
                  {query
                    ? "Try a different search."
                    : "Add a truck in Vehicles or try sample data to explore this workspace."}
                </p>
              </div>
            )}
            <div className={styles.lowerGrid}>
              <section className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.eyebrow}>PLANNING WORKLOAD</span>
                    <h2>Oil services by month</h2>
                  </div>
                  <span className={styles.softBadge}>Projected</span>
                </div>
                {events.length ? (
                  <MaintenanceChart data={chartData} />
                ) : (
                  <div className={styles.empty}>
                    <CalendarDays size={26} />
                    <p>
                      Complete an oil-service baseline to populate the chart.
                    </p>
                  </div>
                )}
              </section>
              <section className={`${styles.panel} ${styles.nextSteps}`}>
                <span className={styles.eyebrow}>
                  BUILD A RELIABLE BASELINE
                </span>
                <h2>
                  Three small steps.
                  <br />A clearer year ahead.
                </h2>
                {[
                  "Confirm each truck’s configuration and applicable oil limits.",
                  "Record the last completed oil change and current mileage.",
                  "Review upcoming work weekly and log service when completed.",
                ].map((text, i) => (
                  <div key={text}>
                    <span>{i + 1}</span>
                    <p>{text}</p>
                  </div>
                ))}
                <p className={styles.muted}>
                  Forecasts are estimates. The truck’s oil-life warning may call
                  for earlier service. Reminders and appointments are not sent
                  automatically.
                </p>
              </section>
            </div>
          </>
        )}
        {tab === "timeline" && (
          <section className={styles.timelineSection}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>THE ROAD AHEAD</span>
                <h2>A year of better planning.</h2>
                <p className={styles.muted}>
                  Projected oil services across the trucks in view. Later dates
                  assume earlier services are completed.
                </p>
              </div>
              <span className={styles.softBadge}>
                {format(now, "MMM yyyy")} —{" "}
                {format(addMonths(now, 12), "MMM yyyy")}
              </span>
            </div>
            <div className={styles.timeline}>
              {events.map((event, i) => (
                <article
                  key={event.id}
                  className={`${styles.timelineRow} ${i % 2 ? styles.timelineRight : ""}`}
                >
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineCard}>
                    <span className={styles.eyebrow}>
                      {format(parseISO(event.date), "MMM d, yyyy")}
                    </span>
                    <div className={styles.cardTop}>
                      <h3>{event.vehicleNumber}</h3>
                      <span
                        className={`${styles.badge} ${event.overdue ? styles.overdue : styles.scheduled}`}
                      >
                        {event.overdue ? "Due now" : "Projection"}
                      </span>
                    </div>
                    <h4>{event.title}</h4>
                    <p>{event.detail}</p>
                    <button
                      className={styles.setupLink}
                      onClick={() =>
                        setEditor({ id: event.vehicleId, mode: "service" })
                      }
                    >
                      Record completed service <ArrowUpRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!events.length && (
              <div className={styles.empty}>
                <CalendarDays size={32} />
                <h3>Your timeline starts with a baseline.</h3>
                <p>
                  Set oil intervals and log the last oil change from Fleet
                  overview.
                </p>
                <button
                  className={styles.secondary}
                  onClick={() => setTab("overview")}
                >
                  Open fleet overview
                </button>
              </div>
            )}
          </section>
        )}
        {tab === "equipment" && (
          <section>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>
                  TOOLS THAT KEEP YOU MOVING
                </span>
                <h2>Equipment life at a glance.</h2>
                <p className={styles.muted}>
                  Existing usage and time-based review thresholds. These are
                  lifespan estimates, not manufacturer service schedules.
                </p>
              </div>
              {!demo && (
                <Link href="/equipment" className={styles.secondary}>
                  Manage equipment <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
            <div className={styles.equipmentGrid}>
              {items.map((e) => {
                const status = computeLifespanStatus(e, now);
                const used = e.expectedCars
                  ? Math.min(
                      100,
                      Math.max(0, ((e.carsUsed || 0) / e.expectedCars) * 100),
                    )
                  : null;
                return (
                  <article key={e.id} className={styles.panel}>
                    <div className={styles.cardTop}>
                      <Wrench size={20} />
                      <span
                        className={`${styles.badge} ${status === "due_for_review" ? styles.overdue : status === "getting_low" ? styles.due_soon : styles.scheduled}`}
                      >
                        {status === "due_for_review"
                          ? "Review now"
                          : status === "getting_low"
                            ? "Getting low"
                            : status === "ok"
                              ? "On track"
                              : "Not configured"}
                      </span>
                    </div>
                    <h3>{e.name}</h3>
                    <p className={styles.muted}>
                      {e.assetTag || e.vehicleNumber || "Shared equipment"}
                    </p>
                    {e.lifespanMode === "usage" ? (
                      <>
                        <strong className={styles.equipmentValue}>
                          {e.carsUsed || 0} / {e.expectedCars ?? "—"} jobs
                        </strong>
                        <div className={styles.progress}>
                          <div style={{ width: `${used || 0}%` }} />
                        </div>
                      </>
                    ) : (
                      <strong className={styles.equipmentValue}>
                        {e.dueDate
                          ? `Review ${e.dueDate.slice(0, 10)}`
                          : "No review date"}
                      </strong>
                    )}
                    <p className={styles.muted}>
                      Condition: {e.status.replace(/_/g, " ")}
                    </p>
                  </article>
                );
              })}
            </div>
            {!items.length && (
              <div className={styles.empty}>
                <Wrench size={28} />
                <p>No active equipment records available.</p>
              </div>
            )}
          </section>
        )}
      </div>
      <footer className={styles.footer}>
        <span>Sunny Fleet / Maintenance intelligence</span>
        <span>
          {demo ? "Sample data" : "Fleet data"} · Updated{" "}
          {format(now, "h:mm a")}
        </span>
      </footer>
      {selected && editor && (
        <VehicleMaintenanceForm
          key={`${selected.id}-${editor.mode}`}
          vehicle={selected}
          mode={editor.mode}
          actor={user?.name || "Manager"}
          demo={demo}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
