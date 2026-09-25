'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { createSwapy, utils, type SlotItemMapArray, type Swapy } from 'swapy';
import { DASHBOARD_WIDGET_LABELS, sizeToColSpan, type DashboardWidgetId, type DashboardWidgetSize } from '@/lib/dashboardLayout';

export type DashboardGridItem = {
  id: DashboardWidgetId;
  size: DashboardWidgetSize;
  content: React.ReactNode;
};

const PALETTE: Record<DashboardWidgetId, string> = {
  stats: 'bg-emerald-200',
  today_issues: 'bg-yellow-200',
  open_issues: 'bg-rose-200',
  in_use: 'bg-blue-200',
  activity: 'bg-purple-200',
  calendar: 'bg-sky-200',
  lifespan: 'bg-amber-200',
  safety: 'bg-pink-200',
};

type Props = {
  children: React.ReactNode;
  layout: { id: DashboardWidgetId; size: DashboardWidgetSize }[];
  colorful: boolean;
  customize: boolean;
  onReorder: (ids: DashboardWidgetId[]) => void;
  onMove: (id: DashboardWidgetId, direction: -1 | 1) => void;
  onSize: (id: DashboardWidgetId, size: DashboardWidgetSize) => void;
};

export function DashboardSwapGrid({ children, layout, colorful, customize, onReorder, onMove, onSize }: Props) {
  const content = new Map(
    React.Children.toArray(children)
      .filter((node): node is React.ReactElement<{ 'data-dashboard-widget': DashboardWidgetId; children: React.ReactNode }> => React.isValidElement(node))
      .map(element => [element.props['data-dashboard-widget'] as DashboardWidgetId, element.props.children] as const)
  );
  const items: DashboardGridItem[] = layout.filter(entry => content.has(entry.id)).map(entry => ({
    ...entry,
    content: content.get(entry.id),
  }));
  const containerRef = useRef<HTMLDivElement>(null);
  const swapyRef = useRef<Swapy | null>(null);
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  const [slotItemMap, setSlotItemMap] = useState<SlotItemMapArray>(() => utils.initSlotItemMap(items, 'id'));
  const itemIds = items.map(item => item.id).join(',');

  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;
    try {
      const instance = createSwapy(containerRef.current, {
        manualSwap: true,
        swapMode: 'hover',
        autoScrollOnDrag: true,
      });
      swapyRef.current = instance;
      instance.onSwap(event => setSlotItemMap(event.newSlotItemMap.asArray));
      instance.onSwapEnd(event => {
        if (event.hasChanged) {
          reorderRef.current(event.slotItemMap.asArray.map(({ item }) => item as DashboardWidgetId));
        }
      });
      return () => { instance.destroy(); swapyRef.current = null; };
    } catch (error) {
      console.error('Dashboard drag initialization failed:', error);
    }
  // Reinitialize when a saved reorder or a conditional widget changes the slots.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds]);

  useEffect(() => {
    setSlotItemMap(utils.initSlotItemMap(items, 'id'));
    const frame = requestAnimationFrame(() => swapyRef.current?.update());
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds]);

  useEffect(() => {
    utils.dynamicSwapy(swapyRef.current, items, 'id', slotItemMap, setSlotItemMap);
  // Widget content changes with live fleet data; slot reconciliation only needs IDs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds]);

  const slotted = useMemo(() => utils.toSlottedItems(items, 'id', slotItemMap), [items, slotItemMap]);

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--gutter)] items-start" aria-label="Dashboard widgets">
      {slotted.map(({ slotId, itemId, item }, index) => item && (
        <div key={slotId} data-swapy-slot={slotId} className={sizeToColSpan(item.size)}>
          <section
            key={itemId}
            data-swapy-item={itemId}
            data-dashboard-widget={itemId}
            className={`rounded-2xl border border-line shadow-sm min-w-0 overflow-visible ${colorful ? `${PALETTE[item.id]} p-2 dashboard-colorful` : 'bg-surface'} `}
          >
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <button type="button" data-swapy-handle className="cursor-grab active:cursor-grabbing touch-none flex items-center gap-1.5 min-h-10 select-none text-xs font-bold text-ink" aria-label={`Drag ${DASHBOARD_WIDGET_LABELS[item.id]}`}>
                <GripVertical className="h-4 w-4" aria-hidden />
                {DASHBOARD_WIDGET_LABELS[item.id]}
              </button>
              {customize && (
                <div className="flex items-center gap-1" data-swapy-no-drag>
                  <button type="button" className="btn btn-secondary btn-xs" disabled={index === 0} onClick={() => onMove(item.id, -1)} aria-label={`Move ${DASHBOARD_WIDGET_LABELS[item.id]} up`}>↑</button>
                  <button type="button" className="btn btn-secondary btn-xs" disabled={index === slotted.length - 1} onClick={() => onMove(item.id, 1)} aria-label={`Move ${DASHBOARD_WIDGET_LABELS[item.id]} down`}>↓</button>
                  <select aria-label={`Size ${DASHBOARD_WIDGET_LABELS[item.id]}`} className="select text-xs w-auto" value={item.size} onChange={event => onSize(item.id, event.target.value as DashboardWidgetSize)}>
                    <option value="small">Small</option><option value="medium">Medium</option><option value="wide">Wide</option>
                  </select>
                </div>
              )}
            </div>
            <div data-swapy-no-drag className="min-w-0">{item.content}</div>
          </section>
        </div>
      ))}
    </div>
  );
}
