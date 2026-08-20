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
import { Inspection, Issue, Vehicle, ReportSettings } from '@/types';

export default function ReportsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reportSettings, setReportSettings] = useState<ReportSettings>({ enabledMetrics: ['pass_rate', 'issues', 'fleet_size'] });

  const load = () => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
    setVehicles(dbService.getVehicles());
    setReportSettings(dbService.getReportSettings());
  };
  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
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

      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Displayed Metrics</h2><p className="text-[11px] text-slate-400">Choose which report cards managers see.</p></div>
          <div className="flex flex-wrap gap-2">{[['pass_rate', 'Pass rate'], ['issues', 'Issues'], ['fleet_size', 'Fleet size']].map(([key, label]) => <label key={key} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={reportSettings.enabledMetrics.includes(key)} onChange={async e => { const enabledMetrics = e.target.checked ? (reportSettings.enabledMetrics.includes(key) ? reportSettings.enabledMetrics : [...reportSettings.enabledMetrics, key]) : reportSettings.enabledMetrics.filter(item => item !== key); const next = { enabledMetrics }; setReportSettings(next); await dbService.saveReportSettings(next); }} className="rounded border-slate-300 text-sky-600" />{label}</label>)}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {reportSettings.enabledMetrics.includes('pass_rate') && <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
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
        </div>}

        {reportSettings.enabledMetrics.includes('issues') && <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
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
        </div>}

        {reportSettings.enabledMetrics.includes('fleet_size') && <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
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
        </div>}
      </div>
    </div>
  );
}
