'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Truck,
  ArrowLeft,
  QrCode,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  User,
  History,
  Plus,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, Equipment, Inspection, Issue } from '@/types';
import { VehicleStatusBadge, InspectionStatusBadge, EquipmentStatusBadge, IssueStatusBadge } from '@/components/StatusBadges';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { IssueTimeline } from '@/components/IssueTimeline';
import { RecentInspectors } from '@/components/RecentInspectors';
import { QuantityModal } from '@/components/QuantityModal';
import { EmptyState } from '@/components/EmptyState';

export default function VehicleDetailClient() {
  const searchParams = useSearchParams();
  const vehicleId = searchParams?.get('id') || '';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'equipment' | 'qr' | 'issues'>('timeline');
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'existing' | 'new'>('existing');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [assignQuantity, setAssignQuantity] = useState('1');
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentTag, setNewEquipmentTag] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [returnModal, setReturnModal] = useState<{ item: Equipment; max: number } | null>(null);
  const [parDrafts, setParDrafts] = useState<Record<string, string>>({});
  const [parSavingId, setParSavingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!vehicleId) {
      setIsLoading(false);
      setVehicle(null);
      return;
    }

    try {
      setIsLoading(true);
      let v = dbService.getVehicle(vehicleId) || dbService.getVehicleByQR(vehicleId);
      if (!v) {
        v = (await dbService.fetchVehicleAsync(vehicleId)) || undefined;
      }

      if (v) {
        setVehicle(v);
        const vehicleEquipment = dbService.getEquipmentForVehicle(v.id);
        setEquipment(vehicleEquipment);
        setInspections(dbService.getInspectionsForVehicle(v.id));
        setIssues(dbService.getIssuesForVehicle(v.id));
        setParDrafts(prev => {
          const next = { ...prev };
          for (const item of vehicleEquipment) {
            const assignment = item.assignments?.find(candidate => candidate.vehicleId === v!.id);
            if (!(item.id in next)) {
              next[item.id] = assignment?.requiredQuantity != null ? String(assignment.requiredQuantity) : '';
            }
          }
          return next;
        });
      } else {
        setVehicle(null);
      }
    } catch (error) {
      console.error('Error loading vehicle details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, [loadData]);

  const getVehicleAllocation = (item: Equipment) => {
    return item.assignments?.find(assignment => assignment.vehicleId === vehicle?.id)?.quantity
      || (item.vehicleId === vehicle?.id ? 1 : 0);
  };

  const handleReturnConfirm = async (amount: number) => {
    if (!returnModal || !vehicle) return;
    try {
      await dbService.returnEquipmentToShop(returnModal.item.id, vehicle.id, amount);
      setReturnModal(null);
    } catch (error: any) {
      alert(error.message || 'Could not return equipment to the shop.');
    }
  };

  const saveRequiredQuantity = async (item: Equipment) => {
    if (!vehicle) return;
    const draft = parDrafts[item.id] ?? '';
    const requiredQuantity = draft === '' ? 0 : Number(draft);
    if (!Number.isInteger(requiredQuantity) || requiredQuantity < 0) {
      alert('Enter a non-negative whole number.');
      return;
    }
    try {
      setParSavingId(item.id);
      await dbService.setAssignmentRequiredQuantity(item.id, vehicle.id, requiredQuantity);
    } catch (error: any) {
      alert(error.message || 'Could not update the required quantity.');
    } finally {
      setParSavingId(null);
    }
  };

  const openAssignModal = () => {
    setAssignMode('existing');
    setSelectedInventoryId('');
    setAssignQuantity('1');
    setNewEquipmentName('');
    setNewEquipmentTag('');
    setAssignError('');
    setAssignModalOpen(true);
  };

  const submitAssignment = async () => {
    if (!vehicle) return;

    try {
      setAssignLoading(true);
      setAssignError('');

      if (assignMode === 'existing') {
        if (!selectedInventoryId) throw new Error('Select an inventory item.');
        const amount = Number(assignQuantity);
        if (!Number.isInteger(amount) || amount <= 0 || amount > selectedInventoryAvailable) {
          throw new Error(`Enter a whole number from 1 to ${selectedInventoryAvailable}.`);
        }
        await dbService.transferEquipmentQuantity(selectedInventoryId, vehicle.id, amount, null);
      } else {
        if (!newEquipmentName.trim()) throw new Error('Enter equipment name.');
        await dbService.createEquipment({
          name: newEquipmentName.trim(),
          assetTag: newEquipmentTag.trim() || null,
          vehicleId: vehicle.id,
          category: 'equipment',
          kind: 'reusable',
          totalQuantity: 1,
          status: 'working'
        });
      }

      setAssignModalOpen(false);
    } catch (error: any) {
      setAssignError(error.message || 'Could not assign equipment.');
    } finally {
      setAssignLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="stack items-center text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink border-t-transparent" aria-hidden />
          <p className="text-xs font-bold text-ink-muted">Loading Vehicle Profile...</p>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="page max-w-md mx-auto mt-8">
        <div className="card card-pad text-center">
          <EmptyState
            icon={<Truck className="h-12 w-12 text-ink-faint" aria-hidden />}
            title="Vehicle Not Found"
            action={
              <Link href="/vehicles" className="btn btn-primary">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Return to Vehicles List
              </Link>
            }
          >
            {vehicleId ? `No vehicle was found with ID "${vehicleId}".` : 'No vehicle was specified.'}
          </EmptyState>
        </div>
      </div>
    );
  }

  type TimelineItem =
    | { type: 'inspection'; date: string; data: Inspection }
    | { type: 'issue'; date: string; data: Issue };

  const timelineItems: TimelineItem[] = [
    ...inspections.map(i => ({ type: 'inspection' as const, date: i.submittedAt, data: i })),
    ...issues.map(iss => ({ type: 'issue' as const, date: iss.reportedAt, data: iss }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const recentTimelineItems = timelineItems.filter(item => new Date(item.date) >= recentCutoff);
  const visibleTimelineItems = showAllTimeline ? timelineItems : recentTimelineItems;
  const hasOlderTimeline = recentTimelineItems.length < timelineItems.length;
  const unassignedInventory = dbService.getAssignableFromShop();
  const selectedInventory = unassignedInventory.find(item => item.id === selectedInventoryId);
  const selectedInventoryAvailable = selectedInventory ? (selectedInventory.availableQuantity ?? 0) : 0;

  return (
    <div className="page max-w-full overflow-x-hidden">
      <div className="page-head">
        <div className="cluster items-start min-w-0">
          <Link
            href="/vehicles"
            className="btn btn-secondary btn-sm shrink-0"
            aria-label="Back to vehicles"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <div className="cluster flex-wrap">
              <h1 className="page-title break-words">{vehicle.vehicleNumber}</h1>
              <span className="unit-tag rounded border border-line px-2 py-0.5">{vehicle.licensePlate}</span>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
            <p className="page-sub break-words">{vehicle.name}</p>
          </div>
        </div>
        <Link
          href={`/inspect?id=${encodeURIComponent(vehicle.id)}`}
          className="btn btn-primary self-start sm:self-auto"
        >
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          Perform Inspection
        </Link>
      </div>

      <div className="grid-auto" style={{ '--min': '12rem' } as React.CSSProperties}>
        <div className="card card-pad">
          <div className="stat">
            <span className="stat-label">Current Operator</span>
            <span className="stat-value text-base cluster">
              <User className="h-4 w-4 text-[var(--info)]" aria-hidden />
              {vehicle.currentUserName || 'None (In Depot)'}
            </span>
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat">
            <span className="stat-label">Last Inspection</span>
            <span className="mt-1 block">
              <InspectionStatusBadge status={vehicle.lastInspectionStatus} />
            </span>
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat">
            <span className="stat-label">Assigned Equipment</span>
            <span className="stat-value text-base cluster">
              <Wrench className="h-4 w-4 text-ink-muted" aria-hidden />
              {equipment.length} Tools/Gear
            </span>
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat" data-status={issues.filter(i => i.status !== 'fixed').length > 0 ? 'flagged' : 'ok'}>
            <span className="stat-label">Open Issues</span>
            <span className="stat-value text-base cluster">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {issues.filter(i => i.status !== 'fixed').length} Active
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-line overflow-x-auto">
        <div className="cluster gap-4 min-w-max px-1">
          {[
            { id: 'timeline', label: 'Chronological Timeline', icon: History },
            { id: 'equipment', label: `Assigned Equipment (${equipment.length})`, icon: Wrench },
            { id: 'issues', label: `Issues & Resolutions (${issues.length})`, icon: AlertTriangle },
            { id: 'qr', label: 'QR Code & Tag', icon: QrCode },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`cluster min-h-12 border-b-2 pb-3 text-sm font-bold transition-all -mb-px whitespace-nowrap ${
                  isActive
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'timeline' && (
        <div className="card card-pad stack">
          <div className="spread flex-col sm:flex-row gap-3 border-b border-line pb-4">
            <div className="min-w-0">
              <h2 className="card-title">Vehicle Operational Timeline</h2>
              <p className="hint leading-relaxed">
                {showAllTimeline
                  ? 'Complete append-only history of every inspection result and equipment issue.'
                  : 'Recent history from the last 30 days. Older records remain available below.'}
              </p>
            </div>
            {hasOlderTimeline && (
              <button
                type="button"
                onClick={() => setShowAllTimeline(current => !current)}
                className="btn btn-ghost btn-sm whitespace-nowrap"
              >
                {showAllTimeline ? 'Show recent only' : `Show older history (${timelineItems.length - recentTimelineItems.length})`}
              </button>
            )}
          </div>

          <RecentInspectors vehicleId={vehicle.id} />

          <div className="relative pl-6 stack before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line before:content-['']">
            {visibleTimelineItems.map((item) => {
              if (item.type === 'inspection') {
                const insp = item.data;
                const isPassed = insp.status === 'passed';
                return (
                  <div key={insp.id} className="relative">
                    <div
                      className={`absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-[var(--surface)] ${
                        isPassed ? 'border-[var(--ok)]' : 'border-[var(--amber)]'
                      }`}
                    >
                      <div className={`h-1.5 w-1.5 rounded-full ${isPassed ? 'bg-[var(--ok)]' : 'bg-[var(--amber)]'}`} />
                    </div>
                    <div className="card card-pad bg-[var(--surface-alt)] stack-tight">
                      <div className="spread flex-wrap gap-2">
                        <div className="cluster">
                          <span className="text-xs font-bold">Daily Inspection Submitted</span>
                          <InspectionStatusBadge status={insp.status} />
                        </div>
                        <span className="unit-tag">
                          {new Date(insp.submittedAt).toLocaleDateString()} at{' '}
                          {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted leading-relaxed break-words">
                        Completed by <strong>{insp.userName}</strong> ({insp.userEmail})
                      </p>
                      {insp.generalNotes ? (
                        <p className="text-sm italic text-ink-muted card card-pad bg-[var(--surface)] break-words leading-relaxed">
                          &ldquo;{insp.generalNotes}&rdquo;
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              }

              const iss = item.data;
              return (
                <div key={iss.id} className="relative">
                  <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--critical)] bg-[var(--surface)]">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--critical)]" />
                  </div>
                  <div className="card card-pad bg-[var(--amber-wash)] stack-tight">
                    <div className="spread flex-wrap gap-2">
                      <div className="cluster">
                        <span className="text-xs font-bold text-[var(--amber-text)]">
                          Issue Reported: {iss.equipmentName}
                        </span>
                        <IssueStatusBadge status={iss.status} />
                      </div>
                      <span className="unit-tag">{new Date(iss.reportedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-ink break-words leading-relaxed">{iss.description}</p>
                    <div className="hint">
                      Reported by <strong>{iss.reportedByName}</strong>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleTimelineItems.length === 0 && (
              <p className="hint py-4">
                {timelineItems.length === 0
                  ? 'No inspection or issue records logged for this vehicle yet.'
                  : 'No recent records. Show older history to view the complete timeline.'}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="card card-pad stack">
          <div className="spread flex-col sm:flex-row gap-3 border-b border-line pb-3">
            <div className="min-w-0">
              <h2 className="card-title">Vehicle Inventory & Equipment</h2>
              <p className="hint leading-relaxed">
                All tools, machinery, and supplies dedicated to {vehicle.vehicleNumber}.
              </p>
            </div>
            <button type="button" onClick={openAssignModal} className="btn btn-primary w-full sm:w-auto">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Assign Equipment
            </button>
          </div>

          <div className="grid-auto">
            {equipment.map((eq) => {
              const assignment = eq.assignments?.find(candidate => candidate.vehicleId === vehicle.id);
              const heldQty = getVehicleAllocation(eq);
              const requiredLabel = assignment?.requiredQuantity ?? '—';

              return (
                <div key={eq.id} className="card card-pad stack-tight">
                  <div className="spread items-start gap-3">
                    <div className="cluster items-start min-w-0">
                      <span className="icon-tile" aria-hidden>
                        <Wrench className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="card-title break-words">{eq.name}</h3>
                        <span className="badge mt-1">{eq.category}</span>
                        <p className="hint mt-1 break-words">
                          {eq.assetTag ? `Tag #${eq.assetTag}` : 'No serial / tag'}
                        </p>
                        <p className="text-sm font-semibold mt-2">
                          Held {heldQty} / Required {requiredLabel}
                        </p>
                      </div>
                    </div>
                    <EquipmentStatusBadge status={eq.status} />
                  </div>

                  <div className="field">
                    <label className="label" htmlFor={`par-${eq.id}`}>
                      Required (par) quantity
                    </label>
                    <div className="cluster">
                      <input
                        id={`par-${eq.id}`}
                        type="number"
                        min={0}
                        step={1}
                        value={parDrafts[eq.id] ?? ''}
                        onChange={(e) => setParDrafts(prev => ({ ...prev, [eq.id]: e.target.value }))}
                        onBlur={() => void saveRequiredQuantity(eq)}
                        className="input max-w-[8rem]"
                        placeholder="—"
                      />
                      <button
                        type="button"
                        onClick={() => void saveRequiredQuantity(eq)}
                        disabled={parSavingId === eq.id}
                        className="btn btn-secondary btn-sm"
                      >
                        {parSavingId === eq.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>

                  <div className="card-foot mt-0 pt-3">
                    <span className="hint">
                      {eq.status === 'working' ? 'Assigned to' : 'In use by'} {vehicle.vehicleNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReturnModal({ item: eq, max: heldQty })}
                      className="btn btn-primary btn-sm"
                    >
                      Return to shop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {equipment.length === 0 && (
            <EmptyState
              icon={<Wrench className="h-10 w-10 text-ink-faint" aria-hidden />}
              title="No equipment assigned"
            >
              Use Assign Equipment to move inventory from the shop or create a new item.
            </EmptyState>
          )}
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="stack">
          {issues.map((issue) => (
            <IssueTimeline key={issue.id} issue={issue} onStatusUpdated={loadData} />
          ))}

          {issues.length === 0 && (
            <div className="card card-pad">
              <EmptyState
                icon={<CheckCircle2 className="h-12 w-12 text-[var(--ok)]" aria-hidden />}
                title="No issues reported"
              >
                All equipment on this vehicle is operating in standard condition.
              </EmptyState>
            </div>
          )}
        </div>
      )}

      {activeTab === 'qr' && (
        <div className="max-w-md mx-auto">
          <QRCodeDisplay vehicle={vehicle} />
        </div>
      )}

      {assignModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAssignModalOpen(false)}
        >
          <div
            className="card card-pad w-full max-w-lg max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-equipment-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="assign-equipment-title" className="card-title mb-1">
              Assign Equipment to {vehicle.vehicleNumber}
            </h2>
            <p className="hint mb-4 leading-relaxed">
              Select from in-shop inventory or create and assign a new asset.
            </p>

            <div className="stack">
              <label className="card card-pad cluster items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={assignMode === 'existing'}
                  onChange={() => setAssignMode('existing')}
                  className="mt-1"
                />
                <div className="flex-1 stack-tight">
                  <span className="text-sm font-bold">Select from existing inventory</span>
                  <select
                    value={selectedInventoryId}
                    onChange={(e) => {
                      setSelectedInventoryId(e.target.value);
                      setAssignQuantity('1');
                    }}
                    className="select"
                    disabled={assignMode !== 'existing'}
                  >
                    <option value="">Choose item...</option>
                    {unassignedInventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.availableQuantity ?? 0} Unassigned)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={selectedInventoryAvailable}
                    value={assignQuantity}
                    disabled={assignMode !== 'existing'}
                    onChange={(e) => setAssignQuantity(e.target.value)}
                    className="input disabled:opacity-50"
                    placeholder="Quantity to assign"
                  />
                </div>
              </label>

              <label className="card card-pad cluster items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={assignMode === 'new'}
                  onChange={() => setAssignMode('new')}
                  className="mt-1"
                />
                <div className="flex-1 stack-tight">
                  <span className="text-sm font-bold">Create and assign new item</span>
                  <input
                    value={newEquipmentName}
                    onChange={(e) => setNewEquipmentName(e.target.value)}
                    disabled={assignMode !== 'new'}
                    className="input disabled:opacity-50"
                    placeholder="Equipment name"
                  />
                  <input
                    value={newEquipmentTag}
                    onChange={(e) => setNewEquipmentTag(e.target.value)}
                    disabled={assignMode !== 'new'}
                    className="input disabled:opacity-50"
                    placeholder="Serial / asset tag"
                  />
                </div>
              </label>
            </div>

            {assignError ? (
              <p className="hint mt-3 rounded border border-[var(--critical)] bg-[var(--critical-wash)] p-2 text-[var(--critical)]">
                {assignError}
              </p>
            ) : null}

            <div className="cluster justify-end mt-5">
              <button type="button" onClick={() => setAssignModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAssignment()}
                disabled={assignLoading}
                className="btn btn-primary"
              >
                {assignLoading ? 'Saving...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      <QuantityModal
        open={returnModal !== null}
        title={returnModal ? `Return ${returnModal.item.name} to shop` : 'Return to shop'}
        description={
          returnModal
            ? `How many units should leave ${vehicle.vehicleNumber}? (max ${returnModal.max})`
            : 'Enter quantity to return.'
        }
        initialValue={returnModal?.max ?? 1}
        min={1}
        max={returnModal?.max}
        onConfirm={handleReturnConfirm}
        onCancel={() => setReturnModal(null)}
      />
    </div>
  );
}
