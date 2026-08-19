'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Users, 
  Calendar,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection, Issue, Vehicle } from '@/types';

export default function ReportsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
    setVehicles(dbService.getVehicles());
  }, []);

  const passedCount = inspections.filter(i => i.status === 'passed').length;
  const passRate = inspections.length > 0 ? Math.round((passedCount / inspections.length) * 100) : 100;
  const resolvedIssues = issues.filter(i => i.status === 'fixed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fleet Accountability Reports</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          High-level metrics on inspection adherence, equipment reliability, and problem resolution speed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fleet Inspection Pass Rate</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{passRate}%</div>
            <p className="text-xs text-slate-500 mt-1">{passedCount} of {inspections.length} total inspections passed without flags</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Issues Handled</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{issues.length}</div>
            <p className="text-xs text-slate-500 mt-1">{resolvedIssues} resolved, {issues.length - resolvedIssues} active or in repair</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Fleet Size</span>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{vehicles.length}</div>
            <p className="text-xs text-slate-500 mt-1">100% equipped with verifiable QR code tracking</p>
          </div>
        </div>
      </div>
    </div>
  );
}
