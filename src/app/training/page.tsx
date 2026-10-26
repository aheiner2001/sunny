'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Plus } from 'lucide-react';
import { ManagerOnly } from '@/components/ManagerOnly';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';
import {
  applyTraineeCertify,
  applyTrainerSignOff,
  computeTrainingDueAt,
} from '@/lib/training/trainingDomain';
import type { TrainingAssignment, TrainingItem } from '@/lib/training/types';

function TrainingDashboard() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const isManager = role === 'manager';
  const canTrain = isManager || Boolean(user?.isDesignatedTrainer);

  const refresh = useCallback(() => {
    setItems(dbService.getTrainingItems().sort((a, b) => a.order - b.order));
    setAssignments(dbService.getTrainingAssignments());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('sunny_db_update', refresh);
    return () => window.removeEventListener('sunny_db_update', refresh);
  }, [refresh]);

  const stats = useMemo(() => {
    const incomplete = assignments.filter(a => a.status !== 'completed');
    const overdue = assignments.filter(a => a.status === 'overdue');
    const retrain = assignments.filter(a => a.status === 'needs_retrain');
    return { incomplete: incomplete.length, overdue: overdue.length, retrain: retrain.length };
  }, [assignments]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !isManager) return;
    const now = new Date().toISOString();
    const next: TrainingItem = {
      id: `train-${Date.now()}`,
      title: title.trim(),
      order: items.length + 1,
      active: true,
      deadlineType: 'within_days',
      withinDays: 7,
      retrainThreshold: 2,
      linkedQuestionIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await dbService.saveTrainingItems([...items, next]);
    setTitle('');
    setMessage('Training step saved.');
    refresh();
  };

  const assignToSelfDemo = async (item: TrainingItem) => {
    if (!user?.id || !canTrain) return;
    const employees = dbService.getUsers().filter(u => u.status === 'active' && u.role === 'employee');
    const trainee = employees[0];
    if (!trainee) {
      setMessage('Add an active employee before assigning training.');
      return;
    }
    const now = new Date().toISOString();
    const row: TrainingAssignment = {
      id: `asg-${Date.now()}`,
      traineeId: trainee.id,
      traineeName: trainee.name,
      itemId: item.id,
      status: 'assigned',
      dueAt: computeTrainingDueAt(item, now),
      missStreak: 0,
      events: [
        {
          id: `tev-${Date.now()}`,
          type: 'assigned',
          at: now,
          actorId: user.id,
          actorName: user.name,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    await dbService.saveTrainingAssignment(row);
    setMessage(`Assigned “${item.title}” to ${trainee.name}.`);
    refresh();
  };

  const signOff = async (row: TrainingAssignment) => {
    if (!user?.id || !canTrain) return;
    const next = applyTrainerSignOff(row, { id: user.id, name: user.name }, new Date().toISOString());
    await dbService.saveTrainingAssignment(next);
    refresh();
  };

  const certify = async (row: TrainingAssignment) => {
    if (!user?.id) return;
    const next = applyTraineeCertify(row, { id: user.id, name: user.name }, new Date().toISOString());
    await dbService.saveTrainingAssignment(next);
    refresh();
  };

  const myAssignments = assignments.filter(a => a.traineeId === user?.id);

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
          <h2 className="card-title text-base m-0">Curriculum</h2>
          <form onSubmit={e => void addItem(e)} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-xl border border-line text-sm"
              placeholder="New training step title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </button>
          </form>
          <ul className="space-y-2 m-0 p-0 list-none">
            {items.map(item => (
              <li key={item.id} className="rounded-xl border border-line p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold m-0">{item.title}</p>
                  <p className="text-xs text-ink-muted m-0">
                    Due in {item.withinDays || 7} days · retrain after {item.retrainThreshold} misses
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void assignToSelfDemo(item)}>
                  Assign to first employee
                </button>
              </li>
            ))}
            {!items.length && <p className="text-sm text-ink-muted">No training steps yet.</p>}
          </ul>
        </section>
      )}

      {isManager && (
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
                    {canTrain && (row.status === 'assigned' || row.status === 'overdue' || row.status === 'needs_retrain') && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => void signOff(row)}>
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
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void certify(row)}>
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
