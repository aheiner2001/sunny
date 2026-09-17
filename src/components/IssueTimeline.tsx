'use client';

import React, { useState } from 'react';
import { Issue, IssueStatus, IssuePriority } from '@/types';
import { IssueLogStatusBadge, IssueStatusBadge, issueLogStatusDataStatus } from './StatusBadges';
import {
  ChevronDown,
  Clock,
  User,
  Wrench,
  AlertOctagon,
  AlertTriangle,
  Info,
  Calendar,
  DollarSign,
  Tag,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';

function formatLogTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-surface-sunk text-slate-800 border-slate-300',
};

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === 'critical') return <AlertOctagon className="w-3 h-3 text-rose-600" />;
  if (priority === 'moderate') return <AlertTriangle className="w-3 h-3 text-amber-600" />;
  return <Info className="w-3 h-3 text-ink-muted" />;
}

export function IssueTimeline({
  issue,
  onStatusUpdated,
  selectable = false,
  selected = false,
  onSelectToggle,
}: {
  issue: Issue;
  onStatusUpdated?: (updated: Issue) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: (issueId: string) => void;
}) {
  const { user, role } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus>(issue.status);
  const [priority, setPriority] = useState<IssuePriority>(issue.priority || 'moderate');
  const [assignedTechnician, setAssignedTechnician] = useState(issue.assignedTechnician || '');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState(issue.estimatedCompletionDate || '');
  const [repairCost, setRepairCost] = useState(issue.repairCost !== undefined && issue.repairCost !== null ? String(issue.repairCost) : '');
  const [partNumber, setPartNumber] = useState(issue.partNumber || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const logs = [...(issue.statusLogs || [])].reverse();
  const latestLog = logs[0];

  const hasReport = !!(issue.description?.trim() && issue.description !== 'None') || !!issue.photoUrl;
  const hasDetails = !!(issue.assignedTechnician || issue.estimatedCompletionDate || issue.repairCost || issue.partNumber);
  const isCriticalOpen = issue.priority === 'critical' && issue.status !== 'fixed';

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert('Please provide notes explaining this update for the permanent audit trail.');
      return;
    }

    try {
      setIsSubmitting(true);
      const managerIdentity = {
        id: user?.id || 'mgr-1',
        name: user?.name || 'Manager',
      };

      dbService.updateIssueDetails(
        issue.id,
        {
          priority,
          assignedTechnician: assignedTechnician.trim() || null,
          estimatedCompletionDate: estimatedCompletionDate || null,
          repairCost: repairCost ? Number(repairCost) : null,
          partNumber: partNumber.trim() || null,
        },
        managerIdentity,
      );

      const updated = dbService.updateIssueStatus(
        issue.id,
        selectedStatus,
        managerIdentity,
        notes,
      );

      setShowStatusModal(false);
      setNotes('');
      if (onStatusUpdated) onStatusUpdated(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`card transition-all ${isCriticalOpen ? 'border-rose-300 bg-rose-50/20' : ''}`}
    >
      {/* ── Compact row (always visible) ─────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
      >
        {/* Checkbox */}
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              if (onSelectToggle) onSelectToggle(issue.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-line cursor-pointer text-ink focus:ring-ink shrink-0"
            aria-label={`Select issue ${issue.title}`}
          />
        )}

        {/* Expand chevron */}
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${expanded ? 'rotate-90' : ''}`}
          aria-hidden
        />

        {/* Van + Equipment */}
        <span className="badge shrink-0" data-status="info">{issue.vehicleNumber}</span>
        <span className="text-xs text-ink-muted truncate hidden sm:inline shrink-0">{issue.equipmentName}</span>

        {/* Title — flex-1 so it fills space */}
        <span className="text-sm font-semibold text-ink truncate flex-1 min-w-0">{issue.title}</span>

        {/* Priority pill */}
        {issue.priority && (
          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${PRIORITY_BADGE[issue.priority]}`}>
            <PriorityIcon priority={issue.priority} />
            <span className="hidden sm:inline">{issue.priority === 'critical' ? 'Critical' : issue.priority}</span>
          </span>
        )}

        {/* Status badge */}
        <span className="shrink-0"><IssueStatusBadge status={issue.status} /></span>

        {/* Manage button — stops propagation so row doesn't toggle */}
        {role === 'manager' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedStatus(issue.status);
              setPriority(issue.priority || 'moderate');
              setAssignedTechnician(issue.assignedTechnician || '');
              setEstimatedCompletionDate(issue.estimatedCompletionDate || '');
              setRepairCost(issue.repairCost !== undefined && issue.repairCost !== null ? String(issue.repairCost) : '');
              setPartNumber(issue.partNumber || '');
              setShowStatusModal(true);
            }}
            className="btn btn-primary btn-sm shrink-0"
          >
            <Wrench className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Manage</span>
          </button>
        )}
      </div>

      {/* ── Expanded detail panel ─────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">

          {/* Initial report — plain inset, only when there's content */}
          {hasReport && (
            <div className="rounded-lg bg-[var(--surface-alt)] px-3 py-2.5 space-y-2">
              <div className="eyebrow mb-0.5">Initial report</div>
              {issue.description?.trim() && issue.description !== 'None' && (
                <p className="text-sm text-ink-muted leading-relaxed">{issue.description}</p>
              )}
              {issue.photoUrl && (
                <div>
                  <div className="text-[10px] font-bold text-ink-faint uppercase mb-1">Attached Photo</div>
                  <img
                    src={issue.photoUrl}
                    alt="Issue evidence"
                    className="w-24 h-24 object-cover rounded-xl border border-line shadow-xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* Technician / ETA / Cost / Part chips — only when populated */}
          {hasDetails && (
            <div className="flex flex-wrap gap-2 text-xs">
              {issue.assignedTechnician && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink font-semibold">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tech: <strong>{issue.assignedTechnician}</strong></span>
                </div>
              )}
              {issue.estimatedCompletionDate && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>ETA: <strong>{new Date(issue.estimatedCompletionDate).toLocaleDateString()}</strong></span>
                </div>
              )}
              {issue.repairCost !== undefined && issue.repairCost !== null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold font-mono">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cost: ${issue.repairCost.toLocaleString()}</span>
                </div>
              )}
              {issue.partNumber && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink font-mono text-[11px]">
                  <Tag className="w-3 h-3 text-ink-muted" />
                  <span>Part: {issue.partNumber}</span>
                </div>
              )}
            </div>
          )}

          {/* Reporter line */}
          <div className="cluster text-xs text-ink-muted">
            <User className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
            <span>
              Reported by <strong>{issue.reportedByName}</strong> · {formatLogTime(issue.reportedAt)}
            </span>
          </div>

          {/* Audit trail accordion */}
          <div className="rounded-[var(--radius)] border border-line overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAuditOpen((open) => !open);
              }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--surface-alt)] hover:bg-surface-sunk transition-colors text-left"
              aria-expanded={auditOpen}
            >
              <span className="cluster min-w-0">
                <Clock className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
                <span className="text-xs font-bold text-ink">
                  Audit trail
                  <span className="font-normal text-ink-muted"> ({logs.length})</span>
                </span>
              </span>
              {!auditOpen && latestLog ? (
                <span className="cluster text-2xs text-ink-muted min-w-0 truncate">
                  Latest:
                  <IssueLogStatusBadge status={latestLog.newStatus} />
                  <span className="truncate hidden sm:inline">{latestLog.changedByName}</span>
                </span>
              ) : null}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${auditOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {auditOpen ? (
              <div className="max-h-56 overflow-y-auto border-t border-line bg-surface">
                {logs.length === 0 ? (
                  <p className="p-4 text-xs text-ink-muted">No status changes recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {logs.map((log, index) => (
                      <li
                        key={log.id || index}
                        className="row items-start gap-3 py-2.5 px-3 border-b-0"
                        data-status={issueLogStatusDataStatus(log.newStatus)}
                      >
                        <div className="min-w-0 flex-1 stack-tight">
                          <div className="cluster flex-wrap gap-2">
                            <IssueLogStatusBadge status={log.newStatus} />
                            <span className="text-2xs text-ink-muted">
                              {log.changedByName} · {formatLogTime(log.timestamp)}
                            </span>
                          </div>
                          {log.notes ? (
                            <p className="text-xs text-ink-muted leading-snug line-clamp-2" title={log.notes}>
                              {log.notes}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Manage / Resolve modal ────────────────────────────────── */}
      {showStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
          onClick={() => setShowStatusModal(false)}
        >
          <div
            className="card card-pad max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-status-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="issue-status-title" className="card-title mb-1 text-base">
              Manage &amp; Resolve Issue
            </h3>
            <p className="hint mb-4 text-xs">
              Update priority, technician dispatch, parts/costs, and audit resolution notes.
            </p>

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              {/* Status Selector */}
              <div>
                <span className="label font-bold text-ink mb-1 block">Issue Lifecycle Status</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['open', 'needs_repair', 'being_repaired', 'fixed'] as IssueStatus[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setSelectedStatus(st)}
                      className={`btn btn-sm text-center justify-center capitalize ${
                        selectedStatus === st ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Selector */}
              <div>
                <label className="label font-bold text-ink mb-1 block">Issue Urgency / Safety Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'critical', label: 'Critical (Grounded)', color: 'text-rose-700 bg-rose-50 border-rose-300' },
                    { id: 'moderate', label: 'Moderate (Needs Fix)', color: 'text-amber-700 bg-amber-50 border-amber-300' },
                    { id: 'low', label: 'Low (Cosmetic)', color: 'text-ink bg-surface-sunk border-slate-300' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id as IssuePriority)}
                      className={`p-2 rounded-xl text-center font-bold border transition-all ${
                        priority === p.id
                          ? 'ring-2 ring-ink bg-surface shadow-xs'
                          : 'bg-surface-sunk text-ink-muted border-line'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Technician & Estimated Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold text-ink mb-1 block">Assigned Technician / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Mike R. / Fleet Wash Supply"
                    value={assignedTechnician}
                    onChange={(e) => setAssignedTechnician(e.target.value)}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label font-bold text-ink mb-1 block">Estimated Completion Date</label>
                  <input
                    type="date"
                    value={estimatedCompletionDate}
                    onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              {/* Cost & Parts Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold text-ink mb-1 block">Repair Cost ($ USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 45.00"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    className="input text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="label font-bold text-ink mb-1 block">Replacement Part #</label>
                  <input
                    type="text"
                    placeholder="e.g. CAT-PUMP-3DX"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    className="input text-xs font-mono"
                  />
                </div>
              </div>

              {/* Audit Notes */}
              <div>
                <label className="label font-bold text-ink mb-1 block">
                  Action / Resolution Audit Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Replaced leaking brass fitting, bench tested at 150 PSI, ready for route."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="textarea text-xs"
                />
              </div>

              <div className="cluster pt-2 border-t border-line justify-end">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Saving...' : 'Save & Update Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
