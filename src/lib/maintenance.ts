import { addMonths, format, parseISO, isValid } from "date-fns";
import type {
  Vehicle,
  MaintenanceReading,
  VehicleServiceRecord,
  MaintenanceProfile,
} from "@/types";
export type OilStatus = "needs_setup" | "overdue" | "due_soon" | "scheduled";
export interface OilForecast {
  status: OilStatus;
  dueDate?: string;
  dueOdometer?: number;
  remainingMiles?: number;
  milesPerDay?: number;
  lastService?: VehicleServiceRecord;
  reason: string;
}
export interface PlanningEvent {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  title: string;
  date: string;
  projected: boolean;
  detail: string;
  overdue: boolean;
}
export const dateOnly = (d: Date) => format(d, "yyyy-MM-dd");
export function validDay(value: string): boolean {
  const d = parseISO(value);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(d) && dateOnly(d) === value
  );
}
export function mileageRate(
  readings: MaintenanceReading[],
  now = new Date(),
): number | null {
  const cutoff = addMonths(now, -3).getTime();
  const rows = readings
    .filter(
      (r) =>
        validDay(r.date) &&
        Number.isFinite(r.odometer) &&
        r.odometer >= 0 &&
        parseISO(r.date).getTime() >= cutoff &&
        r.date <= dateOnly(now),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
  if (rows.length < 2) return null;
  const first = rows[0],
    last = rows[rows.length - 1];
  const elapsed =
    (parseISO(last.date).getTime() - parseISO(first.date).getTime()) / 86400000;
  if (
    elapsed < 7 ||
    now.getTime() - parseISO(last.date).getTime() > 15 * 86400000 ||
    rows.some((r, i) => i > 0 && r.odometer < rows[i - 1].odometer)
  )
    return null;
  const rate = (last.odometer - first.odometer) / elapsed;
  return rate > 0 ? rate : null;
}
export function validateProfile(profile: MaintenanceProfile): string | null {
  if (profile.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(profile.vin))
    return "Enter a valid 17-character VIN (no I, O or Q).";
  if (
    profile.year != null &&
    (!Number.isInteger(profile.year) ||
      profile.year < 1981 ||
      profile.year > new Date().getFullYear() + 1)
  )
    return "Enter a valid model year.";
  for (const value of [profile.oilIntervalMiles, profile.oilIntervalMonths])
    if (value != null && (!Number.isInteger(value) || value <= 0))
      return "Oil intervals must be positive whole numbers.";
  if (
    profile.scheduleConfirmed &&
    (!profile.oilIntervalMiles ||
      !profile.oilIntervalMonths ||
      !profile.scheduleSource?.trim())
  )
    return "Enter both oil limits and their source before confirming the schedule.";
  return null;
}
export function validateService(
  record: Pick<VehicleServiceRecord, "date" | "odometer" | "title">,
  current?: number,
  now = new Date(),
): string | null {
  if (!record.title.trim()) return "Enter a service description.";
  if (!validDay(record.date) || record.date > dateOnly(now))
    return "Enter a valid service date that is not in the future.";
  if (!Number.isInteger(record.odometer) || record.odometer < 0)
    return "Enter a nonnegative whole-number odometer reading.";
  if (current == null || !Number.isFinite(current))
    return "Record the current odometer before adding service history.";
  if (record.odometer > current)
    return "Service mileage exceeds the current odometer. Record the current mileage first.";
  return null;
}
export function forecastOil(
  vehicle: Vehicle,
  readings: MaintenanceReading[],
  now = new Date(),
): OilForecast {
  const p = vehicle.maintenance;
  const last = [...(vehicle.serviceHistory || [])]
    .filter(
      (s) =>
        s.kind === "oil" &&
        validDay(s.date) &&
        s.date <= dateOnly(now) &&
        Number.isFinite(s.odometer),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer)[0];
  if (
    !p?.scheduleConfirmed ||
    validateProfile(p) ||
    !p.oilIntervalMiles ||
    !p.oilIntervalMonths ||
    !last ||
    vehicle.odometer == null ||
    vehicle.odometer < last.odometer
  )
    return {
      status: "needs_setup",
      lastService: last,
      reason:
        "Confirm oil intervals, current mileage and the last completed oil change.",
    };
  const dueOdometer = last.odometer + p.oilIntervalMiles;
  const remainingMiles = dueOdometer - vehicle.odometer;
  const rate = mileageRate(readings, now);
  const calendarDue = dateOnly(
    addMonths(parseISO(last.date), p.oilIntervalMonths),
  );
  // Anchor mileage predictions to the measured reading date, not the page-open date.
  const latest = [...readings]
    .filter((r) => validDay(r.date) && r.date <= dateOnly(now))
    .sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer)[0];
  const mileageDue =
    rate && latest && latest.odometer === vehicle.odometer
      ? dateOnly(
          new Date(
            parseISO(latest.date).getTime() +
              Math.max(0, remainingMiles / rate) * 86400000,
          ),
        )
      : undefined;
  const dueDate =
    mileageDue && mileageDue < calendarDue ? mileageDue : calendarDue;
  const days =
    (parseISO(dueDate).getTime() - parseISO(dateOnly(now)).getTime()) /
    86400000;
  const overdue = remainingMiles <= 0 || days <= 0;
  return {
    status: overdue
      ? "overdue"
      : days <= 30 || remainingMiles <= 500
        ? "due_soon"
        : "scheduled",
    dueDate,
    dueOdometer,
    remainingMiles,
    milesPerDay: rate ?? undefined,
    lastService: last,
    reason:
      mileageDue && mileageDue < calendarDue
        ? "Estimated mileage limit; recalculates as readings change."
        : "Calendar limit; mileage or the vehicle oil-life warning may require earlier service.",
  };
}
export function buildOilTimeline(
  vehicle: Vehicle,
  readings: MaintenanceReading[],
  now = new Date(),
): PlanningEvent[] {
  const forecast = forecastOil(vehicle, readings, now);
  if (!forecast.dueDate) return [];
  const events: PlanningEvent[] = [];
  const end = dateOnly(addMonths(now, 12));
  let date = forecast.status === "overdue" ? dateOnly(now) : forecast.dueDate;
  for (let i = 0; i < 24 && date <= end; i++) {
    events.push({
      id: `${vehicle.id}-oil-${i}`,
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      title: "Oil & filter service",
      date,
      projected: true,
      overdue: i === 0 && forecast.status === "overdue",
      detail:
        i === 0
          ? forecast.reason
          : "Assumes the previous projected service is completed and driving patterns stay similar.",
    });
    const timeNext = dateOnly(
      addMonths(parseISO(date), vehicle.maintenance!.oilIntervalMonths!),
    );
    const milesNext = forecast.milesPerDay
      ? dateOnly(
          new Date(
            parseISO(date).getTime() +
              (vehicle.maintenance!.oilIntervalMiles! / forecast.milesPerDay) *
                86400000,
          ),
        )
      : timeNext;
    const next = milesNext < timeNext ? milesNext : timeNext;
    if (next <= date) break;
    date = next;
  }
  return events;
}
export function decodeVinResult(payload: {
  Results?: Array<Record<string, string>>;
}): MaintenanceProfile {
  const row = payload.Results?.[0];
  if (
    !row ||
    row.ErrorCode !== "0" ||
    !row.Make ||
    !row.Model ||
    !/^\d{4}$/.test(row.ModelYear)
  )
    throw new Error(
      "VIN could not be fully decoded. Check the VIN or enter the vehicle details manually.",
    );
  return {
    make: row.Make,
    model: row.Model,
    year: Number(row.ModelYear),
    engine: [
      row.DisplacementL ? `${row.DisplacementL}L` : "",
      row.EngineModel,
      row.ElectrificationLevel,
    ]
      .filter(Boolean)
      .join(" · "),
    drivetrain: row.DriveType || "",
  };
}
