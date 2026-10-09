'use client';
import React from 'react';
import type { MaintenanceAppointment, VehicleServiceRecord } from '@/types';
import { effectiveServices } from '@/lib/maintenanceRules';
import type { ServiceChoice } from './MaintenanceServiceFields';
import styles from './analytics.module.css';
export default function MaintenanceAppointmentFields({booking,onChange,rules,original,services}: {
  booking:MaintenanceAppointment; onChange:(next:MaintenanceAppointment)=>void;
  rules:ServiceChoice[]; original?:MaintenanceAppointment; services:VehicleServiceRecord[];
}) {
  const patch=(value:Partial<MaintenanceAppointment>)=>onChange({...booking,...value});
  return <>
    <label>Service rule
      <select value={booking.ruleId} disabled={!!original} onChange={e=>patch({ruleId:e.target.value,serviceRecordId:undefined})}>
        {rules.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
      </select>
    </label>
    <label>Appointment title<input value={booking.title} onChange={e=>patch({title:e.target.value})}/></label>
    <label>Booked date<input type="date" value={booking.date} onChange={e=>patch({date:e.target.value})}/></label>
    <label>Appointment status
      <select value={booking.status} disabled={original?.status==='completed'} onChange={e=>patch({status:e.target.value as MaintenanceAppointment['status']})}>
        <option value="booked">Booked</option><option value="canceled">Canceled</option>
        <option value="completed">Completed — link actual service</option>
      </select>
    </label>
    {booking.status==='completed' && <label>Recorded completed service
      <select value={booking.serviceRecordId || ''} onChange={e=>patch({serviceRecordId:e.target.value})}>
        <option value="">Choose completed service</option>
        {effectiveServices(services).filter(s=>(s.ruleId || s.kind)===booking.ruleId).map(s=><option key={s.id} value={s.id}>{s.date} · {s.title} · {s.odometer} mi</option>)}
      </select>
    </label>}
    <label>Appointment notes<textarea value={booking.notes || ''} onChange={e=>patch({notes:e.target.value})}/></label>
    <p className={styles.muted}>Bookings are separate from forecast estimates. A booking never proves service completion.</p>
  </>;
}
