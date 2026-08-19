'use client';

import React, { Suspense } from 'react';
import InspectClient from './InspectClient';

export default function InspectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading Inspection Checklist...</p>
          </div>
        </div>
      }
    >
      <InspectClient />
    </Suspense>
  );
}
