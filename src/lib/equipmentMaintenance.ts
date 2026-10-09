import { addMonths, parseISO } from 'date-fns';
import type { Equipment, EquipmentHoursReading, EquipmentServiceRecord, EquipmentMaintenanceRule } from '@/types';
import { validDay, dateOnly } from './maintenance';
import type { OilStatus } from './maintenance';
export interface EquipmentMaintenanceForecast {
  ruleId: string; title: string; status: OilStatus; source: string; reason: string; missing: string[];
  dueDate?: string; dueHours?: number; remainingHours?: number; lastService?: EquipmentServiceRecord; basis: string[];
}
const hoursValid = (n: number | undefined): n is number => n != null && Number.isFinite(n) && n >= 0;
export function validateEquipmentRule(rule: EquipmentMaintenanceRule, now = new Date()): string | null {
  if (!rule.id?.trim() || !rule.title?.trim()) return 'Enter a rule identifier and title.';
  if (rule.confirmed && rule.intervalHours == null && rule.intervalMonths == null) return 'Enter a service hour or month interval.';
  if (rule.intervalHours != null && (!Number.isFinite(rule.intervalHours) || rule.intervalHours <= 0)) return 'Service hours must be positive.';
  if (rule.intervalMonths != null && (!Number.isInteger(rule.intervalMonths) || rule.intervalMonths <= 0)) return 'Service months must be positive whole numbers.';
  if (rule.confirmed && !rule.source?.trim()) return 'Verify the source before confirming the rule.';
  if (rule.baselineDate && (!validDay(rule.baselineDate) || rule.baselineDate > dateOnly(now))) return 'Enter a valid baseline date.';
  if (rule.baselineHours != null && !hoursValid(rule.baselineHours)) return 'Enter nonnegative measured baseline hours.';
  return null;
}
export function forecastEquipmentMaintenance(equipment: Equipment, now = new Date()): EquipmentMaintenanceForecast[] {
  const today = dateOnly(now);
  return (equipment.maintenanceRules || []).map(rule=> {
    const lastService = [...(equipment.serviceHistory || [])].filter(s=>s.ruleId === rule.id && validDay(s.date) && s.date<=today && (s.hours == null || hoursValid(s.hours))).sort((a,b)=>b.date.localeCompare(a.date)|| (b.hours??0)-(a.hours??0))[0];
    const baseDate = lastService?.date || rule.baselineDate;
    const baseHours = lastService ? lastService.hours : rule.baselineHours;
    const missing: string[] = [];
    const invalid = validateEquipmentRule(rule,now);
    if (invalid) missing.push(invalid);
    if (rule.intervalHours == null && rule.intervalMonths == null) missing.push('Enter a service hour or month interval.');
    if (!rule.confirmed) missing.push('Confirm the equipment rule against its manual and usage conditions.');
    if (!rule.source?.trim()) missing.push('Add the verified equipment schedule source.');
    if (rule.intervalMonths && (!baseDate || !validDay(baseDate) || baseDate>today)) missing.push('Record a completed service or verified baseline date.');
    if (rule.intervalHours && !hoursValid(baseHours)) missing.push('Record measured service baseline hours.');
    if (rule.intervalHours && !hoursValid(equipment.operatingHours)) missing.push('Record current measured operating hours.');
    if (rule.intervalHours && hoursValid(baseHours) && hoursValid(equipment.operatingHours) && equipment.operatingHours<baseHours) missing.push('Current operating hours are below the service baseline.');
    const basis = [lastService ? `Completed service ${lastService.date}` : 'Manager supplied service baseline'];
    if (missing.length) return {ruleId:rule.id,title:rule.title,status:'needs_setup',source:rule.source,reason:missing.join(' '),missing,basis,lastService};
    const dueHours = rule.intervalHours ? baseHours!+rule.intervalHours : undefined;
    const remainingHours = dueHours != null ? dueHours-equipment.operatingHours! : undefined;
    const dueDate = rule.intervalMonths ? dateOnly(addMonths(parseISO(baseDate!),rule.intervalMonths)) : undefined;
    const days = dueDate ? (parseISO(dueDate).getTime()-parseISO(today).getTime())/86400000 : undefined;
    const overdue = (days != null && days<=0)||(remainingHours != null && remainingHours<=0);
    const status: OilStatus = overdue ? 'overdue' : (days != null && days<=30)||(remainingHours != null && remainingHours<=rule.intervalHours!*.1) ? 'due_soon' : 'scheduled';
    return {ruleId:rule.id,title:rule.title,status,source:rule.source,reason:dueDate ? 'Calendar or measured operating-hour limit, whichever comes first.' : 'Measured operating-hour limit; no usage date is assumed.',missing,basis,dueDate,dueHours,remainingHours,lastService};
  });
}
export function validateEquipmentHours(reading: EquipmentHoursReading, current?:number, now=new Date()):string|null {
  if (!validDay(reading.date) || reading.date !== dateOnly(now)) return 'Hours checks must use today’s date.';
  if (!hoursValid(reading.hours)) return 'Enter valid nonnegative measured hours.';
  if (!reading.recordedBy?.trim()) return 'Record who measured the hours.';
  if (current != null && reading.hours<current) return 'Hours are less than the previous reading.';
  return null;
}
export function validateEquipmentService(record:Pick<EquipmentServiceRecord,'title'|'date'|'hours'>,current?:number,now=new Date()):string|null {
  if (!record.title?.trim()) return 'Enter a service description.';
  if (!validDay(record.date) || record.date>dateOnly(now)) return 'Enter a valid service date that is not in the future.';
  if (record.hours != null && !hoursValid(record.hours)) return 'Enter valid nonnegative service hours.';
  if (record.hours != null && (!hoursValid(current) || record.hours>current)) return 'Record current operating hours before adding this service.';
  return null;
}
