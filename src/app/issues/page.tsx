'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  PackageCheck,
  PackageMinus,
  Trash2,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Issue, IssueType } from '@/types';
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
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [pendingAction, setPendingAction] = useState<'update_stock' | 'remove_from_van' | null>(null);
  const [confirmRemoveIssue, setConfirmRemoveIssue] = useState<Issue | null>(null);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  const activeIssues = (statusFilter === 'fixed'
    ? issues.filter(iss => iss.status === 'fixed')
    : issues.filter(iss => iss.status !== 'fixed')
  ).sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());

  const filteredIssues = activeIssues.filter(iss => {
    const matchesSearch =
      iss.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.reportedByName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || iss.status === statusFilter;
    const matchesVehicle = vehicleFilter === 'all' || iss.vehicleId === vehicleFilter;

    return matchesSearch && matchesStatus && matchesVehicle;
  });

  const vehicles = dbService.getVehicles();
  const getHeldQuantity = (issue: Issue) =>
    dbService
      .getEquipmentItem(issue.equipmentId || '')
      ?.assignments?.find(assignment => assignment.vehicleId === issue.vehicleId)
      ?.quantity ?? issue.reportedQuantity ?? 0;

  return (
    <div className="page">
      <PageHeader
        title={statusFilter === 'fixed' ? 'Resolved Issue History' : 'Active Equipment Issues'}
        subtitle="Trace problems, update stock, and audit resolution history."
        actions={
          <span className="badge" data-status="flagged">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {openIssuesCount} currently open
          </span>
        }
      />

      <div className="card card-pad">
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
                placeholder="Search equipment, problem, van, reporter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          <div className="cluster w-full md:w-auto md:justify-end">
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

            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="select btn-sm w-auto"
              aria-label="Filter by vehicle"
            >
              <option value="all">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="stack">
        {filteredIssues.map((issue) => {
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
              <IssueTimeline issue={issue} onStatusUpdated={() => loadData()} />
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
                  <div className="cluster justify-end pt-2 border-t border-line mt-4">
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

        {filteredIssues.length === 0 && (
          <div className="card card-pad">
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12 text-[var(--ok)]" aria-hidden />}
              title="No issues found matching query"
            >
              Try resetting search keywords or status filter.
            </EmptyState>
          </div>
        )}
      </div>

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
