'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection } from '@/types';
import { InspectionStatusBadge } from '@/components/StatusBadges';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default function InspectionsPage() {
  const { role } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'status' | 'vehicle' | 'driver'>('date_desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

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
    if (confirm(`Are you sure you want to delete this inspection record for ${vehicleNumber}?`)) {
      await dbService.deleteInspection(inspectionId);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const filteredInspections = inspections.filter((insp) => {
    const matchesSearch =
      insp.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.dateString.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || insp.status === statusFilter;
    const matchesVehicle = vehicleFilter === 'all' || insp.vehicleId === vehicleFilter;

    return matchesSearch && matchesStatus && matchesVehicle;
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
            {['all', 'passed', 'issues_found', 'in_progress'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm capitalize ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              >
                {st.replace('_', ' ')}
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

      <div className="stack">
        {sortedInspections.map((insp) => {
          const isExpanded = expandedId === insp.id;

          return (
            <div key={insp.id} className="card overflow-hidden">
              <div
                onClick={() => setExpandedId(isExpanded ? null : insp.id)}
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

                  <button
                    type="button"
                    onClick={(e) => handleDeleteInspection(e, insp.id, insp.vehicleNumber)}
                    className="btn btn-ghost btn-sm text-[var(--critical)]"
                    title="Delete Inspection"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>

                  <span className="icon-tile text-ink-faint" aria-hidden>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="card-pad pt-0 border-t border-line bg-[var(--surface-alt)] stack">
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
                              <p className="text-[11px] text-amber-900 bg-amber-100/50 p-1.5 rounded">
                                {resp.notes}
                              </p>
                            )}
                            {resp.photoUrl && (
                              <div className="pt-1">
                                <img
                                  src={resp.photoUrl}
                                  alt="Issue photo"
                                  className="w-16 h-16 object-cover rounded-lg border border-amber-300"
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

                    {role === 'manager' && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteInspection(e, insp.id, insp.vehicleNumber)}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete Record
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
      </div>
    </div>
  );
}
