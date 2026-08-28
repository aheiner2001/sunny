'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Users,
  ArrowRight,
  Info,
  Clock,
  Wrench,
  RotateCcw,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, Inspection, Issue, IssueType } from '@/types';
import { InspectionStatusBadge, IssueStatusBadge, VehicleStatusBadge } from '@/components/StatusBadges';
import { InspectionCalendar } from '@/components/InspectionCalendar';
import { EmptyState } from '@/components/EmptyState';

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  stock_low_inventory: 'Stock / Low Inventory',
  equipment_replacement: 'Equipment Replacement',
  needs_repair: 'Needs Repair',
};

function formatStartTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function issueTypeLabel(issue: Issue): string {
  const type = issue.type ?? 'needs_repair';
  return ISSUE_TYPE_LABELS[type] ?? ISSUE_TYPE_LABELS.needs_repair;
}

export default function DashboardPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const loadData = () => {
    setVehicles(dbService.getVehicles());
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const totalVehiclesCount = vehicles.length;
  const todayInspections = inspections.filter(i => i.dateString === todayString);
  const todayIssues = issues.filter(i => i.dateString === todayString);
  const todayInspectionsCount = todayInspections.length;
  const openIssuesCount = issues.filter(i => i.status !== 'fixed').length;
  const openIssues = issues.filter(i => i.status !== 'fixed');
  const vehiclesInUse = vehicles.filter(v => v.status === 'in_use');

  const inspectionStatusFor = (status: Inspection['status'] | null | undefined) =>
    status === 'passed' ? 'ok' : status === 'issues_found' ? 'flagged' : 'info';

  const resetDemoHint = (
    <Link href="/settings?tab=danger" className="btn btn-secondary btn-sm cluster gap-1.5">
      <RotateCcw className="w-3.5 h-3.5" />
      Reset demo data in Settings
    </Link>
  );

  return (
    <div className="page max-w-full overflow-x-hidden">
      <div className="grid-auto" style={{ '--min': '15rem' } as React.CSSProperties}>
        <div className="card card-pad flex flex-col">
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status="idle">
              <Truck className="w-6 h-6" />
            </span>
            <div className="stat text-right">
              <span className="stat-value">{totalVehiclesCount}</span>
              <span className="stat-label">Total vehicles</span>
            </div>
          </div>
          <div className="card-foot mt-auto">
            <Link href="/vehicles" className="link-action">
              <span>View all vehicles</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="card card-pad flex flex-col">
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status="ok">
              <CheckCircle2 className="w-6 h-6" />
            </span>
            <div className="stat text-right">
              <span className="stat-value">{todayInspectionsCount}</span>
              <span className="stat-label">Inspections today</span>
            </div>
          </div>
          <div className="card-foot mt-auto">
            <Link href="/inspections" className="link-action">
              <span>View today&apos;s inspections</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div
          className="card card-pad flex flex-col"
          data-status={openIssuesCount > 0 ? 'flagged' : undefined}
        >
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status={openIssuesCount > 0 ? 'flagged' : 'ok'}>
              <AlertTriangle className="w-6 h-6" />
            </span>
            <div className="stat text-right" data-status={openIssuesCount > 0 ? 'flagged' : undefined}>
              <span className="stat-value">{openIssuesCount}</span>
              <span className="stat-label">Open issues</span>
            </div>
          </div>
          <div className="card-foot mt-auto">
            <Link href="/issues" className="link-action">
              <span>View all issues</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="card card-pad flex flex-col">
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status="info">
              <Users className="w-6 h-6" />
            </span>
            <div className="stat text-right">
              <span className="stat-value">{vehiclesInUse.length}</span>
              <span className="stat-label">Vehicles in use</span>
            </div>
          </div>
          <div className="card-foot mt-auto">
            <Link href="/employees" className="link-action">
              <span>View active users</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--gutter)]">
        <div className="card flex flex-col">
          <div className="card-head">
            <h2 className="card-title">Today&apos;s activity</h2>
            <Link href="/inspections" className="link-action">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div>
            {[...todayInspections.map(insp => ({ type: 'inspection' as const, insp, at: insp.submittedAt })),
              ...todayIssues.map(issue => ({ type: 'issue' as const, issue, at: issue.reportedAt }))]
              .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
              .slice(0, 5)
              .map((activity) => (
                <div
                  key={activity.type === 'inspection' ? activity.insp.id : activity.issue.id}
                  className="row"
                  data-status={activity.type === 'inspection' ? 'ok' : 'flagged'}
                >
                  <span className="icon-tile" data-status={activity.type === 'inspection' ? 'ok' : 'flagged'}>
                    {activity.type === 'inspection' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="spread gap-2">
                      <p className="text-xs font-semibold truncate m-0">
                        {activity.type === 'inspection' ? 'Inspection completed' : 'Issue reported'}
                      </p>
                      <time className="unit-tag">
                        {new Date(activity.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </time>
                    </div>
                    <p className="unit-tag truncate m-0">
                      {activity.type === 'inspection'
                        ? `${activity.insp.vehicleNumber} · ${activity.insp.userName}`
                        : `${activity.issue.vehicleNumber} · ${activity.issue.equipmentName}`}
                    </p>
                  </div>
                </div>
              ))}

            {todayInspections.length === 0 && todayIssues.length === 0 && (
              <EmptyState
                icon={
                  <span className="icon-tile icon-tile-lg" data-status="idle">
                    <Clock className="w-6 h-6" />
                  </span>
                }
                title="No activity yet today"
                action={
                  <>
                    <Link href="/inspect" className="btn btn-secondary btn-sm">Start an inspection</Link>
                    {totalVehiclesCount === 0 && resetDemoHint}
                  </>
                }
              >
                Inspections and issues appear here as crews submit them.
              </EmptyState>
            )}
          </div>
        </div>

        <div
          onClick={() => router.push('/calendar')}
          className="card card-link card-pad flex flex-col cursor-pointer"
        >
          <InspectionCalendar
            compact
            inspections={inspections}
            issues={issues}
            monthDate={currentMonthDate}
            onMonthChange={setCurrentMonthDate}
            onDayClick={(d) => router.push(`/calendar?date=${d}`)}
          />
        </div>

        <div className="card flex flex-col">
          <div className="card-head">
            <h2 className="card-title">Open issues</h2>
            <Link href="/issues" className="link-action">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div>
            {openIssues.slice(0, 5).map((issue) => (
              <div
                key={issue.id}
                className="row"
                data-status={issue.status === 'needs_repair' ? 'critical' : issue.status === 'being_repaired' ? 'info' : 'flagged'}
              >
                <span className="icon-tile" data-status="idle">
                  <Wrench className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate m-0">{issue.equipmentName}</p>
                  <p className="unit-tag truncate m-0">
                    {issue.vehicleNumber} · {issueTypeLabel(issue)}
                  </p>
                </div>
                <IssueStatusBadge status={issue.status} />
              </div>
            ))}

            {openIssues.length === 0 && (
              <EmptyState
                icon={
                  <span className="icon-tile icon-tile-lg" data-status="ok">
                    <CheckCircle2 className="w-6 h-6" />
                  </span>
                }
                title="All clear"
              >
                No open issues. Every flagged item has been resolved.
              </EmptyState>
            )}
          </div>

          {openIssues.length > 0 && (
            <div className="card-foot mt-auto mx-5 mb-5">
              <Link href="/issues" className="link-action">
                <span>View all issues</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--gutter)]">
        <div className="card lg:col-span-2">
          <div className="card-head">
            <h2 className="card-title">Vehicles in use</h2>
            <Link href="/vehicles" className="link-action">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="table-scroll">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th className="pl-5">Vehicle</th>
                  <th>Current user</th>
                  <th>Start time</th>
                  <th>Last inspection</th>
                  <th className="pr-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {vehiclesInUse.slice(0, 5).map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="pl-5">
                      <span className="cluster gap-2.5">
                        <span className="icon-tile" data-status="idle">
                          <Truck className="w-4 h-4" />
                        </span>
                        <Link
                          href={`/vehicles/detail?id=${encodeURIComponent(vehicle.id)}`}
                          className="font-semibold hover:underline"
                        >
                          {vehicle.vehicleNumber}
                        </Link>
                      </span>
                    </td>
                    <td>{vehicle.currentUserName || '—'}</td>
                    <td className="text-ink-muted">{formatStartTime(vehicle.currentUserStartTime)}</td>
                    <td>
                      <span className="cluster gap-1.5">
                        <span className="text-ink-muted">
                          {vehicle.lastInspectionAt
                            ? new Date(vehicle.lastInspectionAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                        {vehicle.lastInspectionStatus === 'passed' && <CheckCircle2 className="w-4 h-4 text-ok" />}
                        {vehicle.lastInspectionStatus === 'issues_found' && <AlertTriangle className="w-4 h-4 text-hivis-strong" />}
                        {vehicle.lastInspectionStatus === 'in_progress' && <Info className="w-4 h-4 text-ink-faint" />}
                      </span>
                    </td>
                    <td className="pr-5 text-right">
                      <VehicleStatusBadge status={vehicle.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {vehiclesInUse.length === 0 && (
              <EmptyState
                icon={
                  <span className="icon-tile icon-tile-lg" data-status="idle">
                    <Truck className="w-6 h-6" />
                  </span>
                }
                title="No vehicles in use"
                action={
                  vehicles.length === 0 ? (
                    <>
                      <Link href="/vehicles" className="btn btn-secondary btn-sm">Add a vehicle</Link>
                      {resetDemoHint}
                    </>
                  ) : undefined
                }
              >
                {vehicles.length === 0
                  ? 'Add a vehicle to start tracking inspections and equipment.'
                  : 'No vehicles are checked out right now.'}
              </EmptyState>
            )}
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="card-head">
            <h2 className="card-title">Recent inspections</h2>
            <Link href="/inspections" className="link-action">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div>
            {inspections.slice(0, 5).map((insp) => (
              <Link
                key={insp.id}
                href="/inspections"
                className="row block no-underline hover:bg-surface-alt transition-colors"
                data-status={inspectionStatusFor(insp.status)}
              >
                <span className="icon-tile" data-status={inspectionStatusFor(insp.status)}>
                  {insp.status === 'passed' && <CheckCircle2 className="w-4 h-4" />}
                  {insp.status === 'issues_found' && <AlertTriangle className="w-4 h-4" />}
                  {insp.status === 'in_progress' && <Clock className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate m-0">{insp.vehicleNumber}</p>
                  <p className="unit-tag truncate m-0">{insp.userName}</p>
                </div>
                <div className="text-right shrink-0 stack-tight gap-1">
                  <time className="unit-tag">
                    {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </time>
                  <InspectionStatusBadge status={insp.status} />
                </div>
              </Link>
            ))}

            {inspections.length === 0 && (
              <EmptyState
                icon={
                  <span className="icon-tile icon-tile-lg" data-status="idle">
                    <CheckCircle2 className="w-6 h-6" />
                  </span>
                }
                title="No inspections yet"
                action={resetDemoHint}
              >
                Completed inspections will show up here.
              </EmptyState>
            )}
          </div>

          {inspections.length > 0 && (
            <div className="card-foot mt-auto mx-5 mb-5">
              <Link href="/inspections" className="link-action">
                <span>View all inspections</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
