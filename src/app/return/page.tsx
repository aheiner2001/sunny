'use client';

import React, { Suspense } from 'react';
import ReturnClient from './ReturnClient';

export default function ReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-ink-muted">Loading return checklist...</p>
          </div>
        </div>
      }
    >
      <ReturnClient />
    </Suspense>
  );
}
