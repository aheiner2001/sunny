'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Truck, 
  Search, 
  Filter, 
  QrCode, 
  ArrowRight, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, VehicleStatus } from '@/types';
import { VehicleStatusBadge, InspectionStatusBadge } from '@/components/StatusBadges';
import { QRScannerModal } from '@/components/QRScannerModal';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scannerOpen, setScannerOpen] = useState(false);

  const loadData = () => {
    setVehicles(dbService.getVehicles());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = 
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.currentUserName && v.currentUserName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fleet Vehicles</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage fleet vehicles, print QR inspection badges, and trace operational history.
          </p>
        </div>

        <button
          onClick={() => setScannerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-colors self-start sm:self-auto"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan Vehicle QR</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search van number, name, plate, driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'in_use', 'active', 'maintenance'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => {
          const equipment = dbService.getEquipmentForVehicle(vehicle.id);
          const flaggedEqCount = equipment.filter(e => e.status !== 'working' && e.status !== 'fixed').length;

          return (
            <div
              key={vehicle.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">{vehicle.vehicleNumber}</h2>
                      <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {vehicle.licensePlate}
                      </span>
                    </div>
                  </div>
                  <VehicleStatusBadge status={vehicle.status} />
                </div>

                <p className="text-xs text-slate-600 font-medium mb-4">{vehicle.name}</p>

                {/* Driver & Inspection Info */}
                <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2 border border-slate-100 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Current Driver:</span>
                    <span className="font-bold text-slate-900">{vehicle.currentUserName || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Last Inspection:</span>
                    <InspectionStatusBadge status={vehicle.lastInspectionStatus} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Equipment Health:</span>
                    {flaggedEqCount > 0 ? (
                      <span className="text-amber-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        {flaggedEqCount} Flagged
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        All {equipment.length} Working
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <Link
                  href={`/inspect/${vehicle.id}`}
                  className="flex-1 py-2.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-xs text-center transition-colors"
                >
                  Inspect
                </Link>
                <Link
                  href={`/vehicles/${vehicle.id}`}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs text-center transition-colors flex items-center justify-center gap-1 group"
                >
                  <span>Full History</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">No vehicles match filter</h3>
          <p className="text-xs text-slate-400 mt-1">Try searching for a different van or clear filters.</p>
        </div>
      )}

      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
