'use client';

import React, { useState } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { QRScannerModal } from '@/components/QRScannerModal';
import { QrCode, X } from 'lucide-react';
import { SPARedirectHandler } from '@/components/SPARedirectHandler';
import { PasscodeGate } from '@/components/PasscodeGate';
import { DashboardThemeSync } from '@/components/DashboardThemeSync';
import { SwitchLayoutShell } from '@/components/SwitchLayoutShell';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Sunny Fleet - Vehicle & Equipment Accountability</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="h-svh overflow-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-surface focus:text-ink focus:px-3 focus:py-2 focus:rounded-md"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <DashboardThemeSync />
          <SPARedirectHandler />
          <PasscodeGate>
            <SwitchLayoutShell>
              {children}
            </SwitchLayoutShell>
          </PasscodeGate>
        </AuthProvider>
      </body>
    </html>
  );
}
