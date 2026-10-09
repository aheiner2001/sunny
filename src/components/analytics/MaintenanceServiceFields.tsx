'use client';
import React from 'react';
import type { MaintenanceAppointment, MaintenanceProfile, VehicleServiceRecord } from '@/types';
import { dateOnly } from '@/lib/maintenance';
import styles from './analytics.module.css';
export type ServiceDraft = {
  kind: VehicleServiceRecord['kind']; title: string; date: string;
  odometer: string; notes: string; ruleId: string; appointmentId: string; reason: string;
};
export type ServiceChoice = { id: string; title: string; kind: VehicleServiceRecord['kind'] };
export function maintenanceServiceChoices(profile:MaintenanceProfile | undefined):ServiceChoice[] {
  const configured=profile?.rules || [];
  const oil=configured.find(rule=>rule.id==='oil');
  return [
    oil || {id:'oil',title:'Oil & filter change',kind:'oil'},
    ...(['tires','filters','other'] as const).filter(kind=>!configured.some(rule=>rule.id===kind)).map(kind=>({id:kind,title:kind==='tires'?'Tire service':kind==='filters'?'Filter service':'Other completed service',kind})),
    ...configured.filter(rule=>rule.id!=='oil'),
  ];
}
export default function MaintenanceServiceFields({record,onChange,rules,original,appointments,currentMileage}: {
  record:ServiceDraft; onChange:(next:ServiceDraft)=>void; rules:ServiceChoice[];
  original?:VehicleServiceRecord; appointments:MaintenanceAppointment[]; currentMileage?:number;
}) {
  const patch=(value:Partial<ServiceDraft>)=>onChange({...record,...value});
  return <>
    {original && <div className={styles.notice}>
      Original: {original.title} · {original.date} · {original.odometer} mi.
      This appends an audited correction and retains the original.
    </div>}
    <label>Service rule
      <select value={record.ruleId} disabled={!!original} onChange={e=>{
        const rule=rules.find(r=>r.id===e.target.value)!;
        patch({ruleId:rule.id,kind:rule.kind,title:rule.title,appointmentId:''});
      }}>{rules.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>
    </label>
    <label>Description<input value={record.title} onChange={e=>patch({title:e.target.value})}/></label>
    <label>Completed on<input type="date" max={dateOnly(new Date())} value={record.date} onChange={e=>patch({date:e.target.value})}/></label>
    <label>Odometer at service (miles)<input type="number" min="0" value={record.odometer} onChange={e=>patch({odometer:e.target.value})}/></label>
    <p className={styles.muted}>Current mileage: {currentMileage ?? 'Unknown'} mi. Confirm current mileage first if service mileage exceeds it.</p>
    <label>Notes<textarea value={record.notes} onChange={e=>patch({notes:e.target.value})}/></label>
    {original ? <label>Correction reason<input value={record.reason} onChange={e=>patch({reason:e.target.value})}/></label> :
      <label>Complete booked appointment (optional)
        <select value={record.appointmentId} onChange={e=>patch({appointmentId:e.target.value})}>
          <option value="">No appointment link</option>
          {appointments.filter(a=>a.status==='booked' && a.ruleId===record.ruleId).map(a=><option key={a.id} value={a.id}>{a.date} · {a.title}</option>)}
        </select>
      </label>}
  </>;
}
