const PREFIX = 'sunny_dashboard_color_';
export const DASHBOARD_APPEARANCE_EVENT = 'sunny_dashboard_appearance_change';

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
  window.dispatchEvent(new Event(DASHBOARD_APPEARANCE_EVENT));
}

/** The body class themes every page while the signed-in account is a manager. */
export function applyDashboardTheme(userId?: string | null, isTrueManager = false): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('sunny-friendly-theme', Boolean(isTrueManager && loadDashboardColor(userId)));
}
