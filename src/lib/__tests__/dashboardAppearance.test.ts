/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyDashboardTheme, loadDashboardColor, saveDashboardColor } from '@/lib/dashboardAppearance';

describe('personal dashboard appearance', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to the standard palette and isolates managers', () => {
    expect(loadDashboardColor('a')).toBe(false);
    saveDashboardColor('a', true);
    expect(loadDashboardColor('a')).toBe(true);
    expect(loadDashboardColor('b')).toBe(false);
  });

  it('ignores malformed stored preferences', () => {
    localStorage.setItem('sunny_dashboard_color_a', 'broken');
    expect(loadDashboardColor('a')).toBe(false);
  });

  it('applies the palette across the app only for the manager who enabled it', () => {
    saveDashboardColor('manager-a', true);
    applyDashboardTheme('manager-a', true);
    expect(document.body.classList.contains('sunny-friendly-theme')).toBe(true);
    applyDashboardTheme('employee-b', false);
    expect(document.body.classList.contains('sunny-friendly-theme')).toBe(false);
    applyDashboardTheme('manager-c', true);
    expect(document.body.classList.contains('sunny-friendly-theme')).toBe(false);
  });

  it('updates the app theme when its settings switch changes', () => {
    saveDashboardColor('manager-a', true);
    applyDashboardTheme('manager-a', true);
    saveDashboardColor('manager-a', false);
    applyDashboardTheme('manager-a', true);
    expect(document.body.classList.contains('sunny-friendly-theme')).toBe(false);
  });
});
