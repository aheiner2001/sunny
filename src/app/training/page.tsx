'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Plus } from 'lucide-react';
import { ManagerOnly } from '@/components/ManagerOnly';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';
import { applyTraineeCertify, applyTrainerSignOff } from '@/lib/training/trainingDomain';
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
    return { incomplete: incomplete.length, overdue: overdue.length, retrain: retrain.length };
  }, [assignments]);

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

  const saveItemSettings = async (item: TrainingItem, patch: { withinDays?: number; retrainThreshold?: number }) => {
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
    <div className="page max-w-3xl mx-auto space-y-5 pb-12">
      <div className="spread">
        <Link href={isManager ? '/dashboard' : '/home'} className="btn btn-secondary btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
        <span className="badge" data-status="info">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          Training
        </span>
      </div>

      <div>
        <h1 className="card-title text-2xl">Training accountability</h1>
        <p className="text-sm text-ink-muted">
          Dual sign-off (trainer then trainee), deadlines, and miss/retrain tracking.
        </p>
      </div>

      {message ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--critical)]" role="alert">
          {error}
        </p>
      ) : null}

      {isManager && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card card-pad">
            <p className="text-2xs uppercase text-ink-muted m-0">Incomplete</p>
            <p className="text-2xl font-bold m-0">{stats.incomplete}</p>
          </div>
          <div className="card card-pad">
            <p className="text-2xs uppercase text-ink-muted m-0">Overdue</p>
            <p className="text-2xl font-bold m-0">{stats.overdue}</p>
          </div>
          <div className="card card-pad">
            <p className="text-2xs uppercase text-ink-muted m-0">Needs retrain</p>
            <p className="text-2xl font-bold m-0">{stats.retrain}</p>
          </div>
        </div>
      )}

      {isManager && (
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0">Trainers</h2>
          <p className="text-xs text-ink-muted m-0">
            Mark people as designated trainers on the Employees page, then pair them here.
          </p>
          <ul className="space-y-1 m-0 p-0 list-none text-sm">
            {trainers.map(t => (
              <li key={t.id} className="text-ink">
                {t.name}
              </li>
            ))}
            {!trainers.length && (
              <li className="text-ink-muted">No designated trainers yet — enable on Employees.</li>
            )}
          </ul>
          <form onSubmit={e => void pairTrainer(e)} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select
              className="px-3 py-2 rounded-xl border border-line text-sm"
              value={pairTraineeId}
              onChange={e => setPairTraineeId(e.target.value)}
              aria-label="Trainee to pair"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  Trainee: {e.name}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-xl border border-line text-sm"
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
            <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !trainers.length}>
              Pair
            </button>
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
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0">Curriculum</h2>
          <form onSubmit={e => void addItem(e)} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-xl border border-line text-sm"
              placeholder="New training step title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              aria-label="New training step title"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy} aria-busy={busy}>
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </button>
          </form>

          {(isManager || canTrain) && (
            <label className="block text-xs text-ink-muted">
              Assign to
              <select
                className="mt-1 w-full px-3 py-2 rounded-xl border border-line text-sm text-ink"
                value={assignTraineeId}
                onChange={e => setAssignTraineeId(e.target.value)}
              >
                {assignableTrainees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <ul className="space-y-2 m-0 p-0 list-none">
            {items.map(item => (
              <li key={item.id} className="rounded-xl border border-line p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold m-0">{item.title}</p>
                    <p className="text-xs text-ink-muted m-0">
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
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1 text-ink-muted">
                    Days
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="w-16 px-2 py-1 rounded-lg border border-line text-ink"
                      defaultValue={item.withinDays || 7}
                      onBlur={e => {
                        const withinDays = Number(e.target.value);
                        if (!Number.isFinite(withinDays) || withinDays === (item.withinDays || 7)) return;
                        void saveItemSettings(item, { withinDays });
                      }}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-ink-muted">
                    Retrain after
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="w-16 px-2 py-1 rounded-lg border border-line text-ink"
                      defaultValue={item.retrainThreshold}
                      onBlur={e => {
                        const retrainThreshold = Number(e.target.value);
                        if (!Number.isFinite(retrainThreshold) || retrainThreshold === item.retrainThreshold) {
                          return;
                        }
                        void saveItemSettings(item, { retrainThreshold });
                      }}
                    />
                    misses
                  </label>
                </div>
              </li>
            ))}
            {!items.length && <p className="text-sm text-ink-muted">No training steps yet.</p>}
          </ul>
        </section>
      )}

      {!isManager && canTrain && (
        <section className="card card-pad space-y-3">
          <h2 className="card-title text-base m-0">Assign training</h2>
          <label className="block text-xs text-ink-muted">
            Trainee
            <select
              className="mt-1 w-full px-3 py-2 rounded-xl border border-line text-sm text-ink"
              value={assignTraineeId}
              onChange={e => setAssignTraineeId(e.target.value)}
            >
              {assignableTrainees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <ul className="space-y-2 m-0 p-0 list-none">
            {items.map(item => (
              <li key={item.id} className="rounded-xl border border-line p-3 flex justify-between gap-2">
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
            {!items.length && <p className="text-sm text-ink-muted">No curriculum yet — ask a manager to add steps.</p>}
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
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold m-0">
                        {row.traineeName} · {item?.title || row.itemId}
                      </p>
                      <p className="text-xs text-ink-muted m-0">
                        {row.status} · streak {row.missStreak}
                        {row.dueAt ? ` · due ${new Date(row.dueAt).toLocaleString()}` : ''}
                      </p>
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
            {!assignments.length && <p className="text-sm text-ink-muted">No assignments yet.</p>}
          </ul>
        </section>
      )}

      <section className="card card-pad space-y-3">
        <h2 className="card-title text-base m-0">My training</h2>
        <ul className="space-y-2 m-0 p-0 list-none">
          {myAssignments.map(row => {
            const item = items.find(i => i.id === row.itemId);
            return (
              <li key={row.id} className="rounded-xl border border-line p-3 flex justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold m-0">{item?.title || row.itemId}</p>
                  <p className="text-xs text-ink-muted m-0">{row.status}</p>
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
          {!myAssignments.length && <p className="text-sm text-ink-muted">No training assigned to you.</p>}
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
