"use client";
import React, { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
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
  MaintenanceAppointment,
} from "@/types";
import VehicleMaintenanceForm, {
  type EditorMode,
  type EditorValue,
  type SetupValue,
} from "./VehicleMaintenanceForm";
import styles from "./analytics.module.css";
import EquipmentServicePanel from "./EquipmentServicePanel";
import AnalyticsPreferences from "./AnalyticsPreferences";
import {
  analyticsPreferenceKey, defaultAnalyticsPreferences, loadAnalyticsPreferences,
  saveAnalyticsPreferences, resetAnalyticsPreferences,
  type AnalyticsLayoutPreferences, type AnalyticsWidgetId,
} from "@/lib/analyticsPreferences";
import { forecastEquipmentMaintenance } from "@/lib/equipmentMaintenance";
import FleetTimeline from "./FleetTimeline";
import MaintenanceActions, { issueAction } from "./MaintenanceActions";
import { forecastMaintenance, buildMaintenanceTimeline, effectiveServices, setupIssues } from "@/lib/maintenanceRules";
import { prepareImageUpload, imageErrorFallback } from "@/lib/imageUpload";
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
          odometer: odometer - [1200, 1800, 800][i], confirmed:true, source:"Synthetic sample measurement",
        },
        { date: dateOnly(now), odometer, confirmed:true, source:"Synthetic sample measurement" },
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
// Every hour, service record and interval here is synthetic sample data.
function sampleTools(now: Date): Equipment[] {
  return [
    { id: "sample-brush", name: "Detailing brush", status: "working", category: "equipment",
      lifespanEnabled: true, lifespanMode: "usage", expectedCars: 300, carsUsed: 260,
      operatingHours: 150,
      hoursReadings: [{date: dateOnly(now), hours: 150, recordedBy: "synthetic-manager"}],
      maintenanceRules: [{id: "sample-clean", title: "Synthetic cleaning service", intervalHours: 100,
        source: "Synthetic sample policy only — not a manufacturer recommendation", confirmed: true}],
      serviceHistory: [{id: "sample-tool-service", ruleId: "sample-clean", title: "Synthetic cleaning service",
        date: dateOnly(addDays(now, -30)), hours: 60, recordedBy: "synthetic-manager", recordedAt: now.toISOString()}],
    },
    { id: "sample-hose", name: "Pressure washer hose", status: "working", category: "equipment",
      lifespanEnabled: true, lifespanMode: "time", dueDate: dateOnly(addDays(now, 20)), expectedMonths: 12 },
  ];
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
type PhotoRequest = {generation: number; managerId: string; demo: boolean};

export default function MaintenanceAnalytics() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [equipment, setEquipment] = useState<Equipment[]>([]),
    [inspections, setInspections] = useState<Inspection[]>([]);
  const [demo, setDemo] = useState(false),
    [samples, setSamples] = useState<Vehicle[]>([]),
    [sampleEquipment, setSampleEquipment] = useState<Equipment[]>([]),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState<"overview" | "timeline" | "equipment">("overview");
  const [editor, setEditor] = useState<{ id: string; mode: EditorMode; ruleId?:string; step?:number; original?:VehicleServiceRecord; appointment?:MaintenanceAppointment } | null>(
      null,
    ),
    [message, setMessage] = useState(""),
    [now, setNow] = useState(() => new Date());
  const managerId = user?.id || "";
  const [layout, setLayout] = useState(() => ({managerId: "", preferences: defaultAnalyticsPreferences(), storageMessage: ""}));
  const preferences = layout.managerId === managerId ? layout.preferences : defaultAnalyticsPreferences();
  const storageMessage = layout.managerId === managerId ? layout.storageMessage : "";
  const storageUnavailable = "Layout changed for this session; browser storage is unavailable.";
  useEffect(() => {
    let storageMessage = "";
    try { window.localStorage.getItem(analyticsPreferenceKey(managerId)); }
    catch { storageMessage = "Layout defaults apply for this session; browser storage is unavailable."; }
    setLayout({managerId, preferences: loadAnalyticsPreferences(managerId), storageMessage});
  }, [managerId]);
  function changePreferences(next: AnalyticsLayoutPreferences) {
    const saved = saveAnalyticsPreferences(managerId, next);
    setLayout({managerId, preferences: next, storageMessage: saved ? "" : storageUnavailable});
  }
  function resetPreferences() {
    const next = resetAnalyticsPreferences(managerId);
    let storageMessage = "";
    try {
      if (window.localStorage.getItem(analyticsPreferenceKey(managerId)) !== null) storageMessage = storageUnavailable;
    } catch { storageMessage = storageUnavailable; }
    setLayout({managerId, preferences: next, storageMessage});
  }
  const [equipmentFocus, setEquipmentFocus] = useState("");
  const [removedPhotos, setRemovedPhotos] = useState<Record<string, string>>({});
  const refreshData = () => {
    setVehicles(dbService.getVehicles());
    setEquipment(dbService.getEquipment());
    setInspections(dbService.getInspections());
  };
  const savedSetupStages=useRef(new Set<string>());
  const savedSetupServices=useRef(new Map<string,string>());
  const [photoError,setPhotoError]=useState(""),[photoBusy,setPhotoBusy]=useState<string|null>(null);
  const photoGeneration = useRef(0);
  const activePhotoRequest = useRef<PhotoRequest | null>(null);
  // Cleanup invalidates preparation, persistence completion and feedback before another identity paints.
  useLayoutEffect(() => {
    photoGeneration.current += 1;
    activePhotoRequest.current = null;
    setPhotoBusy(null);
    setPhotoError("");
    setRemovedPhotos({});
    setMessage("");
    return () => {
      photoGeneration.current += 1;
      activePhotoRequest.current = null;
    };
  }, [managerId]);
  const isCurrentPhotoRequest = (request: PhotoRequest) =>
    activePhotoRequest.current === request && photoGeneration.current === request.generation;
  function beginPhotoRequest(vehicleId: string): PhotoRequest | null {
    if (activePhotoRequest.current) return null;
    const request = {generation: photoGeneration.current, managerId, demo};
    activePhotoRequest.current = request;
    setPhotoError("");setMessage("");setPhotoBusy(vehicleId);
    return request;
  }
  const edit=(id:string,mode:EditorMode,ruleId?:string,step?:number)=>{setMessage("");setEditor({id,mode,ruleId,step});};
  useEffect(() => {
    const load = refreshData;
    load();
    window.addEventListener("sunny_db_update", load);
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      window.removeEventListener("sunny_db_update", load);
      clearInterval(timer);
    };
  }, []);
  const source = demo ? samples : vehicles;
  const fleetRows = useMemo(
    () =>
      source.map((vehicle) => {
          const readings: MaintenanceReading[] = [
            ...(vehicle.maintenanceReadings || []),
            ...(!demo
              ? inspections
                  .filter(
                    (i) =>
                      i.vehicleId === vehicle.id &&
                      i.odometer != null &&
                      i.status !== "rejected" &&
                      i.odometerConfirmed === true,
                  )
                  .map((i) => ({ date: i.dateString, odometer: i.odometer!, confirmed:true, source:"Confirmed inspection" }))
              : []),
          ];
          const forecasts=forecastMaintenance(vehicle,readings,now).map(f=>{
            if(f.ruleId!=='oil' || f.status!=='needs_setup' || vehicle.maintenance?.rules?.some(r=>r.id==='oil'))return f;
            const p=vehicle.maintenance;
            const missing=[...(!p?.oilIntervalMiles?['Enter oil mileage interval.']:[]),...(!p?.oilIntervalMonths?['Enter oil month interval.']:[]),...(!p?.scheduleSource?.trim()?['Add the verified oil schedule source.']:[]),...(!p?.scheduleConfirmed?['Confirm oil intervals against configuration and operating conditions.']:[]),...(!f.lastService?['Record oil completed-service baseline date and mileage.']:[]),...(vehicle.odometer==null?['Record current measured mileage.']:[])];
            return {...f,missing:missing.length?missing:f.missing};
          });
          const oil = forecasts.find(f=>f.ruleId==='oil') || forecastOil(vehicle,readings,now);
          return { vehicle, readings, oil, forecasts };
        }),
    [source, demo, inspections, now],
  );
  const rows = useMemo(() => fleetRows.filter(({vehicle}) =>
    `${vehicle.vehicleNumber} ${vehicle.name} ${vehicle.maintenance?.vin || ""}`.toLowerCase().includes(query.toLowerCase())), [fleetRows, query]);
  const identitySetup = fleetRows.map(({vehicle}) => ({vehicle, issues: setupIssues(vehicle).filter(issue =>
    /vehicle make|vehicle model|model year|engine\/configuration|operating conditions/i.test(issue))})).filter(row => row.issues.length);
  const events = useMemo(
    () =>
      rows
        .flatMap((r) => buildMaintenanceTimeline(r.vehicle, r.readings, now))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows, now],
  );
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(now, i),
      key = format(d, "yyyy-MM");
    return {
      month: format(d, "MMM yy"),
      count: events.filter((e) => e.projected && e.date.startsWith(key)).length,
    };
  });
  const items = demo ? sampleEquipment : equipment.filter((e) => !e.retiredAt);
  const equipmentWork = items.map(item => ({item, forecasts: forecastEquipmentMaintenance(item, now).filter(f => f.status !== "scheduled")}))
    .filter(({item, forecasts}) => forecasts.length || !item.maintenanceRules?.length);
  const equipmentActor = demo ? {id: "synthetic-manager", name: "Synthetic sample manager"} : {id: managerId, name: user?.name || "Manager"};
  const updateSampleEquipment = (updated: Equipment) => setSampleEquipment(current => current.map(item => item.id === updated.id ? updated : item));
  const focusedEquipment = equipmentFocus ? [...items].sort((a,b) => Number(b.id === equipmentFocus) - Number(a.id === equipmentFocus)) : items;
  const openEquipment = (id: string) => {setEquipmentFocus(id);setTab("equipment");};
  const lowTools = items.filter((e) => {
    const s = computeLifespanStatus(e, now);
    return s === "getting_low" || s === "due_for_review";
  });
  const selected = source.find((v) => v.id === editor?.id);
  function toggleDemo() {
    if (activePhotoRequest.current) return;
    photoGeneration.current += 1;
    setEditor(null);
    setMessage("");
    setQuery("");
    setPhotoError("");
    setRemovedPhotos({});
    setEquipmentFocus("");
    if (!demo) {setSamples(sampleFleet(now));setSampleEquipment(sampleTools(now));}
    setDemo(!demo);
  }
  async function save(mode:EditorMode,value:EditorValue) {
    if(!selected) throw new Error("Select a vehicle before saving.");
    setMessage("");
    const setup=mode==='profile' && 'profile' in value ? value as SetupValue : undefined;
    if(demo) {
      setSamples(list=>list.map(v=>{
        if(v.id!==selected.id)return v;
        if(setup)return {...v,maintenance:setup.profile,...(setup.reading?{odometer:setup.reading.odometer,maintenanceReadings:[...(v.maintenanceReadings || []),setup.reading]}:{}),...(setup.service?{serviceHistory:[...(v.serviceHistory || []),setup.service]}:{})};
        if(mode==='profile')return {...v,maintenance:value as MaintenanceProfile};
        if(mode==='reading'){const reading=value as MaintenanceReading;return {...v,odometer:reading.odometer,maintenanceReadings:[...(v.maintenanceReadings || []),reading]};}
        if(mode==='appointment'){const a=value as MaintenanceAppointment;return {...v,maintenanceAppointments:[...(v.maintenanceAppointments || []).filter(old=>old.id!==a.id),a]};}
        const service=value as VehicleServiceRecord;
        const original=v.serviceHistory?.find(s=>s.id===service.supersedesId);
        const corrected=mode==='correction'?{...service,...(original?.ruleId?{ruleId:original.ruleId}:{}),recordedBy:'synthetic-manager',recordedAt:new Date().toISOString()}:service;
        return {...v,serviceHistory:[...(v.serviceHistory || []),corrected],maintenanceAppointments:v.maintenanceAppointments?.map(a=>(a.id===service.appointmentId || (service.supersedesId && a.serviceRecordId===service.supersedesId))?{...a,status:'completed',serviceRecordId:service.id}:a)};
      }));
      setMessage("Sample change saved for this session.");return;
    }
    if(setup) {
      // Keep acknowledged stages across retry; a later failure must not duplicate a service.
      const key=`${selected.id}-${setup.service?.id || 'no-service'}`;
      const readingKey=`${key}-reading-${JSON.stringify(setup.reading)}`;
      const serviceSignature=setup.service?JSON.stringify({date:setup.service.date,odometer:setup.service.odometer,title:setup.service.title,kind:setup.service.kind,recordedBy:setup.service.recordedBy}):undefined;
      try {
        if(serviceSignature && savedSetupServices.current.has(key) && savedSetupServices.current.get(key)!==serviceSignature)throw new Error("This completed-service baseline is already saved; append a correction from history and reopen setup before changing it.");
        if(setup.reading && !savedSetupStages.current.has(readingKey)){await dbService.recordMaintenanceReading(selected.id,setup.reading);savedSetupStages.current.add(readingKey);}
        if(setup.service && !savedSetupStages.current.has(`${key}-service`)){await dbService.recordVehicleService(selected.id,setup.service);savedSetupStages.current.add(`${key}-service`);savedSetupServices.current.set(key,serviceSignature!);}
        await dbService.saveMaintenanceProfile(selected.id,setup.profile);
        savedSetupStages.current.clear();savedSetupServices.current.clear();
      } catch(error) {throw new Error(`${error instanceof Error?error.message:'Save could not be confirmed.'} Setup is not fully saved. Any confirmed measurement/service remains in history; check history before retrying uncertain writes.`);}
    } else if(mode==='profile')await dbService.saveMaintenanceProfile(selected.id,value as MaintenanceProfile);
    else if(mode==='reading')await dbService.recordMaintenanceReading(selected.id,value as MaintenanceReading);
    else if(mode==='appointment')await dbService.saveMaintenanceAppointment(selected.id,value as MaintenanceAppointment);
    else if(mode==='correction'){const service=value as VehicleServiceRecord;await dbService.correctVehicleService(selected.id,service.supersedesId!,service,service.correctionReason!,{id:user?.id || '',name:user?.name || 'Manager'});}
    else await dbService.recordVehicleService(selected.id,value as VehicleServiceRecord);
    setMessage("Maintenance record saved.");
  }
  async function changePhoto(request: PhotoRequest, vehicle: Vehicle, imageUrl: string, action: "upload" | "remove" | "restore") {
    if (!isCurrentPhotoRequest(request)) return;
    if (!request.demo) await dbService.saveVehicleImage(vehicle.id, imageUrl);
    if (!isCurrentPhotoRequest(request)) return;
    const update = (list: Vehicle[]) => list.map(v => v.id === vehicle.id ? {...v, imageUrl} : v);
    if (demo) setSamples(update); else setVehicles(update);
    setRemovedPhotos(current => {
      const next = {...current};
      if (action === "remove") next[vehicle.id] = vehicle.imageUrl!;
      else delete next[vehicle.id];
      return next;
    });
    setMessage(`${demo ? "Sample" : "Vehicle"} photo ${action === "remove" ? "removed" : action === "restore" ? "restored" : "saved"}${demo ? " for this session" : ""}.`);
  }
  async function uploadPhoto(vehicle: Vehicle, file: File) {
    const request = beginPhotoRequest(vehicle.id);
    if (!request) return;
    try {await changePhoto(request, vehicle, await prepareImageUpload(file), "upload");}
    catch(error) {
      if (isCurrentPhotoRequest(request)) setPhotoError(error instanceof Error ? error.message : "Could not save photo.");
    } finally {
      if (isCurrentPhotoRequest(request)) {activePhotoRequest.current = null;setPhotoBusy(null);}
    }
  }
  async function removeOrRestorePhoto(vehicle: Vehicle, restore = false) {
    const request = beginPhotoRequest(vehicle.id);
    if (!request) return;
    try {await changePhoto(request, vehicle, restore ? removedPhotos[vehicle.id] : "", restore ? "restore" : "remove");}
    catch(error) {
      if (isCurrentPhotoRequest(request)) setPhotoError(error instanceof Error ? error.message : "Could not save photo.");
    } finally {
      if (isCurrentPhotoRequest(request)) {activePhotoRequest.current = null;setPhotoBusy(null);}
    }
  }
  function download(content:string,type:string,name:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportJson(){const readings=Object.fromEntries(source.map(v=>[v.id,demo?[]:inspections.filter(i=>i.vehicleId===v.id&&i.status!=='rejected'&&i.odometer!=null&&i.odometerConfirmed===true).map(i=>({date:i.dateString,odometer:i.odometer,confirmed:true,source:'Confirmed inspection'}))]));download(JSON.stringify({vehicles:source,equipment:items,readings},null,2),'application/json',`${demo?'sample-':''}maintenance-report-${dateOnly(now)}.json`);}
  function exportPlan() {
    const lines = [
      ["Vehicle", "Service", "Planning date", "Status", "Basis"],
      ...events.map((e) => [
        e.vehicleNumber,
        e.title,
        e.date,
        !e.projected ? "Booked appointment" : e.overdue ? "Due now" : "Estimate",
        e.detail,
      ]),
    ];
    const csv = lines
      .map((r) =>
        r
          .map(
            (c) =>
              `"${(/^[\s]*[=+@-]/.test(c) ? "'" : "") + c.replace(/"/g, '""')}"`,
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
  const widgets: Record<AnalyticsWidgetId, React.ReactNode> = {
    metrics: (<div className={styles.metrics}>
        {[
          {
            label: "Trucks in view",
            value: rows.length,
            icon: Truck,
            note: "Compare across the fleet",
          },
          {
            label: "Services due now",
            value: rows.flatMap(r=>r.forecasts).filter(f=>f.status === "overdue").length,
            icon: Droplets,
            note: "Reached mileage or time limit",
          },
          {
            label: "Baselines needed",
            value: rows.flatMap(r=>r.forecasts).filter(f=>f.status === "needs_setup").length,
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
      </div>),
    vehicles: (<><div className={styles.sectionHeader}>
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
              {rows.map(({ vehicle: v, oil, readings, forecasts }) => {
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
                            (v.maintenance.rules?.find(r=>r.id==='oil')?.intervalMiles || v.maintenance.oilIntervalMiles)) *
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
                    {v.imageUrl ? <img src={v.imageUrl} onError={imageErrorFallback} alt={`${v.vehicleNumber} vehicle`} className={styles.truckGraphic} style={{objectFit: "contain"}} /> : <TruckGraphic />}
                    <label className={styles.photoUpload}>Vehicle photo<input aria-label={`Upload ${v.vehicleNumber} photo`} type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy!==null} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadPhoto(v,file);e.target.value="";}}/>{photoBusy===v.id?"Saving photo…":"JPEG, PNG or WebP · up to 5MB"}</label>
                    {v.imageUrl && <button className={styles.setupLink} aria-label={`Remove ${v.vehicleNumber} photo`} disabled={photoBusy !== null} onClick={() => void removeOrRestorePhoto(v)}>Remove photo</button>}
                    {removedPhotos[v.id] && <button className={styles.setupLink} aria-label={`Restore ${v.vehicleNumber} photo`} disabled={photoBusy !== null} onClick={() => void removeOrRestorePhoto(v, true)}>Restore removed photo</button>}
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
                    {forecasts.map(f=><section key={f.ruleId} className={styles.ruleForecast} aria-label={`${f.title} forecast`}><div className={styles.cardTop}><strong>{f.title}</strong><span className={`${styles.badge} ${styles[f.status]}`}>{labels[f.status]}</span></div><p>{f.reason}</p><p>Source: {f.source.startsWith('https://')?<a href={f.source} target="_blank" rel="noreferrer">Review manual ↗</a>:f.source || 'Not verified'}</p><ul>{f.basis.map(b=><li key={b}>{b}</li>)}</ul>{f.dueDate&&<p>Estimate: {f.dueDate}{f.dueOdometer!=null?` · ${f.dueOdometer.toLocaleString()} mi limit`:''}</p>}{f.missing.map(issue=>{const action=issueAction(issue,f.ruleId,v.maintenance?.rules?.some(rule=>rule.id===f.ruleId) || f.ruleId!=='oil');return <p key={issue}>{issue} <button className={styles.setupLink} onClick={()=>edit(v.id,action.mode,f.ruleId,action.step)}>{action.label} →</button></p>;})}</section>)}
                    {setupIssues(v).filter(issue=>/vehicle make|vehicle model|model year|engine\/configuration|operating conditions/i.test(issue)).map(issue=><p key={issue} className={styles.muted}>{issue} <button className={styles.setupLink} onClick={()=>edit(v.id,'profile',undefined,1)}>Add identity detail →</button></p>)}
                    <div className={styles.cardActions}>
                      <button
                        className={styles.primary}
                        onClick={() => edit(v.id,"service")}
                      >
                        <Plus size={15} />
                        Log service
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={() => edit(v.id,"reading")}
                      >
                        <Gauge size={15} />
                        Mileage
                      </button>
                    </div>
                    <button className={styles.secondary} onClick={()=>edit(v.id,"appointment")}>Book appointment</button>
                    <button
                      className={styles.setupLink}
                      onClick={() => edit(v.id,"profile")}
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
                            {s.supersedesId&&<small>Correction of {s.supersedesId} · {s.correctionReason} · actor {s.recordedBy} · {s.recordedAt}</small>}
                            {effectiveServices(v.serviceHistory || []).some(active=>active.id===s.id)?<button className={styles.setupLink} onClick={()=>{setMessage('');setEditor({id:v.id,mode:'correction',original:s});}}>Append correction →</button>:<small>Superseded; retained for audit</small>}
                          </div>
                        ))}
                      {!v.serviceHistory?.length && (
                        <p>No completed services recorded.</p>
                      )}
                    </details>
                    <details className={styles.history}><summary>Appointments ({v.maintenanceAppointments?.length || 0})</summary>{(v.maintenanceAppointments || []).map(a=><div key={a.id}><strong>{a.title}</strong><span>{a.date} · {a.status}</span>{a.serviceRecordId&&<small>Completed service: {a.serviceRecordId}</small>}<button className={styles.setupLink} onClick={()=>{setMessage('');setEditor({id:v.id,mode:'appointment',appointment:a});}}>Review booking / cancel / link completion →</button></div>)}</details>
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
            )}</>),
    outlook: (<div className={styles.lowerGrid}>
              <section className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.eyebrow}>PLANNING WORKLOAD</span>
                    <h2>Estimated services by month</h2>
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
            </div>),
    equipment: <EquipmentServicePanel key={String(demo)} items={items} demo={demo} actor={equipmentActor} onSampleChange={updateSampleEquipment} onSaved={refreshData} />,
  };
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
          <button className={styles.secondary} onClick={toggleDemo} disabled={photoBusy !== null}>
            <FlaskConical size={16} />
            {demo ? "Use fleet data" : "Try sample data"}
          </button>
          <button className={styles.secondary} onClick={exportJson}><Download size={16}/>Export report JSON</button>
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
      <div id="analytics-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && (
          <>
            <AnalyticsPreferences key={managerId} preferences={preferences} onChange={changePreferences} onReset={resetPreferences} />
            {storageMessage && <p role="status" className={styles.notice}>{storageMessage}</p>}
            <MaintenanceActions rows={fleetRows} onEdit={edit}/>
            {!!identitySetup.length && (
              <section className={styles.panel} aria-label="Vehicle identity setup">
                <h2>Vehicle identity setup</h2>
                <ul className={styles.priorityList}>
                  {identitySetup.map(({vehicle, issues}) => (
                    <li key={vehicle.id}>
                      <strong>{vehicle.vehicleNumber}</strong>
                      {issues.map(issue => <p key={issue}>{issue} <button className={styles.setupLink} onClick={() => edit(vehicle.id, "profile", undefined, 1)}>Add identity detail →</button></p>)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!!equipmentWork.length && (
              <section className={styles.panel} aria-label="Equipment maintenance actions">
                <h2>Equipment maintenance actions</h2>
                <ul className={styles.priorityList}>
                  {equipmentWork.map(({item, forecasts}) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong>
                      {forecasts.length ? forecasts.map(f => (
                        <div key={f.ruleId}>
                          <p>{f.title} · {labels[f.status]}</p>
                          <p>{f.reason}</p>
                          <p>Source: {f.source || "Unknown / unverified"}</p>
                        </div>
                      )) : <p>Needs setup · Service schedule and history are unknown. No interval is assumed.</p>}
                      <button className={styles.secondary} onClick={() => openEquipment(item.id)}>Review equipment service →</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!!lowTools.length && (
              <section className={styles.panel} aria-label="Equipment replacement reviews">
                <h2>Equipment replacement reviews</h2>
                <p className={styles.muted}>Replacement lifespan is separate from operating-hour and calendar service.</p>
                <ul className={styles.priorityList}>
                  {lowTools.map(item => (
                    <li key={item.id}>
                      <strong>{item.name} · {computeLifespanStatus(item, now) === "due_for_review" ? "Review now" : "Getting low"}</strong>
                      {demo ? <button className={styles.secondary} onClick={() => openEquipment(item.id)}>Review sample equipment life →</button> : <Link className={styles.secondary} href="/equipment">Review replacement lifespan →</Link>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {photoError && <p role="alert" className={styles.error}>{photoError}</p>}
            <div className={styles.overviewWidgets}>
              {preferences.order.filter(id => !preferences.hidden.includes(id)).map(id => (
                <section key={id} data-analytics-widget={id}>{widgets[id]}</section>
              ))}
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
                  Compare trucks on shared calendar or mileage scales. Later dates
                  assume earlier services are completed.
                </p>
              </div>
              <span className={styles.softBadge}>
                {format(now, "MMM yyyy")} —{" "}
                {format(addMonths(now, 12), "MMM yyyy")}
              </span>
            </div>
            <FleetTimeline rows={rows} events={events} now={now}
              onService={(id,ruleId) => edit(id,"service",ruleId)}
              onSetup={(id) => edit(id,"profile")}
              onReading={(id)=>edit(id,"reading")}
              onAppointment={(id,appointmentId)=>{const appointment=source.find(v=>v.id===id)?.maintenanceAppointments?.find(a=>a.id===appointmentId);setEditor({id,mode:"appointment",appointment});}} />
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
            <EquipmentServicePanel key={`${demo}-${equipmentFocus}`} items={focusedEquipment} demo={demo} actor={equipmentActor} onSampleChange={updateSampleEquipment} onSaved={refreshData} />
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
          actor={demo?"synthetic-manager":user?.id || ""}
          demo={demo}
          onClose={() => setEditor(null)}
          onSave={save}
          initialStep={editor.step}
          initialRuleId={editor.ruleId}
          original={editor.original}
          appointment={editor.appointment}
        />
      )}
    </div>
  );
}
