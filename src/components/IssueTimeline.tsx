'use client';

import React, { useState } from 'react';
import { Issue, IssueStatus } from '@/types';
import { IssueStatusBadge } from './StatusBadges';
import {
  Clock,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';

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
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="spread flex-col sm:flex-row items-stretch sm:items-center pb-4 mb-6 border-b border-line">
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
              onClick={() => {
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

      <div className="card card-pad bg-[var(--surface-alt)] mb-6">
        <div className="eyebrow mb-1">Initial Problem Report</div>
        <p className="text-sm text-ink-muted leading-relaxed">{issue.description}</p>
        <div className="mt-2 pt-2 border-t border-line cluster text-xs text-ink-muted">
          <User className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
          <span>
            Reported by <strong>{issue.reportedByName}</strong> on{' '}
            {new Date(issue.reportedAt).toLocaleDateString()} at{' '}
            {new Date(issue.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div>
        <h4 className="eyebrow cluster mb-4">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Permanent Audit Trail ({issue.statusLogs?.length || 1} Events)
        </h4>

        <div className="relative pl-6 stack before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
          {[...(issue.statusLogs || [])].reverse().map((log, index) => (
            <div key={log.id || index} className="relative">
              <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-surface border-2 border-ink flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-ink" />
              </div>

              <div className="card card-pad bg-[var(--surface-alt)] stack-tight">
                <div className="spread flex-wrap">
                  <div className="cluster">
                    <span className="text-xs font-bold capitalize">{log.newStatus.replace('_', ' ')}</span>
                    <span className="text-2xs text-ink-faint">by {log.changedByName}</span>
                  </div>
                  <span className="text-2xs text-ink-muted font-mono">
                    {new Date(log.timestamp).toLocaleDateString()}{' '}
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {log.notes && (
                  <p className="text-xs text-ink-muted italic card card-pad bg-surface">
                    &ldquo;{log.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
          <div
            className="card card-pad max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-status-title"
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
                      {st === 'open' && '⚠️ OPEN'}
                      {st === 'needs_repair' && '🛑 NEEDS REPAIR'}
                      {st === 'being_repaired' && '🔧 IN REPAIR'}
                      {st === 'fixed' && '✅ FIXED'}
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
