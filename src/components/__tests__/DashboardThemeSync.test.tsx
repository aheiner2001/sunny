/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { saveDashboardColor } from '@/lib/dashboardAppearance';
import { setThemeMode } from '@/lib/themeMode';

const auth = vi.hoisted(() => ({ userId: 'manager-a', isTrueManager: true }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: auth.userId }, isTrueManager: auth.isTrueManager }),
}));
import { DashboardThemeSync } from '@/components/DashboardThemeSync';

afterEach(() => {
  auth.userId = 'manager-a';
  auth.isTrueManager = true;
  localStorage.clear();
  document.body.classList.remove('sunny-friendly-theme');
  document.body.classList.remove('theme-switch-ui');
});

it('updates all pages immediately when a manager changes the palette and clears it on account switch', async () => {
  localStorage.clear();
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<DashboardThemeSync />));
  expect(document.body.classList.contains('sunny-friendly-theme')).toBe(false);
  await act(async () => saveDashboardColor('manager-a', true));
  expect(document.body.classList.contains('sunny-friendly-theme')).toBe(true);
  auth.userId = 'employee-b';
  auth.isTrueManager = false;
  await act(async () => root.render(<DashboardThemeSync />));
  expect(document.body.classList.contains('sunny-friendly-theme')).toBe(false);
  await act(async () => root.unmount());
});

it('applies theme-switch-ui class on mount and when SUNNY_THEME_CHANGE_EVENT fires', async () => {
  localStorage.setItem('sunny_theme_mode', 'switch');
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<DashboardThemeSync />));
  expect(document.body.classList.contains('theme-switch-ui')).toBe(true);

  await act(async () => setThemeMode('classic'));
  expect(document.body.classList.contains('theme-switch-ui')).toBe(false);

  await act(async () => setThemeMode('switch'));
  expect(document.body.classList.contains('theme-switch-ui')).toBe(true);

  await act(async () => root.unmount());
});
