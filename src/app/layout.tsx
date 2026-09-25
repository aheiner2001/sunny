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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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
            <div className="flex h-full min-h-0">
              {/* Desktop Sidebar: viewport-tall so it never scrolls away with the page. */}
              <div className="hidden lg:flex h-full shrink-0">
                <Sidebar />
              </div>

              {/* Mobile Drawer */}
              {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden flex">
                  <div
                    className="fixed inset-0 bg-ink/60 backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <div className="relative bg-surface w-72 h-full shadow-lg flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
                    <div className="absolute top-4 right-4">
                      <button
                        type="button"
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-1 rounded-full text-ink-muted hover:bg-surface-sunk"
                        aria-label="Close menu"
                      >
                        <X className="w-5 h-5" aria-hidden />
                      </button>
                    </div>
                    <div onClick={() => setMobileMenuOpen(false)}>
                      <Sidebar />
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content Area: header stays put; only this pane scrolls. */}
              <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  <main id="main-content" className="w-full max-w-[1400px] mx-auto px-[var(--gutter)] py-4 sm:py-8 pb-24 lg:pb-8">
                    {children}
                  </main>
                </div>
              </div>
            </div>

            {/* Floating Mobile QR Scan Button */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="btn btn-primary flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg lg:hidden fixed bottom-6 right-6 z-40"
            >
              <QrCode className="w-5 h-5" aria-hidden />
              <span>Scan QR</span>
            </button>

            {/* QR Scanner Modal (global) */}
            <QRScannerModal
              isOpen={scannerOpen}
              onClose={() => setScannerOpen(false)}
            />
          </PasscodeGate>
        </AuthProvider>
      </body>
    </html>
  );
}
