import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type {
  TrainingAttentionBucket,
  TrainingAttentionRow,
} from '@/lib/training/trainingAttention';
import { trainingStatusLabel, trainingStatusTone } from '@/lib/training/trainingProgress';
import type { TrainingAssignment, TrainingItem } from '@/lib/training/types';

export interface NeedsAttentionSectionProps {
  rows: TrainingAttentionRow[];
  itemsById: Map<string, TrainingItem>;
  busy: boolean;
  canTrain: boolean;
  onSignOff: (row: TrainingAssignment) => void;
  onApproveRetrain: (row: TrainingAssignment) => void;
  onOpenPerson: (traineeId: string) => void;
}

const bucketLabels: Record<TrainingAttentionBucket, string> = {
  awaiting_trainer: 'Awaiting trainer',
  awaiting_employee: 'Awaiting employee',
  needs_retrain: 'Needs retrain',
};

const bucketTones: Record<
  TrainingAttentionBucket,
  'idle' | 'info' | 'critical'
> = {
  awaiting_trainer: 'idle',
  awaiting_employee: 'info',
  needs_retrain: 'critical',
};

export function NeedsAttentionSection({
  rows,
  itemsById,
  busy,
  canTrain,
  onSignOff,
  onApproveRetrain,
  onOpenPerson,
}: NeedsAttentionSectionProps) {
  const counts = rows.reduce<Record<TrainingAttentionBucket, number>>(
    (result, row) => {
      result[row.bucket] += 1;
      return result;
    },
    { awaiting_trainer: 0, awaiting_employee: 0, needs_retrain: 0 },
  );

  return (
    <section className="card card-pad space-y-3">
      <div>
        <h2 className="card-title text-base m-0 cluster gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Needs attention
        </h2>
        <p className="hint m-0 mt-1">
          A trainer signs off first, then the employee certifies the step.
        </p>
      </div>
      <div className="cluster gap-2 flex-wrap" aria-label="Attention counts">
        {(Object.keys(bucketLabels) as TrainingAttentionBucket[]).map(bucket => (
          <span key={bucket} className="badge" data-status={bucketTones[bucket]}>
            {bucketLabels[bucket]}: {counts[bucket]}
          </span>
        ))}
      </div>
      {rows.length ? (
        <ul className="m-0 p-0 list-none space-y-2">
          {rows.map(({ bucket, assignment }) => (
            <li
              key={assignment.id}
              className="rounded-xl border border-line p-3 spread items-center gap-2 flex-wrap"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold m-0">
                  {assignment.traineeName} ·{' '}
                  {itemsById.get(assignment.itemId)?.title || assignment.itemId}
                </p>
                <div className="cluster gap-2 flex-wrap">
                  <span className="badge" data-status={bucketTones[bucket]}>
                    {bucketLabels[bucket]}
                  </span>
                  <span className="badge" data-status={trainingStatusTone(assignment.status)}>
                    {trainingStatusLabel(assignment.status)}
                  </span>
                </div>
                {bucket === 'awaiting_employee' ? (
                  <p className="hint m-0">Waiting on {assignment.traineeName}</p>
                ) : null}
              </div>
              {bucket === 'awaiting_trainer' ? (
                canTrain ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => onSignOff(assignment)}
                  >
                    Trainer sign-off
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenPerson(assignment.traineeId)}
                  >
                    Open person
                  </button>
                )
              ) : null}
              {bucket === 'needs_retrain' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => onApproveRetrain(assignment)}
                >
                  Approve retrain
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
          title="Nothing needs attention"
        >
          Training bottlenecks will appear here.
        </EmptyState>
      )}
    </section>
  );
}
