'use client';

import { useEffect } from 'react';
import { dbService } from '@/lib/db';
import { applyAppTheme } from '@/lib/theme';

export function ThemeInit() {
  useEffect(() => {
    const { theme } = dbService.getAppSettings();
    applyAppTheme(theme ?? 'light');
  }, []);

  return null;
}
