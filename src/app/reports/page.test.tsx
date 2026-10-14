import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Inspection, Issue } from '@/types';
import ReportsPage from './page';
import { exportInspectionsAsCSV, exportIssuesAsCSV, exportComplianceReportAsHTML } from '@/lib/export';

const data = vi.hoisted(() => ({ inspections: [] as Inspection[], issues: [] as Issue[] }));
vi.mock('@/lib/db', () => ({ dbService: {
  getInspections: () => data.inspections, getIssues: () => data.issues,
  getVehicles: () => [], getEquipment: () => [],
  getReportSettings: () => ({ enabledMetrics: ['pass_rate', 'issues', 'fleet_size', 'maintenance_spend'] }),
  getUsers: () => [{ id: 'prior', name: 'Prior Operator', role: 'employee', status: 'active' }, { id: 'reporter', name: 'Reporter', role: 'employee', status: 'active' }],
} }));
vi.mock('@/components/ManagerOnly', () => ({ ManagerOnly: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/ReportsAnalytics', () => ({ ReportsAnalytics: () => null }));
vi.mock('@/lib/export', () => ({ exportInspectionsAsCSV: vi.fn(), exportIssuesAsCSV: vi.fn(), exportComplianceReportAsHTML: vi.fn() }));

describe('reports scoring integration', () => {
  let host: HTMLDivElement;
  let root: Root;
  const click = async (label: string) => {
    const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.trim() === label);
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
  };
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const prior: Inspection = { id: 'prior-insp', vehicleId: 'van', vehicleNumber: '1', userId: 'prior', userName: 'Prior Operator', userEmail: '', status: 'passed', startedAt: '2026-10-13T17:00:00Z', submittedAt: '2026-10-13T17:00:00Z', dateString: '2026-10-13', responses: [], issueIds: [], kind: 'return' };
    data.inspections = [prior, { ...prior, id: 'later', userId: 'reporter', userName: 'Reporter', submittedAt: '2026-10-14T09:00:00Z', dateString: '2026-10-14', status: 'issues_found', issueIds: ['issue'], kind: 'pretrip' }];
    data.issues = [{ id: 'issue', inspectionId: 'later', vehicleId: 'van', vehicleNumber: '1', equipmentName: 'Tool', reportedById: 'reporter', reportedByName: 'Reporter', reportedAt: '2026-10-14T09:00:00Z', dateString: '2026-10-14', title: 'Broken tool', description: '', status: 'open' }];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<ReportsPage />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  it('renders prior custody deduction, discovery credit, scorecards and existing charts', () => {
    expect(host.textContent).toContain('Turnover Discrepancies & Handoff Audit');
    expect(host.textContent).toContain('Caught by Reporter');
    expect(host.textContent).toContain('Turnover deduction associated with prior operator Prior Operator');
    expect(host.textContent).toContain('Active Days');
    expect(host.textContent).toContain('Completed Inspections');
    expect(host.textContent).toContain('Handoff Flags');
    expect(host.textContent).toContain('Bonus Eligibility');
    expect(host.textContent).toContain('14-Day Inspection Pass Rate Trend');
    expect(host.textContent).toContain('Weekly Issue Volume & Resolution Speed');
    expect(host.textContent).not.toContain('pass rate accuracy');
  });
  it('preserves every date preset and filtered CSV/HTML exports', async () => {
    for (const label of ['All Time', 'This Week', 'This Month', 'Last 30 Days', 'Last 90 Days', 'Custom Range', 'Today']) {
      await click(label);
      expect(host.textContent).toContain('Broken tool');
      if (label === 'Custom Range') expect(host.querySelectorAll('input[type="date"]')).toHaveLength(2);
    }
    // Today still finds the previous day's handoff, but exports only today's checklist.
    await click('Export Inspections (CSV)');
    expect(exportInspectionsAsCSV).toHaveBeenCalledWith([data.inspections[1]]);
    await click('Export Issues (CSV)');
    expect(exportIssuesAsCSV).toHaveBeenCalledWith(data.issues);
    await click('Compliance Report (HTML)');
    expect(exportComplianceReportAsHTML).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ userName: 'Reporter', totalInspections: 1 })]));
    data.issues = [{ ...data.issues[0], reportedAt: '2026-07-01T09:00:00Z', dateString: '2026-07-01' }];
    await act(async () => { window.dispatchEvent(new Event('sunny_db_update')); });
    expect(host.textContent).toContain('No turnover discrepancies in the current report window.');
  });
});
