'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { CurriculumSortList } from '@/components/CurriculumSortList';
import { TrainingLearnChart } from '@/components/TrainingLearnChart';
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
import {
  buildTraineeLearnRows,
  employeeOverviewLabel,
  employeeOverviewStatus,
  employeeOverviewTone,
  trainingStatusLabel,
  trainingStatusTone,
} from '@/lib/training/trainingProgress';
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
  const [onboardTraineeId, setOnboardTraineeId] = useState('');
  const [reviewEmployeeId, setReviewEmployeeId] = useState('');
  const [pairTraineeId, setPairTraineeId] = useState('');
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

  useEffect(() => {
    if (!pairTraineeId && employees[0]) setPairTraineeId(employees[0].id);
    if (!onboardTraineeId && employees[0]) setOnboardTraineeId(employees[0].id);
    if (!reviewEmployeeId && employees[0]) setReviewEmployeeId(employees[0].id);
  }, [employees, pairTraineeId, onboardTraineeId, reviewEmployeeId]);

  const learnRows = useMemo(
    () => buildTraineeLearnRows({ employees, items, assignments }),
    [employees, items, assignments],
  );

  const retrainQueue = useMemo(
    () => assignments.filter(a => a.status === 'needs_retrain'),
    [assignments],
  );

  /** Open miss streaks (strikes toward retrain) for manager review. */
  const missStrikeRows = useMemo(
    () =>
      assignments
        .filter(a => a.missStreak > 0 || a.status === 'needs_retrain')
        .sort((a, b) => b.missStreak - a.missStreak || a.traineeName.localeCompare(b.traineeName)),
    [assignments],
  );

  const stats = useMemo(() => {
    const incomplete = assignments.filter(a => a.status !== 'completed');
    const overdue = assignments.filter(a => a.status === 'overdue');
    return {
      incomplete: incomplete.length,
      overdue: overdue.length,
      retrain: retrainQueue.length,
      trainedPeople: learnRows.filter(r => employeeOverviewStatus(r) === 'up_to_date').length,
    };
  }, [assignments, learnRows, retrainQueue.length]);

  const nameById = useMemo(() => new Map(employees.map(e => [e.id, e.name])), [employees]);
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

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

  const onboardEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager || !user?.id) return;
    const trainee = employees.find(emp => emp.id === onboardTraineeId);
    if (!trainee) {
      setError('Pick an employee to onboard.');
      setMessage('');
      return;
    }
    if (!items.some(i => i.active)) {
      setError('Add curriculum steps before onboarding.');
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
    const paired = links.find(l => l.traineeId === trainee.id);
    const trainerNames = (paired?.trainerIds || [])
      .map(id => nameById.get(id) || id)
      .join(', ');
    await runAction(
      async () => {
        for (const row of created) {
          await dbService.saveTrainingAssignment(row);
        }
      },
      trainerNames
        ? `Onboarded ${trainee.name}: ${created.length} step(s) assigned. Trainer notified in-app: ${trainerNames}.`
        : `Onboarded ${trainee.name}: ${created.length} step(s) assigned. Pair a trainer so they see the queue.`,
      'Could not complete onboarding.',
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
        `Marked ${trainee.name} trained on “${item.title}”.`,
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
        `Retrain required for ${trainee.name} on “${item.title}”.`,
        'Could not require retrain.',
      );
    } catch (err) {
      setError(formatTrainingActionError(err, 'Could not require retrain.'));
      setMessage('');
    }
  };

  const openEmployeeReview = (employeeId: string) => {
    setReviewEmployeeId(employeeId);
    document.getElementById('employee-training-review')?.scrollIntoView({ behavior: 'smooth' });
  };

  const pairTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    if (!pairTraineeId || !pairTrainerId) {
      setError('Pick both a trainee and a designated trainer.');
      setMessage('');
      return;
    }
    const existing = links.find(l => l.traineeId === pairTraineeId);
    const trainerIds = Array.from(new Set([...(existing?.trainerIds || []), pairTrainerId]));
    await runAction(
      async () => {
        await dbService.saveTraineeTrainerLink({
          traineeId: pairTraineeId,
          trainerIds,
          updatedAt: new Date().toISOString(),
        });
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

  return (
    <div className="page max-w-5xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Training"
        subtitle="Build the curriculum once. Onboard people into every step. Require retrain anytime — with or without miss flags."
        actions={
          <Link href={isManager ? '/dashboard' : '/home'} className="btn btn-secondary btn-sm">
            Back
          </Link>
        }
      />

      {isManager && (
        <div className="card card-pad" data-status="info">
          <p className="text-sm font-semibold m-0 mb-2">How dual sign-off works</p>
          <ol className="m-0 pl-4 text-sm text-ink-muted space-y-1">
            <li>
              <strong className="text-ink">Trainer sign-off</strong> on an assigned step (All assignments
              below).
            </li>
            <li>
              Status becomes <strong className="text-ink">Awaiting certify</strong> — the{' '}
              <em>trainee</em> must sign in as themselves.
            </li>
            <li>
              They open <strong className="text-ink">My training</strong> at the bottom and tap{' '}
              <strong className="text-ink">I was trained — certify</strong>.
            </li>
          </ol>
        </div>
      )}

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
        <div className="grid-auto" style={{ '--min': '11rem' } as React.CSSProperties}>
          <div className="card card-pad" data-status="ok">
            <div className="spread">
              <span className="eyebrow mb-0">Up to date</span>
              <span className="icon-tile" data-status="ok" aria-hidden>
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3" data-status="ok">
              <div className="stat-value">{stats.trainedPeople}</div>
              <p className="stat-label">People fully trained</p>
            </div>
          </div>
          <div className="card card-pad" data-status="info">
            <div className="spread">
              <span className="eyebrow mb-0">Open work</span>
              <span className="icon-tile" data-status="info" aria-hidden>
                <Clock3 className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3">
              <div className="stat-value">{stats.incomplete}</div>
              <p className="stat-label">Incomplete assignments</p>
            </div>
          </div>
          <div className="card card-pad" data-status="flagged">
            <div className="spread">
              <span className="eyebrow mb-0">Overdue</span>
              <span className="icon-tile" data-status="flagged" aria-hidden>
                <AlertTriangle className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3" data-status="flagged">
              <div className="stat-value">{stats.overdue}</div>
              <p className="stat-label">Past due</p>
            </div>
          </div>
          <div className="card card-pad" data-status="critical">
            <div className="spread">
              <span className="eyebrow mb-0">Retrain review</span>
              <span className="icon-tile" data-status="critical" aria-hidden>
                <GraduationCap className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3" data-status="critical">
              <div className="stat-value">{stats.retrain}</div>
              <p className="stat-label">Awaiting your approval</p>
            </div>
          </div>
        </div>
      )}

      {isManager && (
        <section className="card card-pad space-y-3">
          <div className="spread items-start gap-2 flex-wrap">
            <div>
              <h2 className="card-title text-base m-0 cluster gap-2">
                <Users className="h-4 w-4" aria-hidden />
                People overview
              </h2>
              <p className="hint m-0 mt-1">Quick status for every active employee.</p>
            </div>
          </div>
          {learnRows.length ? (
            <ul className="m-0 p-0 list-none grid gap-2 sm:grid-cols-2">
              {learnRows.map(row => {
                const status = employeeOverviewStatus(row);
                return (
                  <li key={row.traineeId} className="rounded-xl border border-line p-3 space-y-2">
                    <div className="spread items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{row.traineeName}</span>
                      <span className="badge" data-status={employeeOverviewTone(status)}>
                        {employeeOverviewLabel(status)}
                      </span>
                    </div>
                    <p className="hint m-0">
                      {row.totalSteps
                        ? `${row.completed}/${row.totalSteps} curriculum steps complete`
                        : 'No curriculum yet'}
                    </p>
                    <div className="cluster gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEmployeeReview(row.traineeId)}
                      >
                        View / retrain
                      </button>
                      {status === 'needs_training' && row.totalSteps > 0 && row.notStarted > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => {
                            setOnboardTraineeId(row.traineeId);
                            document
                              .getElementById('onboarding-section')
                              ?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          Onboard…
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<Users className="h-7 w-7" aria-hidden />} title="No employees yet">
              Add people on Employees, then return here to onboard them.
            </EmptyState>
          )}
        </section>
      )}

      {isManager && (
        <section id="employee-training-review" className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0 cluster gap-2">
            <GraduationCap className="h-4 w-4" aria-hidden />
            Employee training
          </h2>
          <p className="hint m-0">
            Select anyone and require retrain on a step — even if they have no miss flags and are already
            up to date.
          </p>
          <div className="field max-w-sm">
            <label className="label" htmlFor="review-employee">
              Employee
            </label>
            <select
              id="review-employee"
              className="select"
              value={reviewEmployeeId}
              onChange={e => setReviewEmployeeId(e.target.value)}
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          {reviewEmployeeId && items.filter(i => i.active).length > 0 ? (
            <ul className="m-0 p-0 list-none space-y-2">
              {items
                .filter(i => i.active)
                .map(item => {
                  const row = assignments.find(
                    a => a.traineeId === reviewEmployeeId && a.itemId === item.id,
                  );
                  const status = row?.status;
                  const done = status === 'completed';
                  const open = Boolean(status && status !== 'completed');
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-line p-3 spread items-center gap-2 flex-wrap"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold m-0">{item.title}</p>
                        {status ? (
                          <span className="badge" data-status={trainingStatusTone(status)}>
                            {trainingStatusLabel(status)}
                          </span>
                        ) : (
                          <span className="badge" data-status="idle">
                            Not started
                          </span>
                        )}
                      </div>
                      <div className="cluster gap-1 flex-wrap">
                        {(done || !status) && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void requireRetrain(reviewEmployeeId, item.id)}
                          >
                            Require retrain
                          </button>
                        )}
                        {open && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => void markAlreadyTrained(reviewEmployeeId, item.id)}
                          >
                            Mark trained
                          </button>
                        )}
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
              Add curriculum steps first, then you can require retrain per person.
            </EmptyState>
          )}
        </section>
      )}

      {isManager && (
        <section id="onboarding-section" className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0 cluster gap-2">
            <UserPlus className="h-4 w-4" aria-hidden />
            Onboarding
          </h2>
          <p className="hint m-0">
            Assigns every active curriculum step the person has not already completed. Paired trainers see
            the new work on this page (in-app).
          </p>
          <form onSubmit={e => void onboardEmployee(e)} className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="field flex-1">
              <label className="label" htmlFor="onboard-trainee">
                Employee
              </label>
              <select
                id="onboard-trainee"
                className="select"
                value={onboardTraineeId}
                onChange={e => setOnboardTraineeId(e.target.value)}
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !employees.length}>
              Onboard — assign all steps
            </button>
          </form>
          {items.filter(i => i.active).length > 0 && onboardTraineeId && (
            <div className="rounded-xl border border-line p-3 space-y-2">
              <p className="text-xs font-semibold m-0">Veteran shortcut — mark already trained</p>
              <p className="hint m-0">
                Use when someone already knows a step and should not go through dual sign-off.
              </p>
              <ul className="m-0 p-0 list-none space-y-1">
                {items
                  .filter(i => i.active)
                  .map(item => {
                    const row = assignments.find(
                      a => a.traineeId === onboardTraineeId && a.itemId === item.id,
                    );
                    const done = row?.status === 'completed';
                    const inRetrain = Boolean(row && row.status !== 'completed');
                    return (
                      <li key={item.id} className="spread items-center gap-2 text-sm flex-wrap">
                        <span className="truncate">{item.title}</span>
                        <div className="cluster gap-1">
                          {done ? (
                            <span className="badge" data-status="ok">
                              Trained
                            </span>
                          ) : null}
                          {inRetrain ? (
                            <span className="badge" data-status="flagged">
                              {trainingStatusLabel(row!.status)}
                            </span>
                          ) : null}
                          {!done && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busy}
                              onClick={() => void markAlreadyTrained(onboardTraineeId, item.id)}
                            >
                              Mark trained
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </section>
      )}

      {isManager && (
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0 cluster gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Miss strikes &amp; retrain review
          </h2>
          <p className="hint m-0">
            Each filled mark is a flagged linked inspection (previous user when that question is tagged).
            When the row fills to your curriculum threshold, approve retrain.
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
                          {row.traineeName} · {item?.title || row.itemId}
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
              Link curriculum steps to inspection questions. When a previous-user question is flagged,
              their strike row appears here.
            </EmptyState>
          )}
        </section>
      )}

      {isManager && (
        <section className="card card-pad space-y-3">
          <div className="spread items-start gap-2 flex-wrap">
            <div>
              <h2 className="card-title text-base m-0 cluster gap-2">
                <GraduationCap className="h-4 w-4" aria-hidden />
                Learn chart
              </h2>
              <p className="hint m-0 mt-1">Who has been trained across the active curriculum.</p>
            </div>
          </div>
          <TrainingLearnChart rows={learnRows} />
        </section>
      )}

      {isManager && (
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0 cluster gap-2">
            <Users className="h-4 w-4" aria-hidden />
            Trainers
          </h2>
          <p className="hint m-0">Pair designated trainers (set on Employees) to trainees.</p>
          {trainers.length ? (
            <div className="cluster gap-2 flex-wrap">
              {trainers.map(t => (
                <span key={t.id} className="badge" data-status="info">
                  {t.name}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-7 w-7" aria-hidden />}
              title="No designated trainers"
              action={
                <Link href="/employees" className="btn btn-secondary btn-sm">
                  Open Employees
                </Link>
              }
            >
              Enable “Designated trainer” on an employee, then pair them here.
            </EmptyState>
          )}
          <form onSubmit={e => void pairTrainer(e)} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div className="field">
              <label className="label" htmlFor="pair-trainee">
                Trainee
              </label>
              <select
                id="pair-trainee"
                className="select"
                value={pairTraineeId}
                onChange={e => setPairTraineeId(e.target.value)}
                aria-label="Trainee to pair"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="pair-trainer">
                Trainer
              </label>
              <select
                id="pair-trainer"
                className="select"
                value={pairTrainerId}
                onChange={e => setPairTrainerId(e.target.value)}
                aria-label="Trainer to pair"
              >
                <option value="">Select trainer…</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn btn-secondary" disabled={busy || !trainers.length}>
                Pair
              </button>
            </div>
          </form>
          {links.length > 0 && (
            <ul className="space-y-1 m-0 p-0 list-none text-xs text-ink-muted">
              {links.map(link => (
                <li key={link.traineeId}>
                  {nameById.get(link.traineeId) || link.traineeId}:{' '}
                  {link.trainerIds.map(id => nameById.get(id) || id).join(', ')}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isManager && (
        <section className="card card-pad space-y-4">
          <div>
            <h2 className="card-title text-base m-0">Curriculum</h2>
            <p className="hint m-0 mt-1">
              Add steps and drag to reorder. Tap <strong>Link</strong> only when you want inspection misses
              to count — usually previous-user questions.
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
              Add curriculum titles above. Onboard people after the list looks right.
            </EmptyState>
          )}
        </section>
      )}

      {(isManager || canTrain) && (
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0">All assignments</h2>
          <p className="hint m-0">
            After trainer sign-off, status is Awaiting certify — only the trainee can finish it under My
            training (sign in as that person).
          </p>
          <ul className="space-y-2 m-0 p-0 list-none">
            {assignments.map(row => {
              const item = items.find(i => i.id === row.itemId);
              return (
                <li key={row.id} className="rounded-xl border border-line p-3 space-y-2">
                  <div className="spread items-start gap-2 flex-wrap">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold m-0">
                        {row.traineeName} · {item?.title || row.itemId}
                      </p>
                      <div className="cluster gap-2 flex-wrap">
                        <span className="badge" data-status={trainingStatusTone(row.status)}>
                          {trainingStatusLabel(row.status)}
                        </span>
                        <span className="text-xs text-ink-muted">
                          streak {row.missStreak}
                          {row.dueAt ? ` · due ${new Date(row.dueAt).toLocaleString()}` : ''}
                        </span>
                      </div>
                      {row.status === 'awaiting_trainee' && (
                        <p className="hint m-0">
                          Waiting for <strong>{row.traineeName}</strong> to open My training and certify.
                          {isManager && (
                            <>
                              {' '}
                              Or use <strong>Mark trained</strong> on Employee training / Onboarding if
                              they already know it.
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="cluster gap-1 flex-wrap">
                      {canTrain && (row.status === 'assigned' || row.status === 'overdue') && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => void signOff(row)}
                        >
                          Trainer sign-off
                        </button>
                      )}
                      {isManager && row.status !== 'completed' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => void markAlreadyTrained(row.traineeId, row.itemId)}
                        >
                          Mark trained
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {!assignments.length && (
              <EmptyState icon={<Clock3 className="h-7 w-7" aria-hidden />} title="No assignments yet">
                Use Onboarding to assign the full curriculum to someone.
              </EmptyState>
            )}
          </ul>
        </section>
      )}

      <section
        id="my-training"
        className={`card card-pad space-y-3 ${
          myAssignments.some(a => a.status === 'awaiting_trainee') ? 'ring-2 ring-[var(--ok)]' : ''
        }`}
      >
        <h2 className="card-title text-base m-0">My training</h2>
        <p className="hint m-0">
          Steps assigned to <strong>you</strong> ({user?.name || 'current user'}). Certify here after a
          trainer signs off.
        </p>
        <ul className="space-y-2 m-0 p-0 list-none">
          {myAssignments.map(row => {
            const item = items.find(i => i.id === row.itemId);
            return (
              <li
                key={row.id}
                className="rounded-xl border border-line p-3 spread items-center gap-2 flex-wrap"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold m-0">{item?.title || row.itemId}</p>
                  <span className="badge" data-status={trainingStatusTone(row.status)}>
                    {trainingStatusLabel(row.status)}
                  </span>
                </div>
                {row.status === 'awaiting_trainee' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => void certify(row)}
                  >
                    I was trained — certify
                  </button>
                )}
              </li>
            );
          })}
          {!myAssignments.length && (
            <EmptyState
              icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
              title="No training assigned to you"
            >
              {isManager
                ? 'You are signed in as a manager. Sign in as the trainee to certify, or Mark trained on their assignment.'
                : 'When a trainer signs off your step, Certify appears here.'}
            </EmptyState>
          )}
        </ul>
      </section>
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
