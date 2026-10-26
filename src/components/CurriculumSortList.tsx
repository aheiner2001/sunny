'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import { GripVertical, Trash2 } from 'lucide-react';
import type { TrainingItem } from '@/lib/training/types';

/** ~3 grid rows so days/retrain fields fit under the drag handle (matches dashboard rowHeight 56). */
const ROW_H = 3;

type Props = {
  items: TrainingItem[];
  busy?: boolean;
  onReorder: (orderedIds: string[]) => void;
  onDelete: (itemId: string) => void;
  onSettingsBlur: (
    item: TrainingItem,
    patch: { withinDays?: number; retrainThreshold?: number },
  ) => void;
};

export function CurriculumSortList({ items, busy, onReorder, onDelete, onSettingsBlur }: Props) {
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });
  const [working, setWorking] = useState<Layout | null>(null);
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

  if (!items.length) return null;

  return (
    <div
      ref={containerRef as React.Ref<HTMLDivElement>}
      className="curriculum-grid dashboard-grid"
      aria-label="Curriculum steps"
    >
      <p className="hint m-0 mb-2">Drag steps by their handles to reorder.</p>
      {mounted && width > 0 && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 1, rowHeight: 56, margin: [0, 12], containerPadding: [0, 0] }}
          dragConfig={{
            enabled: true,
            handle: '.dashboard-drag-handle',
            cancel: 'a,button:not(.dashboard-drag-handle),input,select,textarea',
          }}
          resizeConfig={{ enabled: false }}
          onDragStart={() => {
            active.current = true;
          }}
          onDrag={next => setWorking(next)}
          onDragStop={commit}
        >
          {items.map(item => (
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
                  <span className="truncate max-w-[14rem] sm:max-w-none">{item.title}</span>
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
                        if (!Number.isFinite(withinDays) || withinDays === (item.withinDays || 7)) return;
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
          ))}
        </GridLayout>
      )}
    </div>
  );
}
