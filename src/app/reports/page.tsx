'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Truck,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Inspection, Issue, Vehicle, ReportSettings } from '@/types';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';

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
    </div>
  );
}
