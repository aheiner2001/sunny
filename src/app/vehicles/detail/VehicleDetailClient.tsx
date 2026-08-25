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
  User, 
  History,
  Plus
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, Equipment, Inspection, Issue } from '@/types';
import { VehicleStatusBadge, InspectionStatusBadge, EquipmentStatusBadge, IssueStatusBadge } from '@/components/StatusBadges';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { IssueTimeline } from '@/components/IssueTimeline';
import { RecentInspectors } from '@/components/RecentInspectors';

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
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const recentTimelineItems = timelineItems.filter(item => new Date(item.date) >= recentCutoff);
  const visibleTimelineItems = showAllTimeline ? timelineItems : recentTimelineItems;
  const hasOlderTimeline = recentTimelineItems.length < timelineItems.length;
  const unassignedInventory = dbService.getAssignableFromShop();
  const selectedInventory = unassignedInventory.find(item => item.id === selectedInventoryId);
  const selectedInventoryAvailable = selectedInventory ? (selectedInventory.availableQuantity ?? 0) : 0;

  const getVehicleAllocation = (item: Equipment) => {
    return item.assignments?.find(assignment => assignment.vehicleId === vehicle.id)?.quantity || (item.vehicleId === vehicle.id ? 1 : 0);
  };

  const returnToShop = async (item: Equipment) => {
    const heldQuantity = getVehicleAllocation(item);
    const entered = prompt(`Return how many ${item.name} units to the shop?`, String(heldQuantity));
    if (entered === null) return;
    const amount = Number(entered);
    if (!Number.isInteger(amount) || amount <= 0 || amount > heldQuantity) {
      alert(`Enter a whole number from 1 to ${heldQuantity}.`);
      return;
    }
    try {
      await dbService.returnEquipmentToShop(item.id, vehicle.id, amount);
    } catch (error: any) {
      alert(error.message || 'Could not return equipment to the shop.');
    }
  };

  const setRequiredQuantity = async (item: Equipment) => {
    const assignment = item.assignments?.find(candidate => candidate.vehicleId === vehicle.id);
    const entered = prompt(
      `Set the required (par) quantity for ${item.name} on ${vehicle.vehicleNumber}.`,
      String(assignment?.requiredQuantity ?? getVehicleAllocation(item))
    );
    if (entered === null) return;
    const requiredQuantity = Number(entered);
    if (!Number.isInteger(requiredQuantity) || requiredQuantity < 0) {
      alert('Enter a non-negative whole number.');
      return;
    }
    try {
      await dbService.setAssignmentRequiredQuantity(item.id, vehicle.id, requiredQuantity);
    } catch (error: any) {
      alert(error.message || 'Could not update the required quantity.');
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

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <Link
            href="/vehicles"
            className="min-w-12 min-h-12 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 shadow-sm flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 break-words">{vehicle.vehicleNumber}</h1>
              <span className="text-sm sm:text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">
                {vehicle.licensePlate}
              </span>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
            <p className="text-sm sm:text-xs text-slate-500 mt-0.5 break-words leading-relaxed">{vehicle.name}</p>
          </div>
        </div>

        <Link
          href={`/inspect?id=${encodeURIComponent(vehicle.id)}`}
          className="flex items-center justify-center gap-2 px-5 min-h-12 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm sm:text-xs shadow-sm transition-colors self-start sm:self-auto"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Perform Inspection</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-3 sm:gap-6 min-w-max">
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
              className={`flex items-center gap-2 px-2 sm:px-0 min-h-12 pb-3 text-sm sm:text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${
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
      </div>

      {/* Tab 1: Chronological Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Vehicle Operational Timeline</h2>
              <p className="text-sm sm:text-xs text-slate-400 leading-relaxed">
                {showAllTimeline
                  ? 'Complete append-only history of every inspection result and equipment issue.'
                  : 'Recent history from the last 30 days. Older records remain available below.'}
              </p>
            </div>
            {hasOlderTimeline && (
              <button
                type="button"
                onClick={() => setShowAllTimeline(current => !current)}
                className="text-sm sm:text-xs font-bold text-sky-600 hover:text-sky-700 whitespace-nowrap min-h-11"
              >
                {showAllTimeline ? 'Show recent only' : `Show older history (${timelineItems.length - recentTimelineItems.length})`}
              </button>
            )}
          </div>

          <RecentInspectors vehicleId={vehicle.id} />

          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {visibleTimelineItems.map((item) => {
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

                      <p className="text-sm sm:text-xs text-slate-600 leading-relaxed break-words">
                        Completed by <strong>{insp.userName}</strong> ({insp.userEmail})
                      </p>

                      {insp.generalNotes && (
                        <p className="text-sm sm:text-xs italic text-slate-500 bg-white p-2 rounded-lg border border-slate-100 break-words leading-relaxed">
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

                      <p className="text-sm sm:text-xs text-slate-700 break-words leading-relaxed">
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

            {visibleTimelineItems.length === 0 && (
              <p className="text-xs text-slate-400 py-4">
                {timelineItems.length === 0
                  ? 'No inspection or issue records logged for this vehicle yet.'
                  : 'No recent records. Show older history to view the complete timeline.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Assigned Equipment */}
      {activeTab === 'equipment' && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Vehicle Inventory & Equipment</h2>
              <p className="text-sm sm:text-xs text-slate-400 leading-relaxed">All tools, machinery, and supplies dedicated to {vehicle.vehicleNumber}.</p>
            </div>
            <button
              onClick={openAssignModal}
              className="inline-flex items-center justify-center gap-2 px-4 min-h-12 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm sm:text-xs font-bold w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Assign Equipment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equipment.map((eq) => {
              const assignment = eq.assignments?.find(candidate => candidate.vehicleId === vehicle.id);
              return (
                <div
                  key={eq.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-xs font-bold text-slate-900 break-words">{eq.name}</h3>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{eq.category}</p>
                        <p className="text-xs sm:text-[11px] text-slate-600 mt-0.5 break-words">
                          {eq.assetTag ? `Tag #${eq.assetTag}` : 'No serial / tag'}
                        </p>
                        <p className="text-xs sm:text-[11px] text-slate-600 break-words">
                          {eq.status === 'working' ? 'Assigned to' : 'In use by'} {vehicle.vehicleNumber} ({getVehicleAllocation(eq)})
                        </p>
                        <p className="text-xs sm:text-[11px] text-slate-500">
                          Required (par): {assignment?.requiredQuantity ?? 'Not set'}
                        </p>
                      </div>
                    </div>
                    <EquipmentStatusBadge status={eq.status} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    <button
                      type="button"
                      onClick={() => setRequiredQuantity(eq)}
                      className="px-3 min-h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Set required (par)
                    </button>
                    <button
                      type="button"
                      onClick={() => returnToShop(eq)}
                      className="px-3 min-h-11 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                    >
                      Return to shop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {equipment.length === 0 && (
            <p className="text-sm sm:text-xs text-slate-400 leading-relaxed">No equipment assigned yet. Use “Assign Equipment” to move inventory from the shop or create a new item.</p>
          )}
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

      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-1">Assign Equipment to {vehicle.vehicleNumber}</h3>
            <p className="text-sm sm:text-xs text-slate-500 mb-4 leading-relaxed">Select from in-shop inventory or create and assign a new asset.</p>

            <div className="space-y-4">
              <label className="flex items-start gap-2 p-3 rounded-xl border border-slate-200">
                <input type="radio" checked={assignMode === 'existing'} onChange={() => setAssignMode('existing')} className="mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm sm:text-xs font-bold text-slate-900">Select from existing inventory</p>
                  <select
                    value={selectedInventoryId}
                    onChange={(e) => {
                      setSelectedInventoryId(e.target.value);
                      setAssignQuantity('1');
                    }}
                    className="mt-2 w-full px-3 min-h-12 rounded-xl border border-slate-200 text-sm sm:text-xs"
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
                    className="mt-2 w-full px-3 min-h-12 rounded-xl border border-slate-200 text-sm sm:text-xs disabled:bg-slate-100"
                    placeholder="Quantity to assign"
                  />
                </div>
              </label>

              <label className="flex items-start gap-2 p-3 rounded-xl border border-slate-200">
                <input type="radio" checked={assignMode === 'new'} onChange={() => setAssignMode('new')} className="mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm sm:text-xs font-bold text-slate-900">Create and assign new item</p>
                  <input
                    value={newEquipmentName}
                    onChange={(e) => setNewEquipmentName(e.target.value)}
                    disabled={assignMode !== 'new'}
                    className="mt-2 w-full px-3 min-h-12 rounded-xl border border-slate-200 text-sm sm:text-xs disabled:bg-slate-100"
                    placeholder="Equipment name"
                  />
                  <input
                    value={newEquipmentTag}
                    onChange={(e) => setNewEquipmentTag(e.target.value)}
                    disabled={assignMode !== 'new'}
                    className="mt-2 w-full px-3 min-h-12 rounded-xl border border-slate-200 text-sm sm:text-xs disabled:bg-slate-100"
                    placeholder="Serial / asset tag"
                  />
                </div>
              </label>
            </div>

            {assignError && <p className="mt-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2">{assignError}</p>}

            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setAssignModalOpen(false)} className="flex-1 min-h-12 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm sm:text-xs">Cancel</button>
              <button type="button" onClick={submitAssignment} disabled={assignLoading} className="flex-1 min-h-12 rounded-xl bg-sky-600 text-white font-bold text-sm sm:text-xs disabled:opacity-60">
                {assignLoading ? 'Saving...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
