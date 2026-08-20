'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection, Issue } from '@/types';
import { InspectionStatusBadge, IssueStatusBadge } from '@/components/StatusBadges';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function CalendarPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const load = () => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
  };
  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, []);

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const selectedInspections = useMemo(() => inspections.filter(i => i.dateString === selectedDate), [inspections, selectedDate]);
  const selectedIssues = useMemo(() => issues.filter(i => i.dateString === selectedDate), [issues, selectedDate]);

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inspection Calendar</h1>
      <p className="text-xs text-slate-500 mt-0.5">Review persisted inspections and reported issues by month and day.</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-sky-600" />{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <div className="flex gap-1">
            <button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
            <button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} className="min-h-16 sm:min-h-20" />)}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
            const dayInspections = inspections.filter(item => item.dateString === key);
            const dayIssues = issues.filter(item => item.dateString === key);
            const selected = key === selectedDate;
            return <button key={key} onClick={() => setSelectedDate(key)} className={`min-h-16 sm:min-h-20 rounded-2xl border p-2 text-left transition-colors ${selected ? 'bg-sky-600 text-white border-sky-600 shadow-md' : 'bg-slate-50/70 border-slate-100 hover:bg-slate-100 text-slate-800'}`}>
              <span className="text-sm font-extrabold">{day}</span>
              <span className="flex gap-1 mt-3">{dayInspections.length > 0 && <span className={`w-2 h-2 rounded-full ${selected ? 'bg-white' : 'bg-emerald-500'}`} />} {dayIssues.length > 0 && <span className={`w-2 h-2 rounded-full ${selected ? 'bg-amber-200' : 'bg-amber-400'}`} />}</span>
              {(dayInspections.length + dayIssues.length) > 0 && <span className={`block text-[10px] mt-1 ${selected ? 'text-sky-100' : 'text-slate-400'}`}>{dayInspections.length + dayIssues.length} record{dayInspections.length + dayIssues.length !== 1 ? 's' : ''}</span>}
            </button>;
          })}
        </div>
      </section>
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-4"><span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Activity on</span><h3 className="text-lg font-extrabold text-slate-900">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h3></div>
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Inspections ({selectedInspections.length})</h4>
        <div className="space-y-2 mb-5">{selectedInspections.map(i => <div key={i.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs"><div className="flex justify-between font-bold"><span>{i.vehicleNumber}</span><InspectionStatusBadge status={i.status} /></div><div className="text-slate-500 mt-1">{i.userName} · {new Date(i.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>{i.scheduleLabel && <div className="text-sky-600 mt-1">Schedule: {i.scheduleLabel}</div>}</div>)}{selectedInspections.length === 0 && <p className="text-xs text-slate-400 italic">No inspections submitted.</p>}</div>
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Reported Issues ({selectedIssues.length})</h4>
        <div className="space-y-2">{selectedIssues.map(i => <div key={i.id} className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/60 text-xs"><div className="flex justify-between font-bold text-amber-900"><span>{i.equipmentName}</span><IssueStatusBadge status={i.status} /></div><p className="text-slate-600 mt-1">{i.description}</p><div className="text-[10px] text-slate-400 mt-1">{i.vehicleNumber} · {i.reportedByName}</div></div>)}{selectedIssues.length === 0 && <p className="text-xs text-slate-400 italic">No issues reported.</p>}</div>
        <Link href="/inspections" className="block mt-6 w-full py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold text-center">View All Historical Records</Link>
      </section>
    </div>
  </div>;
}
