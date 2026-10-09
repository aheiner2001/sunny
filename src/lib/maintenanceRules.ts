import { addMonths, parseISO } from 'date-fns';
import type { Vehicle, VehicleServiceRecord, MaintenanceReading, MaintenanceRule } from '@/types';
import { dateOnly, validDay, mileageRate, forecastOil, buildOilTimeline, effectiveServices } from './maintenance';
import type { PlanningEvent, OilStatus } from './maintenance';
export interface MaintenanceForecast {
  ruleId: string; title: string; status: OilStatus; reason: string; source: string;
  dueDate?: string; dueOdometer?: number; remainingMiles?: number; lastService?: VehicleServiceRecord;
  missing: string[]; basis: string[];
}
export { effectiveServices } from './maintenance';
const positive = (n: number | undefined) => n != null && Number.isInteger(n) && n > 0;
const mileage = (n: number | undefined) => n != null && Number.isInteger(n) && n >= 0;
export function validateMaintenanceRule(rule: MaintenanceRule, now = new Date()): string | null {
  if (!rule.id?.trim() || !rule.title?.trim()) return 'Enter a rule identifier and title.';
  if (!['after_service','initial_then_recurring'].includes(rule.recurrence)) return 'Choose a valid recurrence.';
  if (rule.confirmed && ![rule.intervalMiles,rule.intervalMonths].some(positive)) return 'Enter a positive mileage or month interval.';
  if ([rule.intervalMiles,rule.intervalMonths,rule.initialMiles,rule.initialMonths].some(n=>n != null && !positive(n))) return 'Intervals must be positive whole numbers.';
  if (rule.confirmed && !rule.source?.trim()) return 'Verify a schedule source before confirming the rule.';
  if (rule.baselineDate && (!validDay(rule.baselineDate) || rule.baselineDate > dateOnly(now))) return 'Enter a valid baseline date.';
  if (rule.baselineOdometer != null && !mileage(rule.baselineOdometer)) return 'Enter a nonnegative whole-number baseline mileage.';
  return null;
}
export function forecastMaintenance(vehicle: Vehicle, readings: MaintenanceReading[], now = new Date()): MaintenanceForecast[] {
  const configured = vehicle.maintenance?.rules;
  if (!configured?.length) {
    const oil = forecastOil(vehicle,readings,now);
    return [{...oil,ruleId:'oil',title:'Oil & filter service',source:vehicle.maintenance?.scheduleSource || '',missing:oil.status === 'needs_setup' ? ['Confirm oil intervals, current mileage and last completed oil service.'] : [],basis:[...(oil.lastService ? [`Completed service ${oil.lastService.date} at ${oil.lastService.odometer} miles`] : []), 'Legacy oil profile: stored mileage/readings may predate explicit measurement confirmation.']}];
  }
  const today = dateOnly(now);
  const confirmed = [...(vehicle.maintenanceReadings || []),...readings].filter(r=>r.confirmed === true);
  const rate = mileageRate(confirmed,now);
  const latest = [...confirmed].filter(r=>validDay(r.date) && r.date <= today && mileage(r.odometer)).sort((a,b)=>b.date.localeCompare(a.date)||b.odometer-a.odometer)[0];
  const forecasts: MaintenanceForecast[] = configured.map(rule=> {
    const lastService = effectiveServices(vehicle.serviceHistory || []).filter(s=> (s.ruleId === rule.id || (rule.kind === 'oil' && rule.id === 'oil' && !s.ruleId && s.kind === 'oil')) && validDay(s.date) && s.date <= today && mileage(s.odometer)).sort((a,b)=>b.date.localeCompare(a.date)||b.odometer-a.odometer)[0];
    const initial = rule.recurrence === 'initial_then_recurring' && !lastService;
    const baseDate = lastService?.date || (initial ? vehicle.maintenance?.inServiceDate || rule.baselineDate : rule.baselineDate);
    // First-service mileage is an absolute odometer threshold, not a historical service at zero.
    const baseMiles = initial ? 0 : lastService?.odometer ?? rule.baselineOdometer;
    const months = initial ? rule.initialMonths ?? rule.intervalMonths : rule.intervalMonths;
    const miles = initial ? rule.initialMiles ?? rule.intervalMiles : rule.intervalMiles;
    const missing: string[] = [];
    const invalid = validateMaintenanceRule(rule,now);
    if (invalid) missing.push(invalid);
    if (![rule.intervalMiles,rule.intervalMonths].some(positive)) missing.push('Enter a positive mileage or month interval.');
    if (!lastService && vehicle.maintenance?.baselineUnknown) missing.push(`Verify ${rule.title} history or record an explicit completed-service baseline; prior service is unknown.`);
    if (!rule.confirmed) missing.push('Confirm the rule against the vehicle configuration, usage conditions and source.');
    if (!rule.source?.trim()) missing.push('Add the verified schedule source.');
    if (months && (!baseDate || !validDay(baseDate) || baseDate > today)) missing.push(`Record ${rule.title} completed-service baseline date${initial ? ' or in-service date' : ''}.`);
    if (miles && !mileage(baseMiles)) missing.push(`Record ${rule.title} completed-service baseline mileage.`);
    if (miles && !mileage(vehicle.odometer)) missing.push('Record current measured mileage.');
    const currentConfirmed = !!latest && latest.odometer === vehicle.odometer;
    const currentFresh = currentConfirmed && (parseISO(today).getTime()-parseISO(latest!.date).getTime()) <= 15*86400000;
    if (miles && !currentFresh) missing.push('Confirm current mileage with a measured reading from the last 15 days.');
    if (miles && mileage(vehicle.odometer) && mileage(baseMiles) && vehicle.odometer! < baseMiles!) missing.push('Current mileage is below the service baseline; verify both readings.');
    const basis = [`${initial ? 'Initial' : 'Recurring'} interval: ${miles ? `${miles} miles` : ''}${miles && months ? ' or ' : ''}${months ? `${months} months` : ''}`];
    if (lastService) basis.push(`Completed service ${lastService.date} at ${lastService.odometer} miles`);
    else if (initial) basis.push(`First service: absolute ${miles || 'calendar-only'}${miles ? ' mile threshold' : ''}; in-service date ${baseDate || 'unknown'}`);
    else if (baseDate || baseMiles != null) basis.push(`Manager supplied baseline ${baseDate || ''}${baseMiles != null ? ` at ${baseMiles} miles` : ''}`);
    if (miles) basis.push(currentConfirmed ? `Current mileage ${vehicle.odometer} confirmed ${latest!.date}${currentFresh ? '' : ' (stale)'}` : `Current stored mileage ${vehicle.odometer ?? 'unknown'} has no confirmed reading`);
    if (missing.length) return {ruleId:rule.id,title:rule.title,status:'needs_setup',source:rule.source,reason:missing.join(' '),missing,basis,lastService};
    const dueOdometer = miles ? baseMiles! + miles : undefined;
    const remainingMiles = dueOdometer != null ? dueOdometer - vehicle.odometer! : undefined;
    const calendarDue = months ? dateOnly(addMonths(parseISO(baseDate!),months)) : undefined;
    const mileageDue = rate && latest?.odometer === vehicle.odometer && remainingMiles != null ? dateOnly(new Date(parseISO(latest.date).getTime() + Math.max(0,remainingMiles/rate)*86400000)) : undefined;
    const dueDate = calendarDue && mileageDue ? (calendarDue < mileageDue ? calendarDue : mileageDue) : calendarDue || mileageDue;
    const days = dueDate ? (parseISO(dueDate).getTime()-parseISO(today).getTime())/86400000 : undefined;
    const overdue = (remainingMiles != null && remainingMiles <= 0) || (days != null && days <= 0);
    const status: OilStatus = overdue ? 'overdue' : (days != null && days <= 30) || (remainingMiles != null && remainingMiles <= 500) ? 'due_soon' : 'scheduled';
    const reason = mileageDue && dueDate === mileageDue ? 'Estimated mileage limit from confirmed readings; driving changes can move this date.' : calendarDue ? 'Calendar limit; mileage or condition may require earlier service.' : 'Mileage limit; confirm recent readings to estimate a date.';
    if (rate) basis.push(`Confirmed readings imply ${rate.toFixed(1)} miles/day`);
    return {ruleId:rule.id,title:rule.title,status,reason,source:rule.source,dueDate,dueOdometer,remainingMiles,lastService,missing,basis};
  });
  const legacyOil = vehicle.maintenance?.oilIntervalMiles != null || vehicle.maintenance?.oilIntervalMonths != null || vehicle.maintenance?.scheduleConfirmed;
  if (legacyOil && !configured.some(r=>r.id==='oil')) forecasts.push(...forecastMaintenance({...vehicle,maintenance:{...vehicle.maintenance,rules:[]}},readings,now));
  return forecasts;
}
export function setupIssues(vehicle: Vehicle): string[] {
  const issues: string[] = [];
  const p = vehicle.maintenance;
  if (!p?.make?.trim()) issues.push('Enter vehicle make.');
  if (!p?.model?.trim()) issues.push('Enter vehicle model.');
  if (!p?.year) issues.push('Enter model year.');
  if (!p?.engine?.trim()) issues.push('Enter engine/configuration.');
  if (!p?.operatingProfile?.trim()) issues.push('Record operating conditions.');
  const requiresMileage = !p?.rules?.length || p.rules.some(r=>r.intervalMiles != null || (r.recurrence === 'initial_then_recurring' && r.initialMiles != null)) || (!p.rules.some(r=>r.id==='oil') && p.oilIntervalMiles != null);
  if (requiresMileage && !mileage(vehicle.odometer)) issues.push('Record current measured mileage.');
  return Array.from(new Set([...issues,...forecastMaintenance(vehicle,vehicle.maintenanceReadings || []).flatMap(f=>f.missing)]));
}
export function buildMaintenanceTimeline(vehicle: Vehicle, readings: MaintenanceReading[], now = new Date()): PlanningEvent[] {
  const end = dateOnly(addMonths(now,12));
  const events: PlanningEvent[] = vehicle.maintenance?.rules?.length ? forecastMaintenance(vehicle,readings,now).flatMap(f=> {
    if (f.status === 'needs_setup' || (!f.dueDate && f.status !== 'overdue')) return [];
    const rule = vehicle.maintenance!.rules!.find(r=>r.id===f.ruleId);
    if (!rule) return buildOilTimeline(vehicle,readings,now);
    const result: PlanningEvent[] = [];
    let date = f.status === 'overdue' ? dateOnly(now) : f.dueDate!;
    const rate = mileageRate([...(vehicle.maintenanceReadings || []),...readings].filter(r=>r.confirmed === true),now);
    for (let i=0;i<24 && date<=end;i++) {
      result.push({id:`${vehicle.id}-${f.ruleId}-estimate-${i}`,vehicleId:vehicle.id,vehicleNumber:vehicle.vehicleNumber,title:f.title,date,projected:true,detail:i===0 ? f.reason : 'Assumes the previous estimated service is completed; this is not a booking.',overdue:i===0 && f.status==='overdue'});
      const timeNext = rule.intervalMonths ? dateOnly(addMonths(parseISO(date),rule.intervalMonths)) : undefined;
      const milesNext = rate && rule.intervalMiles ? dateOnly(new Date(parseISO(date).getTime()+rule.intervalMiles/rate*86400000)) : undefined;
      const next = timeNext && milesNext ? (timeNext < milesNext ? timeNext : milesNext) : timeNext || milesNext;
      if (!next || next<=date) break;
      date = next;
    }
    return result;
  }) : buildOilTimeline(vehicle,readings,now);
  for (const a of vehicle.maintenanceAppointments || []) if (a.status === 'booked' && validDay(a.date) && a.date <= end) events.push({id:`${vehicle.id}-appointment-${a.id}`,vehicleId:vehicle.id,vehicleNumber:vehicle.vehicleNumber,title:a.title,date:a.date,projected:false,detail:a.notes || 'Booked appointment; completion must be recorded separately.',overdue:a.date < dateOnly(now)});
  return events.sort((a,b)=>a.date.localeCompare(b.date)||Number(a.projected)-Number(b.projected));
}
