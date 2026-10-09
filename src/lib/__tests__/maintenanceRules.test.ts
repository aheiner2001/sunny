import { describe, expect, it } from 'vitest';
import * as rules from '../maintenanceRules';
import { forecastOil, mileageRate } from '../maintenance';
import type { Vehicle, MaintenanceRule } from '@/types';
const now = new Date('2026-10-08T12:00:00Z');
const rule = (extra: Partial<MaintenanceRule> = {}): MaintenanceRule => ({id:'coolant',title:'Coolant',kind:'other',intervalMiles:100000,intervalMonths:60,initialMiles:200000,initialMonths:120,recurrence:'initial_then_recurring',source:'verified manual',confirmed:true,...extra});
const vehicle = (extra: Partial<Vehicle> = {}): Vehicle => ({id:'v',vehicleNumber:'Van 1',name:'Van',licensePlate:'',qrCodeToken:'v',status:'active',odometer:50000,maintenanceReadings:[{date:'2026-10-08',odometer:50000,confirmed:true}],maintenance:{inServiceDate:'2020-01-01',rules:[rule()]},...extra});
describe('independent maintenance rules', () => {
  it('uses the initial coolant limit until completed coolant service exists', () => {
    expect(rules.forecastMaintenance(vehicle(), [], now)[0]).toMatchObject({dueDate:'2030-01-01',dueOdometer:200000,status:'scheduled'});
  });
  it('uses recurring coolant cadence from its own latest effective service', () => {
    const original = {id:'s1',ruleId:'coolant',kind:'other' as const,title:'Coolant',date:'2025-01-01',odometer:40000,recordedBy:'manager'};
    const corrected = {...original,id:'s2',date:'2024-01-01',odometer:30000,supersedesId:'s1',correctionReason:'Invoice correction'};
    const v = vehicle({serviceHistory:[original,corrected]});
    expect(rules.effectiveServices(v.serviceHistory!)).toEqual([corrected]);
    expect(rules.forecastMaintenance(v, [], now)[0]).toMatchObject({dueDate:'2029-01-01',dueOdometer:130000,lastService:corrected});
  });
  it('blocks recurring rules without their own baseline and reports actionable missing fields', () => {
    const v = vehicle({maintenance:{rules:[rule({recurrence:'after_service'})]}});
    const forecast = rules.forecastMaintenance(v, [], now)[0];
    expect(forecast.status).toBe('needs_setup');
    expect(forecast.missing.join(' ')).toMatch(/baseline|completed/i);
    expect(forecast.dueDate).toBeUndefined();
    expect(rules.setupIssues(v).join(' ')).toMatch(/baseline|completed/i);
  });
  it('does not certify drafts or invalid intervals', () => {
    const v = vehicle({maintenance:{rules:[rule({confirmed:false}),rule({id:'invalid',intervalMonths:-1})]}});
    expect(rules.forecastMaintenance(v, [], now).map(f=>f.status)).toEqual(['needs_setup','needs_setup']);
  });
  it('uses only measured confirmed readings for new-rule mileage predictions', () => {
    const v = vehicle({odometer:5000,maintenanceReadings:[],maintenance:{rules:[rule({recurrence:'after_service',intervalMiles:5000,intervalMonths:12,baselineDate:'2026-01-01',baselineOdometer:1000})]}});
    const rows = [{date:'2026-09-08',odometer:2000,confirmed:true},{date:'2026-10-08',odometer:5000,confirmed:true},{date:'2026-10-08',odometer:999999,confirmed:false}];
    expect(rules.forecastMaintenance(v,rows,now)[0].dueDate).toBe('2026-10-18');
    expect(mileageRate(rows,now)).toBe(100);
  });
  it('keeps booked appointments separate from estimates and never turns them into history', () => {
    const v = vehicle({maintenanceAppointments:[{id:'a',ruleId:'coolant',title:'Booked coolant',date:'2026-10-12',status:'booked'},{id:'c',ruleId:'coolant',title:'Canceled',date:'2026-10-11',status:'canceled'}]});
    const events = rules.buildMaintenanceTimeline(v,[],now);
    expect(events.filter(e=>!e.projected)).toMatchObject([{title:'Booked coolant',date:'2026-10-12'}]);
    expect(rules.forecastMaintenance(v,[],now)[0].dueDate).toBe('2030-01-01');
  });
  it('preserves legacy oil API while using corrected oil history', () => {
    const original = {id:'s',kind:'oil' as const,title:'Oil',date:'2026-01-01',odometer:1000,recordedBy:'manager'};
    const correction = {...original,id:'s2',date:'2026-09-01',odometer:4000,supersedesId:'s'};
    const v = vehicle({odometer:5000,maintenance:{oilIntervalMiles:5000,oilIntervalMonths:6,scheduleConfirmed:true,scheduleSource:'manual'},serviceHistory:[original,correction]});
    expect(forecastOil(v,[],now).dueDate).toBe('2027-03-01');
    expect(rules.forecastMaintenance(v,[],now)[0]).toMatchObject({ruleId:'oil',dueDate:'2027-03-01'});
  });
});
it('keeps initial mileage thresholds absolute even when baseline mileage is provided', () => {
  const v = vehicle({maintenance:{inServiceDate:'2020-01-01',rules:[rule({baselineDate:'2025-01-01',baselineOdometer:50000})]}});
  expect(rules.forecastMaintenance(v,[],now)[0].dueOdometer).toBe(200000);
});
it('reports missing current mileage confirmation separately from its driving rate', () => {
  const f = rules.forecastMaintenance(vehicle({maintenanceReadings:[]}), [], now)[0];
  expect(f.status).toBe('needs_setup');
  expect(f.basis.join(' ')).toMatch(/unconfirmed|not confirmed|no confirmed/i);
});
it('does not let malformed cross-rule or self corrections hide actual history', () => {
  const oil = {id:'s',kind:'oil' as const,title:'Oil',date:'2026-01-01',odometer:1000,recordedBy:'manager'};
  const bad = {...oil,id:'bad',kind:'other' as const,ruleId:'coolant',supersedesId:'s'};
  const self = {...oil,id:'self',supersedesId:'self'};
  expect(rules.effectiveServices([oil,bad,self])).toContainEqual(oil);
  expect(rules.effectiveServices([oil,bad,self])).not.toContainEqual(bad);
});
it('requires a fresh matching measurement for mileage rules but not date-only rules', () => {
 const stale = vehicle({maintenanceReadings:[{date:'2026-09-01',odometer:50000,confirmed:true}]});
 expect(rules.forecastMaintenance(stale,[],now)[0].status).toBe('needs_setup');
 const calendarOnly = vehicle({odometer:undefined,maintenanceReadings:[],maintenance:{rules:[rule({recurrence:'after_service',intervalMiles:undefined,intervalMonths:6,baselineDate:'2026-09-01'})]}});
 expect(rules.forecastMaintenance(calendarOnly,[],now)[0]).toMatchObject({status:'scheduled',dueDate:'2027-03-01'});
});
it('does not assume initial service has never happened when its history is explicitly unknown', () => {
 const v = vehicle({maintenance:{inServiceDate:'2020-01-01',baselineUnknown:true,rules:[rule()]}});
 expect(rules.forecastMaintenance(v,[],now)[0].status).toBe('needs_setup');
});
it('explains missing intervals for unfinished drafts even though drafts can be saved',()=> {
 const v = vehicle({maintenance:{rules:[rule({intervalMiles:undefined,intervalMonths:undefined,initialMiles:undefined,initialMonths:undefined,confirmed:false,source:''})]}});
 const f = rules.forecastMaintenance(v,[],now)[0];
 expect(f.status).toBe('needs_setup'); expect(f.missing.join(' ')).toMatch(/interval/i);
});
it('retains legacy oil obligations when independent draft rules are added',()=> {
 const oil = {id:'s',kind:'oil' as const,title:'Oil',date:'2026-09-01',odometer:4000,recordedBy:'boss'};
 const v = vehicle({odometer:5000,maintenanceReadings:[{date:'2026-10-08',odometer:5000,confirmed:true}],maintenance:{oilIntervalMiles:5000,oilIntervalMonths:6,scheduleConfirmed:true,scheduleSource:'Manual',rules:[rule({confirmed:false})]},serviceHistory:[oil]});
 expect(rules.forecastMaintenance(v,[],now).map(f=>f.ruleId)).toEqual(['coolant','oil']);
 expect(rules.buildMaintenanceTimeline(v,[],now).some(e=>e.title==='Oil & filter service')).toBe(true);
 const explicit = {...v,maintenance:{...v.maintenance!,rules:[rule({id:'oil',kind:'oil',recurrence:'after_service',intervalMiles:5000,intervalMonths:6})]}};
 expect(rules.forecastMaintenance(explicit,[],now).filter(f=>f.ruleId==='oil')).toHaveLength(1);
});
it('places known overdue mileage-only work on today without a rate projection',()=> {
 const v=vehicle({odometer:50000,maintenance:{rules:[rule({intervalMonths:undefined,recurrence:'after_service',intervalMiles:5000,baselineOdometer:40000})]}});
 expect(rules.forecastMaintenance(v,[],now)[0]).toMatchObject({status:'overdue',dueDate:undefined});
 expect(rules.buildMaintenanceTimeline(v,[],now)[0]).toMatchObject({date:'2026-10-08',overdue:true,title:'Coolant'});
});
it('does not ask for mileage in date-only setup',()=> {
 const v=vehicle({odometer:undefined,maintenanceReadings:[],maintenance:{rules:[rule({intervalMiles:undefined,intervalMonths:6,recurrence:'after_service',baselineDate:'2026-09-01'})]}});
 expect(rules.setupIssues(v).join(' ')).not.toMatch(/mileage/i);
});
