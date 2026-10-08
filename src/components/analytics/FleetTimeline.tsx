'use client';
import React, { useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import type { Vehicle, MaintenanceReading } from '@/types';
import type { OilForecast, PlanningEvent } from '@/lib/maintenance';
import styles from './fleetTimeline.module.css';
type Props = { rows: { vehicle: Vehicle; readings: MaintenanceReading[]; oil: OilForecast }[]; events: PlanningEvent[]; now: Date; onService: (id: string) => void; onSetup: (id: string) => void };
const miles = (n: number) => `${n.toLocaleString()} mi`;
export default function FleetTimeline({ rows, events, now, onService, onSetup }: Props) {
  const [view, setView] = useState<'calendar' | 'mileage' | 'list'>('calendar');
  const values = rows.flatMap(({ vehicle, oil }) => [vehicle.odometer, oil.lastService?.odometer, oil.dueOdometer]).filter((n): n is number => n != null && Number.isFinite(n) && n >= 0);
  const low = values.length ? Math.floor(Math.min(...values) / 5000) * 5000 : 0;
  const high = values.length ? Math.ceil(Math.max(...values) / 5000) * 5000 : 10000;
  const bands = Array.from({ length: Math.min(100, Math.max(1, (high - low) / 5000 + 1)) }, (_, i) => low + i * 5000);
  const columns = { gridTemplateColumns: `100px repeat(${rows.length}, minmax(230px, 1fr))` };
  const eventCard = (event: PlanningEvent) => <button key={event.id} className={`${styles.event} ${event.overdue ? styles.urgent : ''}`} onClick={() => onService(event.vehicleId)}>
    <strong>{format(parseISO(event.date), 'MMM d')} · {event.overdue ? 'Due now' : 'Estimated'}</strong>
    <span>{event.title}</span><small>{event.detail}</small><span className={styles.action}>Log completed service →</span>
  </button>;
  return <div>
    <div className={styles.controls} role="group" aria-label="Timeline display">
      {(['calendar', 'mileage', 'list'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'calendar' ? 'Calendar' : v === 'mileage' ? 'Mileage' : 'Upcoming work'}</button>)}
    </div>
    <p className={styles.help}>{view === 'calendar' ? 'Shared month bands across trucks. Dates are forecasts, not booked appointments.' : view === 'mileage' ? 'Shared odometer scale. Each band covers 5,000 miles; marker positions show mileage within the band. Oil deadlines use the confirmed service baseline.' : 'Estimated oil services in date order. Record a service only after it is completed.'}</p>
    {!rows.length ? <p>No trucks match your selection. Add a truck or try sample data.</p> : view === 'list' ? <div className={styles.list}>{events.map(eventCard)}{!events.length && <p>Complete a truck’s maintenance setup to see upcoming work.</p>}</div> : <div className={styles.scroll} tabIndex={0} aria-label="Synchronized truck timelines">
      <div className={styles.board}>
        <div className={`${styles.grid} ${styles.headers}`} style={columns}>
          <div className={styles.axis}>{view === 'calendar' ? 'Month' : 'Odometer'}</div>
          {rows.map(({ vehicle, oil }) => <header key={vehicle.id} className={styles.truck}>
            {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={`${vehicle.vehicleNumber} vehicle`} /> : <span className={styles.placeholder} aria-hidden="true">🚚</span>}
            <strong>{vehicle.vehicleNumber}</strong><small>{[vehicle.maintenance?.year, vehicle.maintenance?.make, vehicle.maintenance?.model].filter(Boolean).join(' ') || vehicle.name}</small>
            <span>{vehicle.odometer != null ? miles(vehicle.odometer) : 'Mileage needed'}</span>
            {oil.status === 'needs_setup' && <button onClick={() => onSetup(vehicle.id)}>Complete setup →</button>}
          </header>)}
        </div>
        {view === 'calendar' ? Array.from({length: 13}, (_, i) => addMonths(now, i)).map(month => {
          const key = format(month, 'yyyy-MM');
          return <div key={key} className={styles.grid} style={columns}>
            <div className={styles.axis}><strong>{format(month, 'MMM')}</strong><small>{format(month, 'yyyy')}</small></div>
            {rows.map(({vehicle}) => <div key={vehicle.id} data-vehicle-lane={vehicle.id} className={styles.calendarLane}>{events.filter(e => e.vehicleId === vehicle.id && e.date.startsWith(key)).map(eventCard)}</div>)}
          </div>;
        }) : bands.map(start => <div key={start} data-mileage-band={start} className={styles.grid} style={columns}>
          <div className={styles.axis}><strong>{miles(start)}</strong><small>to {miles(start + 5000)}</small></div>
          {rows.map(({vehicle, oil, readings}) => {
            const latest = [...readings].filter(r => r.odometer === vehicle.odometer).sort((a,b) => b.date.localeCompare(a.date))[0];
            const points = [
              ...(oil.lastService ? [{ value: oil.lastService.odometer, label: 'Last oil change', type: 'completed', detail: oil.lastService.date }] : []),
              ...(vehicle.odometer != null ? [{value: vehicle.odometer, label: 'Current reading', type: 'current', detail: latest?.date || 'Reading date unknown'}] : []),
              ...(oil.dueOdometer != null ? [{value: oil.dueOdometer, label: oil.status === 'overdue' ? 'Oil service due now' : 'Oil mileage limit', type: 'due', detail: oil.dueDate ? `Planning date ${oil.dueDate}` : ''}] : []),
            ].filter(p => p.value >= start && p.value < start + 5000);
            const current = vehicle.odometer;
            const fill = current == null ? 0 : Math.max(0, Math.min(100, (current - start) / 5000 * 100));
            return <div key={vehicle.id} data-vehicle-lane={vehicle.id} className={styles.mileageLane}>
              <div className={styles.rail}><div style={{height: `${fill}%`}} /></div>
              {points.map(p => <button key={p.type} className={`${styles.marker} ${styles[p.type]}`} style={{top: `${(p.value - start) / 5000 * 100}%`}} onClick={() => p.type === 'current' ? onSetup(vehicle.id) : onService(vehicle.id)} title={`${p.label}: ${miles(p.value)}. ${p.detail}`}>
                <strong>{p.label}</strong><span>{miles(p.value)}</span><small>{p.detail}</small>
              </button>)}
            </div>;
          })}
        </div>)}
      </div>
    </div>}
    {view === 'mileage' && <p className={styles.help}>The mileage marker does not represent measured oil life. Time limits or the truck’s oil-life warning can require service sooner. Missing setup is shown above each truck.</p>}
  </div>;
}
