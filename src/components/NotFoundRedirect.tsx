'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This component handles the SPA redirect for GitHub Pages.
 * When someone visits a dynamic route like /inspect/van-12345 that doesn't have
 * a pre-rendered HTML file, GitHub Pages serves the 404.html (which Next.js generates
 * from this not-found page). This component detects if the current URL looks like
 * a valid app route and performs client-side navigation to it.
 */
export default function NotFoundRedirect() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    const basePath = '/sunny';
    
    // Strip basePath to get the app-relative path
    let appPath = path;
    if (appPath.startsWith(basePath)) {
      appPath = appPath.slice(basePath.length);
    }
    if (!appPath.startsWith('/')) {
      appPath = '/' + appPath;
    }

    // Known dynamic route prefixes that should be handled client-side
    const dynamicPrefixes = ['/inspect/', '/vehicles/'];
    const shouldRedirect = dynamicPrefixes.some(prefix => appPath.startsWith(prefix));

    if (shouldRedirect) {
      setIsRedirecting(true);
      // Use router.replace to do client-side navigation to the dynamic route.
      // The page's client component (InspectClient, VehicleDetailClient) will
      // load the vehicle data from the local store.
      router.replace(appPath);
    }
  }, [router]);

  if (isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Page Not Found</h2>
        <p className="text-slate-500 mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
        <a
          href="/sunny/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white font-medium text-sm hover:bg-sky-700 transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
