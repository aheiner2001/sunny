'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import {
  Clock,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  History,
  PlusCircle,
  FileText,
  UserCheck,
  Shield,
  Coffee,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  X,
  Pencil,
  Cloud,
  Download,
  Table2,
} from 'lucide-react';
import HistoricalHoursRecovery from './HistoricalHoursRecovery';
import { useAuth } from '@/context/AuthContext';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';
import { downloadTimesheetCsv } from '@/lib/timesheets/timesheetExport';
import { humanizeTimesheetError } from '@/lib/timesheets/timesheetMessages';
import { playSwitchSound } from '@/lib/switchAudio';
import {
  DEFAULT_TIMEZONE,
  formatSecondsToHours,
  calculateNetSeconds,
  getWeekBoundariesUtc,
  isEveningTime,
} from '@/lib/timesheets/timeCalculations';
import type {
  ShiftRecord,
  ShiftStatus,
  PunchSource,
  CorrectionRequest,
  AuditEvent,
} from '@/lib/timesheets/types';

export default function TimesheetsClient() {
  const { user, role } = useAuth();
  const isManager = role === 'manager';

  // Navigation / View Tabs: Employees always see 'employee'; managers can toggle
  const [activeTab, setActiveTab] = useState<'employee' | 'manager'>(() =>
    isManager ? 'manager' : 'employee'
  );

  // Sync activeTab when role updates
  useEffect(() => {
    if (role === 'manager') {
      setActiveTab('manager');
    } else {
      setActiveTab('employee');
    }
  }, [role]);

  // Selected week anchor (in America/Denver)
  const [currentWeekAnchor, setCurrentWeekAnchor] = useState<DateTime>(() =>
    DateTime.now().setZone(DEFAULT_TIMEZONE)
  );

  // Compute week boundaries
  const { weekStartUtc, weekEndUtc } = useMemo(() => {
    return getWeekBoundariesUtc(currentWeekAnchor.toISO()!, DEFAULT_TIMEZONE);
  }, [currentWeekAnchor]);

  const weekLabel = useMemo(() => {
    const startDt = DateTime.fromISO(weekStartUtc, { zone: DEFAULT_TIMEZONE });
    const endDt = DateTime.fromISO(weekEndUtc, { zone: DEFAULT_TIMEZONE });
    return `${startDt.toFormat('LLL d')} – ${endDt.toFormat('LLL d, yyyy')}`;
  }, [weekStartUtc, weekEndUtc]);

  // State data
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [punchBusy, setPunchBusy] = useState(false);
  const [tableViewOpen, setTableViewOpen] = useState(false);

  // Modals state
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(0);
  const [isEveningWarningOpen, setIsEveningWarningOpen] = useState(false);

  const [isMissingHoursModalOpen, setIsMissingHoursModalOpen] = useState(false);
  const [missingForm, setMissingForm] = useState({
    start: '',
    end: '',
    breakMinutes: 0,
    reason: '',
  });

  const [correctionShift, setCorrectionShift] = useState<ShiftRecord | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    start: '',
    end: '',
    breakMinutes: 0,
    reason: '',
  });

  // Manager feedback modal
  const [returnModalShift, setReturnModalShift] = useState<ShiftRecord | null>(null);
  const [returnFeedback, setReturnFeedback] = useState('');

  // Manager correction-request review (reject note)
  const [rejectingRequest, setRejectingRequest] = useState<CorrectionRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [correctionReviewBusy, setCorrectionReviewBusy] = useState(false);

  // Manager edit drawer
  const [managerEditShift, setManagerEditShift] = useState<ShiftRecord | null>(null);
  const [managerEditForm, setManagerEditForm] = useState({
    start: '',
    end: '',
    breakMinutes: 0,
    reason: '',
  });

  // Manager review table filters
  const [managerEmployeeFilter, setManagerEmployeeFilter] = useState<string>('all');
  const [managerStatusFilter, setManagerStatusFilter] = useState<string>('all');

  // Audit history drawer
  const [auditShift, setAuditShift] = useState<ShiftRecord | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [syncStatus, setSyncStatus] = useState(() => timesheetStore.getSyncStatus());

  const isSyncDegraded = useMemo(
    () => /failed|cached|\bwaiting\b|unavailable|permission|was not saved/i.test(syncStatus),
    [syncStatus],
  );
  const isCloudSyncFailure = useMemo(
    () => /cloud sync failed|cloud sync unavailable|permission/i.test(syncStatus),
    [syncStatus],
  );

  const syncBannerClasses = useMemo(() => {
    if (isSyncDegraded) {
      return {
        container:
          'bg-rose-500/10 border border-amber-500/30 text-rose-900 dark:text-rose-200',
        iconWrap: 'bg-rose-500/20 text-rose-600 dark:text-rose-300',
        badge:
          'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200',
        subtitle: 'text-rose-700 dark:text-rose-300/80',
      };
    }
    if (/Firebase Cloud Sync Active|timesheet save confirmed|Recovered hours review saved/i.test(syncStatus)) {
      return {
        container:
          'bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200',
        iconWrap: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
        badge:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
        subtitle: 'text-emerald-700 dark:text-emerald-300/80',
      };
    }
    return {
      container:
        'bg-slate-500/10 border border-slate-500/30 text-slate-900 dark:text-slate-200',
      iconWrap: 'bg-slate-500/20 text-slate-600 dark:text-slate-300',
      badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200',
      subtitle: 'text-slate-700 dark:text-slate-300/80',
    };
  }, [syncStatus, isSyncDegraded]);

  // Refresh all records from store
  const refreshData = useCallback(() => {
    setSyncStatus(timesheetStore.getSyncStatus());
    const all = timesheetStore.getAllShifts();
    setShifts(all);

    // Managers need the full correction queue; employees only see their own.
    if (isManager) {
      setCorrectionRequests(timesheetStore.getAllCorrectionRequests());
    } else if (user?.id) {
      setCorrectionRequests(timesheetStore.getCorrectionRequestsByEmployee(user.id));
    } else {
      setCorrectionRequests([]);
    }

    if (user?.id) {
      const guard = timesheetStore.getActiveShiftGuard(user.id);
      if (guard?.activeShiftId) {
        const found = timesheetStore.getShift(guard.activeShiftId);
        setActiveShift(found && found.status === 'active' ? found : null);
      } else {
        const active = all.find((s) => s.employeeId === user.id && s.status === 'active');
        setActiveShift(active || null);
      }
    } else {
      setActiveShift(null);
    }
  }, [user?.id, isManager]);

  useEffect(() => {
    timesheetStore.init();
    refreshData();
    const handleUpdate = () => {
      refreshData();
    };
    window.addEventListener('sunny_timesheet_update', handleUpdate);
    return () => {
      window.removeEventListener('sunny_timesheet_update', handleUpdate);
    };
  }, [refreshData]);

  // Live timer tick for active shift
  useEffect(() => {
    if (!activeShift) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => {
      const startMs = new Date(activeShift.startAtUtc).getTime();
      const nowMs = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeShift]);

  // Format HH:MM:SS
  const formatTimer = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
  };

  // Week navigation
  const handlePrevWeek = () => setCurrentWeekAnchor((prev) => prev.minus({ weeks: 1 }));
  const handleThisWeek = () => setCurrentWeekAnchor(DateTime.now().setZone(DEFAULT_TIMEZONE));
  const handleNextWeek = () => setCurrentWeekAnchor((prev) => prev.plus({ weeks: 1 }));

  // Summaries
  const employeeSummary = useMemo(() => {
    if (!user?.id) return { approvedSeconds: 0, pendingSeconds: 0, activeCount: 0, attentionCount: 0 };
    return timesheetService.getWeeklySummary(user.id, currentWeekAnchor.toISO()!, DEFAULT_TIMEZONE);
  }, [user?.id, currentWeekAnchor, shifts]);

  const teamSummary = useMemo(() => {
    return timesheetService.getWeeklySummary(undefined, currentWeekAnchor.toISO()!, DEFAULT_TIMEZONE);
  }, [currentWeekAnchor, shifts]);

  // Filter shifts by week
  const filterShiftsByWeek = (shiftList: ShiftRecord[]) => {
    const startMs = new Date(weekStartUtc).getTime();
    const endMs = new Date(weekEndUtc).getTime();
    return shiftList.filter((s) => {
      const sStart = new Date(s.startAtUtc).getTime();
      return sStart >= startMs && sStart <= endMs;
    });
  };

  const employeeWeekShifts = useMemo(() => {
    if (!user?.id) return [];
    return filterShiftsByWeek(shifts.filter((s) => s.employeeId === user.id));
  }, [user?.id, shifts, weekStartUtc, weekEndUtc]);

  const teamWeekShifts = useMemo(() => {
    return filterShiftsByWeek(shifts);
  }, [shifts, weekStartUtc, weekEndUtc]);

  const teamEmployees = useMemo(() => {
    const names = new Set<string>();
    shifts.forEach((s) => {
      if (s.employeeName) names.add(s.employeeName);
    });
    return Array.from(names).sort();
  }, [shifts]);

  const filteredTeamShifts = useMemo(() => {
    return teamWeekShifts.filter((shift) => {
      if (managerEmployeeFilter !== 'all' && shift.employeeName !== managerEmployeeFilter && shift.employeeId !== managerEmployeeFilter) {
        return false;
      }
      if (managerStatusFilter !== 'all' && shift.status !== managerStatusFilter) {
        return false;
      }
      return true;
    });
  }, [teamWeekShifts, managerEmployeeFilter, managerStatusFilter]);

  /** All pending employee correction / missing-hours requests (not week-gated). */
  const pendingCorrectionRequests = useMemo(() => {
    return correctionRequests
      .filter((r) => r.status === 'pending')
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [correctionRequests]);

  const isProposedInSelectedWeek = useCallback(
    (proposedStart: string) => {
      const t = new Date(proposedStart).getTime();
      return t >= new Date(weekStartUtc).getTime() && t <= new Date(weekEndUtc).getTime();
    },
    [weekStartUtc, weekEndUtc],
  );

  // Employee punch actions
  const handleClockIn = async (forceEvening: boolean = false) => {
    if (!user?.id) {
      setNotification({ type: 'error', message: 'Could not clock in: sign in again, then retry.' });
      return;
    }
    const isForce = forceEvening === true;
    const nowIso = DateTime.now().setZone(DEFAULT_TIMEZONE).toISO()!;
    if (!isForce && isEveningTime(nowIso, DEFAULT_TIMEZONE)) {
      setIsEveningWarningOpen(true);
      return;
    }
    if (punchBusy) return;
    setPunchBusy(true);
    try {
      const eventId = `manual-in-${Date.now()}`;
      const shift = await timesheetService.clockIn(
        user.id,
        user.name || user.email || 'Employee',
        'manual',
        eventId,
        undefined,
        { allowEvening: isForce }
      );
      setIsEveningWarningOpen(false);
      setNotification({
        type: 'success',
        message:
          shift.startEventId === eventId
            ? 'Clocked in successfully. Active shift is running.'
            : 'You already have an active shift. Use Clock Out when finished.',
      });
      refreshData();
    } catch (err: unknown) {
      setNotification({ type: 'error', message: humanizeTimesheetError(err, 'clock in') });
      setSyncStatus(timesheetStore.getSyncStatus());
    } finally {
      setPunchBusy(false);
    }
  };

  const handleOpenClockOutModal = () => {
    setBreakDurationMinutes(0);
    setIsBreakModalOpen(true);
  };

  const handleConfirmClockOut = async () => {
    if (!user?.id) {
      setNotification({ type: 'error', message: 'Could not clock out: sign in again, then retry.' });
      return;
    }
    if (punchBusy) return;
    setPunchBusy(true);
    try {
      const eventId = `manual-out-${Date.now()}`;
      const breakSecs = Math.max(0, Number(breakDurationMinutes) * 60);
      await timesheetService.clockOut(user.id, 'manual', eventId, breakSecs);
      setIsBreakModalOpen(false);
      setNotification({ type: 'success', message: 'Clocked out successfully. Shift is pending review.' });
      refreshData();
    } catch (err: unknown) {
      setNotification({ type: 'error', message: humanizeTimesheetError(err, 'clock out') });
      setSyncStatus(timesheetStore.getSyncStatus());
    } finally {
      setPunchBusy(false);
    }
  };

  const tableRows = activeTab === 'manager' ? filteredTeamShifts : employeeWeekShifts;

  const handleExportCsv = () => {
    const stamp = DateTime.fromISO(weekStartUtc, { zone: DEFAULT_TIMEZONE }).toFormat('yyyy-LL-dd');
    const who = activeTab === 'manager' ? 'team' : 'my';
    downloadTimesheetCsv(tableRows, `timesheets-${who}-${stamp}.csv`);
    setNotification({
      type: 'success',
      message: tableRows.length
        ? `Exported ${tableRows.length} shift${tableRows.length === 1 ? '' : 's'} to CSV.`
        : 'Exported an empty timesheet CSV for this week.',
    });
  };

  // Missing hours
  const handleOpenMissingHoursModal = () => {
    const nowLocal = DateTime.now().setZone(DEFAULT_TIMEZONE).toFormat("yyyy-MM-dd'T'HH:mm");
    setMissingForm({
      start: nowLocal,
      end: nowLocal,
      breakMinutes: 0,
      reason: '',
    });
    setIsMissingHoursModalOpen(true);
  };

  const handleSubmitMissingHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      const startUtc = DateTime.fromISO(missingForm.start, { zone: DEFAULT_TIMEZONE }).toUTC().toISO();
      const endUtc = DateTime.fromISO(missingForm.end, { zone: DEFAULT_TIMEZONE }).toUTC().toISO();
      if (!startUtc || !endUtc) {
        throw new Error('Invalid start or end timestamp.');
      }
      await timesheetService.requestCorrection({
        shiftId: null,
        employee: { id: user.id, name: user.name || user.email || 'Employee' },
        proposedStart: startUtc,
        proposedEnd: endUtc,
        proposedBreakSeconds: Number(missingForm.breakMinutes) * 60,
        reason: missingForm.reason,
      });
      setIsMissingHoursModalOpen(false);
      setNotification({
        type: 'success',
        message: 'Missing-hours request sent for manager review. This does not clock you in.',
      });
      refreshData();
    } catch (err: unknown) {
      setNotification({ type: 'error', message: humanizeTimesheetError(err, 'submit missing hours') });
    }
  };

  // Shift correction
  const handleOpenCorrectionModal = (shift: ShiftRecord) => {
    setCorrectionShift(shift);
    const startLocal = DateTime.fromISO(shift.startAtUtc, { zone: DEFAULT_TIMEZONE }).toFormat("yyyy-MM-dd'T'HH:mm");
    const endLocal = shift.endAtUtc
      ? DateTime.fromISO(shift.endAtUtc, { zone: DEFAULT_TIMEZONE }).toFormat("yyyy-MM-dd'T'HH:mm")
      : startLocal;
    setCorrectionForm({
      start: startLocal,
      end: endLocal,
      breakMinutes: Math.round(shift.unpaidBreakSeconds / 60),
      reason: '',
    });
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !correctionShift) return;
    try {
      const startUtc = DateTime.fromISO(correctionForm.start, { zone: DEFAULT_TIMEZONE }).toUTC().toISO();
      const endUtc = DateTime.fromISO(correctionForm.end, { zone: DEFAULT_TIMEZONE }).toUTC().toISO();
      if (!startUtc || !endUtc) {
        throw new Error('Invalid timestamps.');
      }
      await timesheetService.requestCorrection({
        shiftId: correctionShift.id,
        employee: { id: user.id, name: user.name || user.email || 'Employee' },
        proposedStart: startUtc,
        proposedEnd: endUtc,
        proposedBreakSeconds: Number(correctionForm.breakMinutes) * 60,
        reason: correctionForm.reason,
        baseRevision: correctionShift.revision,
      });
      setCorrectionShift(null);
      setNotification({ type: 'success', message: 'Shift correction request submitted!' });
      refreshData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error submitting correction' });
    }
  };

  // Manager actions
  const handleApproveShift = async (shift: ShiftRecord) => {
    if (!user?.id) return;
    try {
      await timesheetService.approveShift(
        shift.id,
        { id: user.id, name: user.name || user.email || 'Manager' },
        shift.revision
      );
      setNotification({ type: 'success', message: `Approved shift for ${shift.employeeName}` });
      refreshData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error approving shift' });
    }
  };

  const handleApproveCorrectionRequest = async (request: CorrectionRequest) => {
    if (!user?.id || correctionReviewBusy) return;
    setCorrectionReviewBusy(true);
    try {
      await timesheetService.reviewCorrectionRequest(
        request.id,
        { id: user.id, name: user.name || user.email || 'Manager' },
        'approve',
        '',
      );
      setNotification({
        type: 'success',
        message: `Approved correction for ${request.employeeName}`,
      });
      refreshData();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: humanizeTimesheetError(err, 'approve correction request'),
      });
    } finally {
      setCorrectionReviewBusy(false);
    }
  };

  const handleOpenRejectCorrection = (request: CorrectionRequest) => {
    if (correctionReviewBusy) return;
    setRejectingRequest(request);
    setRejectNote('');
  };

  const handleConfirmRejectCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !rejectingRequest || correctionReviewBusy) return;
    if (!rejectNote.trim()) {
      setNotification({ type: 'error', message: 'Enter a reason for rejecting this request.' });
      return;
    }
    setCorrectionReviewBusy(true);
    try {
      await timesheetService.reviewCorrectionRequest(
        rejectingRequest.id,
        { id: user.id, name: user.name || user.email || 'Manager' },
        'reject',
        rejectNote.trim(),
      );
      setRejectingRequest(null);
      setRejectNote('');
      setNotification({
        type: 'success',
        message: `Rejected correction for ${rejectingRequest.employeeName}`,
      });
      refreshData();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: humanizeTimesheetError(err, 'reject correction request'),
      });
    } finally {
      setCorrectionReviewBusy(false);
    }
  };

  const handleReturnShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !returnModalShift) return;
    try {
      await timesheetService.returnForCorrection(
        returnModalShift.id,
        { id: user.id, name: user.name || user.email || 'Manager' },
        returnModalShift.revision,
        returnFeedback
      );
      setReturnModalShift(null);
      setReturnFeedback('');
      setNotification({ type: 'success', message: 'Shift returned for correction.' });
      refreshData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error returning shift' });
    }
  };

  const handleOpenManagerEdit = (shift: ShiftRecord) => {
    setManagerEditShift(shift);
    const startLocal = DateTime.fromISO(shift.startAtUtc, { zone: DEFAULT_TIMEZONE }).toFormat("yyyy-MM-dd'T'HH:mm");
    const endLocal = shift.endAtUtc
      ? DateTime.fromISO(shift.endAtUtc, { zone: DEFAULT_TIMEZONE }).toFormat("yyyy-MM-dd'T'HH:mm")
      : '';
    setManagerEditForm({
      start: startLocal,
      end: endLocal,
      breakMinutes: Math.round(shift.unpaidBreakSeconds / 60),
      reason: '',
    });
  };

  const handleSaveManagerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !managerEditShift) return;
    try {
      if (!managerEditForm.reason.trim()) {
        throw new Error('REASON_REQUIRED');
      }
      const startUtc = DateTime.fromISO(managerEditForm.start, { zone: DEFAULT_TIMEZONE }).toUTC().toISO();
      const endUtc = managerEditForm.end
        ? DateTime.fromISO(managerEditForm.end, { zone: DEFAULT_TIMEZONE }).toUTC().toISO()
        : undefined;
      if (!startUtc) throw new Error('Invalid start timestamp.');

      await timesheetService.saveManagerEdit(
        managerEditShift.id,
        { id: user.id, name: user.name || user.email || 'Manager' },
        managerEditShift.revision,
        {
          startAtUtc: startUtc,
          endAtUtc: endUtc || undefined,
          unpaidBreakSeconds: Number(managerEditForm.breakMinutes) * 60,
        },
        managerEditForm.reason
      );
      setManagerEditShift(null);
      setNotification({ type: 'success', message: 'Shift updated successfully.' });
      refreshData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error updating shift' });
    }
  };

  const handleViewAudit = (shift: ShiftRecord) => {
    setAuditShift(shift);
    const events = timesheetStore.getAuditEventsForShift(shift.id);
    setAuditEvents(events);
  };

  // Badge render helpers
  const renderStatusBadge = (status: ShiftStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case 'needs_correction':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3 h-3" />
            Needs Correction
          </span>
        );
    }
  };

  const renderSourceBadge = (source: PunchSource) => {
    if (source === 'qr') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          QR
        </span>
      );
    }
    if (source === 'checklist_return') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          Return
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
        Manual
      </span>
    );
  };

  const formatShiftTime = (isoString: string | null) => {
    if (!isoString) return 'In Progress';
    return DateTime.fromISO(isoString, { zone: DEFAULT_TIMEZONE }).toFormat('h:mm a');
  };

  const formatShiftDate = (isoString: string) => {
    return DateTime.fromISO(isoString, { zone: DEFAULT_TIMEZONE }).toFormat('EEE, MMM d');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Firebase Cloud Sync Banner */}
        <div
          className={`flex items-center justify-between gap-4 p-3 sm:p-4 rounded-xl shadow-sm ${syncBannerClasses.container}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${syncBannerClasses.iconWrap}`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm sm:text-base flex items-center gap-2">
                <span>Timesheets</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold ${syncBannerClasses.badge}`}
                >
                  {syncStatus}
                </span>
              </p>
              <p className={`text-xs ${syncBannerClasses.subtitle}`}>
                Check cloud status before relying on these hours. Failed clock-ins and clock-outs need a retry.
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => { void timesheetStore.setupFirestoreListeners(); }}>Retry cloud sync</button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center justify-between p-3 rounded-lg text-sm ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-200'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-xs hover:opacity-75 font-semibold px-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Timesheets</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isManager
                ? 'Review team punches, approvals, and employee timesheet records.'
                : 'Track daily shift punches, view weekly hours, and submit corrections.'}
            </p>
          </div>

          {/* Manager / Employee View Switcher */}
          {isManager && (
            <div className="switch-filter-capsule self-start sm:self-center">
              <button
                type="button"
                onClick={() => {
                  playSwitchSound('klick', 0.25);
                  setActiveTab('employee');
                }}
                className={`switch-filter-tab ${activeTab === 'employee' ? 'is-active' : ''}`}
              >
                My Timesheet
              </button>
              <button
                type="button"
                onClick={() => {
                  playSwitchSound('klick', 0.25);
                  setActiveTab('manager');
                }}
                className={`switch-filter-tab ${activeTab === 'manager' ? 'is-active' : ''}`}
              >
                Manager Review
              </button>
            </div>
          )}
        </div>

        {/* Live Punch Card (Trainee / Employee Punch Controls) */}
        {activeTab === 'employee' && (
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      activeShift
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      {activeShift ? 'Active Shift' : 'Punch Status'}
                      {activeShift ? renderStatusBadge('active') : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Clocked Out
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeShift
                        ? `Started at ${DateTime.fromISO(activeShift.startAtUtc, { zone: DEFAULT_TIMEZONE }).toFormat('h:mm:ss a')} (${DEFAULT_TIMEZONE})`
                        : 'No active shift in progress. Clock in manually or scan vehicle QR code.'}
                    </p>
                  </div>
                </div>

                {activeShift && (
                  <div className="pt-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      Live Elapsed Time
                    </span>
                    <div className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      {formatTimer(elapsedSeconds)}
                    </div>
                  </div>
                )}
              </div>

              {/* Punch Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {!activeShift ? (
                  <button
                    type="button"
                    onClick={() => void handleClockIn(false)}
                    disabled={punchBusy}
                    aria-busy={punchBusy}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait text-white font-semibold text-sm shadow-sm transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    {punchBusy ? 'Saving clock in…' : 'Clock In'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenClockOutModal}
                    disabled={punchBusy}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition-colors focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Clock Out
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenMissingHoursModal}
                  disabled={punchBusy}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-sm transition-colors disabled:opacity-60"
                >
                  <PlusCircle className="w-4 h-4" />
                  Request Missing Hours
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
              {punchBusy
                ? 'Saving punch to the cloud… keep this tab open.'
                : 'Clock In starts a live shift. Request Missing Hours asks a manager to add past time — it does not start a punch.'}
            </p>
          </div>
        )}

        {/* Week Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-base">{weekLabel}</span>
            <span className="text-xs text-slate-400">(Mon–Sun)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSwitchSound('klick', 0.25);
                setTableViewOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            >
              <Table2 className="w-4 h-4" />
              View in table
            </button>
            <button
              type="button"
              onClick={() => {
                playSwitchSound('popup', 0.25);
                handleExportCsv();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <div className="switch-filter-capsule">
              <button
                type="button"
                onClick={() => {
                  playSwitchSound('klick', 0.25);
                  handlePrevWeek();
                }}
                className="switch-filter-tab flex items-center gap-1"
                aria-label="Previous Week"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous Week</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playSwitchSound('klick', 0.25);
                  handleThisWeek();
                }}
                className="switch-filter-tab is-active"
                aria-label="This Week"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => {
                  playSwitchSound('klick', 0.25);
                  handleNextWeek();
                }}
                className="switch-filter-tab flex items-center gap-1"
                aria-label="Next Week"
              >
                <span>Next Week</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Weekly Summary Cards */}
        {activeTab === 'employee' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Approved Hours
              </span>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatSecondsToHours(employeeSummary.approvedSeconds)} hrs
              </p>
              <p className="text-xs text-slate-400">Locked & verified</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pending Hours
              </span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatSecondsToHours(employeeSummary.pendingSeconds)} hrs
              </p>
              <p className="text-xs text-slate-400">Awaiting manager review</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Shifts
              </span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {employeeSummary.activeCount}
              </p>
              <p className="text-xs text-slate-400">Currently in progress</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Attention
              </span>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {employeeSummary.attentionCount}
              </p>
              <p className="text-xs text-slate-400">Needs correction</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Team Approved
              </span>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatSecondsToHours(teamSummary.approvedSeconds)} hrs
              </p>
              <p className="text-xs text-slate-400">Total approved this week</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Team Pending
              </span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatSecondsToHours(teamSummary.pendingSeconds)} hrs
              </p>
              <p className="text-xs text-slate-400">Requires review & signoff</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Workers
              </span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {teamSummary.activeCount}
              </p>
              <p className="text-xs text-slate-400">Clocked in right now</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Needs Correction
              </span>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {teamSummary.attentionCount}
              </p>
              <p className="text-xs text-slate-400">Returned shifts</p>
            </div>
          </div>
        )}

        {/* View Content: Employee Shift Ledger or Manager Review */}
        {activeTab === 'employee' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500" />
                Shift History ({employeeWeekShifts.length})
              </h2>
            </div>

            {employeeWeekShifts.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 space-y-2">
                <Clock className="w-10 h-10 mx-auto text-slate-400 opacity-60" />
                <p className="font-medium">No shifts recorded for this week.</p>
                <p className="text-xs text-slate-400">
                  Clock in manually or scan vehicle inspection QR code to record your time.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Time Interval</th>
                        <th className="py-3 px-4">Break</th>
                        <th className="py-3 px-4">Net Hours</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {employeeWeekShifts.map((shift) => {
                        const netSecs = shift.endAtUtc
                          ? calculateNetSeconds(shift.startAtUtc, shift.endAtUtc, shift.unpaidBreakSeconds)
                          : 0;
                        return (
                          <tr key={shift.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3.5 px-4 font-medium">{formatShiftDate(shift.startAtUtc)}</td>
                            <td className="py-3.5 px-4 font-mono text-xs">
                              {formatShiftTime(shift.startAtUtc)} – {formatShiftTime(shift.endAtUtc)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">
                              {shift.unpaidBreakSeconds > 0
                                ? `${Math.round(shift.unpaidBreakSeconds / 60)}m`
                                : '0m'}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                              {shift.endAtUtc ? `${formatSecondsToHours(netSecs)} hrs` : 'In Progress'}
                            </td>
                            <td className="py-3.5 px-4">{shift.recovery ? <span className="text-xs text-amber-700 dark:text-amber-300">Estimated from inspections</span> : renderSourceBadge(shift.startSource)}</td>
                            <td className="py-3.5 px-4">{renderStatusBadge(shift.status)}</td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleViewAudit(shift)}
                                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 underline"
                                >
                                  History
                                </button>
                                {shift.status !== 'active' && (
                                  <button
                                    onClick={() => handleOpenCorrectionModal(shift)}
                                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    Request Correction
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-2">
                  {employeeWeekShifts.map((shift) => {
                    const netSecs = shift.endAtUtc
                      ? calculateNetSeconds(shift.startAtUtc, shift.endAtUtc, shift.unpaidBreakSeconds)
                      : 0;
                    return (
                      <div key={shift.id} className="p-3 space-y-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{formatShiftDate(shift.startAtUtc)}</span>
                          {renderStatusBadge(shift.status)}
                        </div>
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {formatShiftTime(shift.startAtUtc)} – {formatShiftTime(shift.endAtUtc)}
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <div>
                            <span className="text-slate-400 mr-1">Net:</span>
                            <span className="font-bold">
                              {shift.endAtUtc ? `${formatSecondsToHours(netSecs)} hrs` : 'In Progress'}
                            </span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-slate-400 mr-1">Break:</span>
                            <span>{Math.round(shift.unpaidBreakSeconds / 60)}m</span>
                          </div>
                          <div>{shift.recovery ? <span className="text-xs text-amber-700 dark:text-amber-300">Estimated from inspections</span> : renderSourceBadge(shift.startSource)}</div>
                        </div>
                        {shift.managerNote && (
                          <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs">
                            <span className="font-semibold">Manager note: </span>
                            {shift.managerNote}
                          </div>
                        )}
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => handleViewAudit(shift)}
                            className="text-xs text-slate-500 hover:text-slate-900 underline px-2 py-1"
                          >
                            History
                          </button>
                          {shift.status !== 'active' && (
                            <button
                              onClick={() => handleOpenCorrectionModal(shift)}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                            >
                              Request Correction
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Manager Review View */
          <div className="space-y-4">
            {isManager && user && <HistoricalHoursRecovery actor={{ id: user.id, name: user.name }}
              weekStartUtc={weekStartUtc} weekEndUtc={weekEndUtc} />}

            <section
              className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 space-y-3 shadow-sm"
              aria-label="Pending correction requests"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-semibold flex items-center gap-2 m-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden />
                  Correction requests ({pendingCorrectionRequests.length})
                </h2>
                <p className="text-xs text-slate-500 m-0">
                  All pending shift corrections and missing-hours requests from employees.
                </p>
              </div>
              {pendingCorrectionRequests.length === 0 ? (
                <p className="text-sm text-slate-500 m-0">No pending correction requests.</p>
              ) : (
                <ul className="m-0 p-0 list-none space-y-3">
                  {pendingCorrectionRequests.map((req) => {
                    const startLocal = DateTime.fromISO(req.proposedStart, {
                      zone: DEFAULT_TIMEZONE,
                    }).toFormat('LLL d, h:mm a');
                    const endLocal = DateTime.fromISO(req.proposedEnd, {
                      zone: DEFAULT_TIMEZONE,
                    }).toFormat('LLL d, h:mm a');
                    const breakMin = Math.round(req.proposedBreakSeconds / 60);
                    const inWeek = isProposedInSelectedWeek(req.proposedStart);
                    return (
                      <li
                        key={req.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold m-0 cluster gap-2 flex-wrap">
                              {req.employeeName}
                              {!inWeek ? (
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                  Outside selected week
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-500 m-0">
                              {req.shiftId ? 'Shift correction' : 'Missing hours'} · {startLocal} →{' '}
                              {endLocal}
                              {breakMin > 0 ? ` · ${breakMin}m break` : ''}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 m-0">
                              <span className="font-medium">Reason: </span>
                              {req.reason}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                              disabled={correctionReviewBusy}
                              onClick={() => void handleApproveCorrectionRequest(req)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
                              disabled={correctionReviewBusy}
                              onClick={() => handleOpenRejectCorrection(req)}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Team Shifts ({filteredTeamShifts.length})
              </h2>

              {/* Filters Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <label htmlFor="filter-employee" className="font-medium">Employee:</label>
                  <select
                    id="filter-employee"
                    aria-label="Filter by employee"
                    value={managerEmployeeFilter}
                    onChange={(e) => setManagerEmployeeFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Employees</option>
                    {teamEmployees.map((emp) => (
                      <option key={emp} value={emp}>Employee: {emp}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <label htmlFor="filter-status" className="font-medium">Status:</label>
                  <select
                    id="filter-status"
                    aria-label="Filter by status"
                    value={managerStatusFilter}
                    onChange={(e) => setManagerStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="needs_correction">Needs Correction</option>
                    <option value="active">Active</option>
                  </select>
                </div>

                {(managerEmployeeFilter !== 'all' || managerStatusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setManagerEmployeeFilter('all');
                      setManagerStatusFilter('all');
                    }}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {teamWeekShifts.length === 0 ? (
              isSyncDegraded ? (
                <div className="p-8 text-center rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 text-slate-600 dark:text-slate-300 space-y-2">
                  <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 opacity-80" />
                  <p className="font-medium">
                    {isCloudSyncFailure
                      ? 'No timesheets loaded. Cloud sync failed — retry or check Firebase permissions.'
                      : 'No timesheets are confirmed yet. Retry cloud sync to check for team hours.'}
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-slate-400 opacity-60" />
                  <p className="font-medium">No team shifts recorded for this week.</p>
                </div>
              )
            ) : filteredTeamShifts.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 space-y-2">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-400 opacity-60" />
                <p className="font-medium">No shifts match the selected filters.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Time Interval</th>
                        <th className="py-3 px-4">Break</th>
                        <th className="py-3 px-4">Net Hours</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTeamShifts.map((shift) => {
                        const netSecs = shift.endAtUtc
                          ? calculateNetSeconds(shift.startAtUtc, shift.endAtUtc, shift.unpaidBreakSeconds)
                          : 0;
                        const isSelf = user?.id === shift.employeeId;
                        return (
                          <tr key={shift.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                              {shift.employeeName}
                              {isSelf && (
                                <span className="ml-2 text-xs text-slate-400 font-normal">(You)</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-medium">{formatShiftDate(shift.startAtUtc)}</td>
                            <td className="py-3.5 px-4 font-mono text-xs">
                              {formatShiftTime(shift.startAtUtc)} – {formatShiftTime(shift.endAtUtc)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">
                              {shift.unpaidBreakSeconds > 0
                                ? `${Math.round(shift.unpaidBreakSeconds / 60)}m`
                                : '0m'}
                            </td>
                            <td className="py-3.5 px-4 font-semibold">
                              {shift.endAtUtc ? `${formatSecondsToHours(netSecs)} hrs` : 'In Progress'}
                            </td>
                            <td className="py-3.5 px-4">{shift.recovery ? <span className="text-xs text-amber-700 dark:text-amber-300">Estimated from inspections</span> : renderSourceBadge(shift.startSource)}</td>
                            <td className="py-3.5 px-4">{renderStatusBadge(shift.status)}</td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleViewAudit(shift)}
                                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 underline"
                                >
                                  Audit
                                </button>
                                <button
                                  onClick={() => handleOpenManagerEdit(shift)}
                                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  Edit
                                </button>
                                {shift.status === 'pending' && (
                                  isSelf ? (
                                    <button
                                      disabled
                                      title="Self-approval disabled"
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                                    >
                                      Approve
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleApproveShift(shift)}
                                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => {
                                          setReturnModalShift(shift);
                                          setReturnFeedback('');
                                        }}
                                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                                      >
                                        Return
                                      </button>
                                    </>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Break Duration Modal (On Clock Out) */}
      {isBreakModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Coffee className="w-5 h-5" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Unpaid Break Duration
                </h3>
              </div>
              <button
                onClick={() => setIsBreakModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Please enter any unpaid meal or personal break duration taken during this shift.
            </p>

            <div className="space-y-3">
              <label htmlFor="break-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Break Duration (minutes)
              </label>
              <input
                id="break-input"
                type="number"
                min="0"
                max="480"
                value={breakDurationMinutes}
                onChange={(e) => setBreakDurationMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <div className="flex gap-2 pt-1">
                {[0, 15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setBreakDurationMinutes(mins)}
                    className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                      breakDurationMinutes === mins
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsBreakModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmClockOut()}
                disabled={punchBusy}
                aria-busy={punchBusy}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-wait text-white shadow-sm"
              >
                {punchBusy ? 'Saving clock out…' : 'Confirm Clock Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evening Clock-In Warning Modal */}
      {isEveningWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-amber-300 dark:border-amber-700/60 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Evening Clock-In Warning
                </h3>
              </div>
              <button
                onClick={() => setIsEveningWarningOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              It is currently evening ({DateTime.now().setZone(DEFAULT_TIMEZONE).toFormat('h:mm a')}). Field shifts typically start in the morning. Did you mean to return your van, or are you starting an evening shift?
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/return"
                className="w-full text-center px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-colors"
              >
                Go to Van Return &rarr;
              </Link>
              <button
                type="button"
                onClick={() => handleClockIn(true)}
                className="w-full px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors"
              >
                Yes, Start Evening Shift
              </button>
              <button
                type="button"
                onClick={() => setIsEveningWarningOpen(false)}
                className="w-full px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Missing Hours Modal */}
      {isMissingHoursModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                Request Missing Hours
              </h3>
              <button
                onClick={() => setIsMissingHoursModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              This asks a manager to add past hours. It does <strong>not</strong> start a live Clock In, and hours
              count only after approval.
            </p>

            <form onSubmit={handleSubmitMissingHours} className="space-y-4">
              <div>
                <label htmlFor="missing-start" className="block text-xs font-semibold text-slate-500 mb-1">
                  Start Time
                </label>
                <input
                  id="missing-start"
                  type="datetime-local"
                  required
                  value={missingForm.start}
                  onChange={(e) => setMissingForm({ ...missingForm, start: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="missing-end" className="block text-xs font-semibold text-slate-500 mb-1">
                  End Time
                </label>
                <input
                  id="missing-end"
                  type="datetime-local"
                  required
                  value={missingForm.end}
                  onChange={(e) => setMissingForm({ ...missingForm, end: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="missing-break" className="block text-xs font-semibold text-slate-500 mb-1">
                  Unpaid Break (minutes)
                </label>
                <input
                  id="missing-break"
                  type="number"
                  min="0"
                  value={missingForm.breakMinutes}
                  onChange={(e) =>
                    setMissingForm({ ...missingForm, breakMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="missing-reason" className="block text-xs font-semibold text-slate-500 mb-1">
                  Reason
                </label>
                <textarea
                  id="missing-reason"
                  required
                  rows={3}
                  placeholder="Explain why this shift was unrecorded (e.g., QR scanner battery died, missed punch)"
                  value={missingForm.reason}
                  onChange={(e) => setMissingForm({ ...missingForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMissingHoursModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Submit for manager review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Shift Correction Modal */}
      {correctionShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                Request Shift Correction
              </h3>
              <button
                onClick={() => setCorrectionShift(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              <div>
                <label htmlFor="corr-start" className="block text-xs font-semibold text-slate-500 mb-1">
                  Start Time
                </label>
                <input
                  id="corr-start"
                  type="datetime-local"
                  required
                  value={correctionForm.start}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, start: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="corr-end" className="block text-xs font-semibold text-slate-500 mb-1">
                  End Time
                </label>
                <input
                  id="corr-end"
                  type="datetime-local"
                  required
                  value={correctionForm.end}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, end: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="corr-break" className="block text-xs font-semibold text-slate-500 mb-1">
                  Unpaid Break (minutes)
                </label>
                <input
                  id="corr-break"
                  type="number"
                  min="0"
                  value={correctionForm.breakMinutes}
                  onChange={(e) =>
                    setCorrectionForm({ ...correctionForm, breakMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="corr-reason" className="block text-xs font-semibold text-slate-500 mb-1">
                  Reason
                </label>
                <textarea
                  id="corr-reason"
                  required
                  rows={3}
                  placeholder="Explain why the shift needs adjustment..."
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectionShift(null)}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject correction request (Manager) */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                Reject correction request
              </h3>
              <button
                type="button"
                onClick={() => {
                  setRejectingRequest(null);
                  setRejectNote('');
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close reject dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleConfirmRejectCorrection(e)} className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
                Rejecting request from{' '}
                <span className="font-semibold">{rejectingRequest.employeeName}</span>. Tell them what
                to fix or why it was denied.
              </p>
              <div>
                <label htmlFor="reject-correction-note" className="block text-xs font-semibold text-slate-500 mb-1">
                  Reject reason (Required)
                </label>
                <textarea
                  id="reject-correction-note"
                  required
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  placeholder="e.g. End time must match the return checklist"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingRequest(null);
                    setRejectNote('');
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Reject request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return for Correction Modal (Manager) */}
      {returnModalShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                Return Shift for Correction
              </h3>
              <button
                onClick={() => setReturnModalShift(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnShift} className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Returning shift for <span className="font-semibold">{returnModalShift.employeeName}</span>.
                Provide clear instructions on what needs fixing (e.g., recorded break time).
              </p>

              <div>
                <label htmlFor="return-feedback" className="block text-xs font-semibold text-slate-500 mb-1">
                  Manager Feedback (Required)
                </label>
                <textarea
                  id="return-feedback"
                  required
                  rows={3}
                  value={returnFeedback}
                  onChange={(e) => setReturnFeedback(e.target.value)}
                  placeholder="e.g. Please log your 30 minute lunch break."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalShift(null)}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Return Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manager Edit Drawer */}
      {managerEditShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 h-full max-w-md w-full p-6 shadow-2xl border-l border-slate-200 dark:border-slate-800 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-indigo-600" />
                  Edit Shift — {managerEditShift.employeeName}
                </h3>
                <p className="text-xs text-slate-500">
                  Revision {managerEditShift.revision} • Direct manager revision
                </p>
              </div>
              <button
                onClick={() => setManagerEditShift(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {managerEditShift.recovery && <p className="text-sm text-amber-700 dark:text-amber-300">
              Estimated historical hours. Confirm the employee’s actual start, end and unpaid breaks before approval.
              {managerEditShift.managerNote}
            </p>}
            <form onSubmit={handleSaveManagerEdit} className="space-y-4">
              <div>
                <label htmlFor="edit-start" className="block text-xs font-semibold text-slate-500 mb-1">
                  Start Time
                </label>
                <input
                  id="edit-start"
                  aria-label="Start Time"
                  type="datetime-local"
                  required
                  value={managerEditForm.start}
                  onChange={(e) => setManagerEditForm({ ...managerEditForm, start: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="edit-end" className="block text-xs font-semibold text-slate-500 mb-1">
                  End Time
                </label>
                <input
                  id="edit-end"
                  aria-label="End Time"
                  type="datetime-local"
                  value={managerEditForm.end}
                  onChange={(e) => setManagerEditForm({ ...managerEditForm, end: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="edit-break" className="block text-xs font-semibold text-slate-500 mb-1">
                  Unpaid Break (minutes)
                </label>
                <input
                  id="edit-break"
                  aria-label="Unpaid Break"
                  type="number"
                  min="0"
                  value={managerEditForm.breakMinutes}
                  onChange={(e) =>
                    setManagerEditForm({ ...managerEditForm, breakMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label htmlFor="edit-reason" className="block text-xs font-semibold text-slate-500 mb-1">
                  Reason for Edit (Required)
                </label>
                <textarea
                  id="edit-reason"
                  aria-label="Reason for Edit"
                  required
                  rows={3}
                  placeholder="Explain reason for manual revision (e.g., corrected departure time per driver log)"
                  value={managerEditForm.reason}
                  onChange={(e) => setManagerEditForm({ ...managerEditForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setManagerEditShift(null)}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit History Drawer */}
      {auditShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 h-full max-w-md w-full p-6 shadow-2xl border-l border-slate-200 dark:border-slate-800 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Shift Audit Trail
                </h3>
                <p className="text-xs text-slate-500">
                  Revision {auditShift.revision} • {auditShift.employeeName}
                </p>
              </div>
              <button
                onClick={() => setAuditShift(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {auditEvents.length === 0 ? (
              <p className="text-sm text-slate-400">No audit events recorded for this shift.</p>
            ) : (
              <div className="space-y-4">
                {auditEvents.map((evt, idx) => (
                  <div
                    key={evt.id || idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {evt.action.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {DateTime.fromISO(evt.timestamp, { zone: DEFAULT_TIMEZONE }).toFormat('LLL d, h:mm:ss a')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Actor: <span className="font-medium">{evt.actorName}</span>
                    </p>
                    {evt.reason && (
                      <p className="text-xs italic text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                        &ldquo;{evt.reason}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAuditShift(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-sm font-medium"
              >
                Close Trail
              </button>
            </div>
          </div>
        </div>
      )}

      {tableViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="timesheet-table-title"
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col"
          >
            <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 id="timesheet-table-title" className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Timesheet table
                </h3>
                <p className="text-xs text-slate-500">
                  {weekLabel} · {tableRows.length} row{tableRows.length === 1 ? '' : 's'}
                  {activeTab === 'manager' ? ' (current filters)' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  type="button"
                  aria-label="Close table view"
                  onClick={() => setTableViewOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-4">
              {!tableRows.length ? (
                <p className="text-sm text-slate-500 p-6 text-center">No shifts in this week view.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Timesheet rows for {weekLabel}</caption>
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 uppercase tracking-wider">
                    <tr>
                      {activeTab === 'manager' && <th className="py-2 px-3">Employee</th>}
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Start</th>
                      <th className="py-2 px-3">End</th>
                      <th className="py-2 px-3">Break</th>
                      <th className="py-2 px-3">Net</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tableRows.map(shift => {
                      const netSecs = shift.endAtUtc
                        ? calculateNetSeconds(shift.startAtUtc, shift.endAtUtc, shift.unpaidBreakSeconds)
                        : 0;
                      return (
                        <tr key={shift.id}>
                          {activeTab === 'manager' && (
                            <td className="py-2.5 px-3 font-medium">{shift.employeeName}</td>
                          )}
                          <td className="py-2.5 px-3">{formatShiftDate(shift.startAtUtc)}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{formatShiftTime(shift.startAtUtc)}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{formatShiftTime(shift.endAtUtc)}</td>
                          <td className="py-2.5 px-3">{Math.round(shift.unpaidBreakSeconds / 60)}m</td>
                          <td className="py-2.5 px-3 font-semibold">
                            {shift.endAtUtc ? `${formatSecondsToHours(netSecs)} hrs` : 'In Progress'}
                          </td>
                          <td className="py-2.5 px-3">{renderStatusBadge(shift.status)}</td>
                          <td className="py-2.5 px-3">
                            {shift.recovery ? 'Estimated' : renderSourceBadge(shift.startSource)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
