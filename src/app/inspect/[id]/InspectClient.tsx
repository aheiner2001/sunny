'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  User as UserIcon, 
  ShieldCheck, 
  Wrench, 
  Sparkles, 
  Send,
  HelpCircle,
  Clock,
  RotateCcw,
  Check,
  FileText
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { Vehicle, ChecklistQuestion, ChecklistCategoryConfig, InspectionResponse } from '@/types';

const ICON_MAP: Record<string, any> = {
  Wrench,
  Sparkles,
  Truck,
  ShieldCheck,
  FileText
};

export default function InspectVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params?.id as string;
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [categories, setCategories] = useState<ChecklistCategoryConfig[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<string>('equipment');
  const [responses, setResponses] = useState<Record<string, { value: string; isFlagged: boolean; notes?: string }>>({});
  const [flagIssues, setFlagIssues] = useState<Record<string, { title: string; description: string }>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedInspection, setSubmittedInspection] = useState<any | null>(null);

  const loadData = () => {
    if (!vehicleId) return;
    const v = dbService.getVehicle(vehicleId) || dbService.getVehicleByQR(vehicleId);
    if (v) {
      setVehicle(v);
    }
    const cats = dbService.getChecklistCategories();
    const qList = dbService.getChecklistQuestions();
    setCategories(cats);
    setQuestions(qList);

    if (cats.length > 0 && !cats.some(c => c.id === activeTab)) {
      setActiveTab(cats[0].id);
    }

    // Initialize default responses
    setResponses(prev => {
      const initial: Record<string, { value: string; isFlagged: boolean; notes?: string }> = { ...prev };
      qList.forEach(q => {
        if (!initial[q.id]) {
          if (q.type === 'pass_fail') initial[q.id] = { value: 'pass', isFlagged: false };
          else if (q.type === 'yes_no') initial[q.id] = { value: 'yes', isFlagged: false };
          else if (q.type === 'equipment_status') initial[q.id] = { value: 'working', isFlagged: false };
          else if (q.type === 'text') initial[q.id] = { value: '', isFlagged: false, notes: '' };
          else initial[q.id] = { value: 'pass', isFlagged: false };
        }
      });
      return initial;
    });
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, [vehicleId]);

  if (!vehicle) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-sm mb-4">
          Vehicle "{vehicleId}" not found.
        </div>
        <Link href="/scan" className="text-xs font-bold text-sky-600 hover:underline">
          Return to QR Scanner
        </Link>
      </div>
    );
  }

  // Handle Response Click
  const handleSetResponse = (q: ChecklistQuestion, value: string, isFlagged: boolean, notes?: string) => {
    setResponses(prev => ({
      ...prev,
      [q.id]: { value, isFlagged, notes: notes !== undefined ? notes : prev[q.id]?.notes || '' }
    }));

    if (isFlagged && !flagIssues[q.id]) {
      // Auto prefill issue template
      setFlagIssues(prev => ({
        ...prev,
        [q.id]: {
          title: `${q.equipmentName || q.text.split(':')[0]} issue`,
          description: ''
        }
      }));
    } else if (!isFlagged && flagIssues[q.id]) {
      // Remove issue if unflagged
      const updated = { ...flagIssues };
      delete updated[q.id];
      setFlagIssues(updated);
    }
  };

  const handleIssueChange = (questionId: string, field: 'title' | 'description', val: string) => {
    setFlagIssues(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: val
      }
    }));
  };

  const flaggedCount = Object.keys(flagIssues).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if any flagged item lacks description
    for (const [qId, issue] of Object.entries(flagIssues)) {
      if (!issue.description || !issue.description.trim()) {
        alert('Please provide a problem description for all flagged items before submitting.');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const inspectionResponses: InspectionResponse[] = questions.map(q => {
        const resp = responses[q.id];
        return {
          questionId: q.id,
          questionText: q.text,
          category: q.category,
          value: resp?.value || (q.type === 'text' ? '' : 'pass'),
          isFlagged: Boolean(resp?.isFlagged),
          notes: resp?.notes || '',
          equipmentId: q.equipmentId || null as any,
          equipmentName: q.equipmentName || null as any
        };
      });

      const flaggedList = Object.entries(flagIssues).map(([qId, issueData]) => {
        const question = questions.find(q => q.id === qId);
        return {
          equipmentId: question?.equipmentId || null,
          equipmentName: question?.equipmentName || issueData.title || 'Equipment Item',
          title: issueData.title || 'Flagged Issue',
          description: issueData.description || ''
        };
      });

      const result = dbService.submitInspection({
        vehicleId: vehicle.id,
        userId: user?.id || 'emp-anon',
        userName: user?.name || 'Employee Operator',
        userEmail: user?.email || 'employee@sunnyfleet.com',
        responses: inspectionResponses,
        flaggedIssues: flaggedList,
        generalNotes: generalNotes.trim() || null
      });

      setSubmittedInspection(result);
    } catch (err: any) {
      alert(err.message || 'Error submitting inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view
  if (submittedInspection) {
    const isPassed = submittedInspection.inspection.status === 'passed';
    return (
      <div className="max-w-lg mx-auto py-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
            isPassed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {isPassed ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
            Inspection Submitted!
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Permanent record logged on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left text-xs space-y-2 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Vehicle:</span>
              <span className="font-bold text-slate-900">{vehicle.vehicleNumber} ({vehicle.licensePlate})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Operator:</span>
              <span className="font-bold text-slate-900">{user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Overall Result:</span>
              <span className={`font-bold ${isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isPassed ? 'PASSED — All Green' : `ISSUES FOUND (${submittedInspection.newIssues.length} Flagged)`}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard"
              className="flex-1 px-4 py-3 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 shadow-sm transition-colors text-center"
            >
              Go to Dashboard
            </Link>
            <Link
              href={`/vehicles/${vehicle.id}`}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors text-center"
            >
              View Vehicle Timeline
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active Category Questions
  const categoryQuestions = questions.filter(q => q.category === activeTab);
  const activeCategoryObj = categories.find(c => c.id === activeTab);

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/scan"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Rescan QR</span>
        </Link>
        <div className="flex items-center gap-2">
          {flaggedCount > 0 ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {flaggedCount} Item{flaggedCount > 1 ? 's' : ''} Flagged
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              All Clear
            </span>
          )}
        </div>
      </div>

      {/* Vehicle Info Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900">{vehicle.vehicleNumber}</h1>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {vehicle.licensePlate}
              </span>
            </div>
            <p className="text-xs text-slate-500">{vehicle.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
          <UserIcon className="w-4 h-4 text-sky-600" />
          <div className="text-left">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Operator</div>
            <select
              value={user?.id || ''}
              onChange={(e) => {
                const selected = dbService.getUser(e.target.value);
                if (selected) {
                  localStorage.setItem('sunny_current_user_id', selected.id);
                  window.dispatchEvent(new Event('sunny_db_update'));
                }
              }}
              className="text-xs font-bold text-slate-900 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              {dbService.getUsers().map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {categories.map((cat, idx) => {
          const isActive = activeTab === cat.id;
          const catQuestions = questions.filter(q => q.category === cat.id);
          const hasFlags = catQuestions.some(q => responses[q.id]?.isFlagged);

          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`p-3 rounded-2xl text-left border transition-all relative ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isActive ? 'text-sky-400' : 'text-slate-400'}`}>
                  Step {idx + 1}
                </span>
                {hasFlags && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                )}
              </div>
              <div className="text-xs font-bold truncate">{cat.title}</div>
            </button>
          );
        })}
      </div>

      {/* Checklist Section Body */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {activeCategoryObj?.title || 'Inspection'} Checklist
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeCategoryObj?.subtitle || 'Complete all items before vehicle checkout.'}
          </p>
        </div>

        {/* Questions list */}
        <div className="space-y-4">
          {categoryQuestions.map((q) => {
            const resp = responses[q.id];
            const isFlagged = Boolean(resp?.isFlagged);
            const currentIssue = flagIssues[q.id];

            return (
              <div
                key={q.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isFlagged
                    ? 'border-amber-300 bg-amber-50/40'
                    : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 leading-snug">{q.text}</p>
                    {q.helperText && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{q.helperText}</p>
                    )}
                  </div>

                  {/* Ergonomic 1-tap buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {q.type === 'equipment_status' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSetResponse(q, 'working', false)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            resp?.value === 'working' && !isFlagged
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          ✓ Working
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetResponse(q, 'flagged', true)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            isFlagged
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          ⚠️ Flag Issue
                        </button>
                      </>
                    )}

                    {q.type === 'pass_fail' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSetResponse(q, 'pass', false)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            resp?.value === 'pass' && !isFlagged
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetResponse(q, 'fail', true)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            isFlagged
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          Fail / Flag
                        </button>
                      </>
                    )}

                    {q.type === 'yes_no' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSetResponse(q, 'yes', false)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            resp?.value === 'yes' && !isFlagged
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetResponse(q, 'no', true)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            isFlagged
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          No (Flag)
                        </button>
                      </>
                    )}

                    {q.type === 'text' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetResponse(q, resp?.value || '', !isFlagged)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isFlagged
                              ? 'bg-amber-500 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {isFlagged ? '⚠️ Flagged' : 'Flag Concern'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Text Note Field for 'text' question type */}
                {q.type === 'text' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Type note or response..."
                      value={resp?.value || ''}
                      onChange={(e) => handleSetResponse(q, e.target.value, isFlagged)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}

                {/* Inline Flag Description Drawer */}
                {isFlagged && (
                  <div className="mt-3 pt-3 border-t border-amber-200/80 bg-amber-100/40 p-3 rounded-xl space-y-2 animate-in fade-in duration-150">
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Describe the problem for the permanent log
                    </div>
                    <input
                      type="text"
                      placeholder="Issue title (e.g. Hose leak, Missing towel pack)"
                      value={currentIssue?.title || ''}
                      onChange={(e) => handleIssueChange(q.id, 'title', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                    />
                    <textarea
                      rows={2}
                      placeholder="Detailed explanation of what is wrong or needs repair..."
                      value={currentIssue?.description || ''}
                      onChange={(e) => handleIssueChange(q.id, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {categoryQuestions.length === 0 && (
            <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-400">
              No questions configured in this category yet.
            </div>
          )}
        </div>

        {/* Tab Navigation Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const curIdx = categories.findIndex(c => c.id === activeTab);
              if (curIdx > 0) setActiveTab(categories[curIdx - 1].id);
            }}
            disabled={categories.length === 0 || activeTab === categories[0]?.id}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
          >
            Previous Section
          </button>

          {categories.length > 0 && activeTab !== categories[categories.length - 1]?.id ? (
            <button
              type="button"
              onClick={() => {
                const curIdx = categories.findIndex(c => c.id === activeTab);
                if (curIdx < categories.length - 1) setActiveTab(categories[curIdx + 1].id);
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm flex items-center gap-1.5"
            >
              <span>Next Section</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-xs font-bold text-sky-600">Final Step: Review & Submit below</span>
          )}
        </div>
      </div>

      {/* General Notes & Submit Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            General Inspection Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Any additional remarks, route notes, or route prep info..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Submitting to Fleet Log...' : 'Submit Vehicle Inspection'}</span>
        </button>
      </form>
    </div>
  );
}


