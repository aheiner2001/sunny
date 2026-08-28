'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';
import { Inspection, FleetTask } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { InspectionStatusBadge } from '@/components/StatusBadges';

export default function HomePage() {
  const { user } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [tasks, setTasks] = useState<FleetTask[]>([]);

  const loadData = () => {
    setInspections(dbService.getInspections());
    setTasks(dbService.getTasks());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const myInspections = user
    ? [...inspections]
        .filter(i => i.userId === user.id)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, 5)
    : [];

  const openTask = user
    ? tasks.find(t => t.status === 'open' && t.assignedToId === user.id)
    : undefined;

  const inspectionStatusFor = (status: Inspection['status'] | null | undefined) =>
    status === 'passed' ? 'ok' : status === 'issues_found' ? 'flagged' : 'info';

  return (
    <div className="page max-w-full overflow-x-hidden">
      <div className="card card-pad">
        <Link href="/scan" className="btn btn-primary btn-block cluster justify-center gap-2">
          <QrCode className="w-5 h-5" />
          Scan vehicle
        </Link>
      </div>

      {openTask && (
        <div className="card card-pad">
          <div className="cluster gap-3">
            <span className="icon-tile" data-status="info">
              <ClipboardList className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold m-0">{openTask.title}</p>
              {openTask.description && (
                <p className="unit-tag m-0 truncate">{openTask.description}</p>
              )}
              {openTask.scheduleLabel && (
                <p className="unit-tag m-0">{openTask.scheduleLabel}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card flex flex-col">
        <div className="card-head">
          <h2 className="card-title">My recent inspections</h2>
          {myInspections.length > 0 && (
            <Link href="/inspections" className="link-action">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div>
          {myInspections.map(insp => (
            <div key={insp.id} className="row" data-status={inspectionStatusFor(insp.status)}>
              <span className="icon-tile" data-status={inspectionStatusFor(insp.status)}>
                {insp.status === 'passed' && <CheckCircle2 className="w-4 h-4" />}
                {insp.status === 'issues_found' && <AlertTriangle className="w-4 h-4" />}
                {insp.status === 'in_progress' && <Clock className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate m-0">{insp.vehicleNumber}</p>
                <p className="unit-tag truncate m-0">{insp.dateString}</p>
              </div>
              <div className="text-right shrink-0 stack-tight gap-1">
                <time className="unit-tag">
                  {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
                <InspectionStatusBadge status={insp.status} />
              </div>
            </div>
          ))}

          {myInspections.length === 0 && (
            <EmptyState
              icon={
                <span className="icon-tile icon-tile-lg" data-status="idle">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
              }
              title="No inspections yet"
              action={
                <Link href="/scan" className="btn btn-secondary btn-sm">
                  Scan a vehicle to start
                </Link>
              }
            >
              Your completed inspections will appear here after you scan and submit.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
