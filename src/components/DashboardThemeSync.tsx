'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { applyDashboardTheme, DASHBOARD_APPEARANCE_EVENT } from '@/lib/dashboardAppearance';

export function DashboardThemeSync() {
  const { user, isTrueManager } = useAuth();
  useEffect(() => {
    const sync = () => applyDashboardTheme(user?.id, isTrueManager);
    sync();
    window.addEventListener(DASHBOARD_APPEARANCE_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_APPEARANCE_EVENT, sync);
  }, [user?.id, isTrueManager]);
  return null;
}
