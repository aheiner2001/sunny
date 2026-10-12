import { expect, it } from 'vitest';
import type { Vehicle, VehicleServiceRecord, Equipment } from '@/types';
import { forecastOil, mileageRate, validateService } from '../maintenance';
import { buildMaintenanceTimeline, forecastMaintenance } from '../maintenanceRules';
import { forecastEquipmentMaintenance, validateEquipmentService } from '../equipmentMaintenance';
const now = new Date('2026-10-08T12:00:00Z');
const service = (id:string,date:string,odometer:number,extra:Partial<VehicleServiceRecord>={}):VehicleServiceRecord => ({id,date,odometer,kind:'oil',title:'Service',recordedBy:'manager',...extra});
const legacy=service('engine','2026-09-01',20000);
const separate=service('gear','2026-10-01',29000,{ruleId:'gearbox-oil'});
const vehicle=(history:VehicleServiceRecord[]):Vehicle=>({id:'v',vehicleNumber:'V',name:'Van',licensePlate:'',qrCodeToken:'',status:'active',odometer:30000,maintenance:{oilIntervalMiles:5000,oilIntervalMonths:6,scheduleConfirmed:true,scheduleSource:'Manual',rules:[{id:'gearbox-oil',kind:'oil',title:'Gearbox',intervalMonths:12,recurrence:'after_service',source:'Manual',confirmed:true}]},serviceHistory:history});
it.each([
 ['later-lower', service('new','2026-10-01',19000)],
 ['earlier-higher', service('new','2026-08-01',21000)],
])('rejects %s vehicle chronology across rule IDs',(_,record)=>{
 expect(validateService({...record,ruleId:'tires'},30000,now,[legacy])).toMatch(/service history.*chronolog/i);
});
it('validates prospective corrections without retained originals contaminating chronology',()=>{
 const bad=service('bad','2026-08-01',28000);
 expect(validateService(service('fix','2026-08-01',18000,{supersedesId:'bad'}),30000,now,[bad,legacy])).toBeNull();
 expect(validateService(service('fix','2026-08-01',21000,{supersedesId:'bad'}),30000,now,[bad,legacy])).toMatch(/chronolog/i);
});
it('does not invent event order within the same day',()=>{
 expect(validateService(service('new',legacy.date,19000),30000,now,[legacy])).toBeNull();
 expect(validateService(service('new',legacy.date,21000),30000,now,[legacy])).toBeNull();
});
it('marks all forecasts for contradictory loaded vehicle history as review-required and omits estimates',()=>{
 const v=vehicle([legacy,service('regression','2026-10-01',19000,{ruleId:'gearbox-oil'})]);
 expect(forecastMaintenance(v,[],now).every(f=>f.status==='needs_setup' && /chronolog/i.test(f.reason))).toBe(true);
 expect(buildMaintenanceTimeline(v,[],now)).toEqual([]);
});
it('keeps independent oil history out of legacy oil status and planning',()=>{
 const v=vehicle([legacy,separate]);
 expect(forecastOil(v,[],now)).toMatchObject({status:'overdue',dueOdometer:25000,lastService:legacy});
 expect(forecastMaintenance(v,[],now).find(f=>f.ruleId==='oil')).toMatchObject({dueOdometer:25000});
 expect(buildMaintenanceTimeline(v,[],now).find(e=>e.title==='Oil & filter service')).toMatchObject({date:'2026-10-08',overdue:true});
 expect(forecastOil(vehicle([separate]),[],now).status).toBe('needs_setup');
 expect(forecastOil(vehicle([{...legacy,ruleId:'oil'},separate]),[],now).dueOdometer).toBe(25000);
});
it.each([
 ['three-month cutoff',[{date:'2026-07-08',odometer:1000},{date:'2026-10-08',odometer:10200}],100],
 ['15-day freshness',[{date:'2026-09-01',odometer:1000},{date:'2026-09-23',odometer:3200}],100],
] as const)('uses reporting day at noon for %s',(_,readings,rate)=>expect(mileageRate([...readings],now)).toBe(rate));
const equipmentHistory=[{id:'old',ruleId:'pump',title:'Pump',date:'2026-09-01',hours:150,recordedBy:'m',recordedAt:now.toISOString()}];
it.each([['2026-10-01',100],['2026-08-01',175]] as const)('rejects equipment chronology %s across rules', (date,hours)=>{
 expect(validateEquipmentService({title:'Other',date,hours},200,now,equipmentHistory)).toMatch(/chronolog/i);
});
it('retains unknown calendar-only hours and same-day equipment readings without invented order',()=>{
 expect(validateEquipmentService({title:'Other',date:'2026-10-01'},200,now,equipmentHistory)).toBeNull();
 expect(validateEquipmentService({title:'Other',date:'2026-09-01',hours:100},200,now,equipmentHistory)).toBeNull();
});
it('requires review for existing equipment chronology without changing lifespan',()=>{
 const e={id:'e',operatingHours:200,carsUsed:9000,maintenanceRules:[{id:'pump',title:'Pump',intervalHours:100,source:'Manual',confirmed:true}],serviceHistory:[...equipmentHistory,{...equipmentHistory[0],id:'bad',date:'2026-10-01',hours:100}]} as Equipment;
 expect(forecastEquipmentMaintenance(e,now)[0]).toMatchObject({status:'needs_setup'});
 expect(forecastEquipmentMaintenance(e,now)[0].reason).toMatch(/chronolog/i);
 expect(e.carsUsed).toBe(9000);
});
