#!/usr/bin/env python3
"""Build a reproducible offline maintenance report from explicit exported JSON.

No network, database, third-party packages or implicit current date are used.
"""
import argparse
import calendar
import csv
from datetime import date, datetime, timedelta
import html
import json
import math
from pathlib import Path
import re
import sys

COLUMNS = [
    'assetType', 'assetId', 'asset', 'ruleId', 'title', 'status', 'dueDate',
    'dueOdometer', 'remainingMiles', 'dueHours', 'remainingHours', 'reason',
    'source', 'missing', 'unknownData', 'basis', 'lastServiceId',
    'appointment', 'suggestedDate', 'grouping',
]


def day(value, label='date'):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError(f'{label}: use YYYY-MM-DD')
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f'{label}: invalid calendar date {value}') from error


def number(value, label, integer=False, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{label}: must be a finite number')
    if value < 0 or (positive and value <= 0) or (integer and value != int(value)):
        raise ValueError(f'{label}: must be a {"positive" if positive else "nonnegative"}{" whole" if integer else ""} number')
    return value


def records(value, label):
    if not isinstance(value, list) or any(not isinstance(row, dict) for row in value):
        raise ValueError(f'{label}: must be an array of objects')
    return value


def ids(rows, label):
    values = [row.get('id') for row in rows]
    if any(not isinstance(value, str) or not value.strip() for value in values):
        raise ValueError(f'{label}: each record requires an id')
    if len(set(values)) != len(values):
        raise ValueError(f'{label}: duplicate ids')


def add_months(value, months):
    index = value.year * 12 + value.month - 1 + int(months)
    year, month = divmod(index, 12)
    month += 1
    try:
        return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))
    except (ValueError, OverflowError) as error:
        raise ValueError('Interval produces a date outside supported calendar range') from error


def validate_measurements(rows, key, as_of, label, current=None, integer=False):
    for row in rows:
        measured = day(row.get('date'), f'{label}.date')
        if measured > as_of:
            raise ValueError(f'{label}: measured date cannot be after --as-of')
        number(row.get(key), f'{label}.{key}', integer=integer)
        if current is not None and row[key] > current:
            raise ValueError(f'{label}: measurement exceeds current {key}')
        if 'confirmed' in row and not isinstance(row['confirmed'], bool):
            raise ValueError(f'{label}.confirmed: must be boolean')
    ordered = sorted(rows, key=lambda row: (row['date'], row[key]))
    if any(row[key] < ordered[index - 1][key] for index, row in enumerate(ordered) if index):
        raise ValueError(f'{label}: measurements must be monotonic')


def effective_services(rows, as_of, key, current, label, corrections=False):
    ids(rows, label)
    by_id = {row['id']: row for row in rows}
    superseded = set()
    for row in rows:
        if not isinstance(row.get('title'), str) or not row['title'].strip():
            raise ValueError(f'{label}: service title is required')
        if day(row.get('date'), f'{label}.date') > as_of:
            raise ValueError(f'{label}: completed service cannot be after --as-of')
        if key == 'odometer' or row.get(key) is not None:
            number(row.get(key), f'{label}.{key}', integer=key == 'odometer')
        target = row.get('supersedesId')
        if target is None:
            continue
        if not corrections or target not in by_id or target == row['id'] or target in superseded:
            raise ValueError(f'{label}: correction requires one existing original; no forks or self-links')
        original = by_id[target]
        if row.get('ruleId') != original.get('ruleId') or row.get('kind') != original.get('kind'):
            raise ValueError(f'{label}: correction must preserve original rule and kind')
        for field in ['recordedBy', 'correctionReason', 'recordedAt']:
            if not isinstance(row.get(field), str) or not row[field].strip():
                raise ValueError(f'{label}: correction requires {field}')
        try:
            stamp = datetime.fromisoformat(row['recordedAt'].replace('Z', '+00:00'))
            if stamp.tzinfo is None or 'T' not in row['recordedAt'] or stamp.date() > as_of:
                raise ValueError()
        except ValueError as error:
            raise ValueError(f'{label}: correction recordedAt must be an ISO timestamp with timezone, on/before --as-of') from error
        superseded.add(target)
    for row in rows:
        seen = set()
        cursor = row
        while cursor.get('supersedesId') is not None:
            if cursor['id'] in seen:
                raise ValueError(f'{label}: correction lineage contains a cycle')
            seen.add(cursor['id'])
            cursor = by_id[cursor['supersedesId']]
    effective = [row for row in rows if row['id'] not in superseded]
    validate_measurements([row for row in effective if row.get(key) is not None], key, as_of, label, current, key == 'odometer')
    return effective


def vehicle_rules(vehicle):
    profile = vehicle.get('maintenance') or {}
    if not isinstance(profile, dict):
        raise ValueError('vehicle.maintenance: must be an object')
    configured = records(profile.get('rules', []), 'vehicle.maintenance.rules')
    legacy = (profile.get('oilIntervalMiles') is not None or
              profile.get('oilIntervalMonths') is not None or profile.get('scheduleConfirmed'))
    # Adding an independent rule must not discard an existing legacy oil schedule.
    if legacy and not any(rule.get('id') == 'oil' for rule in configured):
        return [*configured, {
            'id': 'oil', 'title': 'Oil & filter service', 'kind': 'oil',
            'intervalMiles': profile.get('oilIntervalMiles'),
            'intervalMonths': profile.get('oilIntervalMonths'),
            'source': profile.get('scheduleSource', ''),
            'confirmed': profile.get('scheduleConfirmed', False),
            'recurrence': 'after_service', '_legacy': True,
        }]
    return configured


def validate_rules(rules, as_of, equipment=False):
    records(rules, 'maintenance rules')
    ids(rules, 'maintenance rules')
    for rule in rules:
        for field in (['intervalHours', 'intervalMonths', 'baselineHours'] if equipment else
                      ['intervalMiles', 'intervalMonths', 'initialMiles', 'initialMonths', 'baselineOdometer']):
            if rule.get(field) is not None:
                number(rule[field], f'rule.{field}', integer=field != 'baselineHours' and field != 'intervalHours', positive=field.startswith('interval') or field.startswith('initial'))
        if rule.get('baselineDate') is not None and day(rule['baselineDate'], 'rule.baselineDate') > as_of:
            raise ValueError('rule.baselineDate cannot be after --as-of')
        if not equipment and rule.get('recurrence', 'after_service') not in ['after_service', 'initial_then_recurring']:
            raise ValueError('rule.recurrence: unsupported value')
        if 'confirmed' in rule and not isinstance(rule['confirmed'], bool):
            raise ValueError('rule.confirmed: must be boolean')
        if 'source' in rule and not isinstance(rule['source'], str):
            raise ValueError('rule.source: must be text')


def mileage_rate(rows, as_of, current, legacy=False):
    selected = sorted((row for row in rows if (legacy or row.get('confirmed') is True)
                       and day(row['date']) >= add_months(as_of, -3)),
                      key=lambda row: (row['date'], row['odometer']))
    if len(selected) < 2:
        return None, None
    first, last = selected[0], selected[-1]
    elapsed = (day(last['date']) - day(first['date'])).days
    if elapsed < 7 or (as_of - day(last['date'])).days > 15 or last['odometer'] != current:
        return None, None
    rate = (last['odometer'] - first['odometer']) / elapsed
    return (rate, day(last['date'])) if rate > 0 else (None, None)


def forecast(asset, rule, effective, readings, as_of, equipment=False):
    key = 'hours' if equipment else 'odometer'
    current = asset.get('operatingHours' if equipment else 'odometer')
    row = {column: None for column in COLUMNS}
    row.update(assetType='equipment' if equipment else 'vehicle', assetId=asset['id'],
               asset=asset.get('name' if equipment else 'vehicleNumber') or asset['id'],
               ruleId=rule['id'], title=rule.get('title') or rule['id'],
               source=rule.get('source', ''), missing=[], basis=[], unknownData='', appointment='', grouping='')
    matches = [service for service in effective if service.get('ruleId') == rule['id'] or
               (not equipment and rule.get('kind') == 'oil' and rule['id'] == 'oil' and service.get('ruleId') is None and service.get('kind') == 'oil')]
    last = max(matches, key=lambda service: (service['date'], service.get(key, -1)), default=None)
    initial = not equipment and rule.get('recurrence') == 'initial_then_recurring' and last is None
    measure_interval = rule.get('intervalHours' if equipment else 'intervalMiles')
    months = rule.get('intervalMonths')
    if initial:
        measure_interval = rule.get('initialMiles', measure_interval)
        months = rule.get('initialMonths', months)
    baseline_day = last['date'] if last else rule.get('baselineDate')
    baseline_measure = last.get(key) if last else rule.get('baselineHours' if equipment else 'baselineOdometer')
    if initial:
        baseline_day = (asset.get('maintenance') or {}).get('inServiceDate') or baseline_day
        baseline_measure = baseline_measure if baseline_measure is not None else 0
    if not equipment and last is None and (asset.get('maintenance') or {}).get('baselineUnknown') is True:
        row['missing'].append('Verify completed-service history; prior service is explicitly unknown')
    if rule.get('confirmed') is not True:
        row['missing'].append('Manager confirmation of rule applicability')
    if not str(rule.get('source', '')).strip():
        row['missing'].append('Rule source and applicable configuration/conditions')
    if not measure_interval and not months:
        row['missing'].append('Positive service interval')
    if measure_interval and current is None:
        row['missing'].append('Measured current operating hours' if equipment else 'Measured current odometer')
    if measure_interval and not equipment and not rule.get('_legacy'):
        confirmed_current = any(reading.get('confirmed') is True and reading['odometer'] == current
                                and 0 <= (as_of - day(reading['date'])).days <= 15 for reading in readings)
        if not confirmed_current:
            row['missing'].append('Fresh confirmed current odometer reading (on/before --as-of, within 15 days)')
    if measure_interval and baseline_measure is None:
        row['missing'].append('Completed service or explicit measured baseline')
    if months and baseline_day is None:
        row['missing'].append('Completed service date or explicit baseline date')
    if current is not None and baseline_measure is not None and baseline_measure > current:
        row['missing'].append('Baseline exceeds current measurement; reconcile measured history')
    if last:
        row['lastServiceId'] = last['id']
        lineage = [last['id']]
        cursor = last
        original_by_id = {service['id']: service for service in asset.get('serviceHistory', [])}
        while cursor.get('supersedesId'):
            lineage.append(cursor['supersedesId'])
            cursor = original_by_id[cursor['supersedesId']]
        row['basis'].append('Effective completed service ' + ' supersedes '.join(lineage))
    elif initial:
        row['basis'].append(f'Absolute first-service mileage threshold={measure_interval if measure_interval is not None else "not applicable"}; supplied initial calendar date={baseline_day or "unknown"}')
    elif baseline_day or baseline_measure is not None:
        row['basis'].append(f'Explicit baseline date={baseline_day or "unknown"}, {key}={baseline_measure if baseline_measure is not None else "unknown"}')
    if row['missing']:
        row.update(status='needs_setup', reason='Setup required: ' + '; '.join(row['missing']))
        return row
    calendar_due = add_months(day(baseline_day), months) if months else None
    due_measure = (measure_interval if initial else baseline_measure + measure_interval) if measure_interval else None
    remaining = due_measure - current if due_measure is not None else None
    measured_due = None
    if equipment:
        row.update(dueHours=due_measure, remainingHours=remaining)
        if measure_interval:
            row['unknownData'] = 'Hour due date is unknown: no operating-hour usage projection is assumed.'
    else:
        row.update(dueOdometer=due_measure, remainingMiles=remaining)
        if measure_interval:
            rate, anchor = mileage_rate(readings, as_of, current, rule.get('_legacy', False))
            if rate:
                # Floor matches date-fns formatting of the measured timestamp plus fractional days.
                measured_due = anchor + timedelta(days=math.floor(max(0, remaining / rate)))
                row['basis'].append(f'Measured mileage rate {rate:.2f} miles/day; anchored to {anchor.isoformat()}')
            else:
                row['unknownData'] = 'Mileage due date is unknown: need two confirmed monotonic readings at least 7 days apart, within 3 months, latest within 15 days matching current odometer.'
    candidates = [value for value in [calendar_due, measured_due] if value]
    due = min(candidates) if candidates else None
    row['dueDate'] = due.isoformat() if due else None
    overdue = (remaining is not None and remaining <= 0) or (due is not None and due <= as_of)
    soon = (due is not None and (due - as_of).days <= 30) or (remaining is not None and remaining <= (measure_interval * 0.1 if equipment else 500))
    row['status'] = 'overdue' if overdue else 'due_soon' if soon else 'scheduled'
    row['reason'] = ('Measured hour limit reached.' if equipment else 'Measured mileage limit reached.') if remaining is not None and remaining <= 0 else (
        'Estimated mileage limit occurs before calendar limit; update as measured readings change.'
        if measured_due and (calendar_due is None or measured_due < calendar_due) else
        'Calendar limit; measured usage or an equipment/vehicle warning may require earlier service.'
        if calendar_due else 'Measured hour threshold; calendar date unknown.' if equipment else 'Measured mileage threshold; calendar date unknown.')
    row['basis'].append('Initial service interval' if initial else 'Recurring service interval')
    return row


def build_report(data, as_of):
    as_of = day(as_of, '--as-of')
    if not isinstance(data, dict):
        raise ValueError('Export must be an object')
    vehicles = records(data.get('vehicles'), 'vehicles')
    equipment = records(data.get('equipment'), 'equipment')
    ids(vehicles, 'vehicles')
    ids(equipment, 'equipment')
    exported_readings = data.get('readings', {})
    if not isinstance(exported_readings, dict):
        raise ValueError('readings must be an object indexed by vehicle id')
    vehicle_ids = {vehicle['id'] for vehicle in vehicles}
    if any(key not in vehicle_ids for key in exported_readings):
        raise ValueError('readings contains an unknown vehicle id')
    result = []
    for is_equipment, assets in [(False, vehicles), (True, equipment)]:
        for asset in sorted(assets, key=lambda value: value['id']):
            label = f'{"equipment" if is_equipment else "vehicle"} {asset["id"]}'
            key = 'hours' if is_equipment else 'odometer'
            current = asset.get('operatingHours' if is_equipment else 'odometer')
            if current is not None:
                number(current, f'{label}.current {key}', integer=not is_equipment)
            if is_equipment:
                readings = records(asset.get('hoursReadings', []), f'{label}.hoursReadings')
            else:
                readings = (records(asset.get('maintenanceReadings', []), f'{label}.maintenanceReadings')
                            + records(exported_readings.get(asset['id'], []), f'{label}.exported readings'))
            validate_measurements(readings, key, as_of, f'{label}.readings', current, not is_equipment)
            services = records(asset.get('serviceHistory', []), f'{label}.serviceHistory')
            effective = effective_services(services, as_of, key, current, f'{label}.services', corrections=not is_equipment)
            rules = asset.get('maintenanceRules', []) if is_equipment else vehicle_rules(asset)
            validate_rules(rules, as_of, is_equipment)
            if not is_equipment and (asset.get('maintenance') or {}).get('inServiceDate') is not None:
                if day(asset['maintenance']['inServiceDate'], 'inServiceDate') > as_of:
                    raise ValueError('inServiceDate cannot be after --as-of')
            appointments = records(asset.get('maintenanceAppointments', []), f'{label}.appointments') if not is_equipment else []
            ids(appointments, f'{label}.appointments')
            for appointment in appointments:
                day(appointment.get('date'), 'appointment.date')
                if appointment.get('status') not in ['booked', 'canceled', 'completed']:
                    raise ValueError('appointment.status: unsupported value')
                if appointment.get('status') == 'completed':
                    linked = next((service for service in effective if service['id'] == appointment.get('serviceRecordId')), None)
                    if linked is None:
                        raise ValueError('Completed appointment requires an effective completed serviceRecordId')
                    linked_rule = linked.get('ruleId') or ('oil' if linked.get('kind') == 'oil' else None)
                    if linked_rule != appointment.get('ruleId'):
                        raise ValueError('Completed appointment must link to service for the same rule')
            if not rules:
                row = {column: None for column in COLUMNS}
                row.update(assetType='equipment' if is_equipment else 'vehicle', assetId=asset['id'],
                           asset=asset.get('name' if is_equipment else 'vehicleNumber') or asset['id'],
                           title='Maintenance setup', status='needs_setup', reason='No verified maintenance rules supplied.',
                           missing=['Source-confirmed service rules'], basis=[], unknownData='No service forecast is available.', source='', appointment='', grouping='')
                result.append(row)
            for rule in rules:
                row = forecast(asset, rule, effective, readings, as_of, is_equipment)
                booked = sorted((appointment for appointment in appointments if appointment['status'] == 'booked' and appointment.get('ruleId') == rule['id']), key=lambda value: (value['date'], value['id']))
                if booked:
                    appointment = booked[0]
                    row['appointment'] = f'Booked {appointment["date"]}; separate from completed service'
                    if row['dueDate'] and appointment['date'] > row['dueDate']:
                        row['appointment'] += '; after service limit: move appointment earlier'
                result.append(row)
    # Group a single asset's known future dates within seven days at the earliest limit.
    # Unknown, already overdue, and measurement-overdue rows never acquire an invented date.
    for asset_type, asset_id in sorted({(row['assetType'], row['assetId']) for row in result}):
        eligible = sorted((row for row in result if row['assetType'] == asset_type and row['assetId'] == asset_id
                           and row['dueDate'] and row['dueDate'] > as_of.isoformat() and row['status'] not in ['needs_setup', 'overdue']), key=lambda row: (row['dueDate'], row['ruleId']))
        while eligible:
            first = eligible.pop(0)
            group = [first]
            while eligible and (day(eligible[0]['dueDate']) - day(first['dueDate'])).days <= 7:
                group.append(eligible.pop(0))
            if len(group) > 1:
                for row in group:
                    row['suggestedDate'] = first['dueDate']
                    row['grouping'] = 'Consider one visit on the earliest limit; suggestion only, never postpone service.'
    return result


def cell(value):
    if value is None:
        return ''
    if isinstance(value, list):
        return '; '.join(str(item) for item in value)
    return str(value)


def csv_safe(value):
    value = cell(value)
    # Spreadsheet readers can ignore leading whitespace before formula operators.
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r', '\n')) or value.startswith(('\t', '\r', '\n')) else value


def write_report(rows, as_of, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / 'maintenance.csv').open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, lineterminator='\n')
        writer.writeheader()
        writer.writerows({key: csv_safe(row[key]) for key in COLUMNS} for row in rows)
    sections = []
    for row in rows:
        terms = ''.join(f'<dt>{html.escape(key)}</dt><dd>{html.escape(cell(row[key])) or "Unknown / not applicable"}</dd>' for key in COLUMNS if key not in ['asset', 'title'])
        sections.append(f'<article><h2>{html.escape(cell(row["asset"]))} — {html.escape(cell(row["title"]))}</h2><dl>{terms}</dl></article>')
    document = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maintenance report — {html.escape(as_of)}</title><style>
body{{font:16px/1.5 system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#162738;background:#f4f7fa}}
article{{background:white;border:1px solid #cad5df;border-radius:12px;margin:1rem 0;padding:1rem}}
h1,h2{{line-height:1.2}}dl{{display:grid;grid-template-columns:minmax(120px,1fr) 3fr;gap:.4rem 1rem}}dt{{font-weight:600}}dd{{margin:0;overflow-wrap:anywhere}}
@media(max-width:540px){{dl{{display:block}}dd{{margin-bottom:.7rem}}}}@media print{{article{{break-inside:avoid}}body{{background:white}}}}
</style></head><body><h1>Maintenance report</h1><p>As of {html.escape(as_of)}. {len(rows)} service/setup rows. Generated only from the supplied export.</p>
<p>Dates are planning estimates. Confirm configuration, operating conditions, source rules and measured history before using them for actual fleet scheduling. Appointments are separate from completed service. Grouping suggestions only move work earlier.</p>
{''.join(sections) or '<p>No assets supplied.</p>'}</body></html>
'''
    (output_dir / 'maintenance.html').write_text(document, encoding='utf-8')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='Explicit fleet JSON export')
    parser.add_argument('--as-of', required=True, help='Fixed YYYY-MM-DD reporting date')
    parser.add_argument('--output-dir', required=True, type=Path, help='Folder for maintenance.csv and maintenance.html')
    args = parser.parse_args(argv)
    try:
        data = json.loads(args.input.read_text(encoding='utf-8'))
        rows = build_report(data, args.as_of)
        write_report(rows, args.as_of, args.output_dir)
    except (OSError, ValueError, TypeError, OverflowError) as error:
        print(f'Report error: {error}', file=sys.stderr)
        return 2
    print(f'Wrote {len(rows)} rows to {args.output_dir / "maintenance.csv"} and {args.output_dir / "maintenance.html"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
