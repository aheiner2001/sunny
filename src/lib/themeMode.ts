export type ThemeMode = 'classic' | 'switch';

export const SUNNY_THEME_STORAGE_KEY = 'sunny_theme_mode';
export const SUNNY_THEME_CHANGE_EVENT = 'sunny_theme_change';

export function getThemeMode(): ThemeMode {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'classic';
  }
  const saved = localStorage.getItem(SUNNY_THEME_STORAGE_KEY);
  return saved === 'switch' ? 'switch' : 'classic';
}

export function setThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.setItem(SUNNY_THEME_STORAGE_KEY, mode);
  applyThemeModeClass();
  window.dispatchEvent(new CustomEvent(SUNNY_THEME_CHANGE_EVENT, { detail: { mode } }));
}

export function applyThemeModeClass(): void {
  if (typeof document === 'undefined') return;
  const isSwitch = getThemeMode() === 'switch';
  document.body.classList.toggle('theme-switch-ui', isSwitch);
}
