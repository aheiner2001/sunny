'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  Truck, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection } from '@/types';
import { InspectionStatusBadge } from '@/components/StatusBadges';

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = () => {
    setInspections(dbService.getInspections());
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

  const filteredInspections = inspections.filter(insp => {
    const matchesSearch =
      insp.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.dateString.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || insp.status === statusFilter;
    const matchesVehicle = vehicleFilter === 'all' || insp.vehicleId === vehicleFilter;

    return matchesSearch && matchesStatus && matchesVehicle;
  });

  const vehicles = dbService.getVehicles();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inspection History</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete archive of all daily pre-trip and post-trip vehicle checklists.
          </p>
        </div>

        <Link
          href="/scan"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-colors self-start sm:self-auto"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>New Inspection</span>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search driver, van number, date (YYYY-MM-DD)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {['all', 'passed', 'issues_found', 'in_progress'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}

          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Vans</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inspections List */}
      <div className="space-y-4">
        {filteredInspections.map((insp) => {
          const isExpanded = expandedId === insp.id;

          return (
            <div
              key={insp.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all hover:border-slate-300"
            >
              {/* Inspection Header Row */}
              <div 
                onClick={() => setExpandedId(isExpanded ? null : insp.id)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">{insp.vehicleNumber}</span>
                      <InspectionStatusBadge status={insp.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Submitted by <strong>{insp.userName}</strong> ({insp.userEmail})
                    </p>
                  </div>
                </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                    <div className="text-left sm:text-right text-xs">
                      <div className="font-bold text-slate-900">
                        {new Date(insp.submittedAt).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteInspection(e, insp.id, insp.vehicleNumber)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Inspection"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="p-1 rounded-lg bg-slate-100 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Checklist Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4 animate-in fade-in duration-150">
                    {insp.generalNotes && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Operator Notes</span>
                        <p className="text-slate-700 italic">"{insp.generalNotes}"</p>
                      </div>
                    )}

                    {insp.responses && insp.responses.length > 0 ? (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Checklist Responses</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {insp.responses.map((resp, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                                resp.isFlagged
                                  ? 'bg-amber-50 border-amber-200 text-amber-900 font-semibold'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className="truncate pr-2">{resp.questionText}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                resp.isFlagged ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {resp.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Standard checklist verified without anomalies.</p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <Link
                        href={`/vehicles/detail?id=${encodeURIComponent(insp.vehicleId)}`}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                      >
                        View Vehicle History
                      </Link>

                      <button
                        onClick={(e) => handleDeleteInspection(e, insp.id, insp.vehicleNumber)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Record</span>
                      </button>
                    </div>
                  </div>
                )}
            </div>
          );
        })}

        {filteredInspections.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-700">No inspections found</h3>
            <p className="text-xs text-slate-400 mt-1">Try modifying the search filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
