'use client';

import { useEffect } from 'react';
import { isSwitchUiEnabled, SWITCH_UI_EVENT } from '@/lib/switchUiMode';

export function SwitchThemeSync() {
  useEffect(() => {
    const sync = () => {
      const enabled = isSwitchUiEnabled();
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('switch-theme-active', enabled);
      }
    };
    sync();
    window.addEventListener(SWITCH_UI_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SWITCH_UI_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return null;
}
