'use client';

import React, { useState, useEffect } from 'react';
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
  Clock, 
  User, 
  Calendar,
  Sparkles,
  History
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, Equipment, Inspection, Issue } from '@/types';
import { VehicleStatusBadge, InspectionStatusBadge, EquipmentStatusBadge, IssueStatusBadge } from '@/components/StatusBadges';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { IssueTimeline } from '@/components/IssueTimeline';

export default function VehicleDetailClient() {
  const searchParams = useSearchParams();
  const vehicleId = searchParams?.get('id') || '';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'equipment' | 'qr' | 'issues'>('timeline');

  const loadData = async () => {
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
        setEquipment(dbService.getEquipmentForVehicle(v.id));
        setInspections(dbService.getInspectionsForVehicle(v.id));
        setIssues(dbService.getIssuesForVehicle(v.id));
      } else {
        setVehicle(null);
      }
    } catch (error) {
      console.error('Error loading vehicle details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, [vehicleId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading Vehicle Profile...</p>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="max-w-md mx-auto py-12 text-center bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mt-8">
        <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800 mb-1">Vehicle Not Found</h2>
        <p className="text-slate-500 text-xs mb-6">
          {vehicleId ? `No vehicle was found with ID "${vehicleId}".` : 'No vehicle was specified.'}
        </p>
        <Link 
          href="/vehicles" 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Vehicles List</span>
        </Link>
      </div>
    );
  }

  // Combine Inspections & Issues into a single unified chronological timeline
  type TimelineItem = 
    | { type: 'inspection'; date: string; data: Inspection }
    | { type: 'issue'; date: string; data: Issue };

  const timelineItems: TimelineItem[] = [
    ...inspections.map(i => ({ type: 'inspection' as const, date: i.submittedAt, data: i })),
    ...issues.map(iss => ({ type: 'issue' as const, date: iss.reportedAt, data: iss }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/vehicles"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900">{vehicle.vehicleNumber}</h1>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">
                {vehicle.licensePlate}
              </span>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{vehicle.name}</p>
          </div>
        </div>

        <Link
          href={`/inspect?id=${encodeURIComponent(vehicle.id)}`}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-colors self-start sm:self-auto"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Perform Inspection</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Operator</div>
          <div className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
            <User className="w-4 h-4 text-sky-600" />
            {vehicle.currentUserName || 'None (In Depot)'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Inspection</div>
          <div className="mt-1">
            <InspectionStatusBadge status={vehicle.lastInspectionStatus} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned Equipment</div>
          <div className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-slate-500" />
            {equipment.length} Tools/Gear
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open Issues</div>
          <div className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {issues.filter(i => i.status !== 'fixed').length} Active
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
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
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 -mb-px ${
                isActive
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Chronological Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Vehicle Operational Timeline</h2>
              <p className="text-xs text-slate-400">
                Append-only history of every driver assignment, inspection result, and equipment issue.
              </p>
            </div>
          </div>

          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timelineItems.map((item) => {
              if (item.type === 'inspection') {
                const insp = item.data;
                const isPassed = insp.status === 'passed';
                return (
                  <div key={insp.id} className="relative group">
                    <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center ${
                      isPassed ? 'border-emerald-500' : 'border-amber-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isPassed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Daily Inspection Submitted
                          </span>
                          <InspectionStatusBadge status={insp.status} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(insp.submittedAt).toLocaleDateString()} at {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600">
                        Completed by <strong>{insp.userName}</strong> ({insp.userEmail})
                      </p>

                      {insp.generalNotes && (
                        <p className="text-xs italic text-slate-500 bg-white p-2 rounded-lg border border-slate-100">
                          "{insp.generalNotes}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              } else {
                const iss = item.data;
                return (
                  <div key={iss.id} className="relative group">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-rose-500 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    </div>

                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-900">
                            Issue Reported: {iss.equipmentName}
                          </span>
                          <IssueStatusBadge status={iss.status} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(iss.reportedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700">
                        {iss.description}
                      </p>

                      <div className="text-[11px] text-slate-500">
                        Reported by <strong>{iss.reportedByName}</strong>
                      </div>
                    </div>
                  </div>
                );
              }
            })}

            {timelineItems.length === 0 && (
              <p className="text-xs text-slate-400 py-4">No inspection or issue records logged for this vehicle yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Assigned Equipment */}
      {activeTab === 'equipment' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Vehicle Inventory & Equipment</h2>
              <p className="text-xs text-slate-400">All tools, machinery, and supplies dedicated to {vehicle.vehicleNumber}.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equipment.map((eq) => (
              <div
                key={eq.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{eq.name}</h3>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{eq.category}</p>
                  </div>
                </div>
                <EquipmentStatusBadge status={eq.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Issues & Resolutions with Append-Only Timeline */}
      {activeTab === 'issues' && (
        <div className="space-y-6">
          {issues.map((issue) => (
            <IssueTimeline key={issue.id} issue={issue} onStatusUpdated={loadData} />
          ))}

          {issues.length === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">No issues reported</h3>
              <p className="text-xs text-slate-400 mt-1">All equipment on this vehicle is operating in standard condition.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: QR Code Tag & Print */}
      {activeTab === 'qr' && (
        <div className="max-w-md mx-auto">
          <QRCodeDisplay vehicle={vehicle} />
        </div>
      )}
    </div>
  );
}
