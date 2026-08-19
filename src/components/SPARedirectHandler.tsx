'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Handles the GitHub Pages SPA redirect trick.
 * When GitHub Pages serves a 404 for a dynamic route (e.g. /sunny/inspect/van-12345),
 * our custom 404.html stores the original path in sessionStorage and redirects to the
 * base URL. This component picks up the stored path and navigates to it client-side.
 */
export function SPARedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    const redirectPath = sessionStorage.getItem('spa-redirect-path');
    if (redirectPath) {
      sessionStorage.removeItem('spa-redirect-path');
      
      // Strip the basePath (/sunny) to get the app-relative path
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/sunny';
      let appPath = redirectPath;
      if (appPath.startsWith(basePath)) {
        appPath = appPath.slice(basePath.length);
      }
      if (!appPath.startsWith('/')) {
        appPath = '/' + appPath;
      }

      router.replace(appPath);
    }
  }, [router]);

  return null;
}
