const PREFIX = 'sunny_dashboard_color_';

export function loadDashboardColor(userId?: string | null): boolean {
  if (!userId || typeof localStorage === 'undefined') return false;
  try {
    return JSON.parse(localStorage.getItem(`${PREFIX}${userId}`) || 'false') === true;
  } catch {
    return false;
  }
}

export function saveDashboardColor(userId: string, enabled: boolean): void {
  if (!userId || typeof localStorage === 'undefined') return;
  localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify(enabled));
}
