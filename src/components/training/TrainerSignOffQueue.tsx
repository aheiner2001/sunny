import React from 'react';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { trainingStatusLabel, trainingStatusTone } from '@/lib/training/trainingProgress';
import type { TrainingAssignment, TrainingItem } from '@/lib/training/types';

export interface TrainerSignOffQueueProps {
  rows: TrainingAssignment[];
  itemsById: Map<string, TrainingItem>;
  busy: boolean;
  onSignOff: (row: TrainingAssignment) => void;
}

export function TrainerSignOffQueue({
  rows,
  itemsById,
  busy,
  onSignOff,
}: TrainerSignOffQueueProps) {
  return (
    <section className="card card-pad space-y-3">
      <h2 className="card-title text-base m-0 cluster gap-2">
        <ClipboardCheck className="h-4 w-4" aria-hidden />
        Sign-off queue
      </h2>
      <p className="hint m-0">Training steps for people paired with you.</p>
      {rows.length ? (
        <ul className="space-y-2 m-0 p-0 list-none">
          {rows.map(row => (
            <li
              key={row.id}
              className="rounded-xl border border-line p-3 spread items-center gap-2 flex-wrap"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold m-0">
                  {row.traineeName} · {itemsById.get(row.itemId)?.title || row.itemId}
                </p>
                <span className="badge" data-status={trainingStatusTone(row.status)}>
                  {trainingStatusLabel(row.status)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => onSignOff(row)}
              >
                Trainer sign-off
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
          title="No steps need sign-off"
        >
          New steps for people paired with you will appear here.
        </EmptyState>
      )}
    </section>
  );
}
