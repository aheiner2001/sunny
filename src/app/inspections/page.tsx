'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ClipboardCheck,
  Search,
  Truck,
  ChevronDown,
  ChevronUp,
  Trash2,
  Gauge,
  Fuel,
  PenLine,
  Image as ImageIcon,
  WifiOff,
  RefreshCw,
  X,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection } from '@/types';
import { InspectionStatusBadge } from '@/components/StatusBadges';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default function InspectionsPage() {
  const { role, user } = useAuth();
  const searchParams = useSearchParams();
  const openId = searchParams?.get('id') || '';
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'pretrip' | 'return'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'status' | 'vehicle' | 'driver'>('date_desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [requestTarget, setRequestTarget] = useState<Inspection | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);

  const loadData = () => {
    setInspections(dbService.getInspections());
    setOfflineCount(dbService.getOfflineInspections().length);
  };

  const handleSyncOffline = async () => {
    try {
      setIsSyncing(true);
      const synced = await dbService.syncOfflineInspections();
      loadData();
      alert(`Synchronized ${synced} offline inspection(s)!`);
    } catch (e: any) {
      alert(`Sync error: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteInspection = async (e: React.MouseEvent, inspectionId: string, vehicleNumber: string) => {
    e.stopPropagation();
    if (role !== 'manager') return;
    if (confirm(`Are you sure you want to delete this inspection record for ${vehicleNumber}?`)) {
      await dbService.deleteInspection(inspectionId);
    }
  };

  const openDeleteRequest = (e: React.MouseEvent, insp: Inspection) => {
    e.stopPropagation();
    setRequestNote('');
    setRequestTarget(insp);
  };

  const submitDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTarget || !user) return;
    try {
      setRequestBusy(true);
      await dbService.requestInspectionDelete(requestTarget.id, { id: user.id, name: user.name }, requestNote);
      setRequestTarget(null);
      setRequestNote('');
    } catch (err: any) {
      alert(err.message || 'Could not send delete request');
    } finally {
      setRequestBusy(false);
    }
  };

  const pendingDeletes = inspections.filter(i => Boolean(i.deleteRequestedAt));

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  useEffect(() => {
    if (!openId) return;
    setExpandedId(openId);
    setStatusFilter('all');
    setVehicleFilter('all');
    setSearchTerm('');
  }, [openId]);

  useEffect(() => {
    if (!expandedId) return;
    const el = document.getElementById(`inspection-${expandedId}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [expandedId, inspections]);

  const filteredInspections = inspections.filter((insp) => {
    const matchesSearch =
      insp.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.dateString.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || insp.status === statusFilter;
    const kind = insp.kind === 'return' ? 'return' : 'pretrip';
    const matchesKind = kindFilter === 'all' || kind === kindFilter;
    const matchesVehicle = vehicleFilter === 'all' || insp.vehicleId === vehicleFilter;

    return matchesSearch && matchesStatus && matchesKind && matchesVehicle;
  });

  const sortedInspections = [...filteredInspections].sort((a, b) => {
    if (sortBy === 'date_asc') {
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    }
    if (sortBy === 'status') {
      return a.status.localeCompare(b.status);
    }
    if (sortBy === 'vehicle') {
      return a.vehicleNumber.localeCompare(b.vehicleNumber);
    }
    if (sortBy === 'driver') {
      return a.userName.localeCompare(b.userName);
    }
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  const vehicles = dbService.getVehicles();

  return (
    <div className="page">
      {role === 'manager' && pendingDeletes.length > 0 && (
        <div className="card card-pad" data-status="flagged">
          <p className="text-sm font-bold">{pendingDeletes.length} delete request{pendingDeletes.length === 1 ? '' : 's'} waiting</p>
          <p className="hint">Open a flagged row to approve or deny.</p>
        </div>
      )}

      <PageHeader
        title="Inspection History"
        subtitle="Complete archive of all daily pre-trip and post-trip vehicle checklists."
        actions={
          <Link href="/scan" className="btn btn-primary">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            New Inspection
          </Link>
        }
      />

      {/* Offline Sync Banner */}
      {offlineCount > 0 && (
        <div className="card card-pad bg-blue-50 border-blue-200 spread items-center">
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <div className="text-sm font-bold text-blue-900">
                {offlineCount} Offline Inspection{offlineCount > 1 ? 's' : ''} Stored Locally
              </div>
              <p className="text-xs text-blue-700">
                Records captured while offline will sync automatically or can be uploaded now.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncOffline}
            disabled={isSyncing}
            className="btn btn-primary btn-sm shrink-0 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      )}

      <div className="card card-pad">
        <div className="spread flex-col md:flex-row gap-3">
          <div className="field w-full md:max-w-xs">
            <label className="label sr-only" htmlFor="inspections-search">
              Search inspections
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                id="inspections-search"
                type="search"
                placeholder="Search driver, van number, date (YYYY-MM-DD)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          <div className="cluster w-full md:w-auto md:justify-end">
            {([
              ['all', 'All kinds'],
              ['pretrip', 'Pre-trip'],
              ['return', 'Return'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`btn btn-sm ${kindFilter === k ? 'bg-surface-sunk text-ink font-semibold border border-line' : 'btn-secondary'}`}
              >
                {label}
              </button>
            ))}
            {([
              ['all', 'All'],
              ['passed', 'Passed'],
              ['issues_found', 'Issues found'],
              ['in_progress', 'In progress'],
            ] as const).map(([st, label]) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm ${statusFilter === st ? 'bg-surface-sunk text-ink font-semibold border border-line' : 'btn-secondary'}`}
              >
                {label}
              </button>
            ))}

            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="select btn-sm w-auto"
              aria-label="Filter by vehicle"
            >
              <option value="all">All Vans</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="select btn-sm w-auto"
              aria-label="Sort inspections"
            >
              <option value="date_desc">Sort: Newest first</option>
              <option value="date_asc">Sort: Oldest first</option>
              <option value="status">Sort: Status</option>
              <option value="vehicle">Sort: Vehicle</option>
              <option value="driver">Sort: Driver</option>
            </select>
          </div>
        </div>
      </div>

      {sortedInspections.length > 0 && (
      <div className="card overflow-hidden">
        {(() => {
          const groups: { day: string; items: typeof sortedInspections }[] = [];
          for (const insp of sortedInspections) {
            const day = new Date(insp.submittedAt).toLocaleDateString();
            const last = groups[groups.length - 1];
            if (!last || last.day !== day) groups.push({ day, items: [insp] });
            else last.items.push(insp);
          }
          return groups.map((group) => (
            <div key={group.day}>
              <div className="px-4 py-2 bg-[var(--surface-alt)] border-b border-line text-xs font-bold text-ink-muted">
                {group.day}
              </div>
              {group.items.map((insp) => {
          const isExpanded = expandedId === insp.id;

          return (
            <div key={insp.id} id={`inspection-${insp.id}`} className="border-b border-line last:border-b-0">
              <div
                onClick={() => setExpandedId(isExpanded ? null : insp.id)} aria-expanded={isExpanded}
                className="card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--surface-alt)] transition-colors select-none"
              >
                <div className="cluster items-center">
                  <span className="icon-tile" data-status="info" aria-hidden>
                    <Truck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="cluster">
                      <span className="font-bold text-sm">{insp.vehicleNumber}</span>
                      <InspectionStatusBadge status={insp.status} />
                      {insp.kind === 'return' && (
                        <span className="badge" data-status="info">Return</span>
                      )}
                      {insp.deleteRequestedAt && (
                        <span className="badge" data-status="flagged">Delete requested</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Submitted by <strong>{insp.userName}</strong> ({insp.userEmail})
                    </p>
                  </div>
                </div>

                <div className="cluster justify-between sm:justify-end">
                  <div className="text-left sm:text-right text-xs">
                    <div className="font-bold">{new Date(insp.submittedAt).toLocaleDateString()}</div>
                    <div className="text-2xs text-ink-faint">
                      {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {role === 'manager' && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteInspection(e, insp.id, insp.vehicleNumber)}
                    className="btn btn-ghost btn-sm text-[var(--critical)]"
                    title="Delete Inspection"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                  )}
                  {role !== 'manager' && user?.id === insp.userId && !insp.deleteRequestedAt && (
                  <button
                    type="button"
                    onClick={(e) => openDeleteRequest(e, insp)}
                    className="btn btn-ghost btn-sm text-ink-muted"
                    title="Request delete"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                  )}

                  <span className="icon-tile text-ink-faint" aria-hidden>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="card-pad pt-0 border-t border-line bg-[var(--surface-alt)] stack">
                  {insp.deleteRequestedAt && (
                    <div className="card card-pad text-xs" data-status="flagged">
                      <p className="font-bold">Delete requested by {insp.deleteRequestedByName}</p>
                      {insp.deleteRequestNote ? <p className="mt-1 text-ink-muted">&ldquo;{insp.deleteRequestNote}&rdquo;</p> : null}
                    </div>
                  )}
                  {/* Vehicle Readings (Odometer & Fuel) */}
                  {(insp.odometer !== undefined && insp.odometer !== null || insp.fuelLevel !== undefined && insp.fuelLevel !== null) && (
                    <div className="card card-pad text-xs bg-surface flex flex-wrap gap-4 items-center">
                      {insp.odometer !== undefined && insp.odometer !== null && (
                        <div className="flex items-center gap-1.5 font-bold text-ink">
                          <Gauge className="w-3.5 h-3.5 text-ink-muted" />
                          <span>Odometer: {insp.odometer.toLocaleString()} mi</span>
                        </div>
                      )}
                      {insp.fuelLevel !== undefined && insp.fuelLevel !== null && (
                        <div className="flex items-center gap-1.5 font-bold text-ink">
                          <Fuel className="w-3.5 h-3.5 text-ink-muted" />
                          <span>Fuel Level: {insp.fuelLevel}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {insp.generalNotes && (
                    <div className="card card-pad text-xs">
                      <span className="eyebrow mb-1">Operator Notes</span>
                      <p className="text-ink-muted italic">&ldquo;{insp.generalNotes}&rdquo;</p>
                    </div>
                  )}

                  {/* Attached Overview Photos */}
                  {insp.photoUrls && insp.photoUrls.length > 0 && (
                    <div>
                      <h4 className="eyebrow mb-2 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Attached Photos
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {insp.photoUrls.map((pUrl, pIdx) => (
                          <img
                            key={pIdx}
                            src={pUrl}
                            alt={`Inspection capture ${pIdx + 1}`}
                            className="w-20 h-20 object-cover rounded-xl border border-line shadow-xs"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {insp.responses && insp.responses.length > 0 ? (
                    <div>
                      <h4 className="eyebrow mb-2">Checklist Responses</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {insp.responses.map((resp, idx) => (
                          <div
                            key={idx}
                            className={`card card-pad text-xs space-y-1.5 ${
                              resp.isFlagged ? 'bg-[var(--hivis-wash)]' : ''
                            }`}
                            data-status={resp.isFlagged ? 'flagged' : 'ok'}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate pr-2 font-medium">{resp.questionText}</span>
                              <span className="badge" data-status={resp.isFlagged ? 'flagged' : 'ok'}>
                                {resp.value}
                              </span>
                            </div>
                            {resp.notes && (
                              <p className="text-[11px] text-ink-muted bg-[var(--hivis-wash)] p-1.5 rounded">
                                {resp.notes}
                              </p>
                            )}
                            {resp.photoUrl && (
                              <div className="pt-1">
                                <img
                                  src={resp.photoUrl}
                                  alt="Issue photo"
                                  className="w-16 h-16 object-cover rounded-lg border border-line"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-faint">Standard checklist verified without anomalies.</p>
                  )}

                  {/* Operator Signature Display */}
                  {insp.signatureBase64 && (
                    <div className="card card-pad bg-surface border border-line">
                      <div className="text-[10px] font-bold text-ink-faint uppercase tracking-wider flex items-center gap-1 mb-1">
                        <PenLine className="w-3 h-3" /> Certified Operator Signature
                      </div>
                      <img
                        src={insp.signatureBase64}
                        alt="Operator signature"
                        className="h-14 object-contain bg-white border border-line rounded p-1"
                      />
                    </div>
                  )}

                  <div className="spread pt-2">
                    <Link
                      href={`/vehicles/detail?id=${encodeURIComponent(insp.vehicleId)}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View Vehicle History
                    </Link>

                    {role === 'manager' && insp.deleteRequestedAt && (
                      <div className="cluster gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void dbService.approveInspectionDelete(insp.id); }}
                          className="btn btn-danger btn-sm"
                        >
                          Approve delete
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void dbService.denyInspectionDelete(insp.id); }}
                          className="btn btn-secondary btn-sm"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                    {role === 'manager' && !insp.deleteRequestedAt && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteInspection(e, insp.id, insp.vehicleNumber)}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete Record
                      </button>
                    )}
                    {role !== 'manager' && user?.id === insp.userId && !insp.deleteRequestedAt && (
                      <button
                        type="button"
                        onClick={(e) => openDeleteRequest(e, insp)}
                        className="btn btn-ghost btn-sm text-[var(--critical)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Request delete
                      </button>
                    )}
                    {role !== 'manager' && insp.deleteRequestedAt && user?.id === insp.userId && (
                      <span className="text-xs text-ink-muted">Waiting on manager</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
              })}
            </div>
          ));
        })()}
      </div>
      )}

        {sortedInspections.length === 0 && (
          <div className="card card-pad">
            <EmptyState
              icon={<ClipboardCheck className="h-12 w-12 text-ink-faint" aria-hidden />}
              title="No inspections found"
            >
              Try modifying the search filters.
            </EmptyState>
          </div>
        )}

      {requestTarget && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRequestTarget(null)}>
          <form
            className="card card-pad max-w-md w-full stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-request-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitDeleteRequest}
          >
            <div className="spread items-start">
              <h2 id="delete-request-title" className="card-title">Request delete</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRequestTarget(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              {requestTarget.vehicleNumber} · {new Date(requestTarget.submittedAt).toLocaleString()}. A manager has to approve before it is removed.
            </p>
            <div className="field">
              <label className="label" htmlFor="delete-request-note">Why should this be deleted?</label>
              <textarea
                id="delete-request-note"
                required
                rows={3}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="I submitted this by mistake..."
                className="input"
              />
            </div>
            <div className="cluster justify-end">
              <button type="button" className="btn btn-secondary" onClick={() => setRequestTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={requestBusy || !requestNote.trim()}>
                {requestBusy ? 'Sending...' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
