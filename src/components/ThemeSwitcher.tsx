'use client';

import React, { useState, useEffect } from 'react';
import { getThemeMode, setThemeMode, applyThemeModeClass, SUNNY_THEME_CHANGE_EVENT, ThemeMode } from '@/lib/themeMode';

interface ThemeSwitcherProps {
  variant?: 'pills' | 'cards';
}

export function ThemeSwitcher({ variant = 'pills' }: ThemeSwitcherProps) {
  const [mode, setMode] = useState<ThemeMode>('classic');

  useEffect(() => {
    setMode(getThemeMode());
    applyThemeModeClass();

    const handleThemeChange = () => {
      setMode(getThemeMode());
    };

    window.addEventListener(SUNNY_THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(SUNNY_THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  const handleSelect = (newMode: ThemeMode) => {
    setThemeMode(newMode);
    setMode(newMode);
  };

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleSelect('classic')}
          className={`p-4 rounded-xl border text-left transition-all ${
            mode === 'classic' ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20 ring-2 ring-sky-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="font-semibold text-slate-900 dark:text-white">Classic Fleet OS</div>
          <div className="text-sm text-slate-500">Corporate, clean data-dense enterprise layout.</div>
        </button>
        <button
          type="button"
          onClick={() => handleSelect('switch')}
          className={`p-4 rounded-xl border text-left transition-all ${
            mode === 'switch' ? 'border-red-500 bg-red-50 dark:bg-red-950/20 ring-2 ring-red-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="font-semibold text-slate-900 dark:text-white">Nintendo Switch UI</div>
          <div className="text-sm text-slate-500">Software gallery card grid, capsule filters & sounds.</div>
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center rounded-full bg-slate-100 p-1 dark:bg-slate-800 text-xs font-medium">
      <button
        type="button"
        onClick={() => handleSelect('classic')}
        aria-label="Classic"
        className={`px-3 py-1 rounded-full transition-all ${
          mode === 'classic' ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        Classic
      </button>
      <button
        type="button"
        onClick={() => handleSelect('switch')}
        aria-label="Switch UI"
        className={`px-3 py-1 rounded-full transition-all ${
          mode === 'switch' ? 'bg-red-500 text-white font-semibold shadow' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        Switch UI
      </button>
    </div>
  );
}
