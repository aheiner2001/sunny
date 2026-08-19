'use client';

import React, { useState } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { QRScannerModal } from '@/components/QRScannerModal';
import { QrCode, X } from 'lucide-react';

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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <AuthProvider>
          <div className="flex min-h-screen bg-slate-50">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
              <Sidebar />
            </div>

            {/* Mobile Drawer */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex">
                <div 
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <div className="relative bg-white w-72 h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div onClick={() => setMobileMenuOpen(false)}>
                    <Sidebar />
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
              <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
              <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
                {children}
              </main>
            </div>
          </div>

          {/* Floating Mobile QR Scan Button */}
          <div className="fixed bottom-6 right-6 lg:hidden z-40">
            <button
              onClick={() => setScannerOpen(true)}
              className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-xl shadow-sky-600/30 border-2 border-white transition-all transform active:scale-95"
            >
              <QrCode className="w-5 h-5" />
              <span>Scan QR</span>
            </button>
          </div>

          {/* QR Scanner Modal (global) */}
          <QRScannerModal
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
