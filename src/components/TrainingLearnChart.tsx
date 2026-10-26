'use client';

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, GraduationCap } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { TraineeLearnRow } from '@/lib/training/trainingProgress';

function headlineTone(status: TraineeLearnRow['headlineStatus']): 'ok' | 'flagged' | 'critical' | 'info' | 'idle' {
  switch (status) {
    case 'trained':
      return 'ok';
    case 'needs_attention':
      return 'critical';
    case 'in_progress':
      return 'info';
    default:
      return 'idle';
  }
}

function headlineLabel(status: TraineeLearnRow['headlineStatus']): string {
  switch (status) {
    case 'trained':
      return 'Trained';
    case 'needs_attention':
      return 'Needs attention';
    case 'in_progress':
      return 'In progress';
    default:
      return 'Not started';
  }
}

export function TrainingLearnChart({ rows }: { rows: TraineeLearnRow[] }) {
  const chartData = rows.map(r => ({
    name: r.traineeName.split(' ')[0] || r.traineeName,
    fullName: r.traineeName,
    trained: r.completed,
    remaining: Math.max(0, r.totalSteps - r.completed),
    percent: r.percentComplete,
  }));

  if (!rows.length) {
    return (
      <EmptyState icon={<GraduationCap className="h-8 w-8" aria-hidden />} title="No people to chart yet">
        Add active employees, then assign curriculum steps to see who has been trained.
      </EmptyState>
    );
  }

  if (!rows.some(r => r.totalSteps > 0)) {
    return (
      <EmptyState icon={<GraduationCap className="h-8 w-8" aria-hidden />} title="No curriculum yet">
        Add training steps first — the learn chart fills in as people complete them.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-56 w-full" role="img" aria-label="Bar chart of trained steps per person">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, key: string) => [
                value,
                key === 'trained' ? 'Trained steps' : 'Remaining',
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
            />
            <Bar dataKey="trained" stackId="a" fill="var(--ok)" name="trained" radius={[0, 0, 0, 0]} />
            <Bar dataKey="remaining" stackId="a" fill="var(--surface-sunk)" name="remaining" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="m-0 p-0 list-none space-y-2">
        {rows.map(row => (
          <li key={row.traineeId} className="rounded-xl border border-line p-3 space-y-2">
            <div className="spread items-center gap-2 flex-wrap">
              <div className="cluster gap-2 min-w-0">
                <span className="text-sm font-semibold truncate">{row.traineeName}</span>
                <span className="badge" data-status={headlineTone(row.headlineStatus)}>
                  {row.headlineStatus === 'trained' ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                  ) : null}
                  {headlineLabel(row.headlineStatus)}
                </span>
              </div>
              <span className="text-xs text-ink-muted shrink-0">
                {row.completed}/{row.totalSteps} steps · {row.percentComplete}%
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-surface-sunk overflow-hidden"
              role="progressbar"
              aria-valuenow={row.percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${row.traineeName} training progress`}
            >
              <div
                className="h-full rounded-full bg-[var(--ok)] transition-[width]"
                style={{ width: `${row.percentComplete}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
