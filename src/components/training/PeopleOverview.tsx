import React from 'react';
import { Users } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import {
  employeeOverviewLabel,
  employeeOverviewStatus,
  employeeOverviewTone,
  type TraineeLearnRow,
} from '@/lib/training/trainingProgress';

export interface PeopleOverviewProps {
  learnRows: TraineeLearnRow[];
  selectedId: string | null;
  onSelect: (traineeId: string) => void;
}

export function PeopleOverview({ learnRows, selectedId, onSelect }: PeopleOverviewProps) {
  return (
    <section className="card card-pad space-y-3">
      <div>
        <h2 className="card-title text-base m-0 cluster gap-2">
          <Users className="h-4 w-4" aria-hidden />
          People
        </h2>
        <p className="hint m-0 mt-1">Training status for every active employee.</p>
      </div>
      {learnRows.length ? (
        <ul className="m-0 p-0 list-none grid gap-2 sm:grid-cols-2">
          {learnRows.map(row => {
            const status = employeeOverviewStatus(row);
            const selected = row.traineeId === selectedId;
            return (
              <li key={row.traineeId}>
                <button
                  type="button"
                  className={`w-full rounded-xl border p-3 space-y-2 text-left ${
                    selected
                      ? 'border-ink bg-surface-sunk ring-2 ring-ink/20'
                      : 'border-line bg-surface'
                  }`}
                  aria-pressed={selected}
                  onClick={() => onSelect(row.traineeId)}
                >
                  <span className="spread items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{row.traineeName}</span>
                    <span className="badge" data-status={employeeOverviewTone(status)}>
                      {employeeOverviewLabel(status)}
                    </span>
                  </span>
                  <span className="hint block m-0">
                    {row.totalSteps
                      ? `${row.completed}/${row.totalSteps} curriculum steps complete`
                      : 'No curriculum yet'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Users className="h-7 w-7" aria-hidden />} title="No employees yet">
          Add active employees to see their training status.
        </EmptyState>
      )}
    </section>
  );
}
