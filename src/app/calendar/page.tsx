'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Truck, Wrench, CheckCircle2, AlertTriangle, Filter } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection, Issue, FleetTask, Vehicle } from '@/types';
import { InspectionStatusBadge, IssueStatusBadge } from '@/components/StatusBadges';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { InspectionCalendar, CalendarViewMode } from '@/components/InspectionCalendar';

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function CalendarPage() {
  return (
    <ManagerOnly>
      <CalendarPageContent />
    </ManagerOnly>
  );
}

function CalendarPageContent() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<FleetTask[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const load = () => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
    setTasks(dbService.getTasks());
    setVehicles(dbService.getVehicles());
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, []);

  // 5.4 Vehicle Filter on Calendar
  const filteredInspections = useMemo(() => {
    if (vehicleFilter === 'all') return inspections;
    return inspections.filter((i) => i.vehicleId === vehicleFilter);
  }, [inspections, vehicleFilter]);

  const filteredIssues = useMemo(() => {
    if (vehicleFilter === 'all') return issues;
    return issues.filter((iss) => iss.vehicleId === vehicleFilter);
  }, [issues, vehicleFilter]);

  const filteredTasks = useMemo(() => {
    if (vehicleFilter === 'all') return tasks;
    return tasks.filter((t) => t.vehicleId === vehicleFilter);
  }, [tasks, vehicleFilter]);

  const selectedInspections = useMemo(
    () => filteredInspections.filter((i) => i.dateString === selectedDate),
    [filteredInspections, selectedDate],
  );

  const selectedIssues = useMemo(
    () => filteredIssues.filter((i) => i.dateString === selectedDate),
    [filteredIssues, selectedDate],
  );

  const selectedTasks = useMemo(
    () =>
      filteredTasks.filter((t) => {
        const taskDate = t.dueAt ? t.dueAt.split('T')[0] : t.createdAt?.split('T')[0];
        return taskDate === selectedDate;
      }),
    [filteredTasks, selectedDate],
  );

  return (
    <div className="page space-y-6">
      <PageHeader
        title="Fleet Schedule & Inspection Calendar"
        subtitle="Review persisted inspections, scheduled maintenance tasks, and reported issues across the fleet."
        actions={
          <div className="flex items-center gap-3">
            {/* 5.4 Vehicle Filter on Calendar */}
            <div className="flex items-center gap-1.5 bg-surface rounded-xl border border-line px-3 py-1.5 shadow-xs">
              <Truck className="w-4 h-4 text-ink-muted" />
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                className="text-xs font-bold text-ink bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
                aria-label="Filter calendar by vehicle"
              >
                <option value="all">All Fleet Vans ({vehicles.length})</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleNumber} ({v.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InspectionCalendar
            compact={false}
            inspections={filteredInspections}
            issues={filteredIssues}
            tasks={filteredTasks}
            monthDate={month}
            onMonthChange={setMonth}
            onDayClick={setSelectedDate}
            selectedDate={selectedDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            vehicleFilter={vehicleFilter}
            onVehicleFilterChange={setVehicleFilter}
          />
        </div>

        <section className="card card-pad space-y-4">
          <div className="border-b border-line pb-3">
            <span className="eyebrow mb-1">Selected Date Activity</span>
            <h3 className="card-title text-base font-extrabold text-ink">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </h3>
            {vehicleFilter !== 'all' && (
              <span className="unit-tag mt-1 inline-block">
                Filtered: {vehicles.find((v) => v.id === vehicleFilter)?.vehicleNumber}
              </span>
            )}
          </div>

          {/* 5.2 Scheduled Tasks for Selected Day */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-blue-600" /> Scheduled Tasks
              </span>
              <span className="unit-tag">{selectedTasks.length}</span>
            </h4>
            <div className="space-y-2 mb-4">
              {selectedTasks.map((task) => (
                <div key={task.id} className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-blue-900">
                    <span>{task.title}</span>
                    <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-blue-200/70 text-blue-900">
                      {task.status}
                    </span>
                  </div>
                  {task.dueAt && (
                    <div className="text-[11px] text-blue-700 mt-0.5">
                      Due: {new Date(task.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ))}
              {selectedTasks.length === 0 && (
                <p className="text-xs text-ink-faint italic py-1">No tasks scheduled for this day.</p>
              )}
            </div>
          </div>

          {/* Inspections */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Inspections
              </span>
              <span className="unit-tag">{selectedInspections.length}</span>
            </h4>
            <div className="space-y-2 mb-4">
              {selectedInspections.map((i) => (
                <div key={i.id} className="p-2.5 rounded-xl bg-surface-sunk border border-line text-xs">
                  <div className="spread font-bold text-ink">
                    <span>{i.vehicleNumber}</span>
                    <InspectionStatusBadge status={i.status} />
                  </div>
                  <div className="text-ink-muted mt-1 text-[11px]">
                    {i.userName} ·{' '}
                    {new Date(i.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {i.odometer && (
                    <div className="text-[10px] text-ink-faint mt-0.5">
                      Mileage: {i.odometer.toLocaleString()} mi
                    </div>
                  )}
                </div>
              ))}
              {selectedInspections.length === 0 && (
                <p className="text-xs text-ink-faint italic py-1">No inspections submitted.</p>
              )}
            </div>
          </div>

          {/* Reported Issues */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Reported Issues
              </span>
              <span className="unit-tag">{selectedIssues.length}</span>
            </h4>
            <div className="space-y-2">
              {selectedIssues.map((iss) => (
                <div key={iss.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                  <div className="spread font-bold text-rose-900">
                    <span>{iss.equipmentName}</span>
                    <IssueStatusBadge status={iss.status} />
                  </div>
                  <p className="text-rose-800 mt-1 text-[11px]">{iss.description}</p>
                  <div className="text-[10px] text-rose-600 mt-1">
                    {iss.vehicleNumber} · {iss.reportedByName}
                  </div>
                </div>
              ))}
              {selectedIssues.length === 0 && (
                <p className="text-xs text-ink-faint italic py-1">No issues reported.</p>
              )}
            </div>
          </div>

          <Link href="/inspections" className="btn btn-secondary btn-block mt-4 text-xs font-bold">
            View All Inspection Records
          </Link>
        </section>
      </div>
    </div>
  );
}
