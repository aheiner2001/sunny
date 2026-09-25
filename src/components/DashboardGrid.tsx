'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import { GripVertical } from 'lucide-react';
import { dashboardCardForeground, dashboardCardHex, GRID_COLUMNS, GRID_WIDGET_META, mergeVisibleGridLayout, type DashboardCardColor, type DashboardGridState, type GridBreakpoint, type GridWidgetId, type GridWidgetPosition } from '@/lib/dashboardGridLayout';

const DEFAULT_CARD_COLORS: Record<GridWidgetId, DashboardCardColor> = {
  total_vehicles: 'white', inspections_today: 'mist', open_issue_count: 'white',
  vehicles_in_use_count: 'slate', equipment_due_count: 'ivory',
  today_issues: 'white', open_issues: 'white', in_use: 'white', recent_inspections: 'white',
  activity: 'mist', calendar: 'white', lifespan: 'ivory', safety: 'white',
};

type Props = {
  children: React.ReactNode;
  userId: string;
  state: DashboardGridState;
  colorful: boolean;
  customize: boolean;
  onChange: (next: DashboardGridState) => void;
  onColorChange: (id: GridWidgetId, color: DashboardCardColor) => void;
  canEditColors: boolean;
};

export function DashboardGrid({ children, userId, state, colorful, customize, onChange, onColorChange, canEditColors }: Props) {
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });
  const breakpoint: GridBreakpoint = width >= 1000 ? 'desktop' : width >= 640 ? 'tablet' : 'phone';
  const columns = GRID_COLUMNS[breakpoint];
  const widgets = useMemo(() => React.Children.toArray(children)
    .filter((element): element is React.ReactElement<{ 'data-dashboard-widget': GridWidgetId; children: React.ReactNode }> => React.isValidElement(element))
    .map(element => ({ id: element.props['data-dashboard-widget'], content: element.props.children }))
    .filter(widget => widget.id in GRID_WIDGET_META && !state.hidden.includes(widget.id)), [children, state.hidden]);
  const visibleIds=widgets.map(widget=>widget.id).join(',');
  const [working, setWorking]=useState<GridWidgetPosition[] | null>(null);
  const active=useRef(false);
  useEffect(()=>{ if (!active.current) setWorking(null); },[userId,breakpoint,visibleIds,state]);
  const saved=state.layouts[breakpoint];
  const current=working ?? saved;
  const layout: Layout=widgets.map(widget=>{
    const entry=current.find(item=>item.i===widget.id) ?? saved.find(item=>item.i===widget.id)!;
    return {...entry,minW:1,minH:GRID_WIDGET_META[widget.id].minH,maxW:columns,maxH:30};
  });
  const commit=useCallback((next: Layout)=>{
    active.current=false;
    setWorking(null);
    const visible=next.filter(item=>item.i in GRID_WIDGET_META).map(item=>({i:item.i as GridWidgetId,x:item.x,y:item.y,w:item.w,h:item.h}));
    onChange(mergeVisibleGridLayout(state,breakpoint,visible));
  },[state,breakpoint,onChange]);
  return <div ref={containerRef as React.Ref<HTMLDivElement>} className={`dashboard-grid ${colorful?'dashboard-grid-colorful':''}`} aria-label="Dashboard widgets" data-manager={userId}>
    {mounted && width>0 && <GridLayout width={width} layout={layout} gridConfig={{cols:columns,rowHeight:56,margin:[16,16],containerPadding:[0,0]}}
      dragConfig={{enabled:true,handle:'.dashboard-drag-handle',cancel:'a,button:not(.dashboard-drag-handle),input,select,textarea,.dashboard-card-body'}}
      resizeConfig={{enabled:customize,handles:['e','s','se']}}
      onDragStart={()=>{ active.current=true; }} onResizeStart={()=>{ active.current=true; }}
      onDrag={next=>setWorking(next as GridWidgetPosition[])} onResize={next=>setWorking(next as GridWidgetPosition[])}
      onDragStop={commit} onResizeStop={commit}>
      {widgets.map(widget=>{
        const meta=GRID_WIDGET_META[widget.id];
        const cardColor=state.colors[widget.id] ?? DEFAULT_CARD_COLORS[widget.id];
        const hex=dashboardCardHex(cardColor);
        return <section key={widget.id} className={`dashboard-grid-card min-w-0 flex flex-col rounded-2xl border border-line shadow-sm ${colorful?'dashboard-card-custom':'bg-surface'}`} style={colorful ? {'--dashboard-card-background':hex,'--dashboard-card-foreground':dashboardCardForeground(cardColor)} as React.CSSProperties : undefined} data-dashboard-widget={widget.id}>
          <header className="dashboard-card-header flex flex-wrap items-center justify-between gap-2 px-2 py-1">
            <button type="button" className="dashboard-drag-handle shrink-0 inline-flex items-center gap-1 min-h-[44px] min-w-[44px] rounded-lg px-2 text-left text-xs font-bold cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-surge-700" aria-label={`Drag ${meta.label}`}><GripVertical className="w-4 h-4 shrink-0" aria-hidden="true"/>{meta.label}</button>
            {customize && canEditColors && <label className="dashboard-color-control shrink-0 inline-flex items-center gap-2 rounded-lg px-2 text-xs cursor-pointer" style={colorful ? {color:'var(--dashboard-card-foreground)'} : undefined}>
              <span>Color</span>
              <input type="color" className="h-9 w-10 cursor-pointer rounded border border-line bg-white p-0.5" aria-label={`Background color for ${meta.label}`} value={hex} onChange={event=>onColorChange(widget.id,event.target.value as DashboardCardColor)} />
            </label>}
          </header>
          <div className="dashboard-card-body min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">{widget.content}</div>
        </section>;
      })}
    </GridLayout>}
  </div>;
}
