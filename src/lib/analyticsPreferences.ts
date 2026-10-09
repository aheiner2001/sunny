/** Only ordinary overview widgets belong here. Urgent actions and setup never do. */
export const ANALYTICS_WIDGETS = ['metrics', 'outlook', 'vehicles', 'equipment'] as const;
export type AnalyticsWidgetId = typeof ANALYTICS_WIDGETS[number];
export interface AnalyticsLayoutPreferences { version: 1; order: AnalyticsWidgetId[]; hidden: AnalyticsWidgetId[]; }
export const analyticsWidgetLabels: Record<AnalyticsWidgetId, string> = { metrics: 'Fleet metrics', outlook: 'Service outlook', vehicles: 'Vehicle overview', equipment: 'Equipment service' };
export function defaultAnalyticsPreferences(): AnalyticsLayoutPreferences { return { version: 1, order: [...ANALYTICS_WIDGETS], hidden: [] }; }
const known = (value: unknown): value is AnalyticsWidgetId => typeof value === 'string' && (ANALYTICS_WIDGETS as readonly string[]).includes(value);
export function parseAnalyticsPreferences(raw: string | null): AnalyticsLayoutPreferences {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object') return defaultAnalyticsPreferences();
    const p = value as Record<string, unknown>;
    if (p.version !== 1 || !Array.isArray(p.order) || !Array.isArray(p.hidden)) return defaultAnalyticsPreferences();
    const order = Array.from(new Set(p.order.filter(known)));
    return { version: 1, order: [...order, ...ANALYTICS_WIDGETS.filter(id => !order.includes(id))], hidden: Array.from(new Set(p.hidden.filter(known))) };
  } catch { return defaultAnalyticsPreferences(); }
}
export function analyticsPreferenceKey(managerId: string): string { return `sunny.analytics.layout.v1:${encodeURIComponent(managerId)}`; }
export function loadAnalyticsPreferences(managerId: string): AnalyticsLayoutPreferences {
  if (!managerId || typeof window === 'undefined') return defaultAnalyticsPreferences();
  try { return parseAnalyticsPreferences(window.localStorage.getItem(analyticsPreferenceKey(managerId))); } catch { return defaultAnalyticsPreferences(); }
}
/** Returns normalized values; a false persisted flag lets UI report blocked storage honestly. */
export function saveAnalyticsPreferences(managerId: string, preferences: AnalyticsLayoutPreferences): boolean {
  if (!managerId || typeof window === 'undefined') return false;
  try { window.localStorage.setItem(analyticsPreferenceKey(managerId), JSON.stringify(parseAnalyticsPreferences(JSON.stringify(preferences)))); return true; } catch { return false; }
}
export function resetAnalyticsPreferences(managerId: string): AnalyticsLayoutPreferences {
  if (managerId && typeof window !== 'undefined') { try { window.localStorage.removeItem(analyticsPreferenceKey(managerId)); } catch { /* defaults still apply for this session */ } }
  return defaultAnalyticsPreferences();
}
export function moveAnalyticsWidget(preferences: AnalyticsLayoutPreferences, id: AnalyticsWidgetId, direction: -1 | 1): AnalyticsLayoutPreferences {
  const next = parseAnalyticsPreferences(JSON.stringify(preferences));
  const index = next.order.indexOf(id), target = index + direction;
  if (index < 0 || target < 0 || target >= next.order.length) return next;
  [next.order[index], next.order[target]] = [next.order[target], next.order[index]];
  return next;
}
