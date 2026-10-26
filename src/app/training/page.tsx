'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { CurriculumSortList } from '@/components/CurriculumSortList';
import { MyTrainingSection } from '@/components/training/MyTrainingSection';
import { NeedsAttentionSection } from '@/components/training/NeedsAttentionSection';
import { PeopleOverview } from '@/components/training/PeopleOverview';
import { PersonTrainingPanel } from '@/components/training/PersonTrainingPanel';
import { TrainerSignOffQueue } from '@/components/training/TrainerSignOffQueue';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';
import {
  applyApproveRetrain,
  applyManagerMarkTrained,
  applyManagerRequireRetrain,
  applyTraineeCertify,
  applyTrainerSignOff,
  buildOnboardingAssignments,
  removeTrainingItem,
  reorderTrainingItemsByIds,
} from '@/lib/training/trainingDomain';
import { buildTraineeLearnRows } from '@/lib/training/trainingProgress';
import {
  buildTrainerSignOffQueue,
  buildTrainingAttentionRows,
} from '@/lib/training/trainingAttention';
import {
  buildNewTrainingItem,
  formatTrainingActionError,
  updateTrainingItemSettings,
} from '@/lib/training/trainingUi';
import { buildMissStrikeSlots, toggleLinkedQuestionId } from '@/lib/training/trainingMissTargets';
import type { TrainingAssignment, TrainingItem, TraineeTrainerLink } from '@/lib/training/types';
import type { ChecklistQuestion, User } from '@/types';

function TrainingDashboard() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [links, setLinks] = useState<TraineeTrainerLink[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [checklistQuestions, setChecklistQuestions] = useState<ChecklistQuestion[]>([]);
  const [title, setTitle] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [pairTrainerId, setPairTrainerId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isManager = role === 'manager';
  const canTrain = isManager || Boolean(user?.isDesignatedTrainer);

  const refresh = useCallback(() => {
    setItems(dbService.getTrainingItems().sort((a, b) => a.order - b.order));
    setAssignments(dbService.getTrainingAssignments());
    setLinks(dbService.getTraineeTrainerLinks());
    setEmployees(
      dbService
        .getUsers()
        .filter(u => u.status === 'active' && u.role === 'employee')
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    const config = dbService.getChecklistConfig?.() || { questions: [], returnQuestions: [] };
    setChecklistQuestions([...(config.questions || []), ...(config.returnQuestions || [])]);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('sunny_db_update', refresh);
    return () => window.removeEventListener('sunny_db_update', refresh);
  }, [refresh]);

  const trainers = useMemo(
    () => employees.filter(e => Boolean(e.isDesignatedTrainer)),
    [employees],
  );

  const learnRows = useMemo(
    () => buildTraineeLearnRows({ employees, items, assignments }),
    [employees, items, assignments],
  );

  const attentionRows = useMemo(() => buildTrainingAttentionRows(assignments), [assignments]);

  /** Open miss streaks (strikes toward retrain) for manager review. */
  const missStrikeRows = useMemo(
    () =>
      assignments
        .filter(a => a.missStreak > 0 || a.status === 'needs_retrain')
        .sort((a, b) => b.missStreak - a.missStreak || a.traineeName.localeCompare(b.traineeName)),
    [assignments],
  );

  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const activeItems = useMemo(() => items.filter(i => i.active), [items]);
  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );

  const runAction = async (work: () => Promise<void>, success: string, fallbackError: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      setMessage(success);
      refresh();
    } catch (err) {
      setError(formatTrainingActionError(err, fallbackError));
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    const now = new Date().toISOString();
    const next = buildNewTrainingItem(title, items.length + 1, now);
    if ('error' in next) {
      setError(next.error);
      setMessage('');
      return;
    }
    await runAction(
      async () => {
        await dbService.saveTrainingItems([...items, next]);
        setTitle('');
      },
      'Training step saved.',
      'Could not save training step. Check connection / permissions and retry.',
    );
  };

  const saveItemSettings = async (
    item: TrainingItem,
    patch: { withinDays?: number; retrainThreshold?: number; linkedQuestionIds?: string[] },
  ) => {
    if (!isManager) return;
    const now = new Date().toISOString();
    const next = updateTrainingItemSettings(item, patch, now);
    await runAction(
      async () => {
        await dbService.saveTrainingItems(items.map(row => (row.id === item.id ? next : row)));
      },
      'Curriculum settings updated.',
      'Could not update curriculum settings.',
    );
  };

  const toggleLink = async (item: TrainingItem, questionId: string) => {
    if (!isManager) return;
    const next = toggleLinkedQuestionId(item, questionId, new Date().toISOString());
    await runAction(
      async () => {
        await dbService.saveTrainingItems(items.map(row => (row.id === item.id ? next : row)));
      },
      next.linkedQuestionIds.includes(questionId)
        ? 'Inspection question linked to this step.'
        : 'Inspection question unlinked.',
      'Could not update linked questions.',
    );
  };

  const reorderByIds = async (orderedIds: string[]) => {
    if (!isManager) return;
    const next = reorderTrainingItemsByIds(items, orderedIds);
    await runAction(
      async () => {
        await dbService.saveTrainingItems(next);
      },
      'Curriculum order updated.',
      'Could not reorder curriculum.',
    );
  };

  const deleteItem = async (itemId: string) => {
    if (!isManager) return;
    if (!confirm('Delete this training step from the curriculum?')) return;
    const next = removeTrainingItem(items, itemId);
    await runAction(
      async () => {
        await dbService.saveTrainingItems(next);
      },
      'Training step deleted.',
      'Could not delete training step.',
    );
  };

  const assignMissingSteps = async () => {
    if (!isManager || !user?.id) return;
    const trainee = selectedEmployee;
    if (!trainee) {
      setError('Pick an employee first.');
      setMessage('');
      return;
    }
    if (!activeItems.length) {
      setError('Add curriculum steps before assigning training.');
      setMessage('');
      return;
    }
    const created = buildOnboardingAssignments({
      items,
      existing: assignments,
      trainee: { id: trainee.id, name: trainee.name },
      actor: { id: user.id, name: user.name },
      nowIso: new Date().toISOString(),
    });
    if (!created.length) {
      setMessage(`${trainee.name} is already covered for every active curriculum step.`);
      setError('');
      return;
    }
    await runAction(
      async () => {
        for (const row of created) {
          await dbService.saveTrainingAssignment(row);
        }
      },
      `Assigned ${created.length} step(s) to ${trainee.name}.`,
      'Could not assign missing steps.',
    );
  };

  const markAlreadyTrained = async (traineeId: string, itemId: string) => {
    if (!isManager || !user?.id) return;
    const trainee = employees.find(e => e.id === traineeId);
    const item = items.find(i => i.id === itemId);
    if (!trainee || !item) return;
    const existing =
      assignments.find(a => a.traineeId === traineeId && a.itemId === itemId) || null;
    try {
      const row = applyManagerMarkTrained({
        item,
        trainee: { id: trainee.id, name: trainee.name },
        actor: { id: user.id, name: user.name },
        nowIso: new Date().toISOString(),
        existing,
      });
      await runAction(
        async () => {
          await dbService.saveTrainingAssignment(row);
        },
        `Marked ${trainee.name} trained on â€œ${item.title}â€.`,
        'Could not mark trained.',
      );
    } catch (err) {
      setError(formatTrainingActionError(err, 'Could not mark trained.'));
      setMessage('');
    }
  };

  const approveRetrain = async (row: TrainingAssignment) => {
    if (!isManager || !user?.id) return;
    const item = itemById.get(row.itemId);
    if (!item) {
      setError('Curriculum step missing for this assignment.');
      return;
    }
    const next = applyApproveRetrain(
      row,
      { id: user.id, name: user.name },
      new Date().toISOString(),
      item,
    );
    await runAction(
      async () => {
        await dbService.saveTrainingAssignment(next);
      },
      `Retrain approved for ${row.traineeName}. Trainer can sign off again.`,
      'Could not approve retrain.',
    );
  };

  const requireRetrain = async (traineeId: string, itemId: string) => {
    if (!isManager || !user?.id) return;
    const trainee = employees.find(e => e.id === traineeId);
    const item = items.find(i => i.id === itemId);
    if (!trainee || !item) return;
    const existing =
      assignments.find(a => a.traineeId === traineeId && a.itemId === itemId) || null;
    try {
      const next = applyManagerRequireRetrain({
        item,
        trainee: { id: trainee.id, name: trainee.name },
        actor: { id: user.id, name: user.name },
        nowIso: new Date().toISOString(),
        existing,
      });
      await runAction(
        async () => {
          await dbService.saveTrainingAssignment(next);
        },
        `Retrain required for ${trainee.name} on â€œ${item.title}â€.`,
        'Could not require retrain.',
      );
    } catch (err) {
      setError(formatTrainingActionError(err, 'Could not require retrain.'));
      setMessage('');
    }
  };

  const openPerson = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setPairTrainerId('');
    setTimeout(() => {
      document.getElementById('person-training-panel')?.scrollIntoView?.({ behavior: 'smooth' });
    }, 0);
  };

  const pairTrainer = async () => {
    if (!isManager) return;
    if (!selectedEmployeeId || !pairTrainerId) {
      setError('Pick both a trainee and a designated trainer.');
      setMessage('');
      return;
    }
    const existing = links.find(l => l.traineeId === selectedEmployeeId);
    const trainerIds = Array.from(new Set([...(existing?.trainerIds || []), pairTrainerId]));
    await runAction(
      async () => {
        await dbService.saveTraineeTrainerLink({
          traineeId: selectedEmployeeId,
          trainerIds,
          updatedAt: new Date().toISOString(),
        });
        setPairTrainerId('');
      },
      'Trainer linked to trainee.',
      'Could not save trainer pairing.',
    );
  };

  const signOff = async (row: TrainingAssignment) => {
    if (!user?.id || !canTrain) return;
    const next = applyTrainerSignOff(row, { id: user.id, name: user.name }, new Date().toISOString());
    await runAction(
      async () => {
        await dbService.saveTrainingAssignment(next);
      },
      'Trainer sign-off saved.',
      'Could not save trainer sign-off.',
    );
  };

  const certify = async (row: TrainingAssignment) => {
    if (!user?.id) return;
    const next = applyTraineeCertify(row, { id: user.id, name: user.name }, new Date().toISOString());
    await runAction(
      async () => {
        await dbService.saveTrainingAssignment(next);
      },
      'Training certified.',
      'Could not save trainee certification.',
    );
  };

  const myAssignments = assignments.filter(a => a.traineeId === user?.id);
  const trainerQueue = useMemo(
    () =>
      user?.id
        ? buildTrainerSignOffQueue({ assignments, trainerId: user.id, links })
        : [],
    [assignments, links, user?.id],
  );

  return (
    <div className="page max-w-5xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Training"
        subtitle={
          isManager
            ? 'People status, dual sign-off progress, and curriculum.'
            : 'Your training and sign-offs.'
        }
        actions={
          <Link href={isManager ? '/dashboard' : '/home'} className="btn btn-secondary btn-sm">
            Back
          </Link>
        }
      />

      {message ? (
        <div className="card card-pad" data-status="ok" role="status">
          <p className="text-sm m-0 text-[var(--ok)]">{message}</p>
        </div>
      ) : null}
      {error ? (
        <div className="card card-pad" data-status="critical" role="alert">
          <p className="text-sm m-0 text-[var(--critical)]">{error}</p>
        </div>
      ) : null}

      {isManager && (
        <>
          <PeopleOverview
            learnRows={learnRows}
            selectedId={selectedEmployeeId || null}
            onSelect={openPerson}
          />

          {selectedEmployee && (
            <div id="person-training-panel">
              <PersonTrainingPanel
                trainee={{ id: selectedEmployee.id, name: selectedEmployee.name }}
                activeItems={activeItems}
                assignments={assignments}
                trainers={trainers.map(t => ({ id: t.id, name: t.name }))}
                pairedTrainerIds={
                  links.find(l => l.traineeId === selectedEmployee.id)?.trainerIds || []
                }
                pairTrainerId={pairTrainerId}
                onPairTrainerIdChange={setPairTrainerId}
                busy={busy}
                canTrain={canTrain}
                onAssignMissing={() => void assignMissingSteps()}
                onMarkTrained={itemId => void markAlreadyTrained(selectedEmployee.id, itemId)}
                onRequireRetrain={itemId => void requireRetrain(selectedEmployee.id, itemId)}
                onTrainerSignOff={row => void signOff(row)}
                onPairTrainer={() => void pairTrainer()}
              />
            </div>
          )}

          <NeedsAttentionSection
            rows={attentionRows}
            itemsById={itemById}
            busy={busy}
            canTrain={canTrain}
            onSignOff={row => void signOff(row)}
            onApproveRetrain={row => void approveRetrain(row)}
            onOpenPerson={openPerson}
          />

          <section className="card card-pad space-y-3">
            <h2 className="card-title text-base m-0 cluster gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Miss strikes &amp; retrain review
            </h2>
            <p className="hint m-0">
              Each filled mark is a flagged linked inspection (previous user when that question is
              tagged). When the row fills to your curriculum threshold, approve retrain.
            </p>
            {missStrikeRows.length ? (
              <ul className="m-0 p-0 list-none space-y-2">
                {missStrikeRows.map(row => {
                  const item = itemById.get(row.itemId);
                  const slots = buildMissStrikeSlots(row.missStreak, item?.retrainThreshold || 2);
                  const needsApproval = row.status === 'needs_retrain';
                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-line p-3 space-y-2"
                      data-status={needsApproval ? 'critical' : slots.atThreshold ? 'flagged' : 'info'}
                    >
                      <div className="spread items-start gap-2 flex-wrap">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold m-0">
                            {row.traineeName} Â· {item?.title || row.itemId}
                          </p>
                          <div
                            className="cluster gap-1.5"
                            role="img"
                            aria-label={`${slots.filled} of ${slots.total} miss strikes`}
                          >
                            {Array.from({ length: slots.total }, (_, i) => (
                              <span
                                key={i}
                                className={`inline-block h-3 w-3 rounded-full border ${
                                  i < slots.filled
                                    ? 'bg-[var(--critical)] border-[var(--critical)]'
                                    : 'bg-transparent border-line'
                                }`}
                                aria-hidden
                              />
                            ))}
                            <span className="text-xs text-ink-muted ml-1">
                              {slots.filled}/{slots.total}
                            </span>
                            {needsApproval ? (
                              <span className="badge" data-status="critical">
                                Needs retrain
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {needsApproval ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void approveRetrain(row)}
                          >
                            Approve retrain
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
                title="No miss strikes yet"
              >
                Link curriculum steps to inspection questions. When a previous-user question is
                flagged, their strike row appears here.
              </EmptyState>
            )}
          </section>

          <section className="card card-pad space-y-4">
            <div>
              <h2 className="card-title text-base m-0">Curriculum</h2>
              <p className="hint m-0 mt-1">
                Add steps and drag to reorder. Tap <strong>Link</strong> only when you want inspection
                misses to count â€” usually previous-user questions.
              </p>
            </div>
            <form onSubmit={e => void addItem(e)} className="flex flex-col sm:flex-row gap-2">
              <input
                className="input flex-1"
                placeholder="New training step title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                aria-label="New training step title"
              />
              <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
                <Plus className="h-4 w-4" aria-hidden />
                Add
              </button>
            </form>

            {items.length ? (
              <CurriculumSortList
                items={items}
                questions={checklistQuestions}
                busy={busy}
                onReorder={ids => void reorderByIds(ids)}
                onDelete={id => void deleteItem(id)}
                onSettingsBlur={(item, patch) => void saveItemSettings(item, patch)}
                onToggleLinkedQuestion={(item, questionId) => void toggleLink(item, questionId)}
              />
            ) : (
              <EmptyState icon={<Plus className="h-7 w-7" aria-hidden />} title="No training steps yet">
                Add curriculum titles above. Assign people after the list looks right.
              </EmptyState>
            )}
          </section>
        </>
      )}

      {!isManager && user?.isDesignatedTrainer && (
        <TrainerSignOffQueue
          rows={trainerQueue}
          itemsById={itemById}
          busy={busy}
          onSignOff={row => void signOff(row)}
        />
      )}

      {!isManager && (
        <MyTrainingSection
          userName={user?.name || 'current user'}
          rows={myAssignments}
          itemsById={itemById}
          busy={busy}
          onCertify={row => void certify(row)}
        />
      )}
    </div>
  );
}

export default function TrainingPage() {
  const { role } = useAuth();
  if (role === 'manager') {
    return (
      <ManagerOnly>
        <TrainingDashboard />
      </ManagerOnly>
    );
  }
  return <TrainingDashboard />;
}
