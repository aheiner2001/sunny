'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  RotateCcw, 
  ListChecks, 
  ShieldCheck, 
  Database,
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  Lock,
  Sparkles
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { ChecklistQuestion } from '@/types';

export default function SettingsPage() {
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setQuestions(dbService.getChecklistQuestions());
  }, []);

  const handleSyncToFirebase = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await dbService.syncAllToFirestore();
      setSyncStatus(res.message);
    } catch (e: any) {
      setSyncStatus(e.message || 'Failed to sync to Firebase');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all vehicle, inspection, and issue data to default initial state?')) {
      dbService.resetToDefaults();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Firebase Cloud & System Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage live Cloud Firestore synchronization, inspection criteria, and fleet security rules.
        </p>
      </div>

      {/* Cloud Firebase Connection Box */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Firebase Cloud Firestore</h2>
              <p className="text-xs text-slate-400">
                Project ID: <code className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">sunny-cf80c</code>
              </p>
            </div>
          </div>

          <button
            onClick={handleSyncToFirebase}
            disabled={isSyncing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
          >
            <CloudUpload className="w-4 h-4" />
            <span>{isSyncing ? 'Pushing to Firebase...' : 'Push Fleet Data to Firestore'}</span>
          </button>
        </div>

        {syncStatus && (
          <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{syncStatus}</p>
            </div>
          </div>
        )}

        {/* Firebase Console Rules Instructions */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Lock className="w-4 h-4 text-amber-500" />
            <span>Cloud Firestore Security Rules (Firebase Console)</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            To allow reading and writing inspections and issues from all employee phones, ensure Cloud Firestore rules in your{' '}
            <a
              href="https://console.firebase.google.com/project/sunny-cf80c/firestore/rules"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 font-bold underline inline-flex items-center gap-0.5"
            >
              Firebase Console <ExternalLink className="w-3 h-3" />
            </a>{' '}
            are set to:
          </p>
          <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // or: request.auth != null
    }
  }
}`}
          </pre>
        </div>

        <div className="flex justify-between items-center pt-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800">Reset Local Seed Baseline</h3>
            <p className="text-xs text-slate-400">Restore all vans, issues, and audit logs to the initial demo state.</p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Baseline</span>
          </button>
        </div>
      </div>

      {/* Checklist Configuration Overview */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Standard Vehicle Checklist Items ({questions.length})</h2>
            <p className="text-xs text-slate-400">Default checklist applied to all detailing fleet vans upon QR scan.</p>
          </div>
        </div>

        <div className="space-y-2">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-400 w-5">{idx + 1}.</span>
                <span className="font-semibold text-slate-800">{q.text}</span>
              </div>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded uppercase">
                {q.category.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
