'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Edit2, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { normalizeReturnQuestions } from '@/lib/returnFlow';
import type { ChecklistQuestion, QuestionType } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  pass_fail: 'Pass / Fail',
  yes_no: 'Yes / No',
  text: 'Text Note',
  photo: 'Photo',
};

export function ReturnChecklistEditor() {
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistQuestion | null>(null);
  const [form, setForm] = useState({
    text: '',
    type: 'yes_no' as QuestionType,
    required: true,
    helperText: '',
  });

  const load = () => {
    const config = dbService.getChecklistConfig();
    setQuestions(normalizeReturnQuestions(config.returnQuestions));
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, []);

  const persist = async (next: ChecklistQuestion[]) => {
    const ordered = next.map((q, idx) => ({ ...q, order: idx + 1, category: q.category || 'general' }));
    setQuestions(ordered);
    await dbService.saveReturnQuestions(ordered);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ text: '', type: 'yes_no', required: true, helperText: '' });
    setIsModalOpen(true);
  };

  const openEdit = (q: ChecklistQuestion) => {
    setEditing(q);
    setForm({
      text: q.text,
      type: q.type,
      required: q.required,
      helperText: q.helperText || '',
    });
    setIsModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.text.trim()) return;
    if (editing) {
      await persist(
        questions.map((q) =>
          q.id === editing.id
            ? {
                ...q,
                text: form.text.trim(),
                type: form.type,
                required: form.required,
                helperText: form.helperText.trim() || undefined,
              }
            : q
        )
      );
    } else {
      const newQ: ChecklistQuestion = {
        id: `return-q-${Date.now()}`,
        text: form.text.trim(),
        category: 'general',
        type: form.type,
        required: form.required,
        order: questions.length + 1,
        helperText: form.helperText.trim() || undefined,
      };
      await persist([...questions, newQ]);
    }
    setIsModalOpen(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this return question?')) return;
    await persist(questions.filter((q) => q.id !== id));
  };

  const move = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    await persist(next);
  };

  return (
    <div className="bg-surface rounded-[var(--radius-xl)] p-6 sm:p-8 border border-line shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-ink" />
            <span>Return checklist (shop exit)</span>
          </h2>
          <p className="text-xs text-ink-faint">
            Short post-trip questions shown when a driver scans the shop-exit QR.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ink text-white hover:opacity-90 text-xs font-bold shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add return question</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="p-4 rounded-2xl border border-line bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-surface-sunk text-ink-muted font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink leading-snug">{q.text}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {TYPE_LABEL[q.type] || q.type}
                  </span>
                  {q.required && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                      Required
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 shrink-0">
              <button type="button" onClick={() => move(idx, 'up')} disabled={idx === 0} className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-sunk disabled:opacity-20" title="Move up">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => move(idx, 'down')} disabled={idx === questions.length - 1} className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-sunk disabled:opacity-20" title="Move down">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => openEdit(q)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-sunk" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => remove(q.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-[var(--radius-xl)] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-ink">
                {editing ? 'Edit return question' : 'Add return question'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-ink-faint hover:text-ink-muted p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">Question text</label>
                <textarea
                  rows={2}
                  required
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">Answer type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as QuestionType })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface font-semibold"
                >
                  <option value="yes_no">Yes / No</option>
                  <option value="pass_fail">Pass / Fail</option>
                  <option value="text">Text Note</option>
                  <option value="photo">Photo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">Helper note (optional)</label>
                <input
                  type="text"
                  value={form.helperText}
                  onChange={(e) => setForm({ ...form, helperText: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line"
                />
              </div>
              <label className="flex items-center gap-2 pt-1 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="w-4 h-4"
                />
                Required before submit
              </label>
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-line text-ink-muted font-bold text-xs">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-ink text-white font-bold text-xs">
                  Save question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
