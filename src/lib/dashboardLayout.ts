export type DashboardWidgetId =
  | 'stats'
  | 'today_issues'
  | 'open_issues'
  | 'in_use'
  | 'activity'
  | 'calendar'
  | 'lifespan'
  | 'safety';

export type DashboardWidgetSize = 'small' | 'medium' | 'wide';

export type DashboardWidgetLayout = {
  id: DashboardWidgetId;
  size: DashboardWidgetSize;
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidgetLayout[] = [
  { id: 'stats', size: 'wide' },
  { id: 'today_issues', size: 'medium' },
  { id: 'open_issues', size: 'medium' },
  { id: 'safety', size: 'medium' },
  { id: 'in_use', size: 'medium' },
  { id: 'activity', size: 'wide' },
  { id: 'lifespan', size: 'wide' },
  { id: 'calendar', size: 'wide' },
];

export const DASHBOARD_LAYOUT_KEY_PREFIX = 'sunny_dashboard_layout_';

export function dashboardLayoutStorageKey(userId?: string | null): string {
  return `${DASHBOARD_LAYOUT_KEY_PREFIX}${userId || 'anonymous'}`;
}

/** Issues reported on the local calendar day (YYYY-MM-DD). Distinct from open-issues backlog. */
export function filterTodaysIssues<T extends { dateString?: string; reportedAt?: string }>(
  issues: T[],
  todayString: string
): T[] {
  return issues.filter(issue => {
    if (issue.dateString) return issue.dateString === todayString;
    if (issue.reportedAt) return issue.reportedAt.slice(0, 10) === todayString;
    return false;
  });
}

export function sizeToColSpan(size: DashboardWidgetSize): string {
  switch (size) {
    case 'small':
      return 'md:col-span-1';
    case 'wide':
      return 'md:col-span-2 lg:col-span-3';
    case 'medium':
    default:
      return 'md:col-span-1 lg:col-span-1';
  }
}

export function normalizeDashboardLayout(
  layout: DashboardWidgetLayout[] | null | undefined
): DashboardWidgetLayout[] {
  if (!Array.isArray(layout) || layout.length === 0) {
    return DEFAULT_DASHBOARD_LAYOUT.map(w => ({ ...w }));
  }
  const seen = new Set<string>();
  const cleaned: DashboardWidgetLayout[] = [];
  for (const item of layout) {
    if (!item || typeof item.id !== 'string') continue;
    if (seen.has(item.id)) continue;
    if (!DEFAULT_DASHBOARD_LAYOUT.some(d => d.id === item.id)) continue;
    const size: DashboardWidgetSize =
      item.size === 'small' || item.size === 'wide' || item.size === 'medium' ? item.size : 'medium';
    cleaned.push({ id: item.id as DashboardWidgetId, size });
    seen.add(item.id);
  }
  for (const def of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seen.has(def.id)) cleaned.push({ ...def });
  }
  return cleaned;
}

export function loadDashboardLayout(userId?: string | null): DashboardWidgetLayout[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_DASHBOARD_LAYOUT.map(w => ({ ...w }));
  }
  try {
    const raw = localStorage.getItem(dashboardLayoutStorageKey(userId));
    if (!raw) return DEFAULT_DASHBOARD_LAYOUT.map(w => ({ ...w }));
    return normalizeDashboardLayout(JSON.parse(raw));
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT.map(w => ({ ...w }));
  }
}

export function saveDashboardLayout(
  layout: DashboardWidgetLayout[],
  userId?: string | null
): DashboardWidgetLayout[] {
  const normalized = normalizeDashboardLayout(layout);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(dashboardLayoutStorageKey(userId), JSON.stringify(normalized));
  }
  return normalized;
}

export function resetDashboardLayout(userId?: string | null): DashboardWidgetLayout[] {
  const defaults = DEFAULT_DASHBOARD_LAYOUT.map(w => ({ ...w }));
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(dashboardLayoutStorageKey(userId));
  }
  return defaults;
}

export function reorderDashboardLayout(
  layout: DashboardWidgetLayout[],
  fromId: DashboardWidgetId,
  toId: DashboardWidgetId
): DashboardWidgetLayout[] {
  const next = normalizeDashboardLayout(layout);
  const fromIndex = next.findIndex(w => w.id === fromId);
  const toIndex = next.findIndex(w => w.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return next;
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function setDashboardWidgetSize(
  layout: DashboardWidgetLayout[],
  id: DashboardWidgetId,
  size: DashboardWidgetSize
): DashboardWidgetLayout[] {
  return normalizeDashboardLayout(layout).map(w => (w.id === id ? { ...w, size } : w));
}
