/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadDashboardColor, saveDashboardColor } from '@/lib/dashboardAppearance';

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
});
