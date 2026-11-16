import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  BookOpen,
  Sparkles,
  Play,
  Check,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { trainingStatusLabel, trainingStatusTone } from '@/lib/training/trainingProgress';
import type { TrainingAssignment, TrainingItem } from '@/lib/training/types';
import { TrainingModuleModal } from './TrainingModuleModal';

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
  const [activeItem, setActiveItem] = useState<{
    item: TrainingItem;
    row: TrainingAssignment;
  } | null>(null);

  const completedCount = rows.filter((r) => r.status === 'completed').length;
  const progressPercent = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;
  const hasAwaitingTrainee = rows.some((row) => row.status === 'awaiting_trainee');

  return (
    <section
      id="my-training"
      className="card card-pad space-y-5"
    >
      {/* Top Banner: Khan-style Progress Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="card-title text-lg m-0">My Training</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary,#f59e0b)]/15 text-[var(--primary,#f59e0b)] font-medium">
              Curriculum Mastery
            </span>
          </div>
          <p className="hint text-xs mt-1 mb-0">
            Assigned learning modules for <strong>{userName}</strong>. Complete lessons and certify after trainer sign-off.
          </p>
        </div>

        {/* Progress Circle / Bar */}
        {rows.length > 0 ? (
          <div className="flex items-center gap-3 bg-[var(--surface-muted,#18181b)] p-3 rounded-xl border border-[var(--line)] self-start sm:self-auto min-w-[200px]">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full border-2 border-[var(--primary,#f59e0b)]/30">
              <span className="text-xs font-bold text-[var(--foreground)]">
                {progressPercent}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-xs font-medium">
                <span>Progress</span>
                <span className="text-[var(--muted-foreground)]">
                  {completedCount}/{rows.length}
                </span>
              </div>
              <div className="w-full bg-[var(--line)] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-[var(--primary,#f59e0b)] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {hasAwaitingTrainee ? (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>You have modules signed off by your trainer ready for final certification!</span>
        </div>
      ) : null}

      {/* Grid of Micro-learning Cards */}
      {rows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {rows.map((row) => {
            const item = itemsById.get(row.itemId) || {
              id: row.itemId,
              title: row.itemId,
              order: 0,
              active: true,
              deadlineType: 'end_of_day',
              retrainThreshold: 3,
              linkedQuestionIds: [],
              createdAt: '',
              updatedAt: '',
            };

            const isCompleted = row.status === 'completed';
            const canCertify = row.status === 'awaiting_trainee';
            const estMinutes = item.estimatedMinutes || 3;
            const category = item.category || 'general';

            return (
              <div
                key={row.id}
                className={`group rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 bg-[var(--surface-muted,#18181b)] hover:border-[var(--line-strong,#3f3f46)] ${
                  canCertify
                    ? 'ring-2 ring-emerald-500/50 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                    : isCompleted
                    ? 'border-[var(--line)] opacity-85'
                    : 'border-[var(--line)]'
                }`}
              >
                {/* Card Header & Badge */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--surface-hover,#27272a)] text-[var(--muted-foreground)]">
                      {category}
                    </span>
                    <span className="badge text-[11px]" data-status={trainingStatusTone(row.status)}>
                      {trainingStatusLabel(row.status)}
                    </span>
                  </div>

                  {/* Optional Card Image / Thumbnail */}
                  {item.coverImageUrl ? (
                    <div className="h-28 rounded-xl overflow-hidden bg-black/20 border border-[var(--line)]">
                      <img
                        src={item.coverImageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : null}

                  {/* Title & Time */}
                  <div>
                    <h3 className="text-sm font-semibold m-0 text-[var(--foreground)] group-hover:text-[var(--primary,#f59e0b)] transition-colors">
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-1 mb-0">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Card Footer / Actions */}
                <div className="mt-4 pt-3 border-t border-[var(--line)]/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{estMinutes} min</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-xs gap-1 font-medium"
                      onClick={() => setActiveItem({ item, row })}
                    >
                      <BookOpen className="h-3 w-3" />
                      Review Lesson
                    </button>

                    {canCertify ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-xs gap-1 shadow-sm font-medium"
                        disabled={busy}
                        onClick={() => onCertify(row)}
                      >
                        <Check className="h-3 w-3" />
                        I was trained — certify
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="h-7 w-7 text-emerald-400" aria-hidden />}
          title="No training assigned to you"
        >
          When a trainer assigns modules, your interactive lessons and certification cards will appear here.
        </EmptyState>
      )}

      {/* Interactive Micro-learning Modal */}
      {activeItem ? (
        <TrainingModuleModal
          item={activeItem.item}
          isOpen={Boolean(activeItem)}
          canCertify={activeItem.row.status === 'awaiting_trainee'}
          busy={busy}
          onClose={() => setActiveItem(null)}
          onCertify={() => onCertify(activeItem.row)}
        />
      ) : null}
    </section>
  );
}
