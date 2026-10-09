import { describe, expect, it } from 'vitest';
import { forecastEquipmentMaintenance, validateEquipmentService, validateEquipmentHours } from '../equipmentMaintenance';
import type { Equipment } from '@/types';
const now = new Date('2026-10-08T12:00:00Z');
const item = (extra:Partial<Equipment>={}): Equipment => ({id:'e',name:'Washer',category:'equipment',status:'working',carsUsed:9000,operatingHours:120,maintenanceRules:[{id:'pump',title:'Pump service',intervalHours:100,intervalMonths:6,source:'Manager verified manual',confirmed:true,baselineDate:'2026-06-01',baselineHours:50}],...extra});
describe('equipment maintenance',()=> {
 it('forecasts measured operating hours independently of replacement lifespan',()=> {
   expect(forecastEquipmentMaintenance(item(),now)[0]).toMatchObject({dueHours:150,dueDate:'2026-12-01',status:'scheduled'});
   expect(forecastEquipmentMaintenance(item({operatingHours:150}),now)[0].status).toBe('overdue');
 });
 it('uses each rule service history and never invents an hour baseline',()=> {
   expect(forecastEquipmentMaintenance(item({serviceHistory:[{id:'s',ruleId:'pump',title:'Pump',date:'2026-09-01',hours:100,recordedBy:'manager',recordedAt:'2026-10-08T12:00:00Z'}]}),now)[0]).toMatchObject({dueHours:200,dueDate:'2027-03-01'});
   const f = forecastEquipmentMaintenance(item({maintenanceRules:[{id:'x',title:'Unconfigured',intervalHours:100,confirmed:false,source:''}]}),now)[0];
   expect(f.status).toBe('needs_setup');
   expect(f.missing.join(' ')).toMatch(/baseline|source|confirm/i);
 });
 it('validates actual hours, nondecreasing readings and service mileage bounds',()=> {
   expect(validateEquipmentHours({date:'2026-10-08',hours:119,recordedBy:'manager'},120,now)).toMatch(/previous/i);
   expect(validateEquipmentHours({date:'2026-10-08',hours:120.5,recordedBy:'manager'},120,now)).toBeNull();
   expect(validateEquipmentHours({date:'2026-10-09',hours:130,recordedBy:'manager'},120,now)).toMatch(/date/i);
   expect(validateEquipmentService({title:'Pump',date:'2026-09-01',hours:121},120,now)).toMatch(/current/i);
   expect(validateEquipmentService({title:'Pump',date:'2026-09-01',hours:NaN},120,now)).toMatch(/hours/i);
 });
});
