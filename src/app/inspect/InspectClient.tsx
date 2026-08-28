'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  User as UserIcon,
  Send,
  RotateCcw,
  Check,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { Vehicle, ChecklistQuestion, ChecklistCategoryConfig, InspectionResponse, FleetTask } from '@/types';
import { canSubmitInspection } from './inspectionValidation';
import { RecentInspectors } from '@/components/RecentInspectors';

export default function InspectClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vehicleId = searchParams?.get('id') || searchParams?.get('vehicle') || searchParams?.get('v') || '';
  const { user, role } = useAuth();
  const employeeFlow = role === 'employee' || searchParams?.get('mode') === 'employee';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<ChecklistCategoryConfig[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, { value: string; isFlagged: boolean; notes?: string }>>({});
  const [flagIssues, setFlagIssues] = useState<Record<string, { title: string; description: string }>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedInspection, setSubmittedInspection] = useState<any | null>(null);
  const [tasks, setTasks] = useState<FleetTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  const loadData = async () => {
    if (!vehicleId) {
      setIsLoading(false);
      setVehicle(null);
      return;
    }

    try {
      setIsLoading(true);
      let v = dbService.getVehicle(vehicleId) || dbService.getVehicleByQR(vehicleId);

      if (!v) {
        v = (await dbService.fetchVehicleAsync(vehicleId)) || undefined;
      }

      if (v) {
        setVehicle(v);
      } else {
        setVehicle(null);
      }

      const cats = dbService.getChecklistCategories();
      const qList = dbService.getChecklistQuestions();
      setCategories(cats);
      setQuestions(qList);
      const vehicleTasks = dbService.getTasks().filter(task => !task.vehicleId || task.vehicleId === v?.id);
      setTasks(vehicleTasks);
      const openTask = vehicleTasks.find(task => task.status === 'open');
      setSelectedTaskId(prev => prev || openTask?.id || '');
    } catch (error) {
      console.error('Error loading inspection data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, [vehicleId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-ink-muted">Loading Vehicle Inspection Checklist...</p>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    const allVehicles = dbService.getVehicles();
    return (
      <div className="page max-w-md mx-auto py-8 text-center space-y-6">
        <div className="card card-pad space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-ink">
              {vehicleId ? 'Vehicle Not Found' : 'Select Vehicle to Inspect'}
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              {vehicleId ? (
                <>The tag <code className="unit-tag font-mono text-[11px] font-bold">{vehicleId}</code> does not match an active vehicle.</>
              ) : (
                'Choose a vehicle from the fleet to begin today’s inspection checklist.'
              )}
            </p>
          </div>

          <div className="border-t border-line pt-4 text-left">
            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-2">
              Select vehicle:
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allVehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => router.push(`/inspect?id=${encodeURIComponent(v.id)}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-line hover:border-ink hover:bg-surface-sunk transition-all text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-ink-faint group-hover:text-ink" />
                    <div>
                      <div className="text-xs font-bold text-ink group-hover:text-ink">{v.vehicleNumber}</div>
                      <div className="text-[10px] text-ink-faint">{v.name} &bull; {v.licensePlate}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-ink transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Link href="/scan" className="link-action inline-flex items-center gap-1.5 text-xs font-bold">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Scan QR Code with Camera</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSetResponse = (q: ChecklistQuestion, value: string, isFlagged: boolean, notes?: string) => {
    setResponses(prev => ({
      ...prev,
      [q.id]: {
        value,
        isFlagged,
        notes: isFlagged ? (notes !== undefined ? notes : prev[q.id]?.notes || '') : ''
      }
    }));

    if (isFlagged && !flagIssues[q.id]) {
      setFlagIssues(prev => ({
        ...prev,
        [q.id]: {
          title: `${q.equipmentName || q.text.split(':')[0]} issue`,
          description: ''
        }
      }));
    } else if (!isFlagged && flagIssues[q.id]) {
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
    if (field === 'description') {
      setResponses(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          value: prev[questionId]?.value || '',
          isFlagged: Boolean(prev[questionId]?.isFlagged),
          notes: val
        }
      }));
    }
  };

  const requiredQuestions = questions.filter(q => q.required);
  const answeredCount = requiredQuestions.filter(q => {
    const v = responses[q.id]?.value;
    return v !== undefined && v !== null && v !== '';
  }).length;

  const flaggedCount = Object.keys(flagIssues).length;
  const allRequiredAnswered = canSubmitInspection(questions, responses);
  const flaggedMissingNotes = questions.some(q => {
    const resp = responses[q.id];
    return resp?.isFlagged && !(resp.notes || '').trim();
  });
  const canSubmit = allRequiredAnswered && !flaggedMissingNotes && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!allRequiredAnswered) {
      return;
    }

    if (flaggedMissingNotes) {
      alert('Please provide a problem description for all flagged items before submitting.');
      return;
    }

    for (const [, issue] of Object.entries(flagIssues)) {
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
          value: resp?.value || '',
          isFlagged: Boolean(resp?.isFlagged),
          notes: resp?.notes || '',
          equipmentId: q.equipmentId || null as any,
          equipmentName: q.equipmentName || null as any
        };
      });

      const flaggedList = Object.entries(flagIssues).map(([qId, issueData]) => {
        const question = questions.find(q => q.id === qId);
        const response = responses[qId];
        const quantities = issueData.description.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
        return {
          equipmentId: question?.equipmentId || null,
          equipmentName: question?.equipmentName || issueData.title || 'Equipment Item',
          title: issueData.title || 'Flagged Issue',
          description: issueData.description || '',
          questionType: question?.type,
          value: response?.value,
          reportedQuantity: quantities.length >= 2 ? quantities[0] : null,
          requiredQuantity: quantities.length >= 2 ? quantities[1] : null
        };
      });

      const result = dbService.submitInspection({
        vehicleId: vehicle.id,
        userId: user?.id || 'emp-anon',
        userName: user?.name || 'Employee Operator',
        userEmail: user?.email || 'employee@sunnyfleet.com',
        responses: inspectionResponses,
        flaggedIssues: flaggedList,
        generalNotes: generalNotes.trim() || null,
        taskId: selectedTaskId || null,
        scheduleLabel: selectedTask?.scheduleLabel || null,
        scheduledAt: selectedTask?.dueAt || null
      });

      setSubmittedInspection(result);
    } catch (err: any) {
      alert(err.message || 'Error submitting inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTask = tasks.find(task => task.id === selectedTaskId);

  if (submittedInspection) {
    const isPassed = submittedInspection.inspection.status === 'passed';
    return (
      <div className="page max-w-lg mx-auto py-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="card card-pad text-center">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
            isPassed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {isPassed ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
          </div>

          <h2 className="text-2xl font-extrabold text-ink mb-1">
            Inspection Submitted!
          </h2>
          <p className="text-xs text-ink-muted mb-6">
            Permanent record logged on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>

          <div className="card card-pad mb-6 text-left text-xs space-y-2 bg-[var(--surface)]">
            <div className="flex justify-between">
              <span className="text-ink-muted">Vehicle:</span>
              <span className="font-bold text-ink">{vehicle.vehicleNumber} ({vehicle.licensePlate})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Operator:</span>
              <span className="font-bold text-ink">{user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Overall Result:</span>
              <span className={`font-bold ${isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isPassed ? 'PASSED — All Green' : `ISSUES FOUND (${submittedInspection.newIssues.length} Flagged)`}
              </span>
            </div>
          </div>

          <div className="mb-6 text-left">
            <RecentInspectors vehicleId={vehicle.id} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/scan" className="btn btn-primary flex-1 justify-center">
              {employeeFlow ? 'Back to Scanner' : 'Scan Another Vehicle'}
            </Link>
            {!employeeFlow && (
              <Link
                href={`/vehicles/detail?id=${encodeURIComponent(vehicle.id)}`}
                className="btn btn-secondary flex-1 justify-center"
              >
                View Vehicle Timeline
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = requiredQuestions.length
    ? (answeredCount / requiredQuestions.length) * 100
    : 0;

  return (
    <div className="page max-w-2xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <Link href="/scan" className="btn btn-secondary btn-sm cluster gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>Rescan QR</span>
        </Link>
        <div className="flex items-center gap-2">
          {employeeFlow && (
            <span className="text-xs font-bold text-ink bg-surface-sunk px-3 py-1.5 rounded-xl border border-line">
              Employee To-Do
            </span>
          )}
          {flaggedCount > 0 ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {flaggedCount} Item{flaggedCount > 1 ? 's' : ''} Flagged
            </span>
          ) : answeredCount === requiredQuestions.length && flaggedCount === 0 ? (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              All Clear
            </span>
          ) : null}
        </div>
      </div>

      <div className="card card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="cluster items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface-sunk text-ink flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="cluster flex-wrap gap-2">
              <h1 className="text-base font-extrabold text-ink">{vehicle.vehicleNumber}</h1>
              <span className="unit-tag">{vehicle.licensePlate}</span>
            </div>
            <p className="text-xs text-ink-muted">{vehicle.name}</p>
          </div>
        </div>

        <div className="cluster items-center gap-2 self-end sm:self-auto bg-surface-sunk p-2 rounded-xl border border-line">
          <UserIcon className="w-4 h-4 text-ink" />
          <div className="text-left">
            <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">Operator</div>
            {employeeFlow ? (
              <div className="text-xs font-bold text-ink">{user?.name || 'Employee Operator'}</div>
            ) : (
              <select
                value={user?.id || ''}
                onChange={(e) => {
                  const selected = dbService.getUser(e.target.value);
                  if (selected) {
                    localStorage.setItem('sunny_current_user_id', selected.id);
                    window.dispatchEvent(new Event('sunny_db_update'));
                  }
                }}
                className="text-xs font-bold text-ink bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
              >
                {dbService.getUsers().map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-surface border-b border-line py-2 space-y-2">
        <div>
          <p className="text-sm text-ink-muted">Answered {answeredCount} / {requiredQuestions.length}</p>
          <div className="h-1.5 bg-surface-sunk rounded-full mt-1">
            <div
              className="h-full bg-ink rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border border-line bg-surface-sunk text-ink-muted hover:text-ink hover:bg-surface-alt transition-colors"
              >
                {cat.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card card-pad space-y-6">
        <div className="border-b border-line pb-3">
          <h2 className="text-base font-bold text-ink">
            Inspection Checklist
          </h2>
          <p className="text-xs text-ink-faint mt-0.5">
            Complete all required items before vehicle checkout.
          </p>
        </div>

        <div className="space-y-8">
          {categories.map(cat => {
            const categoryQuestions = questions
              .filter(q => q.category === cat.id)
              .sort((a, b) => a.order - b.order);

            return (
              <section key={cat.id} id={`cat-${cat.id}`} className="space-y-3 scroll-mt-24">
                <div>
                  <h2 className="text-sm font-extrabold text-ink uppercase tracking-wide">
                    {cat.title}
                  </h2>
                  {cat.subtitle && (
                    <p className="text-xs text-ink-muted mt-0.5">{cat.subtitle}</p>
                  )}
                </div>

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
                            : 'border-line bg-surface-sunk/50 hover:bg-surface-sunk'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-ink leading-snug">{q.text}</p>
                            {q.helperText && (
                              <p className="text-[11px] text-ink-faint mt-0.5">{q.helperText}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {q.type === 'equipment_status' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSetResponse(q, 'working', false)}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    resp?.value === 'working' && !isFlagged
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
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
                                      : 'bg-surface border border-line text-amber-700 hover:bg-amber-50'
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
                                      : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
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
                                      : 'bg-surface border border-line text-rose-700 hover:bg-rose-50'
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
                                      : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
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
                                      : 'bg-surface border border-line text-rose-700 hover:bg-rose-50'
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
                                      : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
                                  }`}
                                >
                                  {isFlagged ? '⚠️ Flagged' : 'Flag Concern'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {q.type === 'text' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              placeholder="Type note or response..."
                              value={resp?.value || ''}
                              onChange={(e) => handleSetResponse(q, e.target.value, isFlagged)}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-ink/20"
                            />
                          </div>
                        )}

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
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-surface focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            />
                            {q.reasonPresets && q.reasonPresets.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {q.reasonPresets.map(reason => (
                                  <button
                                    key={reason}
                                    type="button"
                                    onClick={() => handleIssueChange(q.id, 'description', currentIssue?.description ? `${currentIssue.description}, ${reason}` : reason)}
                                    className="px-2 py-1 rounded-lg bg-surface border border-amber-200 text-[10px] font-bold text-amber-800 hover:bg-amber-50"
                                  >
                                    {reason}
                                  </button>
                                ))}
                              </div>
                            )}
                            <textarea
                              rows={2}
                              placeholder="Detailed explanation of what is wrong or needs repair..."
                              value={currentIssue?.description || ''}
                              onChange={(e) => handleIssueChange(q.id, 'description', e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-surface focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {categoryQuestions.length === 0 && (
                    <div className="text-center py-6 bg-surface-sunk rounded-2xl border border-line text-xs text-ink-faint">
                      No questions configured in this category yet.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card card-pad space-y-4">
        {tasks.length > 0 && (
          <div className="p-3 rounded-2xl bg-surface-sunk border border-line">
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">Scheduled inspection / task</label>
            <select
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface"
            >
              <option value="">Unscheduled inspection</option>
              {tasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                  {task.status === 'completed' ? ' (completed)' : ''}
                  {task.dueAt ? ` · ${new Date(task.dueAt).toLocaleString()}` : ''}
                </option>
              ))}
            </select>
            {selectedTask?.status === 'completed' && (
              <p className="text-[11px] text-amber-700 mt-1">
                This scheduled task was already completed; submitting will create an additional intentional record.
              </p>
            )}
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
            General Inspection Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Any additional remarks, route notes, or route prep info..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-ink/20"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary btn-block py-4 rounded-2xl text-sm font-extrabold gap-2 active:scale-[0.99]"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Submitting to Fleet Log...' : 'Submit Vehicle Inspection'}</span>
        </button>
        {!isSubmitting && !allRequiredAnswered && (
          <p className="text-center text-xs text-ink-muted">
            Answer every required question before submitting.
          </p>
        )}
        {!isSubmitting && allRequiredAnswered && flaggedMissingNotes && (
          <p className="text-center text-xs text-amber-700">
            Add a problem description for every flagged item before submitting.
          </p>
        )}
      </form>
    </div>
  );
}
