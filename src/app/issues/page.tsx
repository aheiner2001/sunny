'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  Wrench, 
  Truck, 
  User, 
  Clock, 
  Calendar, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Issue, IssueStatus } from '@/types';
import { IssueStatusBadge } from '@/components/StatusBadges';
import { IssueTimeline } from '@/components/IssueTimeline';

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const loadData = () => {
    setIssues(dbService.getIssues());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  useEffect(() => {
    const issueId = new URLSearchParams(window.location.search).get('issue');
    if (!issueId) return;
    const target = issues.find(issue => issue.id === issueId);
    if (target) {
      setSelectedIssue(target);
      setStatusFilter(target.status === 'fixed' ? 'fixed' : 'all');
      window.setTimeout(() => document.getElementById(`issue-${issueId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    }
  }, [issues]);

  const activeIssues = (statusFilter === 'fixed'
    ? issues.filter(iss => iss.status === 'fixed')
    : issues.filter(iss => iss.status !== 'fixed')
  ).sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());

  const filteredIssues = activeIssues.filter(iss => {
    const matchesSearch =
      iss.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      iss.reportedByName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || iss.status === statusFilter;
    const matchesVehicle = vehicleFilter === 'all' || iss.vehicleId === vehicleFilter;

    return matchesSearch && matchesStatus && matchesVehicle;
  });

  const vehicles = dbService.getVehicles();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {statusFilter === 'fixed' ? 'Resolved Issue History' : 'Active Equipment Issues'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Trace problems back to origin, update equipment repair stages, and audit immutable resolution history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{issues.filter(i => i.status !== 'fixed').length} Currently Open</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search equipment, problem, van, reporter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status filter tabs */}
          {['all', 'open', 'needs_repair', 'being_repaired', 'fixed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'active' : st === 'fixed' ? 'resolved history' : st.replace('_', ' ')}
            </button>
          ))}

          {/* Vehicle Dropdown */}
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Issue Cards with Built-in Timeline */}
      <div className="space-y-6">
        {filteredIssues.map((issue) => (
          <div
            key={issue.id}
            id={`issue-${issue.id}`}
            className={selectedIssue?.id === issue.id ? 'rounded-3xl ring-2 ring-sky-500 ring-offset-2' : ''}
          >
            <IssueTimeline issue={issue} onStatusUpdated={() => loadData()} />
          </div>
        ))}

        {filteredIssues.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No issues found matching query</h3>
            <p className="text-xs text-slate-400 mt-1">Try resetting search keywords or status filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
