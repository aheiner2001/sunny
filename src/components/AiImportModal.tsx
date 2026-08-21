'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardCopy, Info, Sparkles, Upload, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { AI_IMPORT_PROMPT, parseImportPayload, ParseResult } from '@/lib/aiImport';

type ImportMode = 'append' | 'replace';
type ImportScope = 'all' | 'checklist' | 'equipment';

const SCOPE_LABELS: Record<ImportScope, string> = {
  all: 'Everything in the payload',
  checklist: 'Questions & categories only',
  equipment: 'Equipment only'
};

/**
 * Appends items, renaming ids that collide so an existing record is never
 * silently overwritten.
 */
function appendRenaming<T extends { id: string }>(existing: T[], incoming: T[], stamp: number): T[] {
  const used = new Set(existing.map(item => item.id));
  const added = incoming.map((item, index) => {
    let id = item.id;
    if (used.has(id)) id = `${id}-${stamp}-${index}`;
    used.add(id);
    return { ...item, id };
  });
  return [...existing, ...added];
}

/**
 * Appends categories, skipping ids that already exist. Unlike questions, a
 * colliding category id means that section is already there — renaming it would
 * orphan every question pointing at the original id.
 */
function appendSkipping<T extends { id: string }>(existing: T[], incoming: T[]): { merged: T[]; skipped: string[] } {
  const used = new Set(existing.map(item => item.id));
  const skipped: string[] = [];
  const added: T[] = [];
  incoming.forEach(item => {
    if (used.has(item.id)) {
      skipped.push(item.id);
      return;
    }
    used.add(item.id);
    added.push(item);
  });
  return { merged: [...existing, ...added], skipped };
}

export function AiImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [json, setJson] = useState('');
  const [mode, setMode] = useState<ImportMode>('append');
  const [scope, setScope] = useState<ImportScope>('all');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const includesChecklist = scope === 'all' || scope === 'checklist';
  const includesEquipment = scope === 'all' || scope === 'equipment';

  /** Counts limited to the selected scope, so the preview matches what applies. */
  const scoped = useMemo(() => {
    if (!result?.ok) return null;
    const { categories, questions, equipment } = result.payload;
    return {
      categories: includesChecklist ? categories.length : 0,
      questions: includesChecklist ? questions.length : 0,
      equipment: includesEquipment ? equipment.length : 0
    };
  }, [result, includesChecklist, includesEquipment]);

  /**
   * Replacing categories can strip the section a surviving question points at,
   * leaving it invisible in the inspection form. Surfaced before applying.
   */
  const orphanWarning = useMemo(() => {
    if (!result?.ok || mode !== 'replace' || !includesChecklist) return null;
    const { categories, questions } = result.payload;
    if (categories.length === 0) return null;

    const incomingIds = new Set(categories.map(c => c.id));
    const keptQuestions = questions.length > 0 ? questions : dbService.getChecklistQuestions();
    const orphans = keptQuestions.filter(q => !incomingIds.has(q.category));
    if (orphans.length === 0) return null;
    return `${orphans.length} question(s) reference a category that the replacement does not define and will not appear in any section.`;
  }, [result, mode, includesChecklist]);

  const validate = () => {
    setSummary(null);
    setResult(parseImportPayload(json));
  };

  const reset = () => {
    setJson('');
    setResult(null);
    setSummary(null);
  };

  const apply = async () => {
    const parsed = parseImportPayload(json);
    setResult(parsed);
    if (!parsed.ok) return;

    const { categories, questions, equipment } = parsed.payload;
    const willTouchChecklist = includesChecklist && (categories.length > 0 || questions.length > 0);
    const willTouchEquipment = includesEquipment && equipment.length > 0;

    if (!willTouchChecklist && !willTouchEquipment) {
      setResult({
        ...parsed,
        ok: false,
        errors: ['The payload has nothing that matches the selected scope.']
      });
      return;
    }

    if (mode === 'replace') {
      const targets = [
        willTouchChecklist && categories.length > 0 ? 'all inspection categories' : null,
        willTouchChecklist && questions.length > 0 ? 'all checklist questions' : null,
        willTouchEquipment ? 'the entire equipment inventory, including every per-vehicle assignment' : null
      ].filter(Boolean);
      const confirmed = window.confirm(
        `Replace ${targets.join(' and ')}?\n\nThis cannot be undone.`
      );
      if (!confirmed) return;
    }

    const notes: string[] = [];
    const stamp = Date.now();

    try {
      setApplying(true);

      if (willTouchChecklist) {
        const config = dbService.getChecklistConfig();
        let nextCategories = config.categories;
        let nextQuestions = config.questions;

        if (categories.length > 0) {
          if (mode === 'replace') {
            nextCategories = categories;
            notes.push(`Replaced categories with ${categories.length}.`);
          } else {
            const { merged, skipped } = appendSkipping(config.categories, categories);
            nextCategories = merged;
            notes.push(`Added ${categories.length - skipped.length} category(ies).`);
            if (skipped.length > 0) {
              notes.push(`Skipped ${skipped.length} existing category id(s): ${skipped.join(', ')}.`);
            }
          }
        }

        if (questions.length > 0) {
          if (mode === 'replace') {
            nextQuestions = questions;
            notes.push(`Replaced questions with ${questions.length}.`);
          } else {
            nextQuestions = appendRenaming(config.questions, questions, stamp);
            notes.push(`Added ${questions.length} question(s).`);
          }
        }

        await dbService.saveChecklistConfig({ ...config, categories: nextCategories, questions: nextQuestions });
      }

      if (willTouchEquipment) {
        const created = await dbService.importEquipment(equipment, mode);
        notes.push(
          mode === 'replace'
            ? `Replaced inventory with ${created.length} item(s).`
            : `Added ${created.length} equipment item(s).`
        );
      }

      setSummary(notes.join(' '));
      setJson('');
      setResult(null);
    } catch (err: any) {
      setResult({
        ok: false,
        errors: [err?.message || 'Could not apply the import.'],
        warnings: parsed.warnings,
        payload: parsed.payload
      });
    } finally {
      setApplying(false);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_IMPORT_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some embedded browsers; the textarea is selectable.
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 my-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-sky-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Generate / Import with AI</h3>
              <p className="text-[11px] text-slate-500">Build the prompt, paste the JSON back, review, then apply.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* SECTION A — copyable prompt */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">1 · Prompt for your AI</h4>
                <p className="text-[11px] text-slate-500">
                  Paste this into ChatGPT, Claude, or Gemini with your notes or a photo of a paper checklist.
                </p>
              </div>
              <button
                onClick={copyPrompt}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
              >
                {promptCopied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                <span>{promptCopied ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={AI_IMPORT_PROMPT}
              onFocus={e => e.currentTarget.select()}
              rows={8}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[10px] leading-relaxed text-slate-700 resize-y"
            />
          </section>

          {/* SECTION B — paste and import */}
          <section className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">2 · Paste the JSON</h4>
            <textarea
              value={json}
              onChange={e => {
                setJson(e.target.value);
                setResult(null);
                setSummary(null);
              }}
              rows={7}
              spellCheck={false}
              placeholder='{ "categories": [...], "questions": [...], "equipment": [...] }'
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] leading-relaxed resize-y focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Apply to</label>
                <select
                  value={scope}
                  onChange={e => setScope(e.target.value as ImportScope)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {(Object.keys(SCOPE_LABELS) as ImportScope[]).map(key => (
                    <option key={key} value={key}>{SCOPE_LABELS[key]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Mode</label>
                <div className="flex gap-2">
                  {(['append', 'replace'] as ImportMode[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMode(option)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        mode === option
                          ? option === 'replace'
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-sky-50 border-sky-300 text-sky-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {option === 'append' ? 'Append' : 'Replace'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              {mode === 'append'
                ? 'Existing records are kept. Questions and equipment with a clashing id are given a new one; a category id that already exists is skipped.'
                : 'The current lists in scope are discarded and replaced by the payload. Replacing equipment also clears every per-vehicle assignment.'}
            </p>

            {/* Validation output */}
            {result && !result.ok && (
              <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3">
                <p className="text-[11px] font-extrabold text-rose-900 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {result.errors.length} problem(s) found
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.errors.slice(0, 12).map((err, i) => (
                    <li key={i} className="text-[11px] text-rose-800 font-medium">{err}</li>
                  ))}
                  {result.errors.length > 12 && (
                    <li className="text-[11px] text-rose-700">…and {result.errors.length - 12} more.</li>
                  )}
                </ul>
              </div>
            )}

            {result?.ok && scoped && (
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Valid — ready to {mode}
                </p>
                <p className="text-[11px] text-emerald-800 font-medium mt-1">
                  {scoped.categories} categories · {scoped.questions} questions · {scoped.equipment} equipment items
                </p>
              </div>
            )}

            {result && result.warnings.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-[11px] font-extrabold text-amber-900 mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  {result.warnings.length} note(s)
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.warnings.slice(0, 8).map((warn, i) => (
                    <li key={i} className="text-[11px] text-amber-800 font-medium">{warn}</li>
                  ))}
                  {result.warnings.length > 8 && (
                    <li className="text-[11px] text-amber-700">…and {result.warnings.length - 8} more.</li>
                  )}
                </ul>
              </div>
            )}

            {orphanWarning && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-300 p-3">
                <p className="text-[11px] font-bold text-amber-900 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {orphanWarning}
                </p>
              </div>
            )}

            {summary && (
              <div className="mt-3 rounded-xl bg-sky-50 border border-sky-200 p-3">
                <p className="text-[11px] font-bold text-sky-900 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {summary}
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-2 sticky bottom-0 bg-white rounded-b-3xl">
          <button
            onClick={reset}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            onClick={validate}
            disabled={!json.trim()}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            Validate
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={apply}
            disabled={applying || !json.trim()}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50 ${
              mode === 'replace' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{applying ? 'Applying...' : mode === 'replace' ? 'Replace & Apply' : 'Append & Apply'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
