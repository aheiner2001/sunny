// Handler: index.handler
//
// Environment variables:
// FIREBASE_PROJECT_ID
// FIREBASE_SECRET_ARN
// SES_FROM_EMAIL
// REPORT_RECIPIENTS
// SEND_ENABLED=true
// REPORT_TIMEZONE=America/Denver
//
// Optional:
// FIREBASE_DATABASE_ID=(default)
// REPORT_WEEK=previous
// REPORT_WEEK=current
//
// Preview: {"dryRun":true}
// Preview with CSV contents: {"dryRun":true,"includeCsv":true}
// Send: {"dryRun":false}
//
// Reads Firestore without changing vehicle or service records.
// Ford reference checkpoints are informational.
// Verified vehicle maintenance rules drive actual deadlines.

import { sign, randomUUID } from "node:crypto";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

// -----------------------------------------------------------------------------
// Date and validation helpers
// -----------------------------------------------------------------------------

const MILLISECONDS_IN_HOUR = 3600000;
const MILLISECONDS_IN_DAY = 86400000;

const list = value =>
  Array.isArray(value) ? value.filter(Boolean) : [];

const ms = value =>
  typeof value === "string" && value.trim()
    ? Date.parse(value)
    : NaN;

const number = value =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0;

const positive = value =>
  value != null &&
  Number.isInteger(value) &&
  value > 0;

const mileage = value =>
  value != null &&
  Number.isInteger(value) &&
  value >= 0;

const hours = value => Number(value || 0).toFixed(2);

const dateOnly = date => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const day = dateOnly;

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

function validDay(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(value + "T12:00:00Z");

  return (
    Number.isFinite(+date) &&
    date.toISOString().slice(0, 10) === value
  );
}

const dateDay = value =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  day(new Date(value + "T12:00:00")) === value;

function parseISO(value) {
  return validDay(value)
    ? new Date(value + "T12:00:00")
    : new Date(NaN);
}

function addMonths(date, amount) {
  const result = new Date(+date);
  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + amount);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));

  return result;
}

function calendarDays(from, to) {
  return (
    Date.parse(to + "T00:00:00Z") -
    Date.parse(from + "T00:00:00Z")
  ) / MILLISECONDS_IN_DAY;
}

function getPeriod(anchor, zone, mode = "previous") {
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
  }).format(anchor);

  process.env.TZ = zone;

  const end = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate()
  );

  end.setDate(
    end.getDate() - (end.getDay() + 6) % 7
  );

  const start = new Date(end);

  if (mode === "current") {
    end.setDate(end.getDate() + 7);
  } else {
    start.setDate(start.getDate() - 7);
  }

  const last = new Date(end);
  last.setDate(last.getDate() - 1);

  return {
    start: +start,
    end: +end,
    startDay: day(start),
    endDay: day(last),
    zone,
    mode,
  };
}

// -----------------------------------------------------------------------------
// Mileage normalization and calculations
// -----------------------------------------------------------------------------

function mileageRate(readings, now = new Date()) {
  const today = dateOnly(now);
  const cutoff = dateOnly(
    addMonths(parseISO(today), -3)
  );

  const rows = readings
    .filter(reading =>
      reading.confirmed === true &&
      validDay(reading.date) &&
      Number.isFinite(reading.odometer) &&
      reading.odometer >= 0 &&
      reading.date >= cutoff &&
      reading.date <= today
    )
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.timestamp || 0) - (b.timestamp || 0) ||
      a.odometer - b.odometer
    );

  if (rows.length < 2) return null;

  const first = rows[0];
  const last = rows.at(-1);
  const elapsed = calendarDays(
    first.date,
    last.date
  );

  if (
    elapsed < 7 ||
    calendarDays(last.date, today) > 15 ||
    rows.some(
      (reading, index) =>
        index &&
        reading.odometer < rows[index - 1].odometer
    )
  ) {
    return null;
  }

  const rate =
    (last.odometer - first.odometer) / elapsed;

  return rate > 0 ? rate : null;
}

function analyzeMileage(
  vehicle,
  inspections,
  period,
  now
) {
  const warnings = [];
  const candidates = [];
  const seenIds = new Map();
  const today = dateOnly(now);

  function add(raw, source, id) {
    if (raw.confirmed === false) return;

    if (!number(raw.odometer)) {
      if (source === "inspection") {
        warnings.push(
          "Inspection mileage missing or not numeric."
        );
      }
      return;
    }

    const date = validDay(raw.date)
      ? raw.date
      : null;

    if (
      !date ||
      date > today ||
      (
        raw.timestamp &&
        raw.timestamp > +now
      )
    ) {
      warnings.push(
        "Invalid or future odometer date."
      );
      return;
    }

    if (id && seenIds.has(id)) {
      const previous = seenIds.get(id);

      if (
        previous.odometer !== raw.odometer ||
        previous.date !== date
      ) {
        warnings.push(
          "Conflicting duplicate inspection ID."
        );
      }

      return;
    }

    const row = {
      date,
      odometer: raw.odometer,
      confirmed: raw.confirmed === true,
      timestamp: raw.timestamp || null,
      source,
    };

    if (id) seenIds.set(id, row);
    candidates.push(row);
  }

  for (
    const reading of list(
      vehicle.maintenanceReadings
    )
  ) {
    const timestamp = ms(reading.recordedAt);

    add(
      {
        ...reading,
        timestamp: Number.isFinite(timestamp)
          ? timestamp
          : null,
      },
      "maintenance",
      null
    );
  }

  for (const inspection of inspections) {
    if (inspection.vehicleId !== vehicle.id) {
      continue;
    }

    const timestamp = [
      inspection.submittedAt,
      inspection.completedAt,
      inspection.startedAt,
    ]
      .map(ms)
      .find(Number.isFinite);

    const date = Number.isFinite(timestamp)
      ? dateOnly(new Date(timestamp))
      : inspection.dateString;

    add(
      {
        date,
        odometer: inspection.odometer,
        confirmed: inspection.odometerConfirmed,
        timestamp: Number.isFinite(timestamp)
          ? timestamp
          : null,
      },
      "inspection",
      inspection.id
    );
  }

  const unique = new Map();

  for (const reading of candidates) {
    const key = [
      reading.date,
      reading.timestamp ?? "date-only",
      reading.odometer,
    ].join("|");

    const previous = unique.get(key);

    if (
      !previous ||
      (
        reading.confirmed &&
        !previous.confirmed
      )
    ) {
      unique.set(key, reading);
    }
  }

  const readings = [...unique.values()]
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.timestamp || 0) - (b.timestamp || 0) ||
      a.odometer - b.odometer
    );

  let conflict = warnings.some(
    warning => /Conflicting duplicate/.test(warning)
  );

  for (
    let index = 1;
    index < readings.length;
    index++
  ) {
    const previous = readings[index - 1];
    const current = readings[index];

    if (
      current.odometer < previous.odometer
    ) {
      warnings.push(
        "Odometer decreased; review readings before using mileage."
      );
      conflict = true;
    }

    if (
      previous.date === current.date &&
      previous.odometer !== current.odometer &&
      (
        !previous.timestamp ||
        !current.timestamp ||
        previous.timestamp === current.timestamp
      )
    ) {
      warnings.push(
        "Different same-day readings lack reliable time ordering."
      );
      conflict = true;
    }
  }

  const latest = readings.at(-1);

  if (
    latest &&
    number(vehicle.odometer) &&
    vehicle.odometer !== latest.odometer
  ) {
    warnings.push(
      "Stored vehicle odometer conflicts with latest dated reading."
    );
    conflict = true;
  }

  if (!latest) {
    warnings.push(
      "No dated mileage readings available."
    );
  }

  if (
    latest &&
    calendarDays(latest.date, today) > 15
  ) {
    warnings.push(
      "Latest mileage reading is more than 15 days old."
    );
  }

  const weekRows = readings.filter(
    reading =>
      reading.date >= period.startDay &&
      reading.date <= period.endDay
  );

  const observedMiles =
    !conflict && weekRows.length >= 2
      ? weekRows.at(-1).odometer -
        weekRows[0].odometer
      : null;

  const coverage =
    observedMiles == null
      ? "Insufficient or conflicting readings"
      : (
          "Partial observed interval: " +
          weekRows[0].date +
          " to " +
          weekRows.at(-1).date +
          "; not a complete weekly total"
        );

  return {
    vehicle:
      vehicle.vehicleNumber ||
      vehicle.name ||
      vehicle.id,
    vehicleId: vehicle.id,
    readings,
    conflict,
    currentOdometer:
      latest?.odometer ??
      (
        number(vehicle.odometer)
          ? vehicle.odometer
          : null
      ),
    currentDate: latest?.date || null,
    currentConfirmed:
      latest?.confirmed === true,
    readingCount: weekRows.length,
    observedMiles,
    coverage,
    confirmedMilesPerDay: conflict
      ? null
      : mileageRate(readings, now),
    warnings: [...new Set(warnings)],
  };
}

// -----------------------------------------------------------------------------
// Service history and maintenance forecasts
// -----------------------------------------------------------------------------

function hasServiceChronologyConflict(rows) {
  const measured = rows
    .filter(row =>
      validDay(row.date) &&
      row.measurement != null &&
      Number.isFinite(row.measurement)
    )
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.measurement - b.measurement
    );

  return measured.some(
    (row, index) =>
      index > 0 &&
      row.measurement <
        measured[index - 1].measurement
  );
}

const VEHICLE_HISTORY_REVIEW =
  "Service history has conflicting mileage chronology. Review completed service dates and mileages.";

function vehicleServiceHistoryIssue(records) {
  const conflict =
    hasServiceChronologyConflict(
      records.map(service => ({
        date: service.date,
        measurement: service.odometer,
      }))
    );

  return conflict
    ? VEHICLE_HISTORY_REVIEW
    : null;
}

function effectiveServices(records) {
  const accepted = [];
  const superseded = new Set();

  for (const record of records) {
    if (
      accepted.some(
        service => service.id === record.id
      )
    ) {
      continue;
    }

    if (record.supersedesId) {
      const original = accepted.find(
        service =>
          service.id === record.supersedesId &&
          !superseded.has(service.id)
      );

      if (
        !original ||
        original.id === record.id ||
        original.ruleId !== record.ruleId ||
        original.kind !== record.kind
      ) {
        continue;
      }

      superseded.add(original.id);
    }

    accepted.push(record);
  }

  return accepted.filter(
    service => !superseded.has(service.id)
  );
}

function validateMaintenanceRule(
  rule,
  now = new Date()
) {
  if (
    !rule.id?.trim() ||
    !rule.title?.trim()
  ) {
    return "Enter a rule identifier and title.";
  }

  if (
    ![
      "after_service",
      "initial_then_recurring",
    ].includes(rule.recurrence)
  ) {
    return "Choose a valid recurrence.";
  }

  if (
    rule.confirmed &&
    ![
      rule.intervalMiles,
      rule.intervalMonths,
    ].some(positive)
  ) {
    return "Enter a positive mileage or month interval.";
  }

  if (
    [
      rule.intervalMiles,
      rule.intervalMonths,
      rule.initialMiles,
      rule.initialMonths,
    ].some(
      value =>
        value != null &&
        !positive(value)
    )
  ) {
    return "Intervals must be positive whole numbers.";
  }

  if (
    rule.confirmed &&
    !rule.source?.trim()
  ) {
    return "Verify a schedule source before confirming rule.";
  }

  if (
    rule.baselineDate &&
    (
      !validDay(rule.baselineDate) ||
      rule.baselineDate > dateOnly(now)
    )
  ) {
    return "Enter a valid baseline date.";
  }

  if (
    rule.baselineOdometer != null &&
    !mileage(rule.baselineOdometer)
  ) {
    return "Enter a valid baseline mileage.";
  }

  return null;
}

function forecastMaintenance(
  vehicle,
  readings,
  now = new Date()
) {
  const profile = vehicle.maintenance || {};
  const rules = [...list(profile.rules)];

  // Support existing legacy oil-profile fields.
  if (
    !rules.some(rule => rule.id === "oil") &&
    (
      profile.oilIntervalMiles != null ||
      profile.oilIntervalMonths != null ||
      profile.scheduleConfirmed
    )
  ) {
    rules.push({
      id: "oil",
      kind: "oil",
      title: "Oil & filter service",
      recurrence: "after_service",
      intervalMiles: profile.oilIntervalMiles,
      intervalMonths: profile.oilIntervalMonths,
      confirmed:
        profile.scheduleConfirmed === true,
      source: profile.scheduleSource || "",
    });
  }

  if (!rules.length) {
    return [{
      ruleId: "setup",
      title: "Maintenance schedule",
      status: "needs_setup",
      reason:
        "Add and verify maintenance rules for this vehicle.",
      missing: [
        "Maintenance rules missing",
      ],
    }];
  }

  const today = dateOnly(now);

  const history = effectiveServices(
    list(vehicle.serviceHistory)
  );

  const confirmed = readings.filter(
    reading => reading.confirmed === true
  );

  const latest = readings.at(-1);

  const currentUsable =
    latest &&
    latest.confirmed === true &&
    calendarDays(latest.date, today) <= 15 &&
    latest.odometer === vehicle.odometer &&
    !vehicle.mileageConflict;

  const rate = vehicle.mileageConflict
    ? null
    : mileageRate(confirmed, now);

  return rules.map(rule => {
    const fatal = [];
    const notes = [];

    const invalid =
      validateMaintenanceRule(rule, now);

    if (invalid) fatal.push(invalid);

    if (!rule.confirmed) {
      fatal.push(
        "Confirm schedule against the exact vehicle and source."
      );
    }

    if (!rule.source?.trim()) {
      fatal.push(
        "Add verified schedule source."
      );
    }

    if (
      ![
        rule.intervalMiles,
        rule.intervalMonths,
      ].some(positive)
    ) {
      fatal.push(
        "Add a valid service interval."
      );
    }

    const services = history.filter(
      service =>
        service.ruleId === rule.id ||
        (
          rule.id === "oil" &&
          !service.ruleId &&
          service.kind === "oil"
        )
    );

    const lastService = services
      .filter(service =>
        validDay(service.date) &&
        service.date <= today
      )
      .sort((a, b) =>
        b.date.localeCompare(a.date) ||
        (b.odometer ?? -1) -
          (a.odometer ?? -1)
      )[0];

    const initial =
      rule.recurrence ===
        "initial_then_recurring" &&
      !lastService;

    const baseDate =
      lastService?.date ||
      (
        initial
          ? profile.inServiceDate
          : rule.baselineDate
      );

    const baseMiles = lastService
      ? lastService.odometer
      : initial
        ? 0
        : rule.baselineOdometer;

    const months = initial
      ? (
          rule.initialMonths ??
          rule.intervalMonths
        )
      : rule.intervalMonths;

    const miles = initial
      ? (
          rule.initialMiles ??
          rule.intervalMiles
        )
      : rule.intervalMiles;

    if (
      !lastService &&
      profile.baselineUnknown
    ) {
      fatal.push(
        "Verify service history or record a completed-service baseline."
      );
    }

    const historyIssue =
      vehicleServiceHistoryIssue(services);

    if (historyIssue) {
      notes.push(historyIssue);
    }

    // Calendar reminders can work without mileage.
    const calendarDue =
      months &&
      validDay(baseDate) &&
      baseDate <= today
        ? dateOnly(
            addMonths(
              parseISO(baseDate),
              months
            )
          )
        : null;

    if (months && !calendarDue) {
      notes.push(
        "Calendar limit not evaluated: last service or initial baseline date needed."
      );
    }

    const mileageUsable =
      miles &&
      mileage(baseMiles) &&
      currentUsable &&
      !historyIssue &&
      mileage(vehicle.odometer) &&
      vehicle.odometer >= baseMiles;

    const dueOdometer =
      miles && mileage(baseMiles)
        ? baseMiles + miles
        : null;

    const remainingMiles = mileageUsable
      ? dueOdometer - vehicle.odometer
      : null;

    if (miles && !mileageUsable) {
      notes.push(
        "Mileage limit not evaluated: need a recent confirmed reading, valid baseline mileage and consistent history."
      );
    }

    const mileageDue =
      remainingMiles != null &&
      rate &&
      latest
        ? dateOnly(
            new Date(
              +parseISO(latest.date) +
              Math.ceil(
                Math.max(
                  0,
                  remainingMiles
                ) / rate
              ) * MILLISECONDS_IN_DAY
            )
          )
        : null;

    const dueDate = [
      calendarDue,
      mileageDue,
    ]
      .filter(Boolean)
      .sort()[0] || null;

    const daysUntil = dueDate
      ? calendarDays(today, dueDate)
      : null;

    const calendarOverdue =
      calendarDue &&
      calendarDays(
        today,
        calendarDue
      ) <= 0;

    const status =
      fatal.length ||
      (
        !calendarDue &&
        remainingMiles == null
      )
        ? "needs_setup"
        : (
            calendarOverdue ||
            (
              remainingMiles != null &&
              remainingMiles <= 0
            )
          )
          ? "overdue"
          : (
              (
                daysUntil != null &&
                daysUntil <= 30
              ) ||
              (
                remainingMiles != null &&
                remainingMiles <= 1000
              )
            )
            ? "due_soon"
            : "scheduled";

    const reason = [
      ...fatal,
      ...(
        calendarDue
          ? [
              "Calendar deadline " +
              calendarDue +
              ".",
            ]
          : []
      ),
      ...(
        mileageDue
          ? [
              "Estimated mileage deadline " +
              mileageDue +
              "; not a measured service event.",
            ]
          : []
      ),
      ...(
        remainingMiles != null
          ? [
              remainingMiles +
              " measured miles remaining.",
            ]
          : []
      ),
      ...notes,
    ].join(" ");

    return {
      ruleId: rule.id,
      title: rule.title,
      status,
      source: rule.source || "",
      reason,
      dueDate,
      calendarDue,
      mileageDue,
      dueOdometer,
      remainingMiles,
      daysUntil,
      lastService,
      milesPerDay: rate,
      missing: [
        ...fatal,
        ...notes,
      ],
      basis: [
        "Verified service rule",
      ],
    };
  });
}

// -----------------------------------------------------------------------------
// Timesheet calculations
// -----------------------------------------------------------------------------

function netHours(start, end, breaks) {
  const startMs = ms(start);
  const endMs = ms(end);
  const breakSeconds = breaks ?? 0;

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs ||
    !number(breakSeconds) ||
    breakSeconds >=
      (endMs - startMs) / 1000
  ) {
    return null;
  }

  return (
    (endMs - startMs) /
      MILLISECONDS_IN_HOUR -
    breakSeconds / 3600
  );
}

// -----------------------------------------------------------------------------
// Combined analytics
// -----------------------------------------------------------------------------

function buildAnalytics(
  data,
  now = new Date(),
  anchor = now,
  zone = "America/Denver",
  mode = "previous"
) {
  const period = getPeriod(
    anchor,
    zone,
    mode
  );

  const warnings = [];
  const employeeMap = new Map();

  const getEmployee = (id, name) => {
    const key = String(id || "unknown");

    if (!employeeMap.has(key)) {
      employeeMap.set(key, {
        id: key,
        name: name || key,
        approved: 0,
        pending: 0,
        stuckShifts: 0,
      });
    }

    return employeeMap.get(key);
  };

  const shifts = list(
    data.timesheet_shifts
  );

  const valid = [];
  const shiftRows = [];
  const incomplete = [];

  for (const shift of shifts) {
    const start = ms(shift.startAtUtc);
    const end = ms(shift.endAtUtc);

    if (!shift.endAtUtc) {
      if (
        Number.isFinite(start) &&
        start <= +now
      ) {
        const isStuck =
          (+now - start) >
          16 * MILLISECONDS_IN_HOUR;

        const employee = getEmployee(
          shift.employeeId,
          shift.employeeName
        );

        if (isStuck) {
          employee.stuckShifts++;
        }

        incomplete.push({
          employee:
            shift.employeeName ||
            shift.employeeId ||
            "Unknown",
          employeeId:
            shift.employeeId || "",
          shiftId: shift.id || "",
          start: shift.startAtUtc,
          status:
            shift.status || "unknown",
          isStuck,
          attention: isStuck
            ? "Open >16h"
            : "Currently clocked in",
        });
      }

      continue;
    }

    const net = netHours(
      shift.startAtUtc,
      shift.endAtUtc,
      shift.unpaidBreakSeconds
    );

    if (
      net === null ||
      !shift.employeeId ||
      ![
        "approved",
        "pending",
      ].includes(shift.status) ||
      end > +now
    ) {
      continue;
    }

    valid.push({
      shift,
      start,
      end,
      net,
    });
  }

  for (const entry of valid) {
    const overlap = Math.max(
      0,
      Math.min(
        entry.end,
        period.end
      ) -
      Math.max(
        entry.start,
        period.start
      )
    );

    if (!overlap) continue;

    const employee = getEmployee(
      entry.shift.employeeId,
      entry.shift.employeeName
    );

    const portion =
      entry.net *
      overlap /
      (entry.end - entry.start);

    if (
      entry.shift.status === "approved"
    ) {
      employee.approved += portion;
    }

    if (
      entry.shift.status === "pending"
    ) {
      employee.pending += portion;
    }

    shiftRows.push({
      employee: employee.name,
      employeeId: employee.id,
      status: entry.shift.status,
      start: entry.shift.startAtUtc,
      end: entry.shift.endAtUtc,
      weekHours: portion,
    });
  }

  const employees = [
    ...employeeMap.values(),
  ].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const totals = employees.reduce(
    (total, employee) => ({
      approved:
        total.approved +
        employee.approved,
      pending:
        total.pending +
        employee.pending,
      stuckShifts:
        total.stuckShifts +
        employee.stuckShifts,
    }),
    {
      approved: 0,
      pending: 0,
      stuckShifts: 0,
    }
  );

  const maintenanceHorizon = [];
  const setupGaps = [];
  const vehicleMileage = [];
  const maintenanceRows = [];

  const activeVehicles = list(
    data.vehicles
  ).filter(vehicle =>
    vehicle.status !== "inactive"
  );

  for (const vehicle of activeVehicles) {
    const label =
      vehicle.vehicleNumber ||
      vehicle.name ||
      vehicle.id;

    const analysis = analyzeMileage(
      vehicle,
      list(data.inspections),
      period,
      now
    );

    vehicleMileage.push(analysis);

    const vehicleGaps = [
      ...analysis.warnings,
    ];

    const effectiveVehicle = {
      ...vehicle,
      odometer:
        analysis.currentOdometer,
      mileageConflict:
        analysis.conflict,
    };

    let forecasts = [];

    try {
      forecasts =
        forecastMaintenance(
          effectiveVehicle,
          analysis.readings,
          now
        );
    } catch {
      vehicleGaps.push(
        "Maintenance schedule malformed; review configuration."
      );
    }

    for (const forecast of forecasts) {
      const row = {
        vehicle: label,
        service: forecast.title,
        status: forecast.status,
        dueDate:
          forecast.dueDate ||
          "Not determined",
        dueOdometer:
          forecast.dueOdometer ??
          null,
        remainingMiles:
          forecast.remainingMiles ??
          null,
        daysUntil:
          forecast.daysUntil ??
          null,
        reason:
          forecast.reason || "",
        source:
          forecast.source || "",
      };

      maintenanceRows.push(row);

      if (
        [
          "overdue",
          "due_soon",
        ].includes(forecast.status)
      ) {
        maintenanceHorizon.push(row);
      }

      if (
        forecast.status ===
          "needs_setup" ||
        forecast.missing?.length
      ) {
        vehicleGaps.push(
          forecast.reason
        );
      }
    }

    if (vehicleGaps.length) {
      setupGaps.push({
        vehicle: label,
        reasons: [
          ...new Set(vehicleGaps),
        ].join("; "),
      });
    }
  }

  maintenanceHorizon.sort((a, b) => {
    if (
      a.status === "overdue" &&
      b.status !== "overdue"
    ) {
      return -1;
    }

    if (
      b.status === "overdue" &&
      a.status !== "overdue"
    ) {
      return 1;
    }

    return (
      (a.daysUntil ?? 999) -
      (b.daysUntil ?? 999)
    );
  });

  const todayString = day(now);

  const equipmentWatchlist = list(
    data.equipment
  )
    .filter(equipment =>
      !equipment.retiredAt &&
      equipment.lifespanEnabled !== false
    )
    .flatMap(equipment => {
      let warn = false;
      let wearNote = "";

      if (
        equipment.expectedCars &&
        number(equipment.carsUsed)
      ) {
        const percent =
          (
            equipment.carsUsed /
            equipment.expectedCars
          ) * 100;

        const threshold =
          equipment.lowWearThresholdPercent ||
          80;

        if (percent >= threshold) {
          warn = true;

          wearNote =
            Math.round(percent) +
            "% worn (" +
            equipment.carsUsed +
            "/" +
            equipment.expectedCars +
            " cars)";
        }
      }

      if (
        equipment.dueDate &&
        dateDay(equipment.dueDate)
      ) {
        const daysLeft = Math.round(
          (
            parseISO(
              equipment.dueDate
            ).getTime() -
            parseISO(
              todayString
            ).getTime()
          ) / MILLISECONDS_IN_DAY
        );

        if (daysLeft <= 30) {
          warn = true;

          const timeNote =
            daysLeft <= 0
              ? "Past replacement date"
              : (
                  "Due in " +
                  daysLeft +
                  " days"
                );

          wearNote = wearNote
            ? wearNote + "; " + timeNote
            : timeNote;
        }
      }

      if (
        [
          "getting_low",
          "due_for_review",
        ].includes(
          equipment.lifespanStatus
        )
      ) {
        warn = true;

        if (!wearNote) {
          wearNote =
            "Due for lifespan review";
        }
      }

      if (!warn) return [];

      return [{
        id: equipment.id,
        name:
          equipment.name ||
          equipment.id,
        location:
          equipment.vehicleNumber
            ? (
                "Van " +
                equipment.vehicleNumber
              )
            : "Shop Storage",
        wearNote,
        unitCost:
          number(equipment.unitCost)
            ? (
                "$" +
                equipment.unitCost.toFixed(2)
              )
            : "Unknown",
      }];
    });

  const result = {
    period,
    generatedAt: now.toISOString(),
    employees,
    totals,
    shiftRows,
    incomplete,
    maintenanceHorizon,
    maintenanceRows,
    vehicleMileage,
    setupGaps,
    equipmentWatchlist,
    warnings: [
      ...new Set(warnings),
    ],
    timesheetsAvailable:
      shifts.length > 0,
  };

  result.reportActions =
    buildReportActions(
      data,
      result
    );

  result.referencePositions =
    buildReferencePositions(
      data,
      result
    );

  return result;
}

// -----------------------------------------------------------------------------
// Manufacturer reference information
// -----------------------------------------------------------------------------

// Informational only. This does not automatically activate maintenance rules.
const FORD_MAVERICK_REFERENCE = {
  title:
    "2024-2025 Ford Maverick checkpoints",
  checkedAt: "2026-10-27",
  sources: [
    {
      year: 2024,
      url:
        "https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G2426440&Uid=G2426958&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=USA&vFilteringEnabled=False&variantid=9734",
    },
    {
      year: 2025,
      url:
        "https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/2025_P758_Maverick_OM_USCAN_enUSA.pdf",
      pages: "451-452",
    },
  ],
  rows: [
    [
      "Oil-life monitor / annual",
      "Oil and filter; rotate tires at oil service. Gas: do not exceed 10,000 mi or one year. Hybrids may travel farther; retain the one-year limit. Follow the truck's monitor and manual.",
    ],
    [
      "Every 20,000 mi",
      "Replace cabin air filter.",
    ],
    [
      "Every 30,000 mi",
      "Replace engine air filter. Severe service also calls for transmission fluid service.",
    ],
    [
      "Every 60,000 mi - severe service",
      "Replace spark plugs under severe service.",
    ],
    [
      "Every 100,000 mi",
      "Replace spark plugs; begin accessory-belt inspections, then inspect every other oil change.",
    ],
    [
      "Every 150,000 mi",
      "Change automatic transmission fluid; replace belts if not replaced in the previous 100,000 mi.",
    ],
    [
      "200,000 mi or 10 years initially",
      "Change coolant; then every 100,000 mi or five years, whichever comes first.",
    ],
    [
      "Every 3 years",
      "Change brake fluid.",
    ],
  ],
  note:
    "Reference only, not a truck-specific due notice. Recurring milestones repeat. Verify year, powertrain, operating conditions and completed service history. Frequent idling, heavy loads or dusty work may require severe-service maintenance. The supplied owner's manual takes priority.",
};

function buildReferencePositions(
  data,
  analytics
) {
  const result = [];

  for (
    const vehicle of list(
      data.vehicles
    )
  ) {
    const profile =
      vehicle.maintenance || {};

    const year = Number(
      profile.year ??
      vehicle.year ??
      vehicle.modelYear
    );

    const identity = [
      profile.make,
      profile.model,
      vehicle.make,
      vehicle.model,
      vehicle.name,
    ]
      .filter(Boolean)
      .join(" ");

    const vehicleMileage =
      analytics.vehicleMileage.find(
        row =>
          row.vehicleId === vehicle.id
      );

    if (
      ![2024, 2025].includes(year) ||
      !/maverick/i.test(identity) ||
      !/ford/i.test(identity) ||
      !vehicleMileage ||
      !vehicleMileage.currentDate ||
      !number(
        vehicleMileage.currentOdometer
      ) ||
      vehicleMileage.conflict ||
      calendarDays(
        vehicleMileage.currentDate,
        dateOnly(
          new Date(
            analytics.generatedAt
          )
        )
      ) > 15
    ) {
      continue;
    }

    // Reference comparison only; no missed service is inferred.
    const checkpoints = [
      {
        interval: 20000,
        service: "Cabin filter",
      },
      {
        interval: 30000,
        service: "Engine air filter",
      },
      {
        interval: 100000,
        service:
          "Spark plugs / belt inspection",
      },
      {
        interval: 150000,
        service:
          "Transmission fluid / belt review",
      },
    ].map(checkpoint => ({
      ...checkpoint,
      miles:
        Math.max(
          1,
          Math.ceil(
            vehicleMileage.currentOdometer /
            checkpoint.interval
          )
        ) * checkpoint.interval,
    }));

    const next = Math.min(
      ...checkpoints.map(
        checkpoint =>
          checkpoint.miles
      )
    );

    result.push({
      vehicle:
        vehicleMileage.vehicle,
      year,
      reading:
        vehicleMileage.currentOdometer,
      readingDate:
        vehicleMileage.currentDate,
      confirmed:
        vehicleMileage.currentConfirmed,
      checkpointMiles: next,
      remainingMiles:
        next -
        vehicleMileage.currentOdometer,
      service: checkpoints
        .filter(checkpoint =>
          checkpoint.miles === next
        )
        .map(checkpoint =>
          checkpoint.service
        )
        .join(" + "),
      note:
        "Reference only - review service records; this is not an overdue determination.",
    });
  }

  return result;
}

// -----------------------------------------------------------------------------
// Clear grouped setup actions
// -----------------------------------------------------------------------------

function buildReportActions(
  data,
  analytics
) {
  const grouped = new Map();

  const add = (
    code,
    title,
    step,
    vehicle
  ) => {
    if (!grouped.has(code)) {
      grouped.set(code, {
        code,
        title,
        step,
        vehicles: [],
      });
    }

    const entry = grouped.get(code);

    if (
      !entry.vehicles.includes(vehicle)
    ) {
      entry.vehicles.push(vehicle);
    }
  };

  const today = dateOnly(
    new Date(
      analytics.generatedAt
    )
  );

  for (
    const vehicle of list(
      data.vehicles
    ).filter(
      row =>
        row.status !== "inactive"
    )
  ) {
    const vehicleMileage =
      analytics.vehicleMileage.find(
        row =>
          row.vehicleId === vehicle.id
      );

    const name =
      vehicle.vehicleNumber ||
      vehicle.name ||
      vehicle.id;

    if (!vehicleMileage) continue;

    if (!vehicleMileage.currentDate) {
      add(
        "enable_odometer",
        "Enable odometer readings",
        "Enable odometer in the inspection checklist, then save two dated readings to calculate observed mileage. If already enabled, check that submitted inspections save the number.",
        name
      );
    } else {
      if (
        vehicleMileage.observedMiles == null &&
        !vehicleMileage.conflict &&
        vehicleMileage.readingCount < 2
      ) {
        add(
          "second_reading",
          "Save a second reading",
          "Save another odometer reading on a later inspection in the reporting week. Two readings show mileage only between those readings.",
          name
        );
      }

      if (
        !vehicleMileage.currentConfirmed &&
        !vehicleMileage.conflict
      ) {
        add(
          "confirm_reading",
          "Confirm the latest mileage",
          "In Settings > Manager > Analytics, review and confirm a recent measured odometer reading to enable mileage-based maintenance forecasts.",
          name
        );
      }

      if (
        calendarDays(
          vehicleMileage.currentDate,
          today
        ) > 15
      ) {
        add(
          "refresh_reading",
          "Update the odometer",
          "Save and confirm a fresh dated reading. Older readings remain history, not current mileage.",
          name
        );
      }
    }

    if (vehicleMileage.conflict) {
      add(
        "review_readings",
        "Review conflicting readings",
        "Compare inspection readings with the vehicle odometer in Settings > Manager > Analytics; correct decreasing values or conflicting dates before relying on mileage.",
        name
      );
    }

    const forecasts =
      analytics.maintenanceRows.filter(
        forecast =>
          forecast.vehicle === name
      );

    if (
      forecasts.some(forecast =>
        /Add and verify maintenance|Confirm schedule|verified schedule|valid service interval|Enter a rule|Choose a valid|Intervals must|valid baseline/i
          .test(forecast.reason)
      ) ||
      !forecasts.length
    ) {
      add(
        "rules",
        "Verify service rules",
        "In Settings > Manager > Analytics, select the vehicle and add verified oil and independent service rules with months, miles and source. Check year and engine before selecting Ford guidance.",
        name
      );
    }

    if (
      forecasts.some(forecast =>
        /baseline date needed|Verify service history|baselineUnknown/i
          .test(forecast.reason)
      )
    ) {
      add(
        "service_history",
        "Record completed services",
        "In Settings > Manager > Analytics, enter the actual last service date and mileage when known. An inspection date is not an oil-change date.",
        name
      );
    }

    const rules = list(
      vehicle.maintenance?.rules
    );

    if (
      vehicle.maintenance?.oilIntervalMiles &&
      !rules.some(
        rule => rule.id === "oil"
      )
    ) {
      rules.push({
        id: "oil",
        intervalMiles:
          vehicle.maintenance.oilIntervalMiles,
        recurrence:
          "after_service",
      });
    }

    const history =
      effectiveServices(
        list(
          vehicle.serviceHistory
        )
      );

    const missingMileageBaseline =
      rules.some(rule => {
        if (!rule.intervalMiles) {
          return false;
        }

        const service = history
          .filter(row =>
            row.ruleId === rule.id ||
            (
              rule.id === "oil" &&
              !row.ruleId &&
              row.kind === "oil"
            )
          )
          .filter(row =>
            validDay(row.date) &&
            row.date <= today
          )
          .sort((a, b) =>
            b.date.localeCompare(a.date)
          )[0];

        return service
          ? !mileage(
              service.odometer
            )
          : (
              rule.recurrence !==
                "initial_then_recurring" &&
              !mileage(
                rule.baselineOdometer
              )
            );
      });

    if (missingMileageBaseline) {
      add(
        "service_history",
        "Record completed services",
        "In Settings > Manager > Analytics, enter the actual last service date and mileage when known. An inspection date is not an oil-change date.",
        name
      );
    }

    if (
      forecasts.some(forecast =>
        /conflicting mileage chronology/i
          .test(forecast.reason)
      )
    ) {
      add(
        "service_conflict",
        "Review service history",
        "Check completed-service dates and odometers in Settings > Manager > Analytics. Calendar reminders may still be shown while mileage history is reviewed.",
        name
      );
    }
  }

  return [
    ...grouped.values(),
  ];
}

// -----------------------------------------------------------------------------
// CSV generation
// -----------------------------------------------------------------------------

function makeCSV(
  headers,
  records
) {
  const cell = value => {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    let text = String(value);

    if (
      typeof value === "string" &&
      /^[\s]*[=+\-@\t\r]/.test(text)
    ) {
      text = "'" + text;
    }

    return /[",\r\n]/.test(text)
      ? (
          '"' +
          text.replace(/"/g, '""') +
          '"'
        )
      : text;
  };

  return (
    "\uFEFF" +
    [
      headers,
      ...records,
    ]
      .map(row =>
        row.map(cell).join(",")
      )
      .join("\r\n") +
    "\r\n"
  );
}

// -----------------------------------------------------------------------------
// Email report
// -----------------------------------------------------------------------------

function renderReport(analytics) {
  const period = analytics.period;

  const approved =
    analytics.timesheetsAvailable
      ? hours(
          analytics.totals.approved
        )
      : "Unavailable";

  const pending =
    analytics.timesheetsAvailable
      ? hours(
          analytics.totals.pending
        )
      : "Unavailable";

  const miles = value =>
    value == null
      ? "Not available"
      : (
          Number(value).toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 1,
            }
          ) +
          " mi"
        );

  const badge = (
    text,
    color = "amber"
  ) => {
    const colors = {
      amber: [
        "#fef3c7",
        "#92400e",
      ],
      red: [
        "#fee2e2",
        "#991b1b",
      ],
      green: [
        "#d1fae5",
        "#065f46",
      ],
      slate: [
        "#e2e8f0",
        "#334155",
      ],
    };

    const selected =
      colors[color] ||
      colors.slate;

    return `
      <span style="
        display:inline-block;
        padding:3px 7px;
        border-radius:5px;
        font-size:11px;
        font-weight:700;
        background:${selected[0]};
        color:${selected[1]};
      ">${esc(text)}</span>
    `;
  };

  const table = (
    headers,
    rows,
    empty
  ) => {
    if (!rows.length) {
      return `
        <p style="font-size:12px;color:#64748b">
          ${esc(empty)}
        </p>
      `;
    }

    return `
      <table
        role="table"
        width="100%"
        cellpadding="9"
        cellspacing="0"
        style="
          border:1px solid #e2e8f0;
          border-collapse:collapse;
          font-size:12px;
        "
      >
        <thead>
          <tr style="
            background:#f1f5f9;
            text-align:left;
            color:#475569;
          ">
            ${headers.map(header => `
              <th>${esc(header)}</th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr style="
              background:${index % 2 ? "#fafafa" : "#fff"};
            ">
              ${row.map(value => `
                <td style="
                  vertical-align:top;
                  border-bottom:1px solid #e2e8f0;
                  overflow-wrap:anywhere;
                ">
                  ${
                    value &&
                    typeof value === "object" &&
                    "html" in value
                      ? value.html
                      : esc(value)
                  }
                </td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  };

  const section = (
    title,
    description,
    body
  ) => `
    <tr>
      <td style="padding:16px 28px">
        <h2 style="
          font-size:17px;
          margin:0 0 7px;
          color:#0f172a;
        ">
          ${esc(title)}
        </h2>
        <p style="
          font-size:12px;
          color:#64748b;
          margin:0 0 12px;
        ">
          ${esc(description)}
        </p>
        ${body}
      </td>
    </tr>
  `;

  const actions =
    analytics.reportActions || [];

  const actionVehicleCount =
    new Set(
      actions.flatMap(
        action =>
          action.vehicles
      )
    ).size;

  const noDue = actions.length
    ? "No due services identified from the available setup. Complete the steps below to evaluate the remaining vehicles or mileage limits."
    : "No configured services fall within the next 30 days or 1,000 measured miles.";

  const missing =
    analytics.vehicleMileage.filter(
      vehicle =>
        !vehicle.currentDate
    );

  const usable =
    analytics.vehicleMileage.filter(
      vehicle =>
        vehicle.currentDate
    );

  const mileageRows =
    usable.map(vehicle => [
      vehicle.vehicle,
      (
        miles(
          vehicle.currentOdometer
        ) +
        " (" +
        vehicle.currentDate +
        ")"
      ),
      vehicle.observedMiles != null
        ? miles(
            vehicle.observedMiles
          )
        : vehicle.conflict
          ? "Review readings"
          : "Add a second weekly reading",
      vehicle.observedMiles != null
        ? vehicle.coverage
            .replace(
              "Partial observed interval: ",
              ""
            )
            .replace(
              "; not a complete weekly total",
              " (partial)"
            )
        : "See next actions",
      {
        html: badge(
          vehicle.conflict
            ? "Review"
            : vehicle.currentConfirmed
              ? "Confirmed"
              : "Recorded",
          vehicle.conflict
            ? "red"
            : vehicle.currentConfirmed
              ? "green"
              : "slate"
        ),
      },
    ]);

  const mileageIntro =
    missing.length
      ? `
        <div style="
          background:#fffbeb;
          border:1px solid #fde68a;
          border-radius:7px;
          padding:12px;
          font-size:12px;
          margin-bottom:12px;
        ">
          <strong>Mileage tracking needs setup</strong><br>
          Enable odometer in the inspection checklist and save two dated readings.
          If already enabled, check that inspections save the value.<br>
          <span style="color:#92400e">
            ${
              esc(
                missing.map(
                  vehicle =>
                    vehicle.vehicle
                ).join(", ")
              )
            }
          </span>
        </div>
      `
      : "";

  const dueRows =
    analytics.maintenanceHorizon.map(
      maintenance => [
        maintenance.vehicle,
        maintenance.service,
        {
          html: badge(
            maintenance.status === "overdue"
              ? "OVERDUE"
              : "DUE SOON",
            maintenance.status === "overdue"
              ? "red"
              : "amber"
          ),
        },
        maintenance.dueDate,
        miles(
          maintenance.remainingMiles
        ),
      ]
    );

  const actionHtml =
    actions.length
      ? `
        <ol style="
          margin:0;
          padding-left:20px;
          font-size:12px;
        ">
          ${actions.map(action => `
            <li style="padding-bottom:12px">
              <strong>${esc(action.title)}</strong><br>
              ${esc(action.step)}<br>
              <span style="color:#64748b">
                ${esc(action.vehicles.join(", "))}
              </span>
            </li>
          `).join("")}
        </ol>
      `
      : `
        <p style="font-size:12px;color:#065f46">
          No setup actions identified.
        </p>
      `;

  const referenceRows =
    FORD_MAVERICK_REFERENCE.rows;

  const positions =
    (
      analytics.referencePositions ||
      []
    ).map(position => [
      position.vehicle,
      (
        miles(position.reading) +
        " on " +
        position.readingDate
      ),
      (
        miles(
          position.checkpointMiles
        ) +
        ": " +
        position.service
      ),
      {
        html: badge(
          position.remainingMiles === 0
            ? "At reference checkpoint"
            : (
                miles(
                  position.remainingMiles
                ) +
                " to checkpoint"
              ),
          position.remainingMiles <= 1000
            ? "amber"
            : "slate"
        ),
      },
    ]);

  const referenceLinks =
    FORD_MAVERICK_REFERENCE.sources
      .map(source => `
        <a
          href="${esc(source.url)}"
          style="color:#2563eb"
        >
          Ford ${source.year} manual${
            source.pages
              ? " pp. " + esc(source.pages)
              : ""
          }
        </a>
      `)
      .join(" &nbsp;|&nbsp; ");

  const referenceHtml = `
    <div style="
      border-left:4px solid #f59e0b;
      background:#fffbeb;
      padding:12px;
      margin-bottom:12px;
      font-size:12px;
      color:#92400e;
    ">
      ${esc(FORD_MAVERICK_REFERENCE.note)}
    </div>

    ${
      table(
        [
          "Checkpoint",
          "Service to review",
        ],
        referenceRows,
        ""
      )
    }

    <p style="font-size:11px;color:#64748b">
      ${referenceLinks}
      | Checked ${esc(FORD_MAVERICK_REFERENCE.checkedAt)}
    </p>

    ${
      positions.length
        ? `
          <h3 style="font-size:13px">
            Compare with latest recorded mileage
          </h3>
          ${
            table(
              [
                "Truck",
                "Recorded mileage",
                "Next reference",
                "Distance",
              ],
              positions,
              ""
            )
          }
          <p style="font-size:11px;color:#64748b">
            These comparisons do not establish whether maintenance
            has been completed. Severe-service items may be due earlier.
          </p>
        `
        : `
          <p style="font-size:12px;color:#64748b">
            Add a recent dated reading and confirm the Ford Maverick
            model year in vehicle setup to compare a truck with these
            reference points.
          </p>
        `
    }
  `;

  const overdue =
    analytics.maintenanceHorizon.filter(
      maintenance =>
        maintenance.status === "overdue"
    ).length;

  const card = (
    title,
    value,
    detail,
    color = "#64748b"
  ) => `
    <td
      width="32%"
      style="
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:8px;
        padding:14px;
        vertical-align:top;
      "
    >
      <div style="
        font-size:10px;
        font-weight:700;
        color:#64748b;
        text-transform:uppercase;
      ">
        ${esc(title)}
      </div>
      <div style="
        font-size:23px;
        font-weight:700;
        margin-top:5px;
        color:#0f172a;
      ">
        ${esc(value)}
      </div>
      <div style="
        font-size:11px;
        color:${color};
        margin-top:5px;
      ">
        ${esc(detail)}
      </div>
    </td>
  `;

  const banner =
    actions.length
      ? `
        <tr>
          <td style="padding:0 28px 8px">
            <div style="
              background:#fffbeb;
              border:1px solid #fde68a;
              border-left:4px solid #f59e0b;
              border-radius:7px;
              padding:12px;
              font-size:12px;
              color:#92400e;
            ">
              <strong>
                ${actions.length} setup step(s) to improve reminders
              </strong><br>
              Start with checklist mileage, completed-service dates and
              verified intervals. Clear steps are listed under Next Actions.
            </div>
          </td>
        </tr>
      `
      : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="
  margin:0;
  background:#f4f6f8;
  font-family:Arial,Helvetica,sans-serif;
  color:#0f172a;
">
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
  >
    <tr>
      <td align="center" style="padding:24px 8px">
        <table
          role="presentation"
          width="760"
          cellpadding="0"
          cellspacing="0"
          style="
            width:100%;
            max-width:760px;
            background:#fff;
            border:1px solid #e2e8f0;
            border-radius:12px;
            overflow:hidden;
          "
        >
          <tr>
            <td style="padding:28px;background:#0f172a">
              <div style="
                font-size:11px;
                letter-spacing:1.5px;
                font-weight:700;
                color:#f59e0b;
              ">
                SUNNY FLEET MANAGEMENT
              </div>
              <h1 style="
                font-size:24px;
                color:#fff;
                margin:9px 0;
              ">
                Weekly Fleet & Payroll Digest
              </h1>
              <p style="
                font-size:12px;
                color:#cbd5e1;
                margin:0;
              ">
                ${esc(period.startDay)}
                to ${esc(period.endDay)}
                | ${esc(period.zone)}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px">
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
              >
                <tr>
                  ${
                    card(
                      "Approved hours",
                      approved,
                      pending + " hours pending",
                      "#d97706"
                    )
                  }
                  <td width="2%"></td>
                  ${
                    card(
                      "Services due",
                      analytics.maintenanceHorizon.length,
                      overdue
                        ? overdue + " overdue"
                        : "30 days / 1,000 mi",
                      overdue
                        ? "#dc2626"
                        : "#64748b"
                    )
                  }
                  <td width="2%"></td>
                  ${
                    card(
                      "Setup actions",
                      actions.length,
                      actionVehicleCount +
                        " vehicle(s) need attention",
                      actions.length
                        ? "#d97706"
                        : "#059669"
                    )
                  }
                </tr>
              </table>
            </td>
          </tr>

          ${banner}

          ${
            section(
              FORD_MAVERICK_REFERENCE.title,
              "Manufacturer reference milestones; individual deadlines still use verified vehicle rules and service records.",
              referenceHtml
            )
          }

          ${
            section(
              "Vehicle Mileage",
              "Recorded odometer readings and mileage between available readings in the report week. Partial coverage is not a full weekly total.",
              mileageIntro +
              table(
                [
                  "Vehicle",
                  "Last reading",
                  "Observed miles",
                  "Coverage",
                  "Reading",
                ],
                mileageRows,
                missing.length
                  ? "Mileage rows will appear after dated readings are saved."
                  : "No active vehicles."
              )
            )
          }

          ${
            section(
              "Vehicle Service Horizon",
              "Deadlines from your verified setup. Dates may reflect calendar limits or estimates based on confirmed mileage history.",
              table(
                [
                  "Vehicle",
                  "Service",
                  "Status",
                  "Due date",
                  "Miles remaining",
                ],
                dueRows,
                noDue
              )
            )
          }

          ${
            section(
              "Next Actions",
              "Settings > Manager > Analytics is the vehicle-setup location you described. Detailed validation messages remain in the CSV attachments.",
              actionHtml
            )
          }

          ${
            section(
              "Weekly Team Hours",
              "Completed shifts count toward hours. Open shifts and detailed punches are attached.",
              table(
                [
                  "Employee",
                  "Approved hours",
                  "Pending hours",
                  "Attention",
                ],
                analytics.employees.map(
                  employee => [
                    employee.name,
                    hours(
                      employee.approved
                    ),
                    hours(
                      employee.pending
                    ),
                    employee.stuckShifts
                      ? (
                          employee.stuckShifts +
                          " open >16h"
                        )
                      : "No stuck shifts",
                  ]
                ),
                "No employee hours available."
              )
            )
          }

          ${
            section(
              "Equipment Watchlist",
              "Configured usage and review-date thresholds indicate when to check equipment.",
              table(
                [
                  "Equipment",
                  "Location",
                  "Review reason",
                  "Est. cost",
                ],
                analytics.equipmentWatchlist.map(
                  equipment => [
                    equipment.name,
                    equipment.location,
                    equipment.wearNote,
                    equipment.unitCost,
                  ]
                ),
                "No equipment alerts identified from available data."
              )
            )
          }

          <tr>
            <td style="
              padding:20px 28px;
              background:#f8fafc;
              border-top:1px solid #e2e8f0;
              font-size:11px;
              color:#64748b;
            ">
              Generated ${esc(analytics.generatedAt)}.
              Complete diagnostics, service records and hours
              are included in CSV attachments.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    (
      "SUNNY FLEET & PAYROLL | " +
      period.startDay +
      " to " +
      period.endDay +
      " | " +
      period.zone
    ),
    (
      "Approved hours: " +
      approved +
      " | Pending: " +
      pending
    ),
    "",
    FORD_MAVERICK_REFERENCE.title
      .toUpperCase(),
    FORD_MAVERICK_REFERENCE.note,
    ...referenceRows.map(
      row => row.join(": ")
    ),
    ...FORD_MAVERICK_REFERENCE.sources.map(
      source =>
        "Ford " +
        source.year +
        ": " +
        source.url +
        (
          source.pages
            ? " (pp. " +
              source.pages +
              ")"
            : ""
        )
    ),
    ...(
      analytics.referencePositions ||
      []
    ).map(position =>
      position.vehicle +
      ": " +
      miles(position.reading) +
      " recorded " +
      position.readingDate +
      "; " +
      miles(position.remainingMiles) +
      " to " +
      miles(position.checkpointMiles) +
      " reference: " +
      position.service +
      ". " +
      position.note
    ),
    "",
    "--- VEHICLE MILEAGE ---",
    ...(
      missing.length
        ? [
            "Enable odometer in the inspection checklist and save two dated readings: " +
            missing.map(
              vehicle =>
                vehicle.vehicle
            ).join(", "),
          ]
        : []
    ),
    ...usable.map(vehicle =>
      vehicle.vehicle +
      ": " +
      miles(
        vehicle.currentOdometer
      ) +
      " on " +
      vehicle.currentDate +
      "; " +
      (
        vehicle.observedMiles != null
          ? (
              miles(
                vehicle.observedMiles
              ) +
              " observed, " +
              vehicle.coverage
            )
          : "Save another weekly reading or review the next actions."
      )
    ),
    "",
    "--- VEHICLE SERVICE HORIZON ---",
    ...(
      analytics.maintenanceHorizon.length
        ? analytics.maintenanceHorizon.map(
            maintenance =>
              maintenance.vehicle +
              ": " +
              maintenance.service +
              " | " +
              maintenance.status +
              " | " +
              maintenance.dueDate +
              " | " +
              maintenance.reason
          )
        : [noDue]
    ),
    "",
    "--- NEXT ACTIONS / DATA GAPS ---",
    ...(
      actions.length
        ? actions.map(
            (action, index) =>
              (index + 1) +
              ". " +
              action.title +
              ": " +
              action.step +
              " Vehicles: " +
              action.vehicles.join(", ")
          )
        : [
            "No setup actions identified.",
          ]
    ),
    "",
    "--- EMPLOYEE HOURS ---",
    ...analytics.employees.map(
      employee =>
        employee.name +
        ": " +
        hours(employee.approved) +
        " approved; " +
        hours(employee.pending) +
        " pending; " +
        employee.stuckShifts +
        " stuck shift(s)"
    ),
    "",
    "--- EQUIPMENT WATCHLIST ---",
    ...analytics.equipmentWatchlist.map(
      equipment =>
        equipment.name +
        ": " +
        equipment.wearNote +
        " | " +
        equipment.unitCost
    ),
  ].join("\n");

  const attach = (
    name,
    headers,
    rows
  ) => ({
    name:
      name +
      "-" +
      period.startDay +
      ".csv",
    content: makeCSV(
      headers,
      rows
    ),
  });

  const attachments = [
    attach(
      "employee-hours",
      [
        "Employee ID",
        "Employee",
        "Approved Hours",
        "Pending Hours",
        "Week Start",
        "Week End",
      ],
      analytics.employees.map(
        employee => [
          employee.id,
          employee.name,
          hours(employee.approved),
          hours(employee.pending),
          period.startDay,
          period.endDay,
        ]
      )
    ),
    attach(
      "shift-details",
      [
        "Employee ID",
        "Employee",
        "Status",
        "Start UTC",
        "End UTC",
        "Hours",
      ],
      analytics.shiftRows.map(
        shift => [
          shift.employeeId,
          shift.employee,
          shift.status,
          shift.start,
          shift.end,
          hours(shift.weekHours),
        ]
      )
    ),
    attach(
      "open-shifts",
      [
        "Shift ID",
        "Employee",
        "Start UTC",
        "Attention",
      ],
      analytics.incomplete.map(
        shift => [
          shift.shiftId,
          shift.employee,
          shift.start,
          shift.attention,
        ]
      )
    ),
    attach(
      "vehicle-mileage",
      [
        "Vehicle",
        "Latest Odometer",
        "Reading Date",
        "Confirmed",
        "Observed Miles",
        "Week Reading Count",
        "Coverage",
        "Warnings",
      ],
      analytics.vehicleMileage.map(
        vehicle => [
          vehicle.vehicle,
          vehicle.currentOdometer,
          vehicle.currentDate,
          vehicle.currentConfirmed,
          vehicle.observedMiles,
          vehicle.readingCount,
          vehicle.coverage,
          vehicle.warnings.join("; "),
        ]
      )
    ),
    attach(
      "vehicle-maintenance",
      [
        "Vehicle",
        "Service",
        "Status",
        "Due Date",
        "Due Odometer",
        "Remaining Miles",
        "Reason",
        "Source",
      ],
      analytics.maintenanceRows.map(
        maintenance => [
          maintenance.vehicle,
          maintenance.service,
          maintenance.status,
          maintenance.dueDate,
          maintenance.dueOdometer,
          maintenance.remainingMiles,
          maintenance.reason,
          maintenance.source,
        ]
      )
    ),
    attach(
      "maintenance-setup-gaps",
      [
        "Vehicle",
        "Diagnostic",
      ],
      analytics.setupGaps.map(
        gap => [
          gap.vehicle,
          gap.reasons,
        ]
      )
    ),
    attach(
      "next-actions",
      [
        "Action",
        "Steps",
        "Vehicles",
      ],
      actions.map(
        action => [
          action.title,
          action.step,
          action.vehicles.join("; "),
        ]
      )
    ),
    attach(
      "ford-reference",
      [
        "Checkpoint",
        "Service to review",
        "Scope",
      ],
      referenceRows.map(
        row => [
          ...row,
          "2024-2025 Maverick reference only; verify vehicle and service history",
        ]
      )
    ),
    attach(
      "equipment-watchlist",
      [
        "Equipment ID",
        "Equipment",
        "Location",
        "Review Reason",
        "Estimated Cost",
      ],
      analytics.equipmentWatchlist.map(
        equipment => [
          equipment.id,
          equipment.name,
          equipment.location,
          equipment.wearNote,
          equipment.unitCost,
        ]
      )
    ),
  ];

  return {
    subject:
      "Sunny Fleet Heads-Up | " +
      period.startDay +
      " to " +
      period.endDay,
    html,
    text,
    attachments,
    summary: {
      approvedHours:
        analytics.timesheetsAvailable
          ? analytics.totals.approved
          : null,
      pendingHours:
        analytics.timesheetsAvailable
          ? analytics.totals.pending
          : null,
      servicesDue:
        analytics.maintenanceHorizon.length,
      equipmentWatchlist:
        analytics.equipmentWatchlist.length,
      setupGaps:
        analytics.setupGaps.length,
      nextActions:
        actions.length,
      vehiclesWithObservedMileage:
        analytics.vehicleMileage.filter(
          vehicle =>
            vehicle.observedMiles != null
        ).length,
    },
    period,
  };
}

// -----------------------------------------------------------------------------
// Raw email construction
// -----------------------------------------------------------------------------

function makeRawEmail(
  from,
  to,
  report
) {
  const address =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  if (
    !address.test(from) ||
    !address.test(to)
  ) {
    throw new Error(
      "Use plain sender/recipient email addresses."
    );
  }

  const mixed =
    "mixed_" + randomUUID();

  const alternative =
    "alt_" + randomUUID();

  const base64 = value =>
    Buffer.from(
      value,
      "utf8"
    )
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") || "";

  const body = [
    "From: Sunny Fleet <" + from + ">",
    "To: " + to,
    "Subject: " + report.subject,
    "Date: " +
      new Date().toUTCString(),
    "MIME-Version: 1.0",
    (
      'Content-Type: multipart/mixed; boundary="' +
      mixed +
      '"'
    ),
    "",
    "--" + mixed,
    (
      'Content-Type: multipart/alternative; boundary="' +
      alternative +
      '"'
    ),
    "",
    "--" + alternative,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(report.text),
    "--" + alternative,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(report.html),
    "--" + alternative + "--",
  ];

  for (
    const attachment of report.attachments
  ) {
    body.push(
      "--" + mixed,
      (
        'Content-Type: text/csv; charset=UTF-8; name="' +
        attachment.name +
        '"'
      ),
      (
        'Content-Disposition: attachment; filename="' +
        attachment.name +
        '"'
      ),
      "Content-Transfer-Encoding: base64",
      "",
      base64(
        attachment.content
      )
    );
  }

  body.push(
    "--" + mixed + "--",
    ""
  );

  const raw = Buffer.from(
    body.join("\r\n")
  );

  if (
    raw.length >
    8 * 1024 * 1024
  ) {
    throw new Error(
      "Report exceeds 8 MiB limit."
    );
  }

  return raw;
}

// -----------------------------------------------------------------------------
// AWS and Firestore access
// -----------------------------------------------------------------------------

const REGION =
  process.env.AWS_REGION ||
  "us-east-2";

const secrets =
  new SecretsManagerClient({
    region: REGION,
  });

const ses =
  new SESv2Client({
    region: REGION,
    maxAttempts: 1,
  });

function required(name) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      "Missing environment variable: " +
      name
    );
  }

  return value;
}

function decodeValue(value) {
  if ("nullValue" in value) {
    return null;
  }

  for (const key of [
    "stringValue",
    "booleanValue",
    "timestampValue",
    "referenceValue",
    "bytesValue",
  ]) {
    if (key in value) {
      return value[key];
    }
  }

  if ("integerValue" in value) {
    return Number(
      value.integerValue
    );
  }

  if ("doubleValue" in value) {
    return Number(
      value.doubleValue
    );
  }

  if ("arrayValue" in value) {
    return (
      value.arrayValue.values ||
      []
    ).map(decodeValue);
  }

  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(
        value.mapValue.fields ||
        {}
      ).map(
        ([key, item]) => [
          key,
          decodeValue(item),
        ]
      )
    );
  }

  if ("geoPointValue" in value) {
    return value.geoPointValue;
  }

  throw new Error(
    "Unsupported Firestore field type."
  );
}

async function getGoogleToken() {
  const secret =
    await secrets.send(
      new GetSecretValueCommand({
        SecretId: required(
          "FIREBASE_SECRET_ARN"
        ),
      })
    );

  const account = JSON.parse(
    secret.SecretString
  );

  const issuedAt = Math.floor(
    Date.now() / 1000
  );

  const encode = value =>
    Buffer.from(
      JSON.stringify(value)
    ).toString("base64url");

  const header = encode({
    alg: "RS256",
    typ: "JWT",
    ...(
      account.private_key_id
        ? {
            kid:
              account.private_key_id,
          }
        : {}
    ),
  });

  const payload = encode({
    iss: account.client_email,
    scope:
      "https://www.googleapis.com/auth/datastore",
    aud:
      "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  });

  const unsigned =
    header + "." + payload;

  const signature = sign(
    "RSA-SHA256",
    Buffer.from(unsigned),
    account.private_key
  ).toString("base64url");

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:
          unsigned +
          "." +
          signature,
      }),
      signal:
        AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Google auth failed: HTTP " +
      response.status
    );
  }

  const result =
    await response.json();

  return result.access_token;
}

async function readCollection(
  collection,
  token
) {
  const project = required(
    "FIREBASE_PROJECT_ID"
  );

  const database =
    process.env.FIREBASE_DATABASE_ID ||
    "(default)";

  const documents = [];
  let pageToken;

  do {
    const url = new URL(
      "https://firestore.googleapis.com/v1/projects/" +
      encodeURIComponent(project) +
      "/databases/" +
      encodeURIComponent(database) +
      "/documents/" +
      encodeURIComponent(collection)
    );

    url.searchParams.set(
      "pageSize",
      "300"
    );

    if (pageToken) {
      url.searchParams.set(
        "pageToken",
        pageToken
      );
    }

    const response =
      await fetch(url, {
        headers: {
          Authorization:
            "Bearer " + token,
        },
        signal:
          AbortSignal.timeout(10000),
      });

    if (!response.ok) {
      throw new Error(
        "Firestore " +
        collection +
        ": HTTP " +
        response.status
      );
    }

    const result =
      await response.json();

    for (
      const document of
      result.documents || []
    ) {
      const fields =
        Object.fromEntries(
          Object.entries(
            document.fields || {}
          ).map(
            ([key, value]) => [
              key,
              decodeValue(value),
            ]
          )
        );

      documents.push({
        ...fields,
        id: document.name
          .split("/")
          .at(-1),
      });
    }

    pageToken =
      result.nextPageToken;
  } while (pageToken);

  return documents;
}

// -----------------------------------------------------------------------------
// Lambda handler
// -----------------------------------------------------------------------------

export async function handler(
  event = {}
) {
  const isHttpApi = Boolean(
    event.rawPath ||
    event.requestContext?.http
  );

  const query =
    event.queryStringParameters ||
    {};

  if (
    isHttpApi &&
    event.requestContext?.http?.method === "OPTIONS"
  ) {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
    };
  }

  required(
    "FIREBASE_PROJECT_ID"
  );

  required(
    "FIREBASE_SECRET_ARN"
  );

  const zone =
    process.env.REPORT_TIMEZONE ||
    "America/Denver";

  const now = new Date();

  const anchor =
    event.scheduledTime
      ? new Date(
          event.scheduledTime
        )
      : now;

  const mode =
    query.week ||
    process.env.REPORT_WEEK ||
    "previous";

  if (
    ![
      "previous",
      "current",
    ].includes(mode)
  ) {
    throw new Error(
      "REPORT_WEEK must be previous or current."
    );
  }

  if (
    !Number.isFinite(+anchor)
  ) {
    throw new Error(
      "Invalid scheduledTime."
    );
  }

  getPeriod(
    anchor,
    zone,
    mode
  );

  const send =
    !isHttpApi &&
    process.env.SEND_ENABLED ===
      "true" &&
    event.dryRun === false;

  let recipients = [];

  if (send) {
    required(
      "SES_FROM_EMAIL"
    );

    recipients = [
      ...new Set(
        required(
          "REPORT_RECIPIENTS"
        )
          .split(",")
          .map(
            recipient =>
              recipient
                .trim()
                .toLowerCase()
          )
          .filter(Boolean)
      ),
    ];
  }

  const token =
    await getGoogleToken();

  const names = [
    "vehicles",
    "equipment",
    "inspections",
    "timesheet_shifts",
    "timesheet_corrections",
  ];

  const collections =
    await Promise.all(
      names.map(
        name =>
          readCollection(
            name,
            token
          )
      )
    );

  const data =
    Object.fromEntries(
      names.map(
        (name, index) => [
          name,
          collections[index],
        ]
      )
    );

  const analytics =
    buildAnalytics(
      data,
      now,
      anchor,
      zone,
      mode
    );

  const report =
    renderReport(
      analytics
    );

  if (!send) {
    const previewResult = {
      mode: "preview",
      message:
        "No email sent.",
      summary:
        report.summary,
      period:
        report.period,
      diagnostics: {
        vehicleMileage:
          analytics.vehicleMileage.map(
            ({
              readings,
              ...row
            }) => row
          ),
        setupGaps:
          analytics.setupGaps,
        nextActions:
          analytics.reportActions,
        referencePositions:
          analytics.referencePositions,
      },
      report: {
        subject:
          report.subject,
        text:
          report.text,
        html:
          report.html,
        attachments:
          event.includeCsv === true
            ? report.attachments
            : report.attachments.map(
                attachment =>
                  attachment.name
              ),
      },
    };

    if (isHttpApi) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        body: JSON.stringify(previewResult),
      };
    }

    return previewResult;
  }

  let sent = 0;
  const messageIds = [];

  for (
    const recipient of recipients
  ) {
    const raw =
      makeRawEmail(
        required(
          "SES_FROM_EMAIL"
        ),
        recipient,
        report
      );

    const result =
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress:
            required(
              "SES_FROM_EMAIL"
            ),
          Destination: {
            ToAddresses: [
              recipient,
            ],
          },
          Content: {
            Raw: {
              Data: raw,
            },
          },
        })
      );

    sent++;

    messageIds.push(
      result.MessageId ||
      "accepted"
    );
  }

  return {
    mode: "send",
    sent,
    messageIds,
    summary:
      report.summary,
    period:
      report.period,
  };
}
