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
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    
    // 1. Direct query parameter support for QR codes (e.g. ?inspect=van-1 or ?vehicle=van-1 or ?v=van-1)
    const directInspect = urlParams.get('inspect') || urlParams.get('vehicle') || urlParams.get('v');
    if (directInspect) {
      router.replace(`/inspect?id=${encodeURIComponent(directInspect)}`);
      return;
    }

    // 2. 404.html redirect parameter (?p=/inspect/van-1234 or ?p=/vehicles/van-1234)
    const pParam = urlParams.get('p');
    const redirectPath = pParam ? decodeURIComponent(pParam) : sessionStorage.getItem('spa-redirect-path');

    if (redirectPath) {
      sessionStorage.removeItem('spa-redirect-path');
      
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/sunny';
      let appPath = redirectPath;
      if (appPath.startsWith(basePath)) {
        appPath = appPath.slice(basePath.length);
      }
      if (!appPath.startsWith('/')) {
        appPath = '/' + appPath;
      }

      // Convert legacy dynamic paths into query params
      if (appPath.startsWith('/inspect/') && !appPath.startsWith('/inspect?')) {
        const id = appPath.replace('/inspect/', '').split('?')[0];
        router.replace(`/inspect?id=${encodeURIComponent(id)}`);
        return;
      }
      if (appPath.startsWith('/vehicles/') && !appPath.startsWith('/vehicles/detail')) {
        const id = appPath.replace('/vehicles/', '').split('?')[0];
        router.replace(`/vehicles/detail?id=${encodeURIComponent(id)}`);
        return;
      }

      router.replace(appPath);
    }
  }, [router]);

  return null;
}
