'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar as CalendarIcon,
  Clock,
  Wrench,
  Truck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Inspection, Issue, FleetTask } from '@/types';

export type CalendarViewMode = 'month' | 'week' | 'day';

export type InspectionCalendarProps = {
  inspections: Inspection[];
  issues: Issue[];
  tasks?: FleetTask[];
  monthDate: Date;
  onMonthChange: (d: Date) => void;
  onDayClick?: (dateString: string) => void;
  selectedDate?: string;
  compact?: boolean;
  viewMode?: CalendarViewMode;
  onViewModeChange?: (mode: CalendarViewMode) => void;
  vehicleFilter?: string;
  onVehicleFilterChange?: (vId: string) => void;
};

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function InspectionCalendar({
  inspections,
  issues,
  tasks = [],
  monthDate,
  onMonthChange,
  onDayClick,
  selectedDate,
  compact = false,
  viewMode = 'month',
  onViewModeChange,
}: InspectionCalendarProps) {
  const today = new Date();
  const todayStr = dateKey(today);

  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const startDayOffset = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const viewingCurrentMonth =
    monthDate.getFullYear() === today.getFullYear() &&
    monthDate.getMonth() === today.getMonth();

  const getDayData = (dayStr: string) => {
    const dayInspections = inspections.filter((i) => i.dateString === dayStr);
    const dayIssues = issues.filter((i) => i.dateString === dayStr);
    const dayTasks = tasks.filter((t) => {
      const taskDate = t.dueAt ? t.dueAt.split('T')[0] : t.createdAt?.split('T')[0];
      return taskDate === dayStr;
    });

    return {
      dayStr,
      inspections: dayInspections,
      issues: dayIssues,
      tasks: dayTasks,
      hasInspection: dayInspections.length > 0,
      hasIssue: dayIssues.length > 0,
      hasTask: dayTasks.length > 0,
    };
  };

  // Helper for week view calculations
  const currentWeekDays = React.useMemo(() => {
    const baseDate = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date(monthDate);
    const dayOfWeek = (baseDate.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: d,
        dayStr: dateKey(d),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: dateKey(d) === todayStr,
        isSelected: dateKey(d) === (selectedDate || todayStr),
      };
    });
  }, [monthDate, selectedDate, todayStr]);

  if (compact) {
    return (
      <div className="card card-pad flex flex-col">
        <div className="spread pb-3 mb-2 border-b border-line">
          <h2 className="card-title">Inspection calendar</h2>
          <div className="cluster gap-1">
            <span className="unit-tag">
              {monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1));
              }}
              className="btn btn-ghost btn-sm px-2"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));
              }}
              className="btn btn-ghost btn-sm px-2"
              aria-label="Next month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center py-1 eyebrow mb-0">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        <div className="grid grid-cols-7 text-center text-sm gap-y-1.5 py-2" data-numeric>
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <span key={`empty-${i}`} />
          ))}
          {calendarDays.map((day) => {
            const dayStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const data = getDayData(dayStr);
            const isToday = viewingCurrentMonth && day === today.getDate();
            const isSelected = selectedDate === dayStr;

            return (
              <span
                key={day}
                role={onDayClick ? 'button' : undefined}
                tabIndex={onDayClick ? 0 : undefined}
                onClick={
                  onDayClick
                    ? (e) => {
                        e.stopPropagation();
                        onDayClick(dayStr);
                      }
                    : undefined
                }
                className={`relative py-1 ${
                  isSelected
                    ? 'font-bold text-ink ring-2 ring-ink rounded-lg bg-surface-sunk'
                    : isToday
                    ? 'font-bold text-ink ring-1 ring-ink/40 rounded-lg'
                    : 'text-ink-muted'
                }${onDayClick ? ' cursor-pointer hover:text-ink' : ''}`}
              >
                {day}
                {(data.hasIssue || data.hasInspection || data.hasTask) && (
                  <span
                    className="dot absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5"
                    data-status={data.hasIssue ? 'flagged' : data.hasTask ? 'info' : 'ok'}
                  />
                )}
              </span>
            );
          })}
        </div>

        <div className="card-foot mt-auto text-2xs spread items-center">
          <div className="cluster gap-2">
            <span className="cluster gap-1">
              <span className="dot w-2 h-2" data-status="ok" />
              <span className="text-ink-muted">Insp</span>
            </span>
            <span className="cluster gap-1">
              <span className="dot w-2 h-2" data-status="flagged" />
              <span className="text-ink-muted">Issue</span>
            </span>
            {tasks.length > 0 && (
              <span className="cluster gap-1">
                <span className="dot w-2 h-2" data-status="info" />
                <span className="text-ink-muted">Task</span>
              </span>
            )}
          </div>
          <span className="link-action text-2xs">
            Open full view <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad flex flex-col space-y-4">
      {/* Header controls: Month navigation & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface-sunk text-ink flex items-center justify-center">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-ink">
              {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <span className="text-[11px] text-ink-muted">
              {inspections.length} inspections · {issues.length} issues · {tasks.length} tasks
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher (Month / Week / Day) */}
          {onViewModeChange && (
            <div className="inline-flex rounded-xl border border-line bg-surface-sunk p-0.5">
              {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg capitalize transition-all ${
                    viewMode === mode
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          {/* Month Steppers */}
          <div className="flex items-center border border-line rounded-xl bg-surface">
            <button
              type="button"
              onClick={() => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              className="p-1.5 text-ink-muted hover:text-ink"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(new Date())}
              className="px-2 py-1 text-xs font-bold text-ink hover:bg-surface-sunk border-x border-line"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              className="p-1.5 text-ink-muted hover:text-ink"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5.3 VIEW 1: MONTH GRID (with 5.1 Multi-Item Numeric Badges & 5.2 Tasks) */}
      {viewMode === 'month' && (
        <div className="space-y-2">
          <div className="grid grid-cols-7 text-center eyebrow py-1 border-b border-line">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[85px] rounded-xl bg-surface-sunk/30 opacity-40 border border-transparent" />
            ))}
            {calendarDays.map((day) => {
              const dayStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data = getDayData(dayStr);
              const isToday = viewingCurrentMonth && day === today.getDate();
              const isSelected = selectedDate === dayStr;

              return (
                <div
                  key={day}
                  role={onDayClick ? 'button' : undefined}
                  tabIndex={onDayClick ? 0 : undefined}
                  onClick={() => onDayClick && onDayClick(dayStr)}
                  className={`min-h-[70px] sm:min-h-[85px] p-1.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-ink bg-surface shadow-xs ring-2 ring-ink/20'
                      : isToday
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : 'border-line bg-surface hover:border-ink/40 hover:bg-surface-sunk/50'
                  }${onDayClick ? ' cursor-pointer' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold ${
                        isToday
                          ? 'w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]'
                          : isSelected
                          ? 'text-ink'
                          : 'text-ink-muted'
                      }`}
                    >
                      {day}
                    </span>
                    {isToday && <span className="text-[9px] font-bold text-emerald-700 uppercase">Today</span>}
                  </div>

                  {/* 5.1 Multi-Item Numeric Badges & 5.2 Tasks */}
                  <div className="space-y-1 mt-1">
                    {data.inspections.length > 0 && (
                      <div className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-800 text-[10px] font-bold truncate flex items-center justify-between">
                        <span>Insp</span>
                        <span>{data.inspections.length}</span>
                      </div>
                    )}
                    {data.issues.length > 0 && (
                      <div className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold truncate flex items-center justify-between">
                        <span>Issues</span>
                        <span>{data.issues.length}</span>
                      </div>
                    )}
                    {data.tasks.length > 0 && (
                      <div className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold truncate flex items-center justify-between">
                        <span>Tasks</span>
                        <span>{data.tasks.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5.3 VIEW 2: WEEK TIMELINE VIEW */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {currentWeekDays.map((wDay) => {
              const data = getDayData(wDay.dayStr);
              return (
                <div
                  key={wDay.dayStr}
                  onClick={() => onDayClick && onDayClick(wDay.dayStr)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between min-h-[140px] ${
                    wDay.isSelected
                      ? 'border-ink bg-surface ring-2 ring-ink/20 shadow-xs'
                      : wDay.isToday
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : 'border-line bg-surface hover:bg-surface-sunk'
                  }`}
                >
                  <div className="border-b border-line pb-1.5 mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                        {wDay.dayName}
                      </div>
                      <div className="text-base font-extrabold text-ink">{wDay.dayNum}</div>
                    </div>
                    {wDay.isToday && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-600 text-white">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {data.inspections.length > 0 && (
                      <div className="p-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{data.inspections.length} Insp</span>
                      </div>
                    )}
                    {data.issues.length > 0 && (
                      <div className="p-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>{data.issues.length} Issues</span>
                      </div>
                    )}
                    {data.tasks.length > 0 && (
                      <div className="p-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-blue-600" />
                        <span>{data.tasks.length} Tasks</span>
                      </div>
                    )}
                    {data.inspections.length === 0 && data.issues.length === 0 && data.tasks.length === 0 && (
                      <div className="text-[10px] text-ink-faint italic text-center py-2">No activity</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5.3 VIEW 3: DAY BREAKDOWN VIEW */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          <div className="p-3 bg-surface-sunk rounded-xl border border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-ink-muted" />
              <span className="text-xs font-extrabold text-ink">
                Hourly & Activity Breakdown for {selectedDate || todayStr}
              </span>
            </div>
            <div className="cluster gap-2">
              <button
                type="button"
                onClick={() => {
                  const curr = new Date(`${selectedDate || todayStr}T12:00:00`);
                  curr.setDate(curr.getDate() - 1);
                  if (onDayClick) onDayClick(dateKey(curr));
                }}
                className="btn btn-secondary btn-sm px-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const curr = new Date(`${selectedDate || todayStr}T12:00:00`);
                  curr.setDate(curr.getDate() + 1);
                  if (onDayClick) onDayClick(dateKey(curr));
                }}
                className="btn btn-secondary btn-sm px-2"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {(() => {
            const dayData = getDayData(selectedDate || todayStr);
            const allItems = [
              ...dayData.inspections.map((i) => ({
                id: i.id,
                type: 'inspection' as const,
                title: `Inspection: ${i.vehicleNumber}`,
                subtitle: `${i.userName} (${i.status})`,
                time: i.submittedAt,
              })),
              ...dayData.issues.map((iss) => ({
                id: iss.id,
                type: 'issue' as const,
                title: `Issue: ${iss.equipmentName}`,
                subtitle: `${iss.vehicleNumber} · ${iss.description}`,
                time: iss.reportedAt,
              })),
              ...dayData.tasks.map((t) => ({
                id: t.id,
                type: 'task' as const,
                title: `Scheduled: ${t.title}`,
                subtitle: `${t.vehicleId ? 'Vehicle Task' : 'Fleet Task'}${t.scheduleLabel ? ` · ${t.scheduleLabel}` : ''}`,
                time: t.dueAt || t.createdAt,
              })),
            ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

            if (allItems.length === 0) {
              return (
                <div className="text-center py-8 bg-surface-sunk rounded-2xl border border-line text-xs text-ink-faint">
                  No fleet events, tasks, or inspections scheduled for this day.
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {allItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-line bg-surface flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          item.type === 'inspection'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.type === 'issue'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {item.type === 'inspection' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : item.type === 'issue' ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Wrench className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink">{item.title}</div>
                        <div className="text-[11px] text-ink-muted">{item.subtitle}</div>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-ink-faint shrink-0">
                      {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend footer */}
      <div className="border-t border-line pt-3 flex flex-wrap items-center justify-between text-xs text-ink-muted gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Inspections</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Issues</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Scheduled Tasks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
