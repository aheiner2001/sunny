'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import { GripVertical, Link2, Trash2, X } from 'lucide-react';
import type { TrainingItem } from '@/lib/training/types';
import type { ChecklistQuestion } from '@/types';

const ROW_H = 3;

type Props = {
  items: TrainingItem[];
  questions: ChecklistQuestion[];
  busy?: boolean;
  onReorder: (orderedIds: string[]) => void;
  onDelete: (itemId: string) => void;
  onSettingsBlur: (
    item: TrainingItem,
    patch: { withinDays?: number; retrainThreshold?: number },
  ) => void;
  onToggleLinkedQuestion: (item: TrainingItem, questionId: string) => void;
};

export function CurriculumSortList({
  items,
  questions,
  busy,
  onReorder,
  onDelete,
  onSettingsBlur,
  onToggleLinkedQuestion,
}: Props) {
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });
  const [working, setWorking] = useState<Layout | null>(null);
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const active = useRef(false);

  const saved: Layout = useMemo(
    () =>
      items.map((item, index) => ({
        i: item.id,
        x: 0,
        y: index * ROW_H,
        w: 1,
        h: ROW_H,
        minW: 1,
        maxW: 1,
        minH: ROW_H,
        maxH: ROW_H,
      })),
    [items],
  );

  useEffect(() => {
    if (!active.current) setWorking(null);
  }, [items]);

  const layout = working ?? saved;

  const commit = useCallback(
    (next: Layout) => {
      active.current = false;
      setWorking(null);
      const orderedIds = [...next]
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map(entry => entry.i);
      const same =
        orderedIds.length === items.length && orderedIds.every((id, index) => id === items[index]?.id);
      if (!same) onReorder(orderedIds);
    },
    [items, onReorder],
  );

  const linkableQuestions = useMemo(() => {
    const all = [...questions]
      .filter(q => q.enabled !== false && (q.type === 'yes_no' || q.type === 'pass_fail'))
      .sort((a, b) => {
        const aPrev = a.holdPreviousUserAccountable ? 0 : 1;
        const bPrev = b.holdPreviousUserAccountable ? 0 : 1;
        if (aPrev !== bPrev) return aPrev - bPrev;
        return (a.order ?? 0) - (b.order ?? 0);
      });
    if (showAllQuestions) return all;
    const prevOnly = all.filter(q => q.holdPreviousUserAccountable);
    return prevOnly.length ? prevOnly : all;
  }, [questions, showAllQuestions]);

  const linkingItem = items.find(i => i.id === linkingItemId) || null;

  if (!items.length) return null;

  return (
    <div
      ref={containerRef as React.Ref<HTMLDivElement>}
      className="curriculum-grid dashboard-grid"
      aria-label="Curriculum steps"
    >
      <p className="hint m-0 mb-2">
        Drag by the grip handle to reorder. Use <strong>Link</strong> only when a step should track
        inspection misses (usually previous-user questions).
      </p>
      {mounted && width > 0 && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 1, rowHeight: 56, margin: [0, 12], containerPadding: [0, 0] }}
          dragConfig={{
            enabled: true,
            handle: '.dashboard-drag-handle',
            cancel: 'a,button:not(.dashboard-drag-handle),input,select,textarea,label',
          }}
          resizeConfig={{ enabled: false }}
          onDragStart={() => {
            active.current = true;
          }}
          onDrag={next => setWorking(next)}
          onDragStop={commit}
        >
          {items.map(item => {
            const linkCount = item.linkedQuestionIds.length;
            return (
              <section
                key={item.id}
                className="dashboard-grid-card curriculum-step-card min-w-0 flex flex-col rounded-2xl border border-line bg-surface shadow-sm overflow-hidden"
              >
                <header className="dashboard-card-header flex flex-wrap items-center justify-between gap-2 px-2 py-1">
                  <button
                    type="button"
                    className="dashboard-drag-handle shrink-0 inline-flex items-center gap-1 min-h-[44px] min-w-[44px] rounded-lg px-2 text-left text-xs font-bold cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-surge-700"
                    aria-label={`Drag ${item.title}`}
                    disabled={busy}
                  >
                    <GripVertical className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-[12rem] sm:max-w-none">{item.title}</span>
                  </button>
                  <div className="cluster gap-1">
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${linkCount ? '' : ''}`}
                      disabled={busy}
                      aria-expanded={linkingItemId === item.id}
                      aria-label={`Link inspection questions for ${item.title}`}
                      onClick={() =>
                        setLinkingItemId(current => (current === item.id ? null : item.id))
                      }
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                      Link
                      {linkCount > 0 ? (
                        <span className="badge" data-status="info">
                          {linkCount}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm text-[var(--critical)]"
                      disabled={busy}
                      aria-label={`Delete ${item.title}`}
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </header>
                <div className="dashboard-card-body px-3 pb-3 space-y-2">
                  <p className="hint m-0">
                    Due in {item.withinDays || 7} days · retrain after {item.retrainThreshold} misses
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <div className="field">
                      <label className="label">Days</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        className="input w-20"
                        defaultValue={item.withinDays || 7}
                        disabled={busy}
                        onBlur={e => {
                          const withinDays = Number(e.target.value);
                          if (!Number.isFinite(withinDays) || withinDays === (item.withinDays || 7)) {
                            return;
                          }
                          onSettingsBlur(item, { withinDays });
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
                        disabled={busy}
                        onBlur={e => {
                          const retrainThreshold = Number(e.target.value);
                          if (
                            !Number.isFinite(retrainThreshold) ||
                            retrainThreshold === item.retrainThreshold
                          ) {
                            return;
                          }
                          onSettingsBlur(item, { retrainThreshold });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </GridLayout>
      )}

      {linkingItem && (
        <div
          className="mt-3 rounded-2xl border border-line bg-surface p-4 space-y-3 shadow-sm"
          role="dialog"
          aria-label={`Link questions for ${linkingItem.title}`}
        >
          <div className="spread items-start gap-2">
            <div>
              <h3 className="card-title text-sm m-0 cluster gap-2">
                <Link2 className="h-4 w-4" aria-hidden />
                Link questions — {linkingItem.title}
              </h3>
              <p className="hint m-0 mt-1">
                Optional. Prefer previous-user questions so a miss ticks that person&apos;s training.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label="Close link panel"
              onClick={() => setLinkingItemId(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={showAllQuestions}
              onChange={e => setShowAllQuestions(e.target.checked)}
            />
            Show all yes/no questions (not only previous-user)
          </label>
          {linkableQuestions.length ? (
            <ul className="m-0 p-0 list-none space-y-2 max-h-56 overflow-y-auto">
              {linkableQuestions.map(q => {
                const checked = linkingItem.linkedQuestionIds.includes(q.id);
                return (
                  <li key={q.id}>
                    <label className="flex items-start gap-2 text-sm cursor-pointer rounded-xl border border-line p-2 hover:bg-surface-sunk/50">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={busy}
                        onChange={() => onToggleLinkedQuestion(linkingItem, q.id)}
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-ink">{q.text}</span>
                        {q.holdPreviousUserAccountable ? (
                          <span className="badge ml-1" data-status="flagged">
                            Prev. user
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="hint m-0">
              No matching questions yet. Add yes/no items in Settings and tag previous-user when needed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
