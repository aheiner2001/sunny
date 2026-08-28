'use client';

import React, { useState } from 'react';
import { Issue, IssueStatus } from '@/types';
import { IssueLogStatusBadge, IssueStatusBadge, issueLogStatusDataStatus } from './StatusBadges';
import { ChevronDown, Clock, User, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';

function formatLogTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function IssueTimeline({
  issue,
  onStatusUpdated,
}: {
  issue: Issue;
  onStatusUpdated?: (updated: Issue) => void;
}) {
  const { user, role } = useAuth();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus>(issue.status);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const logs = [...(issue.statusLogs || [])].reverse();
  const latestLog = logs[0];

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert('Please provide notes explaining this status change for the permanent audit trail.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = dbService.updateIssueStatus(
        issue.id,
        selectedStatus,
        {
          id: user?.id || 'mgr-1',
          name: user?.name || 'Manager',
        },
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
    <div className="card card-pad">
      <div className="spread flex-col sm:flex-row items-stretch sm:items-center pb-4 mb-4 border-b border-line">
        <div>
          <div className="cluster mb-1">
            <span className="badge" data-status="info">
              {issue.vehicleNumber}
            </span>
            <span className="text-xs text-ink-faint">•</span>
            <span className="text-xs text-ink-muted">{issue.equipmentName}</span>
          </div>
          <h3 className="card-title text-lg">{issue.title}</h3>
        </div>
        <div className="cluster">
          <IssueStatusBadge status={issue.status} />
          {role === 'manager' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStatus(issue.status);
                setShowStatusModal(true);
              }}
              className="btn btn-primary btn-sm"
            >
              <Wrench className="h-3.5 w-3.5" aria-hidden />
              Update Status
            </button>
          )}
        </div>
      </div>

      <div className="card card-pad bg-[var(--surface-alt)] mb-4">
        <div className="eyebrow mb-1">Initial report</div>
        <p className="text-sm text-ink-muted leading-relaxed line-clamp-3">{issue.description}</p>
        <div className="mt-2 pt-2 border-t border-line cluster text-xs text-ink-muted">
          <User className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
          <span>
            {issue.reportedByName} · {formatLogTime(issue.reportedAt)}
          </span>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-line overflow-hidden">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAuditOpen((open) => !open);
          }}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[var(--surface-alt)] hover:bg-surface-sunk transition-colors text-left"
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

      {showStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
          onClick={() => setShowStatusModal(false)}
        >
          <div
            className="card card-pad max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-status-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="issue-status-title" className="card-title mb-1">
              Update Equipment Status
            </h3>
            <p className="hint mb-4">
              All status changes are permanently recorded in the immutable audit trail.
            </p>

            <form onSubmit={handleUpdateStatus} className="stack">
              <div className="field">
                <span className="label">New Status</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['open', 'needs_repair', 'being_repaired', 'fixed'] as IssueStatus[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setSelectedStatus(st)}
                      className={`btn btn-sm text-left capitalize ${selectedStatus === st ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="status-notes">
                  Manager Log / Action Notes <span className="text-[var(--critical)]">*</span>
                </label>
                <textarea
                  id="status-notes"
                  rows={3}
                  required
                  placeholder="e.g. Replaced leaking valve gasket with OEM part. Tested up to 140 PSI."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="textarea"
                />
              </div>

              <div className="cluster pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
                  {isSubmitting ? 'Saving...' : 'Save to Audit Trail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
