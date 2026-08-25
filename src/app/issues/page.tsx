'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Search, 
  CheckCircle2,
  PackageCheck,
  PackageMinus
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Issue, IssueType } from '@/types';
import { IssueTimeline } from '@/components/IssueTimeline';
import { ManagerOnly } from '@/components/ManagerOnly';
import { useAuth } from '@/context/AuthContext';
import { RecentInspectors } from '@/components/RecentInspectors';

const ISSUE_TYPES: Array<{ value: IssueType; label: string }> = [
  { value: 'stock_low_inventory', label: 'Stock / Low Inventory' },
  { value: 'equipment_replacement', label: 'Equipment Replacement' },
  { value: 'needs_repair', label: 'Needs Repair' },
];

export default function IssuesPage() {
  return (
    <ManagerOnly>
      <IssuesPageContent />
    </ManagerOnly>
  );
}

function IssuesPageContent() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [pendingAction, setPendingAction] = useState<'update_stock' | 'remove_from_van' | null>(null);

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

  const managerIdentity = {
    id: user?.id || 'manager',
    name: user?.name || 'Manager',
  };

  const handleTypeChange = (issue: Issue, type: IssueType) => {
    try {
      const updated = dbService.updateIssueType(issue.id, type, managerIdentity);
      setSelectedIssue(updated);
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update issue type.');
    }
  };

  const handleStockAction = async (
    issue: Issue,
    action: 'update_stock' | 'remove_from_van',
  ) => {
    if (!issue.equipmentId) {
      alert('This issue has no linked equipment; update inventory manually.');
      return;
    }

    let quantity: number | undefined;
    if (action === 'update_stock' && issue.reportedQuantity == null) {
      const response = window.prompt('Enter the actual quantity currently on the van:');
      if (response === null) return;
      quantity = Number(response);
    }

    if (action === 'remove_from_van') {
      if (!window.confirm('Return this equipment from the van to shop inventory?')) return;
      const response = window.prompt(
        'Quantity to remove (leave blank to remove everything assigned to this van):',
        '',
      );
      if (response === null) return;
      if (response.trim()) quantity = Number(response);
    }

    try {
      setPendingAction(action);
      const updated = await dbService.resolveStockIssue(
        issue.id,
        action,
        managerIdentity,
        quantity === undefined ? undefined : { quantity },
      );
      setSelectedIssue(updated);
      loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to resolve stock issue.');
    } finally {
      setPendingAction(null);
    }
  };

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
            onClick={() => setSelectedIssue(issue)}
            className={`rounded-3xl transition-shadow ${
              selectedIssue?.id === issue.id ? 'ring-2 ring-sky-500 ring-offset-2' : ''
            }`}
          >
            <IssueTimeline issue={issue} onStatusUpdated={() => loadData()} />
            {selectedIssue?.id === issue.id && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="w-full lg:max-w-xs">
                    <label
                      htmlFor={`issue-type-${issue.id}`}
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      Issue Type
                    </label>
                    <select
                      id={`issue-type-${issue.id}`}
                      value={issue.type || 'needs_repair'}
                      onChange={(event) => handleTypeChange(issue, event.target.value as IssueType)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {ISSUE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {issue.type === 'stock_low_inventory' && issue.status !== 'fixed' && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => handleStockAction(issue, 'update_stock')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50"
                      >
                        <PackageCheck className="h-4 w-4" />
                        {pendingAction === 'update_stock' ? 'Updating...' : 'Update Stock'}
                      </button>
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => handleStockAction(issue, 'remove_from_van')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                      >
                        <PackageMinus className="h-4 w-4" />
                        {pendingAction === 'remove_from_van' ? 'Removing...' : 'Remove from Van'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <RecentInspectors vehicleId={selectedIssue.vehicleId} />
                </div>
              </div>
            )}
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
