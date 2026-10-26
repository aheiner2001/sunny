import React from 'react';
import { GraduationCap, UserPlus } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { trainingStatusLabel, trainingStatusTone } from '@/lib/training/trainingProgress';
import type { TrainingAssignment, TrainingItem } from '@/lib/training/types';

export interface PersonTrainingPanelProps {
  trainee: { id: string; name: string };
  activeItems: TrainingItem[];
  assignments: TrainingAssignment[];
  trainers: Array<{ id: string; name: string }>;
  pairedTrainerIds: string[];
  pairTrainerId: string;
  onPairTrainerIdChange: (id: string) => void;
  busy: boolean;
  canTrain: boolean;
  onAssignMissing: () => void;
  onMarkTrained: (itemId: string) => void;
  onRequireRetrain: (itemId: string) => void;
  onTrainerSignOff: (row: TrainingAssignment) => void;
  onPairTrainer: () => void;
}

export function PersonTrainingPanel({
  trainee,
  activeItems,
  assignments,
  trainers,
  pairedTrainerIds,
  pairTrainerId,
  onPairTrainerIdChange,
  busy,
  canTrain,
  onAssignMissing,
  onMarkTrained,
  onRequireRetrain,
  onTrainerSignOff,
  onPairTrainer,
}: PersonTrainingPanelProps) {
  const assignmentsByItem = new Map(
    assignments
      .filter(row => row.traineeId === trainee.id)
      .map(row => [row.itemId, row]),
  );
  const pairedNames = trainers
    .filter(trainer => pairedTrainerIds.includes(trainer.id))
    .map(trainer => trainer.name);
  const trainerSelectId = `pair-trainer-${trainee.id}`;

  return (
    <section className="card card-pad space-y-4">
      <div className="spread items-start gap-3 flex-wrap">
        <div>
          <h2 className="card-title text-base m-0 cluster gap-2">
            <GraduationCap className="h-4 w-4" aria-hidden />
            {trainee.name} training
          </h2>
          <p className="hint m-0 mt-1">Manage curriculum progress and trainer pairing.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || !activeItems.length}
          onClick={onAssignMissing}
        >
          Assign missing steps
        </button>
      </div>

      {activeItems.length ? (
        <ul className="m-0 p-0 list-none space-y-2">
          {activeItems.map(item => {
            const row = assignmentsByItem.get(item.id);
            const canSignOff =
              canTrain && row && (row.status === 'assigned' || row.status === 'overdue');
            const canRequireRetrain = !row || row.status === 'completed';

            return (
              <li
                key={item.id}
                className="rounded-xl border border-line p-3 spread items-center gap-2 flex-wrap"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold m-0">{item.title}</p>
                  {row ? (
                    <span className="badge" data-status={trainingStatusTone(row.status)}>
                      {trainingStatusLabel(row.status)}
                    </span>
                  ) : (
                    <span className="badge" data-status="idle">
                      Not started
                    </span>
                  )}
                </div>
                <div className="cluster gap-1 flex-wrap">
                  {!row || row.status !== 'completed' ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => onMarkTrained(item.id)}
                    >
                      Mark trained
                    </button>
                  ) : null}
                  {canRequireRetrain ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => onRequireRetrain(item.id)}
                    >
                      Require retrain
                    </button>
                  ) : null}
                  {canSignOff ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => onTrainerSignOff(row)}
                    >
                      Trainer sign-off
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<GraduationCap className="h-7 w-7" aria-hidden />}
          title="No curriculum steps"
        >
          Add curriculum steps before assigning training.
        </EmptyState>
      )}

      <div className="rounded-xl border border-line p-3 space-y-3">
        <div>
          <p className="text-sm font-semibold m-0 cluster gap-2">
            <UserPlus className="h-4 w-4" aria-hidden />
            Pair trainer
          </p>
          <p className="hint m-0 mt-1">
            {pairedNames.length
              ? `Currently paired: ${pairedNames.join(', ')}`
              : 'No trainers paired yet.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="field flex-1">
            <label className="label" htmlFor={trainerSelectId}>
              Trainer
            </label>
            <select
              id={trainerSelectId}
              className="select"
              value={pairTrainerId}
              disabled={busy}
              onChange={event => onPairTrainerIdChange(event.target.value)}
            >
              <option value="">Select trainer…</option>
              {trainers.map(trainer => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !pairTrainerId}
            onClick={onPairTrainer}
          >
            Pair
          </button>
        </div>
      </div>
    </section>
  );
}
