'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Truck,
  Download,
  FileText,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection, Issue, Vehicle, ReportSettings } from '@/types';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { exportInspectionsAsCSV, exportIssuesAsCSV, exportComplianceReportAsHTML, ComplianceReportData } from '@/lib/export';

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
  const [reportSettings, setReportSettings] = useState<ReportSettings>({
    enabledMetrics: ['pass_rate', 'issues', 'fleet_size'],
  });

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

  const passedCount = inspections.filter((i) => i.status === 'passed').length;
  const passRate = inspections.length > 0 ? Math.round((passedCount / inspections.length) * 100) : 100;
  const resolvedIssues = issues.filter((i) => i.status === 'fixed').length;

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
    return users.map(user => {
      const userInspections = inspections.filter(i => i.userId === user.id);
      const passed = userInspections.filter(i => i.status === 'passed').length;
      const passRate = userInspections.length > 0 ? Math.round((passed / userInspections.length) * 100) : 0;

      // Calculate trend (last 15 vs first 15 days)
      const firstHalf = userInspections
        .filter(i => new Date(i.submittedAt).getTime() > Date.now() - 15 * 24 * 60 * 60 * 1000)
        .filter(i => i.status === 'passed').length;
      const secondHalf = userInspections
        .slice(0, Math.ceil(userInspections.length / 2))
        .filter(i => i.status === 'passed').length;
      const trend = Math.round((firstHalf - secondHalf) * 100 / Math.max(secondHalf, 1));

      // Common issues
      const userIssues = issues.filter(i => i.reportedByName === user.name);
      const issuesByType = new Map<string, number>();
      userIssues.forEach(issue => {
        const key = issue.equipmentName || issue.title;
        issuesByType.set(key, (issuesByType.get(key) || 0) + 1);
      });

      return {
        userName: user.name,
        passRate,
        passedInspections: passed,
        totalInspections: userInspections.length,
        trend,
        commonIssues: Array.from(issuesByType.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
      };
    });
  };

  const handleExportInspections = () => {
    exportInspectionsAsCSV(inspections);
  };

  const handleExportIssues = () => {
    exportIssuesAsCSV(issues);
  };

  const handleExportCompliance = () => {
    const reports = generateComplianceReportData();
    exportComplianceReportAsHTML(reports);
  };

  return (
    <div className="page">
      <PageHeader
        title="Fleet Accountability Reports"
        subtitle="High-level metrics on inspection adherence, equipment reliability, and problem resolution speed."
      />

      <div className="card card-pad">
        <div className="spread flex-col sm:flex-row gap-3">
          <div>
            <h2 className="card-title">Displayed Metrics</h2>
            <p className="hint">Choose which report cards managers see.</p>
          </div>
          <div className="cluster">
            {(
              [
                ['pass_rate', 'Pass rate'],
                ['issues', 'Issues'],
                ['fleet_size', 'Fleet size'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="cluster text-sm font-semibold text-ink-muted">
                <input
                  type="checkbox"
                  checked={reportSettings.enabledMetrics.includes(key)}
                  onChange={(e) => void toggleMetric(key, e.target.checked)}
                  className="rounded border-line-strong"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-auto" style={{ '--min': '14rem' } as React.CSSProperties}>
        {reportSettings.enabledMetrics.includes('pass_rate') && (
          <div className="card card-pad flex flex-col justify-between" data-status="ok">
            <div className="spread">
              <span className="eyebrow mb-0">Fleet Inspection Pass Rate</span>
              <span className="icon-tile" data-status="ok" aria-hidden>
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-4" data-status="ok">
              <div className="stat-value">{passRate}%</div>
              <p className="stat-label">
                {passedCount} of {inspections.length} total inspections passed without flags
              </p>
            </div>
          </div>
        )}

        {reportSettings.enabledMetrics.includes('issues') && (
          <div className="card card-pad flex flex-col justify-between" data-status="flagged">
            <div className="spread">
              <span className="eyebrow mb-0">Total Issues Handled</span>
              <span className="icon-tile" data-status="flagged" aria-hidden>
                <AlertTriangle className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-4">
              <div className="stat-value">{issues.length}</div>
              <p className="stat-label">
                {resolvedIssues} resolved, {issues.length - resolvedIssues} active or in repair
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
              <p className="stat-label">100% equipped with verifiable QR code tracking</p>
            </div>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="card card-pad">
        <div className="spread flex-col sm:flex-row gap-3 mb-4">
          <div>
            <h2 className="card-title">Export Reports</h2>
            <p className="hint">Download data for analysis, audits, or compliance.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExportInspections}
            className="btn btn-secondary cluster gap-2 justify-center"
          >
            <Download className="w-4 h-4" />
            <span>Export Inspections (CSV)</span>
          </button>
          <button
            onClick={handleExportIssues}
            className="btn btn-secondary cluster gap-2 justify-center"
          >
            <Download className="w-4 h-4" />
            <span>Export Issues (CSV)</span>
          </button>
          <button
            onClick={handleExportCompliance}
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
