export function applyAppTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
}
