'use client';

import { useState, useEffect, useCallback } from 'react';

const SWITCH_UI_STORAGE_KEY = 'sunny_switch_ui_mode_enabled';
export const SWITCH_UI_EVENT = 'sunny_switch_mode_changed';

/** Check if Nintendo Switch UI mode is enabled. Defaults to false (Classic Sunny). */
export function isSwitchUiEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SWITCH_UI_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Enable or disable Nintendo Switch UI mode and notify all components */
export function setSwitchUiEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SWITCH_UI_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Non-blocking storage fallback
  }

  // Update body class for CSS scoping
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('switch-theme-active', enabled);
  }

  window.dispatchEvent(new CustomEvent(SWITCH_UI_EVENT, { detail: { enabled } }));
}

/** React hook for reading and updating Switch UI mode reactively across components */
export function useSwitchUiMode(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => isSwitchUiEnabled());

  useEffect(() => {
    // Sync initial state on mount (avoids hydration mismatch)
    const current = isSwitchUiEnabled();
    setEnabled(current);
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('switch-theme-active', current);
    }

    const handleModeChange = () => {
      const updated = isSwitchUiEnabled();
      setEnabled(updated);
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('switch-theme-active', updated);
      }
    };

    window.addEventListener(SWITCH_UI_EVENT, handleModeChange);
    window.addEventListener('storage', handleModeChange);
    return () => {
      window.removeEventListener(SWITCH_UI_EVENT, handleModeChange);
      window.removeEventListener('storage', handleModeChange);
    };
  }, []);

  const updateMode = useCallback((val: boolean) => {
    setSwitchUiEnabled(val);
  }, []);

  return [enabled, updateMode];
}
