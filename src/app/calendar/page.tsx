'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dbService } from '@/lib/db';
import { Inspection, Issue } from '@/types';
import { InspectionStatusBadge, IssueStatusBadge } from '@/components/StatusBadges';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { InspectionCalendar } from '@/components/InspectionCalendar';

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
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const load = () => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, []);

  const selectedInspections = useMemo(
    () => inspections.filter((i) => i.dateString === selectedDate),
    [inspections, selectedDate],
  );
  const selectedIssues = useMemo(
    () => issues.filter((i) => i.dateString === selectedDate),
    [issues, selectedDate],
  );

  return (
    <div className="page">
      <PageHeader
        title="Inspection Calendar"
        subtitle="Review persisted inspections and reported issues by month and day."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InspectionCalendar
            compact={false}
            inspections={inspections}
            issues={issues}
            monthDate={month}
            onMonthChange={setMonth}
            onDayClick={setSelectedDate}
          />
        </div>

        <section className="card card-pad">
          <div className="border-b border-line pb-4 mb-4">
            <span className="eyebrow mb-1">Activity on</span>
            <h3 className="card-title">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </h3>
          </div>

          <h4 className="label mb-2">
            Inspections ({selectedInspections.length})
          </h4>
          <div className="stack-tight mb-5">
            {selectedInspections.map((i) => (
              <div key={i.id} className="card card-pad bg-[var(--surface-alt)] text-xs">
                <div className="spread font-bold">
                  <span>{i.vehicleNumber}</span>
                  <InspectionStatusBadge status={i.status} />
                </div>
                <div className="text-ink-muted mt-1">
                  {i.userName} ·{' '}
                  {new Date(i.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {i.scheduleLabel && (
                  <div className="text-ink-muted mt-1">Schedule: {i.scheduleLabel}</div>
                )}
              </div>
            ))}
            {selectedInspections.length === 0 && (
              <p className="text-xs text-ink-faint italic">No inspections submitted.</p>
            )}
          </div>

          <h4 className="label mb-2">
            Reported Issues ({selectedIssues.length})
          </h4>
          <div className="stack-tight">
            {selectedIssues.map((i) => (
              <div key={i.id} className="card card-pad bg-[var(--hivis-wash)] border-[var(--hivis)]/30 text-xs" data-status="flagged">
                <div className="spread font-bold text-[var(--hivis-text)]">
                  <span>{i.equipmentName}</span>
                  <IssueStatusBadge status={i.status} />
                </div>
                <p className="text-ink-muted mt-1">{i.description}</p>
                <div className="text-2xs text-ink-faint mt-1">
                  {i.vehicleNumber} · {i.reportedByName}
                </div>
              </div>
            ))}
            {selectedIssues.length === 0 && (
              <p className="text-xs text-ink-faint italic">No issues reported.</p>
            )}
          </div>

          <Link href="/inspections" className="btn btn-primary btn-block mt-6">
            View All Historical Records
          </Link>
        </section>
      </div>
    </div>
  );
}
