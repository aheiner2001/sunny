/** @vitest-environment node */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  filterTodaysIssues,
  loadDashboardLayout,
  normalizeDashboardLayout,
  reorderDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
  setDashboardWidgetSize,
} from '@/lib/dashboardLayout';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  (globalThis as any).localStorage = localStorageMock;
}

installMemoryLocalStorage();

describe('filterTodaysIssues', () => {
  it('keeps only issues from the given local dateString', () => {
    const issues = [
      { id: '1', dateString: '2026-09-17', title: 'Today A' },
      { id: '2', dateString: '2026-09-16', title: 'Yesterday' },
      { id: '3', reportedAt: '2026-09-17T15:00:00.000Z', title: 'Today B' },
    ];
    expect(filterTodaysIssues(issues, '2026-09-17').map(i => i.id)).toEqual(['1', '3']);
  });

  it('is distinct from open-issue backlog (does not care about status)', () => {
    const issues = [
      { id: 'open-old', dateString: '2026-09-10', status: 'open' },
      { id: 'today-fixed', dateString: '2026-09-17', status: 'fixed' },
    ];
    expect(filterTodaysIssues(issues, '2026-09-17').map(i => i.id)).toEqual(['today-fixed']);
  });
});

describe('dashboard layout persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads defaults when nothing saved', () => {
    expect(loadDashboardLayout('user-1')).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('persists reorder + size presets per user', () => {
    const userA = 'mgr-1';
    let layout = loadDashboardLayout(userA);
    layout = reorderDashboardLayout(layout, 'today_issues', 'stats');
    layout = setDashboardWidgetSize(layout, 'today_issues', 'wide');
    saveDashboardLayout(layout, userA);

    const reloaded = loadDashboardLayout(userA);
    expect(reloaded[0].id).toBe('today_issues');
    expect(reloaded[0].size).toBe('wide');

    // other user keeps defaults
    expect(loadDashboardLayout('mgr-2')[0].id).toBe('stats');
  });

  it('reset layout clears saved prefs', () => {
    saveDashboardLayout(
      setDashboardWidgetSize(DEFAULT_DASHBOARD_LAYOUT, 'calendar', 'small'),
      'mgr-1'
    );
    const reset = resetDashboardLayout('mgr-1');
    expect(reset).toEqual(DEFAULT_DASHBOARD_LAYOUT);
    expect(loadDashboardLayout('mgr-1')).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('normalize drops unknown ids and fills missing widgets', () => {
    const normalized = normalizeDashboardLayout([
      { id: 'today_issues', size: 'small' },
      { id: 'not_real' as any, size: 'wide' },
    ]);
    expect(normalized.find(w => w.id === 'today_issues')?.size).toBe('small');
    expect(normalized.some(w => (w.id as string) === 'not_real')).toBe(false);
    expect(normalized.map(w => w.id)).toContain('today_issues');
    expect(normalized.map(w => w.id)).toEqual(
      expect.arrayContaining(DEFAULT_DASHBOARD_LAYOUT.map(w => w.id))
    );
    expect(normalized).toHaveLength(DEFAULT_DASHBOARD_LAYOUT.length);
  });
});
