'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import { GripVertical } from 'lucide-react';
import { GRID_COLUMNS, GRID_WIDGET_META, mergeVisibleGridLayout, moveGridWidget, normalizeGridLayout, type DashboardGridState, type GridBreakpoint, type GridWidgetId, type GridWidgetPosition } from '@/lib/dashboardGridLayout';

const CARD_COLORS: Record<GridWidgetId, string> = {
  total_vehicles: 'bg-sky-surge-100', inspections_today: 'bg-ivory-mist-100', open_issue_count: 'bg-light-coral-100',
  vehicles_in_use_count: 'bg-charcoal-blue-100', equipment_due_count: 'bg-prussian-blue-100',
  today_issues: 'bg-ivory-mist-100', open_issues: 'bg-light-coral-100', in_use: 'bg-charcoal-blue-100',
  activity: 'bg-sky-surge-100', calendar: 'bg-prussian-blue-100', lifespan: 'bg-ivory-mist-100', safety: 'bg-light-coral-100',
};

type Props = {
  children: React.ReactNode;
  userId: string;
  state: DashboardGridState;
  colorful: boolean;
  customize: boolean;
  onChange: (next: DashboardGridState) => void;
};

export function DashboardGrid({ children, userId, state, colorful, customize, onChange }: Props) {
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });
  const breakpoint: GridBreakpoint = width >= 1000 ? 'desktop' : width >= 640 ? 'tablet' : 'phone';
  const columns = GRID_COLUMNS[breakpoint];
  const widgets = useMemo(() => React.Children.toArray(children)
    .filter((element): element is React.ReactElement<{ 'data-dashboard-widget': GridWidgetId; children: React.ReactNode }> => React.isValidElement(element))
    .map(element => ({ id: element.props['data-dashboard-widget'], content: element.props.children }))
    .filter(widget => widget.id in GRID_WIDGET_META), [children]);
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
  const keyboardChange=(id: GridWidgetId, field: 'x'|'y'|'w'|'h', value: number)=>{
    if (field==='x' || field==='y') {
      onChange(moveGridWidget(state,breakpoint,id,field,value));
      return;
    }
    const next=current.map(item=>item.i===id?{...item,[field]:value}:item);
    onChange({...state,layouts:{...state.layouts,[breakpoint]:normalizeGridLayout(next,breakpoint)}});
  };
  return <div ref={containerRef as React.Ref<HTMLDivElement>} className={`dashboard-grid ${colorful?'dashboard-grid-colorful':''}`} aria-label="Dashboard widgets" data-manager={userId}>
    {mounted && width>0 && <GridLayout width={width} layout={layout} gridConfig={{cols:columns,rowHeight:56,margin:[16,16],containerPadding:[0,0]}}
      dragConfig={{enabled:true,handle:'.dashboard-drag-handle',cancel:'a,button:not(.dashboard-drag-handle),input,select,textarea,.dashboard-card-body'}}
      resizeConfig={{enabled:customize,handles:['e','s','se']}}
      onDragStart={()=>{ active.current=true; }} onResizeStart={()=>{ active.current=true; }}
      onDrag={next=>setWorking(next as GridWidgetPosition[])} onResize={next=>setWorking(next as GridWidgetPosition[])}
      onDragStop={commit} onResizeStop={commit}>
      {widgets.map(widget=>{
        const entry=layout.find(item=>item.i===widget.id)!;
        const meta=GRID_WIDGET_META[widget.id];
        return <section key={widget.id} className={`dashboard-grid-card min-w-0 flex flex-col rounded-2xl border border-line shadow-sm ${colorful?CARD_COLORS[widget.id]:'bg-surface'}`} data-dashboard-widget={widget.id}>
          <header className="dashboard-card-header flex items-center justify-between gap-1 px-2 py-1 overflow-x-auto">
            <button type="button" className="dashboard-drag-handle shrink-0 inline-flex items-center gap-1 min-h-[44px] min-w-[44px] rounded-lg px-2 text-left text-xs font-bold cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-surge-700" aria-label={`Drag ${meta.label}`}><GripVertical className="w-4 h-4 shrink-0" aria-hidden="true"/>{meta.label}</button>
            {customize && <div className="dashboard-card-controls shrink-0 flex flex-nowrap justify-end gap-1">
              <button className="btn btn-secondary btn-xs" onClick={()=>keyboardChange(widget.id,'x',Math.max(0,entry.x-1))} aria-label={`Move ${meta.label} left`}>←</button>
              <button className="btn btn-secondary btn-xs" onClick={()=>keyboardChange(widget.id,'x',Math.min(columns-entry.w,entry.x+1))} aria-label={`Move ${meta.label} right`}>→</button>
              <button className="btn btn-secondary btn-xs" onClick={()=>keyboardChange(widget.id,'y',Math.max(0,entry.y-1))} aria-label={`Move ${meta.label} up`}>↑</button>
              <button className="btn btn-secondary btn-xs" onClick={()=>keyboardChange(widget.id,'y',entry.y+1)} aria-label={`Move ${meta.label} down`}>↓</button>
              <label className="text-xs">Width <select className="select text-xs w-auto" aria-label={`Width of ${meta.label}`} value={entry.w} onChange={event=>keyboardChange(widget.id,'w',Number(event.target.value))}>{Array.from({length:columns},(_,index)=><option key={index} value={index+1}>{index+1}</option>)}</select></label>
              <label className="text-xs">Height <input type="number" className="input w-14 text-xs" aria-label={`Height of ${meta.label} in rows`} min={meta.minH} max={30} value={entry.h} onChange={event=>keyboardChange(widget.id,'h',Number(event.target.value))}/></label>
            </div>}
          </header>
          <div className="dashboard-card-body min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">{widget.content}</div>
        </section>;
      })}
    </GridLayout>}
  </div>;
}
