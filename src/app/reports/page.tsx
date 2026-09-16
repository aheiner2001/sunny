'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Truck,
  Download,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  Calendar as CalendarIcon,
  Wrench,
  Users,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection, Issue, Vehicle, Equipment, ReportSettings } from '@/types';
import { ManagerOnly } from '@/components/ManagerOnly';
import { ReportsAnalytics } from '@/components/ReportsAnalytics';
import { PageHeader } from '@/components/PageHeader';
import { exportInspectionsAsCSV, exportIssuesAsCSV, exportComplianceReportAsHTML, ComplianceReportData } from '@/lib/export';

type DatePreset = 'all' | 'today' | 'week' | 'month' | '30days' | '90days' | 'custom';

export default function ReportsPage() {
  return (
    <ManagerOnly>
      <ReportsPageContent />
    </ManagerOnly>
  );
}

function ReportsPageContent() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [reportSettings, setReportSettings] = useState<ReportSettings>({
    enabledMetrics: ['pass_rate', 'issues', 'fleet_size', 'maintenance_spend'],
  });

  // 6.2 Custom Date Range Picker state
  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const load = () => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
    setVehicles(dbService.getVehicles());
    setEquipmentList(dbService.getEquipment());
    setReportSettings(dbService.getReportSettings());
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, []);

  // Compute effective date filter bounds
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (datePreset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (datePreset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { startDate: d.toISOString().split('T')[0], endDate: todayStr };
    }
    if (datePreset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { startDate: d.toISOString().split('T')[0], endDate: todayStr };
    }
    if (datePreset === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: d.toISOString().split('T')[0], endDate: todayStr };
    }
    if (datePreset === '90days') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return { startDate: d.toISOString().split('T')[0], endDate: todayStr };
    }
    if (datePreset === 'custom') {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    return { startDate: '', endDate: '' };
  }, [datePreset, customStartDate, customEndDate]);

  // Filtered Inspections & Issues based on Date Range
  const filteredInspections = useMemo(() => {
    if (!startDate || !endDate) return inspections;
    return inspections.filter((i) => {
      const date = i.dateString || i.submittedAt?.split('T')[0];
      return date >= startDate && date <= endDate;
    });
  }, [inspections, startDate, endDate]);

  const filteredIssues = useMemo(() => {
    if (!startDate || !endDate) return issues;
    return issues.filter((iss) => {
      const date = iss.dateString || iss.reportedAt?.split('T')[0];
      return date >= startDate && date <= endDate;
    });
  }, [issues, startDate, endDate]);

  // KPI Calculations
  const passedCount = filteredInspections.filter((i) => i.status === 'passed').length;
  const passRate = filteredInspections.length > 0 ? Math.round((passedCount / filteredInspections.length) * 100) : 100;
  const resolvedIssues = filteredIssues.filter((i) => i.status === 'fixed').length;

  // 6.3 Equipment Cost & Maintenance ROI
  const totalRepairSpend = useMemo(() => {
    return filteredIssues.reduce((sum, iss) => sum + (Number(iss.repairCost) || 0), 0);
  }, [filteredIssues]);

  const totalEquipmentInventoryValue = useMemo(() => {
    return equipmentList.reduce((sum, eq) => {
      const qty = eq.totalQuantity || 1;
      const unit = eq.unitCost || 0;
      return sum + qty * unit;
    }, 0);
  }, [equipmentList]);

  const vehicleMaintenanceROI = useMemo(() => {
    return vehicles.map((v) => {
      const vIssues = filteredIssues.filter((iss) => iss.vehicleId === v.id);
      const vInspections = filteredInspections.filter((i) => i.vehicleId === v.id);
      const vRepairCost = vIssues.reduce((sum, iss) => sum + (Number(iss.repairCost) || 0), 0);
      const vFixedIssues = vIssues.filter((iss) => iss.status === 'fixed').length;
      const vPassedInspections = vInspections.filter((i) => i.status === 'passed').length;
      const vPassRate = vInspections.length > 0 ? Math.round((vPassedInspections / vInspections.length) * 100) : 100;

      return {
        vehicle: v,
        totalInspections: vInspections.length,
        passRate: vPassRate,
        totalIssues: vIssues.length,
        resolvedIssues: vFixedIssues,
        repairCost: vRepairCost,
      };
    }).sort((a, b) => b.repairCost - a.repairCost);
  }, [vehicles, filteredIssues, filteredInspections]);

  // 6.4 Operator Reliability Scorecards
  const operatorLeaderboard = useMemo(() => {
    const users = dbService.getUsers().filter((u) => u.status === 'active');
    return users.map((user) => {
      const userInspections = filteredInspections.filter((i) => i.userId === user.id || i.userName === user.name);
      const userPassed = userInspections.filter((i) => i.status === 'passed').length;
      const opPassRate = userInspections.length > 0 ? Math.round((userPassed / userInspections.length) * 100) : 100;
      const userIssuesFlagged = filteredIssues.filter((i) => i.reportedById === user.id || i.reportedByName === user.name).length;

      // Reliability Score: 0-100 based on inspection volume & pass consistency
      const volumeBonus = Math.min(20, userInspections.length * 2);
      const score = userInspections.length === 0 ? 80 : Math.min(100, Math.round(opPassRate * 0.8 + volumeBonus));

      let grade = 'A';
      if (score >= 95) grade = 'A+';
      else if (score >= 90) grade = 'A';
      else if (score >= 80) grade = 'B+';
      else if (score >= 70) grade = 'B';
      else grade = 'C';

      return {
        user,
        totalInspections: userInspections.length,
        passedInspections: userPassed,
        passRate: opPassRate,
        issuesFlagged: userIssuesFlagged,
        score,
        grade,
      };
    }).sort((a, b) => b.score - a.score);
  }, [filteredInspections, filteredIssues]);

  // 6.1 Interactive Trend Graphs data (Last 14-30 days timeline)
  const trendDays = useMemo(() => {
    const numDays = 14;
    const days: Array<{ dateStr: string; label: string; passRate: number; total: number; passed: number; issues: number }> = [];
    const now = new Date();

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayInspections = inspections.filter((insp) => (insp.dateString || insp.submittedAt?.split('T')[0]) === dStr);
      const dayIssues = issues.filter((iss) => (iss.dateString || iss.reportedAt?.split('T')[0]) === dStr);
      const pCount = dayInspections.filter((insp) => insp.status === 'passed').length;
      const pRate = dayInspections.length > 0 ? Math.round((pCount / dayInspections.length) * 100) : 100;

      days.push({
        dateStr: dStr,
        label: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        passRate: pRate,
        total: dayInspections.length,
        passed: pCount,
        issues: dayIssues.length,
      });
    }
    return days;
  }, [inspections, issues]);

  // Weekly issue volume aggregation
  const weeklyIssueData = useMemo(() => {
    const weeks: Array<{ label: string; issues: number; fixed: number }> = [];
    const now = new Date();

    for (let w = 3; w >= 0; w--) {
      const startW = new Date(now);
      startW.setDate(now.getDate() - (w * 7 + 6));
      const endW = new Date(now);
      endW.setDate(now.getDate() - (w * 7));

      const sStr = startW.toISOString().split('T')[0];
      const eStr = endW.toISOString().split('T')[0];

      const wIssues = issues.filter((iss) => {
        const d = iss.dateString || iss.reportedAt?.split('T')[0];
        return d >= sStr && d <= eStr;
      });

      const fixed = wIssues.filter((iss) => iss.status === 'fixed').length;

      weeks.push({
        label: w === 0 ? 'This Week' : `${w}w ago`,
        issues: wIssues.length,
        fixed,
      });
    }
    return weeks;
  }, [issues]);

  const toggleMetric = async (key: string, checked: boolean) => {
    const enabledMetrics = checked
      ? reportSettings.enabledMetrics.includes(key)
        ? reportSettings.enabledMetrics
        : [...reportSettings.enabledMetrics, key]
      : reportSettings.enabledMetrics.filter((item) => item !== key);
    const next = { enabledMetrics };
    setReportSettings(next);
    await dbService.saveReportSettings(next);
  };

  const generateComplianceReportData = (): ComplianceReportData[] => {
    const users = dbService.getUsers();
    return users.map((user) => {
      const userInspections = filteredInspections.filter((i) => i.userId === user.id);
      const passed = userInspections.filter((i) => i.status === 'passed').length;
      const opPassRate = userInspections.length > 0 ? Math.round((passed / userInspections.length) * 100) : 0;

      const firstHalf = userInspections
        .filter((i) => new Date(i.submittedAt).getTime() > Date.now() - 15 * 24 * 60 * 60 * 1000)
        .filter((i) => i.status === 'passed').length;
      const secondHalf = userInspections
        .slice(0, Math.ceil(userInspections.length / 2))
        .filter((i) => i.status === 'passed').length;
      const trend = Math.round(((firstHalf - secondHalf) * 100) / Math.max(secondHalf, 1));

      const userIssues = filteredIssues.filter((i) => i.reportedByName === user.name);
      const issuesByType = new Map<string, number>();
      userIssues.forEach((issue) => {
        const key = issue.equipmentName || issue.title;
        issuesByType.set(key, (issuesByType.get(key) || 0) + 1);
      });

      return {
        userName: user.name,
        passRate: opPassRate,
        passedInspections: passed,
        totalInspections: userInspections.length,
        trend,
        commonIssues: Array.from(issuesByType.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3),
      };
    });
  };

  return (
    <div className="page space-y-6">
      <PageHeader
        title="Fleet Analytics & Accountability Reports"
        subtitle="High-level metrics on inspection adherence, equipment ROI, and operator reliability."
      />

      {/* 6.2 Custom Date Range Picker */}
      <div className="card card-pad space-y-3">
        <div className="spread flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-ink-muted" />
            <span className="text-xs font-extrabold text-ink uppercase tracking-wider">Report Period</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' },
              { id: '90days', label: 'Last 90 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDatePreset(preset.id as DatePreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  datePreset === preset.id
                    ? 'bg-ink text-white shadow-xs'
                    : 'bg-surface-sunk text-ink-muted border border-line hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className="p-3 rounded-xl bg-surface-sunk border border-line flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-ink-muted">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-line bg-surface"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-ink-muted">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-line bg-surface"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid-auto" style={{ '--min': '13rem' } as React.CSSProperties}>
        {reportSettings.enabledMetrics.includes('pass_rate') && (
          <div className="card card-pad flex flex-col justify-between" data-status="ok">
            <div className="spread">
              <span className="eyebrow mb-0">Inspection Pass Rate</span>
              <span className="icon-tile" data-status="ok" aria-hidden>
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-4" data-status="ok">
              <div className="stat-value">{passRate}%</div>
              <p className="stat-label">
                {passedCount} of {filteredInspections.length} passed without flags
              </p>
            </div>
          </div>
        )}

        {reportSettings.enabledMetrics.includes('issues') && (
          <div className="card card-pad flex flex-col justify-between" data-status="flagged">
            <div className="spread">
              <span className="eyebrow mb-0">Issues Reported</span>
              <span className="icon-tile" data-status="flagged" aria-hidden>
                <AlertTriangle className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-4">
              <div className="stat-value">{filteredIssues.length}</div>
              <p className="stat-label">
                {resolvedIssues} resolved, {filteredIssues.length - resolvedIssues} active or in repair
              </p>
            </div>
          </div>
        )}

        {reportSettings.enabledMetrics.includes('maintenance_spend') && (
          <div className="card card-pad flex flex-col justify-between bg-surface">
            <div className="spread">
              <span className="eyebrow mb-0">Maintenance & Repair Spend</span>
              <span className="icon-tile bg-emerald-100 text-emerald-700" aria-hidden>
                <DollarSign className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-4">
              <div className="stat-value font-mono">${totalRepairSpend.toLocaleString()}</div>
              <p className="stat-label">
                ${totalEquipmentInventoryValue.toLocaleString()} shop equipment assets active
              </p>
            </div>
          </div>
        )}

        {reportSettings.enabledMetrics.includes('fleet_size') && (
          <div className="card card-pad flex flex-col justify-between" data-status="info">
            <div className="spread">
              <span className="eyebrow mb-0">Active Fleet Size</span>
              <span className="icon-tile" data-status="info" aria-hidden>
                <Truck className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-4">
              <div className="stat-value">{vehicles.length}</div>
              <p className="stat-label">100% active vans with verifiable QR inspection</p>
            </div>
          </div>
        )}
      </div>

      {/* 6.1 Interactive Trend Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pass Rate Trend Graph */}
        <div className="card card-pad space-y-4">
          <div className="spread items-center border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="card-title text-sm font-extrabold text-ink">
                14-Day Inspection Pass Rate Trend
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Avg: {passRate}%
            </span>
          </div>

          <div className="h-44 flex flex-col justify-end pt-4">
            <div className="flex items-end justify-between h-32 gap-1 px-1">
              {trendDays.map((d, idx) => {
                const heightPct = Math.max(12, d.passRate);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Hover tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg transition-opacity whitespace-nowrap z-10">
                      {d.dateStr}: {d.passRate}% ({d.passed}/{d.total})
                    </div>
                    <div className="w-full max-w-[20px] bg-surface-sunk rounded-t flex flex-col justify-end h-full">
                      <div
                        className={`w-full rounded-t transition-all ${
                          d.passRate === 100
                            ? 'bg-emerald-500'
                            : d.passRate >= 75
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-ink-faint truncate w-full text-center">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line mt-2 pt-1 flex justify-between text-[10px] text-ink-faint font-semibold">
              <span>14 Days Ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Weekly Issue Volume Bar Chart */}
        <div className="card card-pad space-y-4">
          <div className="spread items-center border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-600" />
              <h3 className="card-title text-sm font-extrabold text-ink">
                Weekly Issue Volume & Resolution Speed
              </h3>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              {resolvedIssues} / {filteredIssues.length} Resolved
            </span>
          </div>

          <div className="h-44 flex flex-col justify-end pt-4">
            <div className="grid grid-cols-4 gap-3 h-32 items-end px-2">
              {weeklyIssueData.map((w, idx) => {
                const maxVal = Math.max(1, ...weeklyIssueData.map((x) => x.issues));
                const totalHeight = Math.max(8, (w.issues / maxVal) * 100);
                const fixedHeight = w.issues > 0 ? (w.fixed / w.issues) * totalHeight : 0;

                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 group relative h-full justify-end">
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg transition-opacity whitespace-nowrap z-10">
                      {w.issues} Issues ({w.fixed} Fixed)
                    </div>
                    <div className="w-full max-w-[36px] bg-surface-sunk rounded-t relative flex flex-col justify-end h-full">
                      <div
                        className="w-full bg-rose-400 rounded-t transition-all relative overflow-hidden"
                        style={{ height: `${totalHeight}%` }}
                      >
                        <div
                          className="w-full bg-emerald-500 transition-all absolute bottom-0"
                          style={{ height: `${fixedHeight}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-ink-muted">{w.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line mt-2 pt-1 flex justify-between items-center text-[10px] text-ink-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-rose-400" /> Reported Issues
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-500" /> Resolved Issues
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6.3 Vehicle Maintenance & Equipment ROI Table */}
      <div className="card card-pad space-y-4">
        <div className="spread items-center border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-ink" />
            <div>
              <h3 className="card-title text-sm font-extrabold text-ink">
                Vehicle Maintenance Spend & Equipment ROI
              </h3>
              <p className="hint text-xs">Total repair cost and issue resolution per mobile unit.</p>
            </div>
          </div>
          <span className="text-xs font-extrabold font-mono text-ink bg-surface-sunk px-2.5 py-1 rounded-xl border border-line">
            Total Spend: ${totalRepairSpend.toLocaleString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-line text-ink-muted uppercase tracking-wider text-[10px]">
                <th className="py-2 px-3">Vehicle</th>
                <th className="py-2 px-3">Inspections</th>
                <th className="py-2 px-3">Pass Rate</th>
                <th className="py-2 px-3">Issues Logged</th>
                <th className="py-2 px-3">Resolved</th>
                <th className="py-2 px-3 text-right">Maintenance Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {vehicleMaintenanceROI.map((item) => (
                <tr key={item.vehicle.id} className="hover:bg-surface-sunk/50">
                  <td className="py-2.5 px-3 font-bold text-ink">
                    <div className="flex items-center gap-1.5">
                      <span>{item.vehicle.vehicleNumber}</span>
                      <span className="unit-tag text-[10px]">{item.vehicle.licensePlate}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold">{item.totalInspections}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`font-bold ${
                        item.passRate >= 90
                          ? 'text-emerald-600'
                          : item.passRate >= 75
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {item.passRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold">{item.totalIssues}</td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-700">{item.resolvedIssues}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">
                    ${item.repairCost.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6.4 Operator Reliability Scorecards */}
      <div className="card card-pad space-y-4">
        <div className="spread items-center border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <div>
              <h3 className="card-title text-sm font-extrabold text-ink">
                Operator Reliability Leaderboard & Scorecards
              </h3>
              <p className="hint text-xs">Detailer rankings by inspection completion diligence and pass rate accuracy.</p>
            </div>
          </div>
          <span className="unit-tag flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Top Tier Accountability</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {operatorLeaderboard.map((op, rank) => (
            <div
              key={op.user.id}
              className="p-3.5 rounded-2xl border border-line bg-surface flex flex-col justify-between hover:border-ink transition-all shadow-xs"
            >
              <div className="spread items-center mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                      rank === 0
                        ? 'bg-amber-100 text-amber-800'
                        : rank === 1
                        ? 'bg-slate-200 text-slate-800'
                        : rank === 2
                        ? 'bg-amber-800/20 text-amber-900'
                        : 'bg-surface-sunk text-ink-muted'
                    }`}
                  >
                    #{rank + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-ink">{op.user.name}</div>
                    <div className="text-[10px] text-ink-muted capitalize">{op.user.role}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md font-extrabold text-xs bg-emerald-100 text-emerald-800">
                  Grade {op.grade}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line text-center text-xs">
                <div className="p-1.5 rounded-lg bg-surface-sunk">
                  <div className="text-[10px] text-ink-faint uppercase font-bold">Inspections</div>
                  <div className="font-bold text-ink mt-0.5">{op.totalInspections}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-surface-sunk">
                  <div className="text-[10px] text-ink-faint uppercase font-bold">Pass Rate</div>
                  <div className="font-bold text-emerald-600 mt-0.5">{op.passRate}%</div>
                </div>
                <div className="p-1.5 rounded-lg bg-surface-sunk">
                  <div className="text-[10px] text-ink-faint uppercase font-bold">Score</div>
                  <div className="font-bold text-ink mt-0.5">{op.score}/100</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ReportsAnalytics inspections={filteredInspections} issues={filteredIssues} />

      {/* Export Section */}
      <div className="card card-pad">
        <div className="spread flex-col sm:flex-row gap-3 mb-4">
          <div>
            <h2 className="card-title">Export Compliance & Fleet Data</h2>
            <p className="hint">Download CSV or formatted HTML compliance packages for auditing.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => exportInspectionsAsCSV(filteredInspections)}
            className="btn btn-secondary cluster gap-2 justify-center"
          >
            <Download className="w-4 h-4" />
            <span>Export Inspections (CSV)</span>
          </button>
          <button
            onClick={() => exportIssuesAsCSV(filteredIssues)}
            className="btn btn-secondary cluster gap-2 justify-center"
          >
            <Download className="w-4 h-4" />
            <span>Export Issues (CSV)</span>
          </button>
          <button
            onClick={() => exportComplianceReportAsHTML(generateComplianceReportData())}
            className="btn btn-secondary cluster gap-2 justify-center"
          >
            <FileText className="w-4 h-4" />
            <span>Compliance Report (HTML)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
