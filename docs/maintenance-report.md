# Offline maintenance report and two-hour learning sheet

The report reads a JSON export and writes a CSV plus a readable HTML report. It uses Python's standard library, needs no installation, and never connects to the fleet database. Every run requires an explicit reporting date. The example is synthetic: its intervals demonstrate software behavior and do not certify a manufacturer's schedule or a real vehicle/equipment configuration.

## Run the supplied example

From the repository root:

```sh
python3 scripts/maintenance_report.py docs/examples/maintenance-sample.json \
  --as-of 2026-10-08 --output-dir /tmp/sunny-maintenance-report
python3 -m unittest discover -s scripts -p test_maintenance_report.py -v
```

Open `/tmp/sunny-maintenance-report/maintenance.html` in a browser or use `maintenance.csv` in a spreadsheet. Reference output is checked into `docs/examples/maintenance-output/`. A valid sample run writes six rows. Repeating the same command with the same input and date produces identical file contents. Invalid records cause an explanatory error, exit code 2, and no report files are written; an existing output folder's prior reports are left intact during validation failures.

| Sample asset/rule | Status on 2026-10-08 | Date limit | Measurement limit | Grouping suggestion |
| --- | --- | --- | --- | --- |
| Sample van / oil | scheduled | 2027-01-01 | 15,500 miles | 2027-01-01 |
| Sample van / filters | scheduled | 2027-01-05 | 15,500 miles | 2027-01-01 |
| Sample van / initial coolant | scheduled | 2031-01-01 | 100,000 miles | None |
| Unknown baseline van / oil | needs_setup | Unknown | Unknown | None |
| Synthetic pressure washer / pump | due_soon | 2027-03-01 | 150 actual hours; 5 remaining | None |
| Synthetic pressure washer / inspection | needs_setup | Unknown | Not applicable | None |

The oil baseline is effective record `s2`, which supersedes `s1`. Its booked 2027-02-01 appointment is after the 2027-01-01 service limit and is flagged for an earlier booking. The appointment does not count as completed work. The pressure washer's old replacement date and `carsUsed` do not affect its service forecast.

## JSON export contract

```json
{
  "vehicles": [],
  "equipment": [],
  "readings": { "vehicle-id": [] }
}
```

`vehicles` and `equipment` are required arrays, even when empty. Asset IDs are unique within each array. `readings` is optional and contains measured vehicle readings by vehicle ID. Omit it when each vehicle already contains `maintenanceReadings`; when supplied for an ID, it is combined with that vehicle's embedded readings. Unknown IDs are rejected. Extra application fields are preserved in the export but do not participate in the report.

The browser can export `JSON.stringify({ vehicles, equipment }, null, 2)` from its existing analytics data, including embedded `maintenanceReadings`. Downloading that JSON does not write back to the fleet. An export can alternatively provide `{ vehicles, equipment, readings }` when readings are held separately. The report consumes the same task-1 types:

| Path | Relevant fields |
| --- | --- |
| `Vehicle` | `id`, `vehicleNumber`, `odometer`, `maintenance`, `maintenanceReadings`, `serviceHistory`, `maintenanceAppointments` |
| `Vehicle.maintenance` | `rules`, `inServiceDate`, `baselineUnknown`; legacy `oilIntervalMiles`, `oilIntervalMonths`, `scheduleSource`, `scheduleConfirmed` remain supported |
| Vehicle rule | `id`, `title`, `kind`, `intervalMiles`, `intervalMonths`, `initialMiles`, `initialMonths`, `recurrence`, `source`, `confirmed`, `baselineDate`, `baselineOdometer` |
| Vehicle reading | `date`, `odometer`, `confirmed`, optional `recordedBy` and `source` |
| Vehicle service | `id`, `ruleId`, `kind`, `title`, `date`, `odometer`, `recordedBy`; corrections add `supersedesId`, `correctionReason`, `recordedAt` |
| Vehicle appointment | `id`, `ruleId`, `title`, `date`, `status`, optional `serviceRecordId` |
| `Equipment` | `id`, `name`, `operatingHours`, `maintenanceRules`, `serviceHistory`, `hoursReadings` |
| Equipment rule | `id`, `title`, `intervalHours`, `intervalMonths`, `source`, `confirmed`, `baselineDate`, `baselineHours` |
| Equipment reading | `date`, `hours`, optional `recordedBy` |
| Equipment service | `id`, `ruleId`, `title`, `date`, optional `hours`, `recordedBy`, `recordedAt` |

## Validation and interpretation

Dates must be real `YYYY-MM-DD` calendar days. Readings, baseline dates, in-service dates and completed services cannot be after `--as-of`; future appointments are allowed. Mileage is a finite nonnegative whole number; actual equipment hours may be fractional. Readings and effective services must be monotonic by date and cannot exceed the current measurement. Bad dates, negative values, duplicate IDs, decreasing measurements and malformed correction lineage are rejected. Corrections retain their original records; only an unsuperseded service sets the baseline. A correction needs an existing original of the same rule/kind, a reason, actor and timezone-qualified ISO timestamp. Forks, self-links and cycles are rejected. A completed appointment must link to an effective completed service for the same rule.

Each rule requires `confirmed: true` and a nonempty source. Confirmation means a manager has checked source applicability to the vehicle/equipment and operating conditions; JSON alone cannot establish that real-world applicability. Unconfirmed or missing-source rules appear as `needs_setup`. Missing service history is not filled in. `maintenance.baselineUnknown: true` blocks an assumed first-service or baseline forecast until that rule has a recorded effective completed service; simply knowing the in-service date does not establish whether earlier service occurred. A confirmed explicit baseline can support a recurring rule when completed service history is unavailable. Month-end calculations clamp to the last day of the target month, so January 31 plus one month becomes February 28 in 2026.

For new mileage rules, a confirmed current odometer reading must match `Vehicle.odometer`, be on/before the reporting date, and be no older than 15 days. Missing confirmation blocks the forecast and produces a specific setup action. A calendar-only rule does not require current mileage. Legacy oil profiles keep their earlier compatibility behavior and remain available when independent non-oil rules are added. A service without `ruleId` can supply only the legacy `oil` rule, never an independently named engine-oil or gearbox-oil rule.

A mileage date estimate uses confirmed monotonic readings within three calendar months, spanning at least seven days, with the latest within 15 days and matching the current odometer. It anchors the estimated date to the measurement date, then compares that date with the calendar limit and chooses the earlier limit. If the usage rate cannot be estimated, the report states that the mileage date is unknown and still reports a known calendar limit. An already-reached mileage limit is overdue even when its calendar limit is later. A vehicle is due soon within 30 calendar days or 500 miles.

For `initial_then_recurring`, the first mileage limit is `initialMiles` (or `intervalMiles`), an absolute odometer threshold. The first time limit starts at `inServiceDate`, falling back to the explicit rule baseline date, and uses `initialMonths` (or `intervalMonths`). After an effective completed service, recurring intervals start from that service's mileage and date.

Equipment uses measured `operatingHours`, its own readings and independent service baselines. Jobs, `carsUsed`, replacement dates, lifespan thresholds and expected replacement months never substitute for hours. The report does not invent an hours-per-day projection. It reports a known calendar date and/or hour threshold, explicitly marks the hour date as unknown, and labels equipment due soon within 30 days or within 10% of its configured hour interval.

CSV rows include reasons, source, setup actions, unknown-data explanation, calculation basis, effective service ID, appointment warning and suggested grouping date. HTML escapes supplied text; CSV cells that could be interpreted as spreadsheet formulas are prefixed with an apostrophe. Grouping combines a single asset's known future due dates within seven days at the earliest date. It never pushes service past a limit, schedules overdue work in the future, or assigns a date to unknown history. It is a suggestion, not an appointment or a promise of completion.

## Relationship to the senior-project proposal

The September 25 proposal schedules the initial requirements specification and inspection photo upload/cloud-storage linking for Week 4 (October 5–11), the Firebase → BigQuery pipeline for Weeks 6–9, and the Python predictive model beginning Week 10. This deterministic report supplies a learning foundation: explicit schemas, data-quality validation, synthetic examples, audit lineage, reproducible transforms and explainable service rules. It is an offline rules calculator, not a trained ML model or a BigQuery data pipeline.

The current inspection photo path reads a file, resizes it on a canvas, creates a JPEG `data:` URL and stores that value in `photoUrl`. Source inspection found no Firebase Storage `uploadBytes`/`getDownloadURL` integration in this flow. Improving photo size/quality does not complete Week 4's separate cloud-storage-linking milestone. That remaining milestone needs a storage upload, stored object reference/download URL, and verified persistence/rendering on sample data. This report task does not modify auth/storage rules or perform live uploads.

## Two-hour learning sheet

Use only copies of `docs/examples/maintenance-sample.json`. The exercises deliberately create synthetic mistakes and corrections. Run from the repository root; substitute another temporary folder for `/tmp` on systems without it.

### 0–20 minutes: trace inspection photo data and the storage gap

Open `src/app/inspect/InspectClient.tsx` and locate `processImageFile`, `handleSetResponse`, the inspection response's `photoUrl`, and the submission call into `src/lib/db.ts`. Trace one photo from the file input through `FileReader`, the 800-pixel canvas resize, `canvas.toDataURL('image/jpeg', 0.8)`, response state and the inspection payload. Use source inspection only; do not submit to a live fleet. Search the source for `firebase/storage`, `uploadBytes`, and `getDownloadURL`.

**Expected output:** Write the concrete path `File → canvas JPEG → data: URL → photoUrl → inspection persistence`. Identify that `photoUrl` currently holds encoded image content rather than a verified Firebase Storage download URL. The storage API search finds no upload/download-URL integration. List a separate Week 4 acceptance check: a synthetic photo stored as a storage object, its reference/URL persisted with a synthetic inspection, then rendered after reloading. This tracing exercise is not evidence that the storage milestone has been implemented.

### 20–30 minutes: reproduce and read the report

Run the sample command above. Open the HTML and compare all six rows against the table. Find `missing`, `unknownData`, `basis`, and `appointment` in the CSV header. Explain why pump service is due soon while its calendar date is five months away.

**Expected output:** Six rows, two `needs_setup` rows, one `due_soon` row. Pump `dueHours=150`, `remainingHours=5`; oil's basis names `s2 supersedes s1` and its appointment warns that the booking is after the limit.

### 30–45 minutes: make a safe editable copy and trigger validation

```sh
mkdir -p /tmp/sunny-maintenance-learning
cp docs/examples/maintenance-sample.json /tmp/sunny-maintenance-learning/base.json
```

Create an invalid variant with the following standard-library snippet:

```sh
python3 - <<'PY'
import json
from pathlib import Path
folder = Path('/tmp/sunny-maintenance-learning')
data = json.loads((folder / 'base.json').read_text())
data['vehicles'][0]['maintenanceReadings'][0]['date'] = '2026-02-30'
(folder / 'invalid.json').write_text(json.dumps(data))
PY
python3 scripts/maintenance_report.py /tmp/sunny-maintenance-learning/invalid.json \
  --as-of 2026-10-08 --output-dir /tmp/sunny-maintenance-learning/invalid-output
```

**Expected output:** Exit code 2 and an invalid-calendar-date message; `invalid-output` is not created. Repeat with a negative mileage, then with earlier reading 13,000 and current odometer 14,000 to isolate decreasing history. The first is rejected as a nonnegative-number violation; the second is rejected as non-monotonic.

### 45–60 minutes: compare original and corrected service baselines

Copy `base.json` to `original-only.json`. Remove `s2` from the first vehicle's `serviceHistory`, keeping `s1`. Generate to a separate `original-output` folder using the same reporting date.

**Expected output:** Oil `lastServiceId=s1`, `dueOdometer=15000`, `dueDate=2026-11-01`, and `status=due_soon`. In the unchanged base input these are `s2`, 15,500, 2027-01-01, and `scheduled`. Restore `s2` and remove its correction reason: the report must reject it. Explain why changing the original in place would lose evidence of the correction.

### 60–75 minutes: distinguish unknown data from a forecast

In a fresh copy of `base.json`, add `baselineDate: "2026-09-01"` and `baselineOdometer: 5000` to the second vehicle's oil rule. Generate the report. Then set that vehicle's only reading to `confirmed: false` and generate again to a new folder.

**Expected output:** With its baseline, the second van becomes `scheduled`, `dueOdometer=10000`, `dueDate=2027-03-01`; mileage date remains explicitly unknown because one reading cannot establish a rate. Without current confirmation, it becomes `needs_setup`, with a specific request for a fresh confirmed current odometer reading. Restore the base sample before the next exercise.

### 75–95 minutes: change hours without changing replacement lifespan

In a fresh copy, change equipment `carsUsed` from 9999 to 1 and replacement `dueDate` from 2025-01-01 to 2030-01-01. Generate a report. Then change both `operatingHours` and its latest `hoursReadings[].hours` from 145 to 150 and rerun.

**Expected output:** Replacement edits have no effect on pump service: it stays `due_soon`, due at 150 hours. The measured-hours change makes it `overdue` with zero remaining hours, even though its calendar date is still 2027-03-01. Explain why counting jobs cannot establish actual runtime.

### 95–110 minutes: inspect earlier grouping and initial cadence

In the base report, filters are due 2027-01-05 and suggested for 2027-01-01 with oil. Move the filter baseline date from 2026-07-05 to 2026-07-20 in a fresh copy and rerun. Inspect the coolant rule's initial and recurring fields.

**Expected output:** Filter date becomes 2027-01-20 and there is no oil/filter grouping suggestion because the dates are more than seven days apart. Its original suggested date was earlier than its own limit. Coolant's first limit is 100,000 miles or 2031-01-01; its smaller recurring values apply only after a completed coolant service. A booking is still separate from either estimate.

### 110–120 minutes: verify reproducibility and explain the limits

Run the unit-test command and regenerate the base report twice in the same temporary folder. Compare the outputs with the checked-in reference files:

```sh
cmp /tmp/sunny-maintenance-report/maintenance.csv docs/examples/maintenance-output/maintenance.csv
cmp /tmp/sunny-maintenance-report/maintenance.html docs/examples/maintenance-output/maintenance.html
```

**Expected output:** All Python tests pass; both comparisons exit 0 with no output. Write three sentences explaining (1) what manager/source evidence is still required for a real asset, (2) why missing service history is a setup action, and (3) why an appointment or grouping suggestion does not prove service completion.
