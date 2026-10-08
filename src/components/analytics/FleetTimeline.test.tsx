import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import FleetTimeline from './FleetTimeline';
import { forecastOil } from '@/lib/maintenance';
import type { Vehicle } from '@/types';

it('compares trucks on shared mileage bands and keeps mileage mode separate from calendar dates', async () => {
  const now = new Date('2026-10-07T12:00:00');
  const vehicles: Vehicle[] = [18000, 27000].map((odometer, i) => ({
    id: String(i), vehicleNumber: `Truck ${i + 1}`, name: 'Maverick', status: 'active', licensePlate: '', qrCodeToken: '', odometer,
    maintenance: { oilIntervalMiles: 5000, oilIntervalMonths: 12, scheduleConfirmed: true, scheduleSource: 'Test policy' },
    serviceHistory: [{ id: String(i), kind: 'oil', title: 'Oil change', date: '2026-09-01', odometer: odometer - 1000, recordedBy: 'Manager' }],
  }));
  const el = document.createElement('div'); document.body.append(el); const root = createRoot(el);
  try {
    await act(async () => root.render(<FleetTimeline rows={vehicles.map(vehicle => ({vehicle, readings: [], oil: forecastOil(vehicle, [], now)}))} events={[]} now={now} onService={() => {}} onSetup={() => {}} />));
    expect(el.textContent).toContain('Truck 1'); expect(el.textContent).toContain('Truck 2');
    const mileage = Array.from(el.querySelectorAll('button')).find(b => b.textContent === 'Mileage');
    expect(mileage).toBeDefined(); await act(async () => mileage!.click());
    expect(el.textContent).toContain('18,000 mi'); expect(el.textContent).toContain('27,000 mi');
    expect(el.textContent).toContain('22,000 mi'); expect(el.textContent).toContain('31,000 mi');
    const band = el.querySelector('[data-mileage-band="20000"]');
    expect(band?.querySelectorAll('[data-vehicle-lane]').length).toBe(2);
    expect(el.textContent).not.toContain('Booked');
  } finally { await act(async () => root.unmount()); el.remove(); }
});

it('places dated services in the correct truck and month and opens that truck’s service form', async () => {
  const now = new Date('2026-10-07T12:00:00');
  const vehicle: Vehicle = { id:'truck', vehicleNumber:'Mav 5', name:'Maverick', status:'active', licensePlate:'', qrCodeToken:'', imageUrl:'/truck.jpg' };
  let selected = '';
  const el = document.createElement('div'); document.body.append(el); const root = createRoot(el);
  try {
    await act(async () => root.render(<FleetTimeline rows={[{vehicle, readings:[], oil:{status:'needs_setup',reason:'Needs baseline'}}]} events={[{id:'event',vehicleId:'truck',vehicleNumber:'Mav 5',date:'2026-11-15',title:'Oil & filter service',projected:true,overdue:false,detail:'Test projection'}]} now={now} onService={id => {selected=id;}} onSetup={() => {}} />));
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/truck.jpg');
    const event = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Nov 15'))!;
    expect(event.closest('[data-vehicle-lane]')?.getAttribute('data-vehicle-lane')).toBe('truck');
    expect(event.parentElement?.parentElement?.firstElementChild?.textContent).toContain('Nov');
    await act(async () => event.click()); expect(selected).toBe('truck');
    expect(el.textContent).toContain('Complete setup');
  } finally { await act(async () => root.unmount()); el.remove(); }
});
