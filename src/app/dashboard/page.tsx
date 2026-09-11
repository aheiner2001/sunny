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
  Sparkles,
  Archive,
  ShieldAlert,
  LogOut,
  UserCheck,
  CheckSquare,
  Square,
  Trash2
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, Inspection, Issue, IssueType, Equipment, User } from '@/types';
import { InspectionStatusBadge, IssueStatusBadge, VehicleStatusBadge, LifespanStatusBadge } from '@/components/StatusBadges';
import { InspectionCalendar } from '@/components/InspectionCalendar';
import { EmptyState } from '@/components/EmptyState';
import { LifespanActionModal } from '@/components/LifespanActionModal';
import { useAuth } from '@/context/AuthContext';

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
  const { role } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [lifespanAction, setLifespanAction] = useState<{ item: Equipment; mode: 'extend' | 'replace' | 'retire' } | null>(null);

  // 1.1 Activity Stream Filter state
  const [activityFilter, setActivityFilter] = useState<'all' | 'inspections' | 'issues'>('all');

  // 1.3 Quick Shift Reassignment state
  const [reassignModalVehicle, setReassignModalVehicle] = useState<Vehicle | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // 2.2 Batch Lifespan selection
  const [selectedLifespanIds, setSelectedLifespanIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const loadData = () => {
    setVehicles(dbService.getVehicles());
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
    setEquipment(dbService.getEquipment());
    setUsers(dbService.getUsers().filter(u => u.status === 'active'));
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
  const dueForReviewEquipment = equipment.filter(e => e.lifespanEnabled && !e.retiredAt && e.lifespanStatus === 'due_for_review');
  const pendingInspectionDeletes = inspections
    .filter(i => Boolean(i.deleteRequestedAt))
    .sort((a, b) => new Date(b.deleteRequestedAt || 0).getTime() - new Date(a.deleteRequestedAt || 0).getTime());

  // 1.2 Urgent Vehicle Safety Flag
  const urgentSafetyVehicles = vehiclesInUse.filter(
    v => v.lastInspectionStatus === 'issues_found' || openIssues.some(i => i.vehicleId === v.id && i.priority === 'critical')
  );

  const inspectionStatusFor = (status: Inspection['status'] | null | undefined) =>
    status === 'passed' ? 'ok' : status === 'issues_found' ? 'flagged' : 'info';

  const resetDemoHint = (
    <Link href="/settings?tab=danger" className="btn btn-secondary btn-sm cluster gap-1.5">
      <RotateCcw className="w-3.5 h-3.5" />
      Reset demo data in Settings
    </Link>
  );

  // Quick check-in action
  const handleQuickCheckIn = async (vehicleId: string) => {
    try {
      await dbService.checkInVehicle(vehicleId);
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to check in vehicle');
    }
  };

  // Quick reassign action
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModalVehicle || !selectedUserId) return;
    if (selectedUserId === reassignModalVehicle.currentUserId) {
      alert('Pick a different person than the current driver.');
      return;
    }
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;
    try {
      await dbService.checkOutVehicle(reassignModalVehicle.id, { id: user.id, name: user.name });
      setReassignModalVehicle(null);
      setSelectedUserId('');
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to reassign vehicle');
    }
  };

  // Batch Replace Lifespan
  const handleBatchReplace = async () => {
    if (selectedLifespanIds.length === 0) return;
    if (!window.confirm(`Mark ${selectedLifespanIds.length} items as replaced?`)) return;
    try {
      setIsBatchProcessing(true);
      await dbService.batchReplaceLifespan(selectedLifespanIds, { reason: 'Batch replaced via Dashboard' });
      setSelectedLifespanIds([]);
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to replace equipment batch');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const toggleLifespanSelection = (id: string) => {
    setSelectedLifespanIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllLifespan = () => {
    if (selectedLifespanIds.length === dueForReviewEquipment.length) {
      setSelectedLifespanIds([]);
    } else {
      setSelectedLifespanIds(dueForReviewEquipment.map(e => e.id));
    }
  };

  // Activity list filtered
  const rawActivities = [
    ...(activityFilter !== 'issues' ? todayInspections.map(insp => ({ type: 'inspection' as const, insp, at: insp.submittedAt })) : []),
    ...(activityFilter !== 'inspections' ? todayIssues.map(issue => ({ type: 'issue' as const, issue, at: issue.reportedAt })) : [])
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="page max-w-full overflow-x-hidden stack gap-6">
      {/* 1.2 Urgent Vehicle Safety Banner */}
      {urgentSafetyVehicles.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 flex items-center justify-between flex-wrap gap-3" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <h3 className="font-bold text-sm text-red-900 dark:text-red-200">
                Urgent Vehicle Safety Alert ({urgentSafetyVehicles.length} {urgentSafetyVehicles.length === 1 ? 'vehicle' : 'vehicles'} in use with active issues)
              </h3>
              <p className="text-xs text-red-800 dark:text-red-300">
                The following vans are currently checked out despite flagged inspection failures:
                {' '}
                {urgentSafetyVehicles.map(v => `${v.vehicleNumber} (${v.currentUserName || 'Driver'})`).join(', ')}.
              </p>
            </div>
          </div>
          <div className="cluster gap-2">
            <Link href="/issues" className="btn btn-secondary btn-sm">
              View Issues
            </Link>
            {urgentSafetyVehicles.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleQuickCheckIn(v.id)}
                className="btn btn-primary btn-sm bg-red-600 hover:bg-red-700 text-white"
              >
                Ground / Check In {v.vehicleNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {role === 'manager' && pendingInspectionDeletes.length > 0 && (
        <div className="card card-pad stack" data-status="flagged">
          <div>
            <h2 className="card-title cluster gap-2">
              <Trash2 className="w-4 h-4" aria-hidden />
              Inspection delete requests ({pendingInspectionDeletes.length})
            </h2>
            <p className="hint">Employees asked to remove a record they submitted by mistake. Approve deletes it; deny leaves it in place.</p>
          </div>
          <ul className="stack gap-2">
            {pendingInspectionDeletes.map(insp => (
              <li key={insp.id} className="spread items-start flex-wrap gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {insp.vehicleNumber} · {insp.userName}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {new Date(insp.submittedAt).toLocaleString()}
                    {insp.deleteRequestedByName ? ` · requested by ${insp.deleteRequestedByName}` : ''}
                  </p>
                  {insp.deleteRequestNote ? (
                    <p className="text-xs mt-1">&ldquo;{insp.deleteRequestNote}&rdquo;</p>
                  ) : null}
                </div>
                <div className="cluster gap-2 shrink-0">
                  <Link href={`/inspections?id=${insp.id}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      try {
                        await dbService.denyInspectionDelete(insp.id);
                        loadData();
                      } catch (e: any) {
                        alert(e.message || 'Could not deny request');
                      }
                    }}
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={async () => {
                      if (!confirm(`Delete inspection for ${insp.vehicleNumber}?`)) return;
                      try {
                        await dbService.approveInspectionDelete(insp.id);
                        loadData();
                      } catch (e: any) {
                        alert(e.message || 'Could not delete inspection');
                      }
                    }}
                  >
                    Approve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Equipment Due for Review Section with 2.2 Batch Actions */}
      {dueForReviewEquipment.length > 0 && (
        <div className="card card-pad stack">
          <div className="spread items-center border-b border-line pb-3 flex-wrap gap-2">
            <div>
              <h2 className="card-title cluster gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--amber-text)]" />
                Equipment Due for Review ({dueForReviewEquipment.length})
              </h2>
              <p className="hint">
                Tools that have reached their expected cars cleaned or calendar life expiration.
              </p>
            </div>
            <div className="cluster gap-2">
              <button
                type="button"
                onClick={toggleSelectAllLifespan}
                className="btn btn-secondary btn-sm cluster gap-1"
              >
                {selectedLifespanIds.length === dueForReviewEquipment.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" /> Select All ({dueForReviewEquipment.length})
                  </>
                )}
              </button>
              {selectedLifespanIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchReplace}
                  disabled={isBatchProcessing}
                  className="btn btn-primary btn-sm cluster gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Mark Selected as Replaced ({selectedLifespanIds.length})
                </button>
              )}
              <Link href="/equipment?lifespan=due" className="link-action text-xs ml-2">
                View all due tools <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="grid-auto">
            {dueForReviewEquipment.map((eq) => {
              const isSelected = selectedLifespanIds.includes(eq.id);
              return (
                <div
                  key={eq.id}
                  className={`card card-pad bg-[var(--surface-alt)] stack-tight transition-all ${
                    isSelected ? 'ring-2 ring-primary border-transparent' : ''
                  }`}
                >
                  <div className="spread items-start">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLifespanSelection(eq.id)}
                        className="mt-1 cursor-pointer"
                        aria-label={`Select ${eq.name}`}
                      />
                      <div>
                        <h3 className="card-title text-sm">{eq.name}</h3>
                        <p className="hint text-xs">
                          {eq.vehicleNumber ? `Assigned to ${eq.vehicleNumber}` : 'In shop / unassigned'}
                        </p>
                      </div>
                    </div>
                    <LifespanStatusBadge status={eq.lifespanStatus} />
                  </div>
                  <p className="text-xs text-ink-muted">
                    {eq.lifespanMode === 'usage'
                      ? `Worn ${eq.carsUsed ?? 0} / ${eq.expectedCars ?? 0} cars`
                      : `Due date: ${eq.dueDate ? new Date(eq.dueDate).toLocaleDateString() : '—'}`}
                  </p>
                  <div className="cluster gap-2 mt-2 pt-2 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setLifespanAction({ item: eq, mode: 'extend' })}
                      className="btn btn-secondary btn-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Extend
                    </button>
                    <button
                      type="button"
                      onClick={() => setLifespanAction({ item: eq, mode: 'replace' })}
                      className="btn btn-secondary btn-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Replaced
                    </button>
                    <button
                      type="button"
                      onClick={() => setLifespanAction({ item: eq, mode: 'retire' })}
                      className="btn btn-ghost btn-sm text-[var(--critical)]"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Retire
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Metric Tiles */}
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

        <div className={`card card-pad flex flex-col ${todayInspectionsCount === 0 ? 'opacity-60' : ''}`}>
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status={todayInspectionsCount === 0 ? 'idle' : 'ok'}>
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
          className={`card card-pad flex flex-col ${openIssuesCount === 0 ? 'opacity-60' : ''}`}
          data-status={openIssuesCount > 0 ? 'flagged' : undefined}
        >
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status={openIssuesCount > 0 ? 'flagged' : 'idle'}>
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

        <div className={`card card-pad flex flex-col ${vehiclesInUse.length === 0 ? 'opacity-60' : ''}`}>
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status={vehiclesInUse.length === 0 ? 'idle' : 'info'}>
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

        <Link
          href="/equipment?lifespan=due"
          className={`card card-pad flex flex-col ${dueForReviewEquipment.length === 0 ? 'opacity-60' : ''}`}
          data-status={dueForReviewEquipment.length > 0 ? 'flagged' : undefined}
        >
          <div className="spread items-start">
            <span className="icon-tile icon-tile-lg" data-status={dueForReviewEquipment.length > 0 ? 'flagged' : 'idle'}>
              <AlertTriangle className="w-6 h-6" />
            </span>
            <div className="stat text-right" data-status={dueForReviewEquipment.length > 0 ? 'flagged' : undefined}>
              <span className="stat-value">{dueForReviewEquipment.length}</span>
              <span className="stat-label">Due for review</span>
            </div>
          </div>
          <div className="card-foot mt-auto">
            <span className="link-action">
              <span>Review lifespan tools</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>
      </div>


      {/* Main 3-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--gutter)]">
        {/* 1.1 Activity Stream with Filter Chips */}
        <div className="card flex flex-col">
          <div className="card-head spread items-center pb-2">
            <div>
              <h2 className="card-title">Today&apos;s activity</h2>
            </div>
            <Link href="/inspections" className="link-action text-xs">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Filter Chips */}
          <div className="px-5 pb-3 cluster gap-1.5 border-b border-line">
            <button
              type="button"
              onClick={() => setActivityFilter('all')}
              className={`btn btn-xs rounded-full px-2.5 ${activityFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All ({todayInspections.length + todayIssues.length})
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('inspections')}
              className={`btn btn-xs rounded-full px-2.5 ${activityFilter === 'inspections' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Inspections ({todayInspections.length})
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('issues')}
              className={`btn btn-xs rounded-full px-2.5 ${activityFilter === 'issues' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Issues ({todayIssues.length})
            </button>
          </div>

          <div>
            {rawActivities.slice(0, 6).map((activity) => (
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

            {rawActivities.length === 0 && (
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
                {activityFilter === 'all'
                  ? 'Inspections and issues appear here as crews submit them.'
                  : `No ${activityFilter} recorded today.`}
              </EmptyState>
            )}
          </div>
        </div>

        {/* Compact Calendar */}
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

        {/* Open Issues Tile */}
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
                data-status={issue.priority === 'critical' ? 'critical' : issue.status === 'needs_repair' ? 'critical' : issue.status === 'being_repaired' ? 'info' : 'flagged'}
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

      {/* 1.3 Vehicles in Use Table with Quick Shift Actions */}
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
                  <th className="pr-5 text-right">Shift Actions</th>
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
                    <td>
                      <span className="cluster gap-1.5">
                        <span className="font-medium">{vehicle.currentUserName || '—'}</span>
                      </span>
                    </td>
                    <td className="text-ink-muted">{formatStartTime(vehicle.currentUserStartAt || vehicle.currentUserStartTime)}</td>
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
                      <div className="cluster justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setReassignModalVehicle(vehicle);
                            setSelectedUserId('');
                          }}
                          className="btn btn-secondary btn-xs cluster gap-1"
                          title="Hand this van to a different driver (keeps it in use)"
                        >
                          <UserCheck className="w-3 h-3" />
                          Change driver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Check in ${vehicle.vehicleNumber}? This ends the current shift and returns the van to the shop.`)) {
                              void handleQuickCheckIn(vehicle.id);
                            }
                          }}
                          className="btn btn-secondary btn-xs cluster gap-1 text-[var(--critical)]"
                          title="End shift — clear operator and return van to shop"
                        >
                          <LogOut className="w-3 h-3" />
                          Return to shop
                        </button>
                      </div>
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

        {/* Recent Inspections Card */}
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

      {/* Lifespan Action Modal */}
      <LifespanActionModal
        item={lifespanAction?.item || null}
        mode={lifespanAction?.mode || null}
        onClose={() => setLifespanAction(null)}
        onSuccess={loadData}
      />

      {/* Change driver modal */}
      {reassignModalVehicle && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReassignModalVehicle(null)}
        >
          <div
            className="card card-pad max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassign-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reassign-title" className="card-title cluster gap-2 mb-1">
              <UserCheck className="w-5 h-5" aria-hidden />
              Change driver · {reassignModalVehicle.vehicleNumber}
            </h2>
            <p className="hint mb-4">
              Current driver:{' '}
              <strong>{reassignModalVehicle.currentUserName || 'None'}</strong>
              . Van stays in use — only the assigned person changes.
            </p>
            <form onSubmit={handleReassignSubmit} className="stack gap-4">
              <div className="field">
                <label className="label" htmlFor="reassign-driver">
                  New driver
                </label>
                <select
                  id="reassign-driver"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="select w-full"
                  required
                >
                  <option value="">Choose someone else…</option>
                  {users
                    .filter((u) => u.status === 'active' && u.id !== reassignModalVehicle.currentUserId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                </select>
              </div>
              <div className="cluster justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setReassignModalVehicle(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserId || selectedUserId === reassignModalVehicle.currentUserId}
                  className="btn btn-primary btn-sm"
                >
                  Hand off van
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

