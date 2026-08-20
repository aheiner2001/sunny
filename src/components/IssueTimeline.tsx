'use client';

import React, { useState } from 'react';
import { Issue, IssueStatus } from '@/types';
import { IssueStatusBadge } from './StatusBadges';
import { 
  Clock, 
  User, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Wrench, 
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';

export function IssueTimeline({ 
  issue, 
  onStatusUpdated 
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
          name: user?.name || 'Manager'
        },
        notes
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
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
              {issue.vehicleNumber}
            </span>
            <span className="text-xs font-semibold text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">{issue.equipmentName}</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">{issue.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <IssueStatusBadge status={issue.status} />
          {role === 'manager' && (
            <button
              onClick={() => {
                setSelectedStatus(issue.status);
                setShowStatusModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-sm transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Update Status</span>
            </button>
          )}
        </div>
      </div>

      {/* Description Box */}
      <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
          Initial Problem Report
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{issue.description}</p>
        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs text-slate-500">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span>Reported by <strong>{issue.reportedByName}</strong> on {new Date(issue.reportedAt).toLocaleDateString()} at {new Date(issue.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Append-Only Audit History Feed */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-sky-600" /> Permanent Audit Trail ({issue.statusLogs?.length || 1} Events)
        </h4>

        <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {[...(issue.statusLogs || [])].reverse().map((log, index) => (
            <div key={log.id || index} className="relative group">
              {/* Bullet Node */}
              <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-sky-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              </div>

              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 capitalize">
                      {log.newStatus.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400">by {log.changedByName}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {log.notes && (
                  <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                    "{log.notes}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Update Equipment Status</h3>
            <p className="text-xs text-slate-500 mb-4">
              All status changes are permanently recorded in the immutable audit trail.
            </p>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  New Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['open', 'needs_repair', 'being_repaired', 'fixed'] as IssueStatus[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setSelectedStatus(st)}
                      className={`p-3 rounded-xl text-xs font-bold border text-left transition-all ${
                        selectedStatus === st
                          ? 'border-sky-600 bg-sky-50 text-sky-700 shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {st === 'open' && '⚠️ OPEN'}
                      {st === 'needs_repair' && '🛑 NEEDS REPAIR'}
                      {st === 'being_repaired' && '🔧 IN REPAIR'}
                      {st === 'fixed' && '✅ FIXED'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Manager Log / Action Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Replaced leaking valve gasket with OEM part. Tested up to 140 PSI."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 shadow-sm transition-colors disabled:opacity-50"
                >
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
