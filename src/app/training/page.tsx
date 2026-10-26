'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Plus,
  Users,
} from 'lucide-react';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { TrainingLearnChart } from '@/components/TrainingLearnChart';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';
import { applyTraineeCertify, applyTrainerSignOff } from '@/lib/training/trainingDomain';
import {
  buildTraineeLearnRows,
  trainingStatusLabel,
  trainingStatusTone,
} from '@/lib/training/trainingProgress';
import {
  buildNewTrainingItem,
  buildTrainingAssignment,
  formatTrainingActionError,
  traineesForAssigner,
  updateTrainingItemSettings,
} from '@/lib/training/trainingUi';
import type { TrainingAssignment, TrainingItem, TraineeTrainerLink } from '@/lib/training/types';
import type { User } from '@/types';

function TrainingDashboard() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [links, setLinks] = useState<TraineeTrainerLink[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [title, setTitle] = useState('');
  const [assignTraineeId, setAssignTraineeId] = useState('');
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

  const assignableTrainees = useMemo(
    () =>
      traineesForAssigner({
        employees,
        links,
        assignerId: user?.id || '',
        isManager,
      }),
    [employees, links, user?.id, isManager],
  );

  useEffect(() => {
    if (!pairTraineeId && employees[0]) setPairTraineeId(employees[0].id);
    if (!assignableTrainees.some(e => e.id === assignTraineeId)) {
      setAssignTraineeId(assignableTrainees[0]?.id || '');
    }
  }, [employees, pairTraineeId, assignableTrainees, assignTraineeId]);

  const stats = useMemo(() => {
    const incomplete = assignments.filter(a => a.status !== 'completed');
    const overdue = assignments.filter(a => a.status === 'overdue');
    const retrain = assignments.filter(a => a.status === 'needs_retrain');
    const trainedPeople = buildTraineeLearnRows({ employees, items, assignments }).filter(
      r => r.headlineStatus === 'trained',
    ).length;
    return {
      incomplete: incomplete.length,
      overdue: overdue.length,
      retrain: retrain.length,
      trainedPeople,
    };
  }, [assignments, employees, items]);

  const learnRows = useMemo(
    () => buildTraineeLearnRows({ employees, items, assignments }),
    [employees, items, assignments],
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
    patch: { withinDays?: number; retrainThreshold?: number },
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

  const assignItem = async (item: TrainingItem) => {
    if (!user?.id || !canTrain) return;
    const trainee = assignableTrainees.find(e => e.id === assignTraineeId);
    if (!trainee) {
      setError('Pick an employee to assign training to.');
      setMessage('');
      return;
    }
    const now = new Date().toISOString();
    const row = buildTrainingAssignment({
      item,
      trainee: { id: trainee.id, name: trainee.name },
      actor: { id: user.id, name: user.name },
      nowIso: now,
    });
    await runAction(
      async () => {
        await dbService.saveTrainingAssignment(row);
      },
      `Assigned “${item.title}” to ${trainee.name}.`,
      'Could not assign training. Check connection / permissions and retry.',
    );
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
  const nameById = useMemo(() => new Map(employees.map(e => [e.id, e.name])), [employees]);

  return (
    <div className="page max-w-5xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Training"
        subtitle="Dual sign-off curriculum, trainer pairing, and a clear view of who has been trained."
        actions={
          <Link href={isManager ? '/dashboard' : '/home'} className="btn btn-secondary btn-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden />
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
        <div className="grid-auto" style={{ '--min': '11rem' } as React.CSSProperties}>
          <div className="card card-pad flex flex-col justify-between" data-status="ok">
            <div className="spread">
              <span className="eyebrow mb-0">Fully trained</span>
              <span className="icon-tile" data-status="ok" aria-hidden>
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3" data-status="ok">
              <div className="stat-value">{stats.trainedPeople}</div>
              <p className="stat-label">People who finished every step</p>
            </div>
          </div>
          <div className="card card-pad flex flex-col justify-between" data-status="info">
            <div className="spread">
              <span className="eyebrow mb-0">Incomplete</span>
              <span className="icon-tile" data-status="info" aria-hidden>
                <Clock3 className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3" data-status="info">
              <div className="stat-value">{stats.incomplete}</div>
              <p className="stat-label">Open assignments</p>
            </div>
          </div>
          <div className="card card-pad flex flex-col justify-between" data-status="flagged">
            <div className="spread">
              <span className="eyebrow mb-0">Overdue</span>
              <span className="icon-tile" data-status="flagged" aria-hidden>
                <AlertTriangle className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3" data-status="flagged">
              <div className="stat-value">{stats.overdue}</div>
              <p className="stat-label">Past due date</p>
            </div>
          </div>
          <div className="card card-pad flex flex-col justify-between" data-status="critical">
            <div className="spread">
              <span className="eyebrow mb-0">Needs retrain</span>
              <span className="icon-tile" data-status="critical" aria-hidden>
                <GraduationCap className="h-5 w-5" />
              </span>
            </div>
            <div className="stat mt-3" data-status="critical">
              <div className="stat-value">{stats.retrain}</div>
              <p className="stat-label">Miss threshold hit</p>
            </div>
          </div>
        </div>
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
            <span className="badge" data-status="info">
              {learnRows.filter(r => r.headlineStatus === 'trained').length} trained
            </span>
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
          <p className="hint m-0">
            Mark designated trainers on Employees, then pair them to trainees here.
          </p>
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
              Enable “Designated trainer” on an employee, then come back to pair them.
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
              <button
                type="submit"
                className="btn btn-secondary w-full sm:w-auto"
                disabled={busy || !trainers.length}
              >
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
          <h2 className="card-title text-base m-0">Curriculum</h2>
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

          {(isManager || canTrain) && (
            <div className="field max-w-sm">
              <label className="label" htmlFor="assign-trainee">
                Assign to
              </label>
              <select
                id="assign-trainee"
                className="select"
                value={assignTraineeId}
                onChange={e => setAssignTraineeId(e.target.value)}
              >
                {assignableTrainees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <ul className="space-y-2 m-0 p-0 list-none">
            {items.map(item => (
              <li key={item.id} className="rounded-xl border border-line p-3 space-y-3">
                <div className="spread items-start gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold m-0">{item.title}</p>
                    <p className="hint m-0 mt-0.5">
                      Due in {item.withinDays || 7} days · retrain after {item.retrainThreshold} misses
                    </p>
                  </div>
                  {canTrain && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm shrink-0"
                      disabled={busy || !assignableTrainees.length}
                      onClick={() => void assignItem(item)}
                    >
                      Assign
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="field">
                    <label className="label">Days</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="input w-20"
                      defaultValue={item.withinDays || 7}
                      onBlur={e => {
                        const withinDays = Number(e.target.value);
                        if (!Number.isFinite(withinDays) || withinDays === (item.withinDays || 7)) return;
                        void saveItemSettings(item, { withinDays });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Retrain after misses</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input w-20"
                      defaultValue={item.retrainThreshold}
                      onBlur={e => {
                        const retrainThreshold = Number(e.target.value);
                        if (
                          !Number.isFinite(retrainThreshold) ||
                          retrainThreshold === item.retrainThreshold
                        ) {
                          return;
                        }
                        void saveItemSettings(item, { retrainThreshold });
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
            {!items.length && (
              <EmptyState
                icon={<Plus className="h-7 w-7" aria-hidden />}
                title="No training steps yet"
              >
                Add a curriculum title above to start tracking who has been trained.
              </EmptyState>
            )}
          </ul>
        </section>
      )}

      {!isManager && canTrain && (
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0">Assign training</h2>
          <div className="field max-w-sm">
            <label className="label" htmlFor="trainer-assign-trainee">
              Trainee
            </label>
            <select
              id="trainer-assign-trainee"
              className="select"
              value={assignTraineeId}
              onChange={e => setAssignTraineeId(e.target.value)}
            >
              {assignableTrainees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="space-y-2 m-0 p-0 list-none">
            {items.map(item => (
              <li key={item.id} className="rounded-xl border border-line p-3 spread items-center gap-2">
                <p className="text-sm font-semibold m-0">{item.title}</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy || !assignableTrainees.length}
                  onClick={() => void assignItem(item)}
                >
                  Assign
                </button>
              </li>
            ))}
            {!items.length && (
              <EmptyState icon={<GraduationCap className="h-7 w-7" aria-hidden />} title="No curriculum yet">
                Ask a manager to add training steps first.
              </EmptyState>
            )}
          </ul>
        </section>
      )}

      {(isManager || canTrain) && (
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0">All assignments</h2>
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
                    </div>
                    {canTrain &&
                      (row.status === 'assigned' ||
                        row.status === 'overdue' ||
                        row.status === 'needs_retrain') && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => void signOff(row)}
                        >
                          Trainer sign-off
                        </button>
                      )}
                  </div>
                </li>
              );
            })}
            {!assignments.length && (
              <EmptyState
                icon={<Clock3 className="h-7 w-7" aria-hidden />}
                title="No assignments yet"
              >
                Assign a curriculum step to an employee to start dual sign-off.
              </EmptyState>
            )}
          </ul>
        </section>
      )}

      <section className="card card-pad space-y-3">
        <h2 className="card-title text-base m-0">My training</h2>
        <ul className="space-y-2 m-0 p-0 list-none">
          {myAssignments.map(row => {
            const item = items.find(i => i.id === row.itemId);
            return (
              <li key={row.id} className="rounded-xl border border-line p-3 spread items-center gap-2 flex-wrap">
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
              When a trainer assigns a step, it will show up here for you to certify.
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
