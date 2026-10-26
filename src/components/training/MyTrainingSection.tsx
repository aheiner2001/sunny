import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { trainingStatusLabel, trainingStatusTone } from '@/lib/training/trainingProgress';
import type { TrainingAssignment, TrainingItem } from '@/lib/training/types';

export interface MyTrainingSectionProps {
  userName: string;
  rows: TrainingAssignment[];
  itemsById: Map<string, TrainingItem>;
  busy: boolean;
  onCertify: (row: TrainingAssignment) => void;
}

export function MyTrainingSection({
  userName,
  rows,
  itemsById,
  busy,
  onCertify,
}: MyTrainingSectionProps) {
  const hasCertification = rows.some(row => row.status === 'awaiting_trainee');

  return (
    <section
      id="my-training"
      className={`card card-pad space-y-3 ${
        hasCertification ? 'ring-2 ring-[var(--ok)]' : ''
      }`}
    >
      <h2 className="card-title text-base m-0">My training</h2>
      <p className="hint m-0">
        Steps assigned to <strong>{userName}</strong>. Certify after a trainer signs off.
      </p>
      {rows.length ? (
        <ul className="space-y-2 m-0 p-0 list-none">
          {rows.map(row => (
            <li
              key={row.id}
              className="rounded-xl border border-line p-3 spread items-center gap-2 flex-wrap"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold m-0">
                  {itemsById.get(row.itemId)?.title || row.itemId}
                </p>
                <span className="badge" data-status={trainingStatusTone(row.status)}>
                  {trainingStatusLabel(row.status)}
                </span>
              </div>
              {row.status === 'awaiting_trainee' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => onCertify(row)}
                >
                  I was trained — certify
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
          title="No training assigned to you"
        >
          When a trainer signs off your step, you can certify it here.
        </EmptyState>
      )}
    </section>
  );
}
