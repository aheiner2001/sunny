'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wrench, 
  Search, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment } from '@/types';
import { EquipmentStatusBadge } from '@/components/StatusBadges';

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const loadData = () => {
    setEquipment(dbService.getEquipment());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch =
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || eq.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || eq.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Equipment & Tools Fleet Inventory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every piece of equipment is mapped 1:1 to its dedicated vehicle rig.
          </p>
        </div>

        <Link
          href="/issues"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors self-start sm:self-auto"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>View Flagged Issues</span>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search equipment, van, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {['all', 'working', 'flagged', 'needs_repair', 'being_repaired', 'fixed'].map((st) => (
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
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEquipment.map((eq) => (
          <div
            key={eq.id}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{eq.name}</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {eq.category}
                    </span>
                  </div>
                </div>
                <EquipmentStatusBadge status={eq.status} />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-xs flex items-center justify-between border border-slate-100 mb-3">
                <span className="text-slate-500">Dedicated Van:</span>
                <Link
                  href={`/vehicles/${eq.vehicleId}`}
                  className="font-bold text-sky-600 hover:underline flex items-center gap-1"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>{eq.vehicleNumber}</span>
                </Link>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-[11px] text-slate-400">
                {eq.status === 'working' ? 'Operating Normally' : 'Attention Required'}
              </span>
              <Link
                href={`/vehicles/${eq.vehicleId}`}
                className="font-bold text-slate-700 hover:text-sky-600 flex items-center gap-1"
              >
                <span>Van History</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
