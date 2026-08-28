'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Inspection, Issue } from '@/types';

type InspectionCalendarProps = {
  inspections: Inspection[];
  issues: Issue[];
  monthDate: Date;
  onMonthChange: (d: Date) => void;
  onDayClick?: (dateString: string) => void;
  compact?: boolean;
};

export function InspectionCalendar({
  inspections,
  issues,
  monthDate,
  onMonthChange,
  onDayClick,
  compact = false,
}: InspectionCalendarProps) {
  const today = new Date();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const startDayOffset = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const viewingCurrentMonth =
    monthDate.getFullYear() === today.getFullYear() &&
    monthDate.getMonth() === today.getMonth();

  const getDayStatus = (day: number) => {
    const dayStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayInspections = inspections.filter(i => i.dateString === dayStr);
    const dayIssues = issues.filter(i => i.dateString === dayStr);
    return {
      hasInspection: dayInspections.length > 0,
      hasIssue: dayIssues.length > 0,
      dayStr,
    };
  };

  const calendarContent = (
    <>
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
        {calendarDays.map(day => {
          const info = getDayStatus(day);
          const isToday = viewingCurrentMonth && day === today.getDate();
          return (
            <span
              key={day}
              role={onDayClick ? 'button' : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              onClick={
                onDayClick
                  ? (e) => {
                      e.stopPropagation();
                      onDayClick(info.dayStr);
                    }
                  : undefined
              }
              onKeyDown={
                onDayClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onDayClick(info.dayStr);
                      }
                    }
                  : undefined
              }
              className={`relative py-1 ${isToday ? 'font-bold text-ink ring-1 ring-ink rounded' : 'text-ink-muted'}${onDayClick ? ' cursor-pointer hover:text-ink' : ''}`}
            >
              {day}
              {(info.hasIssue || info.hasInspection) && (
                <span
                  className="dot absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1"
                  data-status={info.hasIssue ? 'flagged' : 'ok'}
                />
              )}
            </span>
          );
        })}
      </div>

      <div className="card-foot mt-auto text-2xs">
        <span className="cluster gap-1.5">
          <span className="dot w-2 h-2" data-status="ok" />
          <span className="text-ink-muted">Inspections</span>
        </span>
        <span className="cluster gap-1.5">
          <span className="dot w-2 h-2" data-status="flagged" />
          <span className="text-ink-muted">Issues</span>
        </span>
        <span className="link-action">
          Open full view <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </>
  );

  if (compact) {
    return calendarContent;
  }

  return <div className="card card-pad flex flex-col">{calendarContent}</div>;
}
