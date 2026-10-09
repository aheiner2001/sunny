'use client';
import React, { useState } from 'react';
import { analyticsWidgetLabels, moveAnalyticsWidget, type AnalyticsLayoutPreferences, type AnalyticsWidgetId } from '@/lib/analyticsPreferences';
import styles from './equipmentPreferences.module.css';
export interface AnalyticsPreferencesProps { preferences: AnalyticsLayoutPreferences; onChange: (next: AnalyticsLayoutPreferences) => void; onReset: () => void; }
export default function AnalyticsPreferences({ preferences, onChange, onReset }: AnalyticsPreferencesProps) {
  const [dragging, setDragging] = useState<AnalyticsWidgetId | null>(null);
  return <details className={styles.preferences}><summary>Customize overview layout</summary>
    <p>Move or hide overview sections. Urgent actions and setup always stay visible. The same order applies on mobile.</p>
    <ol>{preferences.order.map((id, index) => <li key={id} draggable onDragStart={event => { setDragging(id); event.dataTransfer.setData('text/plain', id); }} onDragEnd={() => setDragging(null)} onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault(); if (!dragging || dragging === id) return;
      const order = preferences.order.filter(x => x !== dragging); order.splice(index, 0, dragging); onChange({ ...preferences, order }); setDragging(null);
    }}><label><input type="checkbox" aria-label={`Show ${analyticsWidgetLabels[id]}`} checked={!preferences.hidden.includes(id)} onChange={event => onChange({ ...preferences, hidden: event.target.checked ? preferences.hidden.filter(x => x !== id) : [...preferences.hidden, id] })} />{analyticsWidgetLabels[id]}</label>
      <span className={styles.actions}><button type="button" disabled={index === 0} aria-label={`Move ${analyticsWidgetLabels[id]} up`} onClick={() => onChange(moveAnalyticsWidget(preferences, id, -1))}>Move up</button><button type="button" disabled={index === preferences.order.length - 1} aria-label={`Move ${analyticsWidgetLabels[id]} down`} onClick={() => onChange(moveAnalyticsWidget(preferences, id, 1))}>Move down</button></span></li>)}</ol>
    <button type="button" onClick={onReset}>Reset layout</button>
  </details>;
}
