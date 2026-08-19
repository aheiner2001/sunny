'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection, Issue } from '@/types';
import { InspectionStatusBadge, IssueStatusBadge } from '@/components/StatusBadges';

export default function CalendarPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-08-19');

  const loadData = () => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const daysInMonth = 31;
  const startDayOffset = 5; // Saturday Aug 1
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const selectedInspections = inspections.filter(i => i.dateString === selectedDateStr);
  const selectedIssues = issues.filter(i => i.dateString === selectedDateStr);

  const getDayInfo = (day: number) => {
    const dStr = `2026-08-${String(day).padStart(2, '0')}`;
    const dayInsps = inspections.filter(i => i.dateString === dStr);
    const dayIsss = issues.filter(i => i.dateString === dStr);
    const hasPassed = dayInsps.some(i => i.status === 'passed');
    const hasIssues = dayIsss.length > 0 || dayInsps.some(i => i.status === 'issues_found');

    return {
      dStr,
      inspectionCount: dayInsps.length,
      issueCount: dayIsss.length,
      hasPassed,
      hasIssues,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inspection Calendar</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pick any date to audit historical vehicle checks and inspect flagged problems.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Inspections
          <span className="w-2 h-2 rounded-full bg-amber-400 ml-2" /> Issues Flagged
          <span className="w-2 h-2 rounded-full bg-sky-600 ml-2" /> Selected Date
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-sky-600" />
              <span>August 2026</span>
            </h2>

            <div className="flex items-center gap-1">
              <button className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Calendar Day Tiles */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {/* Prev month placeholders */}
            {[28, 29, 30, 31].map(d => (
              <div key={`prev-${d}`} className="p-3 text-xs text-slate-300 font-medium rounded-2xl">
                {d}
              </div>
            ))}

            {/* Current month days */}
            {calendarDays.map(day => {
              const info = getDayInfo(day);
              const isSelected = selectedDateStr === info.dStr;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDateStr(info.dStr)}
                  className={`p-3 sm:p-4 rounded-2xl text-xs font-bold transition-all relative flex flex-col items-center justify-between min-h-[70px] ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 scale-105 z-10'
                      : 'hover:bg-slate-100/80 bg-slate-50/70 border border-slate-100 text-slate-800'
                  }`}
                >
                  <span className="text-sm font-extrabold">{day}</span>

                  {/* Indicators */}
                  <div className="flex items-center gap-1 mt-1">
                    {info.hasPassed && (
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                    )}
                    {info.hasIssues && (
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-amber-400'}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Activity Drilldown (1 col) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="border-b border-slate-100 pb-4 mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Activity on</span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </h3>
            </div>

            {/* Day's Inspections */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Inspections ({selectedInspections.length})</span>
                </h4>

                <div className="space-y-2.5">
                  {selectedInspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{insp.vehicleNumber}</span>
                        <InspectionStatusBadge status={insp.status} />
                      </div>
                      <div className="text-slate-500 text-[11px] flex items-center justify-between">
                        <span>{insp.userName}</span>
                        <span>{new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}

                  {selectedInspections.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No inspections submitted on this date.</p>
                  )}
                </div>
              </div>

              {/* Day's Issues */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Reported Issues ({selectedIssues.length})
                </h4>

                <div className="space-y-2.5">
                  {selectedIssues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900">{iss.equipmentName}</span>
                        <IssueStatusBadge status={iss.status} />
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{iss.description}</p>
                      <div className="text-[10px] text-slate-400">
                        {iss.vehicleNumber} • Reported by {iss.reportedByName}
                      </div>
                    </div>
                  ))}

                  {selectedIssues.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No equipment problems reported on this date.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/inspections"
            className="w-full py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold text-center block transition-colors shadow-sm"
          >
            View All Historical Records
          </Link>
        </div>
      </div>
    </div>
  );
}
