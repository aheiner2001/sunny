'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  PackageCheck,
  PackageMinus,
  Trash2,
  CheckCheck,
  Filter,
  AlertOctagon,
  Wrench,
  DollarSign,
  UserCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Issue, IssueType, IssuePriority } from '@/types';
import { IssueTimeline } from '@/components/IssueTimeline';
import { ManagerOnly } from '@/components/ManagerOnly';
import { useAuth } from '@/context/AuthContext';
import { RecentInspectors } from '@/components/RecentInspectors';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmModal } from '@/components/ConfirmModal';
import { QuantityModal } from '@/components/QuantityModal';
import { EmptyState } from '@/components/EmptyState';
import { parseQuantityInput } from '@/lib/quantityModal';

const ISSUE_TYPES: Array<{ value: IssueType; label: string }> = [
  { value: 'stock_low_inventory', label: 'Stock / Low Inventory' },
  { value: 'equipment_replacement', label: 'Equipment Replacement' },
  { value: 'needs_repair', label: 'Needs Repair' },
];

const STATUS_FILTERS = ['all', 'open', 'needs_repair', 'being_repaired', 'fixed'] as const;

export default function IssuesPage() {
  return (
    <ManagerOnly>
      <IssuesPageContent />
    </ManagerOnly>
  );
}

function IssuesPageContent() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority_critical' | 'date_desc' | 'date_asc' | 'status'>('priority_critical');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [pendingAction, setPendingAction] = useState<'update_stock' | 'remove_from_van' | null>(null);
  const [confirmRemoveIssue, setConfirmRemoveIssue] = useState<Issue | null>(null);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 7.4 Batch Selection State
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [showBatchResolveModal, setShowBatchResolveModal] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchRepairCost, setBatchRepairCost] = useState('');
  const [batchPartNumber, setBatchPartNumber] = useState('');
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  const [quantityModal, setQuantityModal] = useState<{
    action: 'update_stock' | 'remove_from_van';
    issue: Issue;
  } | null>(null);

  const loadData = () => {
    setIssues(dbService.getIssues());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  useEffect(() => {
    const issueId = new URLSearchParams(window.location.search).get('issue');
    if (!issueId) return;
    const target = issues.find(issue => issue.id === issueId);
    if (target) {
      setSelectedIssue(target);
      setStatusFilter(target.status === 'fixed' ? 'fixed' : 'all');
      window.setTimeout(() => document.getElementById(`issue-${issueId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    }
  }, [issues]);

  const managerIdentity = {
    id: user?.id || 'manager',
    name: user?.name || 'Manager',
  };

  const openIssuesCount = issues.filter(i => i.status !== 'fixed').length;
  const criticalIssuesCount = issues.filter(i => i.status !== 'fixed' && i.priority === 'critical').length;

  const handleTypeChange = (issue: Issue, type: IssueType) => {
    try {
      const updated = dbService.updateIssueType(issue.id, type, managerIdentity);
      setSelectedIssue(updated);
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update issue type.');
    }
  };

  const submitStockAction = async (
    issue: Issue,
    action: 'update_stock' | 'remove_from_van',
    quantity: number | undefined,
  ) => {
    if (!issue.equipmentId) {
      alert('This issue has no linked equipment; update inventory manually.');
      return;
    }

    try {
      setPendingAction(action);
      const updated = await dbService.resolveStockIssue(
        issue.id,
        action,
        managerIdentity,
        quantity === undefined ? undefined : { quantity },
      );
      setSelectedIssue(updated);
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to resolve stock issue.');
    } finally {
      setPendingAction(null);
    }
  };

  const closeQuantityModal = () => setQuantityModal(null);

  const handleUpdateQuantityConfirm = (qty: number) => {
    if (!quantityModal || quantityModal.action !== 'update_stock') return;
    const { issue } = quantityModal;
    closeQuantityModal();
    void submitStockAction(issue, 'update_stock', qty);
  };

  const handleRemoveQuantityConfirm = (qty: number | undefined) => {
    if (!quantityModal || quantityModal.action !== 'remove_from_van') return;
    const { issue } = quantityModal;
    closeQuantityModal();
    void submitStockAction(issue, 'remove_from_van', qty);
  };

  const handleDeleteIssue = async () => {
    if (!issueToDelete) return;
    try {
      setDeleteLoading(true);
      await dbService.deleteIssue(issueToDelete.id);
      if (selectedIssue?.id === issueToDelete.id) {
        setSelectedIssue(null);
      }
      setIssueToDelete(null);
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete issue.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 7.4 Batch Resolve Handler
  const handleBatchResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNotes.trim()) {
      alert('Please provide resolution notes for the batch audit trail.');
      return;
    }

    try {
      setIsBatchSubmitting(true);
      const cost = batchRepairCost ? Number(batchRepairCost) : undefined;
      const part = batchPartNumber.trim() || undefined;

      await dbService.batchResolveIssues(
        selectedIssueIds,
        batchNotes.trim(),
        managerIdentity,
        cost,
        part,
      );

      setSelectedIssueIds([]);
      setShowBatchResolveModal(false);
      setBatchNotes('');
      setBatchRepairCost('');
      setBatchPartNumber('');
      loadData();
      alert(`Successfully marked ${selectedIssueIds.length} issue(s) as resolved!`);
    } catch (err: any) {
      alert(err.message || 'Error executing batch resolution');
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  const toggleSelectIssue = (issueId: string) => {
    setSelectedIssueIds(prev =>
      prev.includes(issueId) ? prev.filter(id => id !== issueId) : [...prev, issueId]
    );
  };

  const activeIssues = (statusFilter === 'fixed'
    ? issues.filter(iss => iss.status === 'fixed')
    : issues.filter(iss => iss.status !== 'fixed')
  );

  const filteredIssues = activeIssues.filter(iss => {
    const matchesSearch =
      iss.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.reportedByName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (iss.assignedTechnician && iss.assignedTechnician.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || iss.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || iss.priority === priorityFilter;
    const matchesVehicle = vehicleFilter === 'all' || iss.vehicleId === vehicleFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesVehicle;
  });

  // 7.1 Sort with Critical Triage to the Top
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === 'priority_critical') {
      const priorityWeight: Record<string, number> = { critical: 3, moderate: 2, low: 1 };
      const weightA = priorityWeight[a.priority || 'moderate'] || 2;
      const weightB = priorityWeight[b.priority || 'moderate'] || 2;
      if (weightA !== weightB) {
        return weightB - weightA; // Higher priority first
      }
      return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
    }
    if (sortBy === 'date_asc') {
      return new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime();
    }
    if (sortBy === 'status') {
      return a.status.localeCompare(b.status);
    }
    return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
  });

  const vehicles = dbService.getVehicles();
  const getHeldQuantity = (issue: Issue) =>
    dbService
      .getEquipmentItem(issue.equipmentId || '')
      ?.assignments?.find(assignment => assignment.vehicleId === issue.vehicleId)
      ?.quantity ?? issue.reportedQuantity ?? 0;

  return (
    <div className="page space-y-6 pb-20">
      <PageHeader
        title={statusFilter === 'fixed' ? 'Resolved Issue History' : 'Active Equipment Issues & Triage'}
        subtitle="Trace problems, dispatch technicians, record repair costs, and audit resolution history."
        actions={
          <div className="flex items-center gap-2">
            {criticalIssuesCount > 0 && statusFilter !== 'fixed' && (
              <span className="badge bg-rose-100 text-rose-800 border-rose-300 font-extrabold flex items-center gap-1">
                <AlertOctagon className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                {criticalIssuesCount} Grounded
              </span>
            )}
            <span className="badge" data-status="flagged">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {openIssuesCount} currently open
            </span>
          </div>
        }
      />

      {/* 7.1 Urgent Grounding Warning Banner */}
      {criticalIssuesCount > 0 && statusFilter !== 'fixed' && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 spread items-center gap-3">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <div className="text-xs font-extrabold">
                {criticalIssuesCount} Critical Issue{criticalIssuesCount > 1 ? 's' : ''} Require Immediate Attention
              </div>
              <p className="text-[11px] text-rose-800">
                Vehicles with critical flags should remain grounded until repairs are certified by a technician.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPriorityFilter('critical');
              setSortBy('priority_critical');
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shrink-0"
          >
            View Critical Only
          </button>
        </div>
      )}

      <div className="card card-pad space-y-3">
        <div className="spread flex-col md:flex-row gap-3">
          <div className="field w-full md:max-w-xs">
            <label className="label sr-only" htmlFor="issues-search">
              Search issues
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                id="issues-search"
                type="search"
                placeholder="Search equipment, problem, tech, van..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 text-xs"
              />
            </div>
          </div>

          <div className="cluster w-full md:w-auto md:justify-end flex-wrap gap-2">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm capitalize ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              >
                {st === 'all' ? 'active' : st === 'fixed' ? 'resolved history' : st.replace('_', ' ')}
              </button>
            ))}

            {/* 7.1 Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="select btn-sm w-auto text-xs"
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical (Grounded)</option>
              <option value="moderate">Moderate</option>
              <option value="low">Low (Cosmetic)</option>
            </select>

            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="select btn-sm w-auto text-xs"
              aria-label="Filter by vehicle"
            >
              <option value="all">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="select btn-sm w-auto text-xs"
              aria-label="Sort issues"
            >
              <option value="priority_critical">Sort: Critical First</option>
              <option value="date_desc">Sort: Newest</option>
              <option value="date_asc">Sort: Oldest</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>
        </div>

        {/* 7.4 Multi-select Controls */}
        {statusFilter !== 'fixed' && sortedIssues.length > 0 && (
          <div className="spread items-center pt-2 border-t border-line text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 font-bold cursor-pointer hover:text-ink">
                <input
                  type="checkbox"
                  checked={selectedIssueIds.length === sortedIssues.length && sortedIssues.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIssueIds(sortedIssues.map((i) => i.id));
                    } else {
                      setSelectedIssueIds([]);
                    }
                  }}
                  className="rounded border-line"
                />
                <span>Select All ({sortedIssues.length})</span>
              </label>
              {selectedIssueIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIssueIds([])}
                  className="text-xs text-rose-600 hover:text-rose-700 underline"
                 aria-label="Clear selection">
                  Clear ({selectedIssueIds.length})
                </button>
              )}
            </div>

            {selectedIssueIds.length > 0 && (
              <span className="font-bold text-ink">
                {selectedIssueIds.length} issue(s) selected
              </span>
            )}
          </div>
        )}
      </div>

      <div className="stack">
        {sortedIssues.map((issue) => {
          const held = getHeldQuantity(issue);
          const required = issue.requiredQuantity;
          const isLowStock = required != null && held < required;

          return (
            <div
              key={issue.id}
              id={`issue-${issue.id}`}
              onClick={() => setSelectedIssue(issue)}
              className={`cursor-pointer rounded-[var(--radius-lg)] transition-shadow ${
                selectedIssue?.id === issue.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--bg)]' : ''
              }`}
            >
              <IssueTimeline
                issue={issue}
                onStatusUpdated={() => loadData()}
                selectable={statusFilter !== 'fixed'}
                selected={selectedIssueIds.includes(issue.id)}
                onSelectToggle={toggleSelectIssue}
              />

              {selectedIssue?.id === issue.id && (
                <div className="card card-pad mt-3">
                  <div className="spread flex-col items-stretch gap-4 lg:flex-row lg:items-end">
                    <div className="field w-full lg:max-w-xs">
                      <label htmlFor={`issue-type-${issue.id}`} className="label">
                        Issue Type
                      </label>
                      <select
                        id={`issue-type-${issue.id}`}
                        value={issue.type || 'needs_repair'}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleTypeChange(issue, event.target.value as IssueType);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="select"
                      >
                        {ISSUE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {issue.type === 'stock_low_inventory' && issue.status !== 'fixed' && (
                      <div className="stack-tight w-full lg:w-auto">
                        {required != null && (
                          <div className="row rounded border border-line" data-status={isLowStock ? 'flagged' : 'ok'}>
                            <span className="text-sm font-semibold">
                              Held {held} / Required {required}
                              {isLowStock ? ' — Low stock' : ''}
                            </span>
                          </div>
                        )}
                        <div className="cluster">
                          <button
                            type="button"
                            disabled={pendingAction !== null}
                            onClick={(event) => {
                              event.stopPropagation();
                              setQuantityModal({ action: 'update_stock', issue });
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            <PackageCheck className="h-4 w-4" aria-hidden />
                            {pendingAction === 'update_stock' ? 'Updating...' : 'Update Stock'}
                          </button>
                          <button
                            type="button"
                            disabled={pendingAction !== null}
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirmRemoveIssue(issue);
                            }}
                            className="btn btn-danger btn-sm"
                          >
                            <PackageMinus className="h-4 w-4" aria-hidden />
                            {pendingAction === 'remove_from_van' ? 'Removing...' : 'Remove from Van'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="cluster justify-between flex-wrap gap-2 pt-2 border-t border-line mt-4">
                    {issue.equipmentId ? (
                      <Link
                        href={`/equipment?id=${encodeURIComponent(issue.equipmentId)}`}
                        onClick={(event) => event.stopPropagation()}
                        className="btn btn-secondary btn-sm"
                      >
                        <Wrench className="h-3.5 w-3.5" aria-hidden />
                        See equipment
                        <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                      </Link>
                    ) : (
                      <span className="text-[11px] text-ink-faint self-center">
                        No linked equipment unit
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIssueToDelete(issue);
                      }}
                      className="btn btn-ghost btn-sm text-[var(--critical)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete issue
                    </button>
                  </div>
                  <div className="divider mt-4 mb-4" />
                  <RecentInspectors vehicleId={selectedIssue.vehicleId} />
                </div>
              )}
            </div>
          );
        })}

        {sortedIssues.length === 0 && (
          <div className="card card-pad">
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12 text-[var(--ok)]" aria-hidden />}
              title="No issues found matching query"
            >
              Try resetting search keywords, status, or priority filters.
            </EmptyState>
          </div>
        )}
      </div>

      {/* 7.4 Sticky Batch Action Bottom Bar */}
      {selectedIssueIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-ink text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-line-strong animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="text-xs font-bold">
            {selectedIssueIds.length} Issue{selectedIssueIds.length > 1 ? 's' : ''} Selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBatchResolveModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Resolve Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIssueIds([])}
              className="p-1 rounded-lg text-ink-muted hover:text-white"
              title="Cancel Selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 7.4 Batch Resolve Modal */}
      {showBatchResolveModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowBatchResolveModal(false)}
        >
          <div
            className="card card-pad max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-resolve-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="batch-resolve-title" className="card-title text-base font-extrabold mb-1">
              Batch Resolve {selectedIssueIds.length} Issues
            </h3>
            <p className="hint text-xs mb-4">
              Mark all selected issues as fixed with a permanent audit note and optional repair cost.
            </p>

            <form onSubmit={handleBatchResolveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="label font-bold text-ink mb-1 block">
                  Batch Resolution Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Completed routine fleet maintenance batch; restocked microfibers and replaced worn fittings."
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="textarea text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold text-ink mb-1 block">Total Batch Repair Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 120.00"
                    value={batchRepairCost}
                    onChange={(e) => setBatchRepairCost(e.target.value)}
                    className="input text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="label font-bold text-ink mb-1 block">Shared Part # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. MISC-RESTOCK"
                    value={batchPartNumber}
                    onChange={(e) => setBatchPartNumber(e.target.value)}
                    className="input text-xs font-mono"
                  />
                </div>
              </div>

              <div className="cluster justify-end pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowBatchResolveModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBatchSubmitting}
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isBatchSubmitting ? 'Resolving Issues...' : `Resolve ${selectedIssueIds.length} Issues`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={issueToDelete !== null}
        title={issueToDelete ? `Delete “${issueToDelete.title}”?` : 'Delete issue?'}
        message="This permanently removes the issue and its audit trail. Use this for accidental or duplicate reports. Linked equipment will be marked working again if this was its only open issue."
        confirmLabel={deleteLoading ? 'Deleting...' : 'Delete issue'}
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => !deleteLoading && setIssueToDelete(null)}
        onConfirm={() => void handleDeleteIssue()}
      />

      <ConfirmModal
        open={confirmRemoveIssue !== null}
        title="Return equipment to shop?"
        message="Return this equipment from the van to shop inventory?"
        confirmLabel="Continue"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          if (!confirmRemoveIssue) return;
          setQuantityModal({ action: 'remove_from_van', issue: confirmRemoveIssue });
          setConfirmRemoveIssue(null);
        }}
        onCancel={() => setConfirmRemoveIssue(null)}
      />

      <QuantityModal
        open={quantityModal?.action === 'update_stock'}
        title="Update stock"
        description="Enter the actual quantity currently on the van."
        initialValue={quantityModal?.issue.reportedQuantity ?? 0}
        min={0}
        onConfirm={handleUpdateQuantityConfirm}
        onCancel={closeQuantityModal}
      />

      <RemoveStockQuantityModal
        open={quantityModal?.action === 'remove_from_van'}
        onConfirm={handleRemoveQuantityConfirm}
        onCancel={closeQuantityModal}
      />
    </div>
  );
}

function RemoveStockQuantityModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: (qty: number | undefined) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(null);
      onConfirm(undefined);
      return;
    }
    const result = parseQuantityInput(value, { min: 0 });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onConfirm(result.value);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="card card-pad max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-quantity-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="remove-quantity-modal-title" className="card-title mb-2">
          Remove from van
        </h2>
        <p className="text-sm text-ink-muted mb-4">Leave blank to remove all</p>
        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <label className="label" htmlFor="remove-quantity-modal-input">
              Quantity
            </label>
            <input
              id="remove-quantity-modal-input"
              type="number"
              min={0}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              className="input"
              aria-invalid={error ? true : undefined}
              autoFocus
            />
            {error ? (
              <p className="hint" data-status="critical">
                {error}
              </p>
            ) : null}
          </div>
          <div className="cluster justify-end">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
