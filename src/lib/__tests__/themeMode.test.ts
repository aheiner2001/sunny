import { describe, it, expect, beforeEach } from 'vitest';
import { getThemeMode, setThemeMode, applyThemeModeClass, SUNNY_THEME_STORAGE_KEY } from '../themeMode';

describe('themeMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  it('defaults to classic when no preference is stored', () => {
    expect(getThemeMode()).toBe('classic');
  });

  it('persists switch mode in localStorage and toggles CSS class', () => {
    setThemeMode('switch');
    expect(localStorage.getItem(SUNNY_THEME_STORAGE_KEY)).toBe('switch');
    expect(getThemeMode()).toBe('switch');

    applyThemeModeClass();
    expect(document.body.classList.contains('theme-switch-ui')).toBe(true);

    setThemeMode('classic');
    applyThemeModeClass();
    expect(document.body.classList.contains('theme-switch-ui')).toBe(false);
  });
});
