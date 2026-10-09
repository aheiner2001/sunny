'use client';
import React, { useEffect, useState } from 'react';
import type { Equipment, EquipmentMaintenanceRule, EquipmentServiceRecord } from '@/types';
import { dbService } from '@/lib/db';
import { dateOnly } from '@/lib/maintenance';
import { forecastEquipmentMaintenance, validateEquipmentHours, validateEquipmentRule, validateEquipmentService } from '@/lib/equipmentMaintenance';
import styles from './equipmentPreferences.module.css';
export interface EquipmentServicePanelProps { items: Equipment[]; demo: boolean; actor: { id: string; name: string }; onSampleChange: (updated: Equipment) => void; onSaved?: () => void; }
type RuleDraft = { id: string; title: string; hours: string; months: string; source: string; confirmed: boolean; baselineDate: string; baselineHours: string };
const optionalNumber = (value: string) => value.trim() ? Number(value) : undefined;
const newId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `equipment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export default function EquipmentServicePanel(props: EquipmentServicePanelProps) {
  const [selected, setSelected] = useState(props.items[0]?.id || '');
  const item = props.items.find(x => x.id === selected) || props.items[0];
  return <section className={styles.panel} aria-label="Equipment service"><h3>Equipment service</h3><p className={styles.note}>Service uses actual operating hours and calendar rules from verified sources. Replacement lifespan and jobs completed are separate.</p>
    {!item ? <p>No equipment in this view.</p> : <><label>Equipment<select aria-label="Equipment" value={item.id} onChange={event => setSelected(event.target.value)}>{props.items.map(e => <option key={e.id} value={e.id}>{e.name}{e.assetTag ? ` (${e.assetTag})` : ''}</option>)}</select></label><EquipmentEditor key={`${item.id}-${props.demo}`} {...props} item={item} /></>}
  </section>;
}
function EquipmentEditor({ item, demo, actor, onSampleChange, onSaved }: EquipmentServicePanelProps & { item: Equipment }) {
  const [equipment, setEquipment] = useState(item);
  useEffect(() => setEquipment(item), [item]);
  const [hours, setHours] = useState('');
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [service, setService] = useState<{ ruleId: string; date: string; hours: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function persist(updated: Equipment, live: () => Promise<void>, success: string): Promise<boolean> {
    if (busy) return false;
    setError(''); setMessage(''); setBusy(true);
    try { if (!actor.id.trim()) throw new Error('A manager identity is required to save.');
      if (demo) { onSampleChange(updated); setEquipment(updated); } else { await live(); onSaved?.(); }
      setMessage(demo ? `Sample only: ${success}` : success); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Save failed. Check service history before retrying.'); return false; } finally { setBusy(false); }
  }
  async function saveHours() {
    setError(''); setMessage('');
    const reading = { date: dateOnly(new Date()), hours: Number(hours), recordedBy: actor.id };
    const issue = !hours.trim() ? 'Enter today’s actual measured operating hours.' : validateEquipmentHours(reading, equipment.operatingHours);
    if (issue) { setError(issue); return; }
    if (await persist({ ...equipment, operatingHours: reading.hours, hoursReadings: [...(equipment.hoursReadings || []), reading] }, () => dbService.recordEquipmentHours(equipment.id, reading), 'Measured hours saved.')) setHours('');
  }
  function editRule(rule?: EquipmentMaintenanceRule) { setError(''); setMessage(''); setDraft({ id: rule?.id || newId(), title: rule?.title || '', hours: rule?.intervalHours?.toString() || '', months: rule?.intervalMonths?.toString() || '', source: rule?.source || '', confirmed: rule?.confirmed || false, baselineDate: rule?.baselineDate || '', baselineHours: rule?.baselineHours?.toString() || '' }); }
  async function saveRule() {
    setError(''); setMessage('');
    if (!draft) return;
    const rule: EquipmentMaintenanceRule = { id: draft.id, title: draft.title.trim(), intervalHours: optionalNumber(draft.hours), intervalMonths: optionalNumber(draft.months), source: draft.source.trim(), confirmed: draft.confirmed, baselineDate: draft.baselineDate || undefined, baselineHours: optionalNumber(draft.baselineHours) };
    const issue = validateEquipmentRule(rule);
    if (issue) { setError(issue); return; }
    const rules = equipment.maintenanceRules?.some(r => r.id === rule.id) ? equipment.maintenanceRules.map(r => r.id === rule.id ? rule : r) : [...(equipment.maintenanceRules || []), rule];
    if (await persist({ ...equipment, maintenanceRules: rules }, () => dbService.saveEquipmentMaintenanceRules(equipment.id, rules), 'Service rule saved.')) setDraft(null);
  }
  async function saveService() {
    setError(''); setMessage('');
    if (!service) return;
    const rule = equipment.maintenanceRules?.find(r => r.id === service.ruleId);
    if (!rule) { setError('Select a service rule.'); return; }
    const record: EquipmentServiceRecord = { id: newId(), ruleId: rule.id, title: rule.title, date: service.date, hours: optionalNumber(service.hours), recordedBy: actor.id, recordedAt: new Date().toISOString() };
    const issue = rule.intervalHours && record.hours == null ? 'Record measured service hours for this rule.' : validateEquipmentService(record, equipment.operatingHours);
    if (issue) { setError(issue); return; }
    if (await persist({ ...equipment, serviceHistory: [...(equipment.serviceHistory || []), record] }, () => dbService.recordEquipmentService(equipment.id, record), 'Completed service saved.')) setService(null);
  }
  const updateDraft = (patch: Partial<RuleDraft>) => {
    setError(''); setMessage('');
    // Verification belongs to these values; every substantive edit requires a fresh confirmation.
    const substantive = Object.keys(patch).some(key => key !== 'confirmed');
    setDraft(d => d ? { ...d, ...patch, confirmed: substantive ? false : patch.confirmed ?? d.confirmed } : d);
  };
  return <div><p>Current measured hours: <strong>{equipment.operatingHours ?? 'unknown'}</strong></p><div className={styles.grid}><label>Today’s measured operating hours<input aria-label="Measured operating hours" type="text" inputMode="decimal" value={hours} onChange={event => setHours(event.target.value)} placeholder="Enter a fresh meter reading" /></label></div><div className={styles.actions}><button disabled={busy} onClick={saveHours}>Save measured hours</button><button disabled={busy} onClick={() => editRule()}>Add service rule</button><button disabled={busy || !equipment.maintenanceRules?.length} onClick={() => { setError(''); setMessage(''); setService({ ruleId: equipment.maintenanceRules![0].id, date: dateOnly(new Date()), hours: '' }); }}>Record completed service</button></div>
    {error && <p className={styles.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {(equipment.maintenanceRules || []).length === 0 && <p>Service schedule and history are unknown. Add an unconfirmed draft or a source-verified rule; no interval is assumed.</p>}
    {forecastEquipmentMaintenance(equipment).map(f => <article key={f.ruleId} className={styles.rule}><strong>{f.title}</strong> — {f.status.replace('_', ' ')}<p>{f.reason}</p>{f.dueHours != null && <p>Due at {f.dueHours} operating hours ({f.remainingHours} remaining).</p>}{f.dueDate && <p>Calendar due: {f.dueDate}</p>}<p className={styles.note}>Source: {f.source || 'unknown / unverified'}. {f.basis.join('; ')}.</p>{!f.lastService && <p className={styles.note}>No completed service recorded. Missing baseline hours or dates mean history is unknown; enter only a verified baseline.</p>}<button disabled={busy} onClick={() => editRule(equipment.maintenanceRules?.find(r => r.id === f.ruleId))}>Edit {f.title} rule</button></article>)}
    {draft && <form className={styles.form} onSubmit={event => { event.preventDefault(); void saveRule(); }}><h4>Service rule</h4><div className={styles.grid}><label>Rule title<input aria-label="Rule title" value={draft.title} onChange={e => updateDraft({ title: e.target.value })} /></label><label>Interval operating hours<input aria-label="Rule interval hours" inputMode="decimal" value={draft.hours} onChange={e => updateDraft({ hours: e.target.value, confirmed: false })} /></label><label>Interval calendar months<input aria-label="Rule interval months" inputMode="numeric" value={draft.months} onChange={e => updateDraft({ months: e.target.value, confirmed: false })} /></label><label>Manual source and usage conditions<input aria-label="Rule source" value={draft.source} onChange={e => updateDraft({ source: e.target.value, confirmed: false })} /></label><label>Verified baseline date<input aria-label="Baseline date" type="date" max={dateOnly(new Date())} value={draft.baselineDate} onChange={e => updateDraft({ baselineDate: e.target.value })} /></label><label>Verified baseline measured hours<input aria-label="Baseline hours" inputMode="decimal" value={draft.baselineHours} onChange={e => updateDraft({ baselineHours: e.target.value })} /></label></div><p className={styles.note}>Leave unknown baselines empty. A completed service supplies its own rule’s baseline. Incomplete unconfirmed drafts can be saved.</p><label className={styles.check}><input type="checkbox" checked={draft.confirmed} onChange={e => updateDraft({ confirmed: e.target.checked })} />I verified this schedule against the equipment manual and actual usage conditions.</label><div className={styles.actions}><button type="submit" disabled={busy}>{draft.confirmed ? 'Save verified rule' : 'Save rule draft'}</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel rule</button></div></form>}
    {service && <form className={styles.form} onSubmit={event => { event.preventDefault(); void saveService(); }}><h4>Completed service</h4><div className={styles.grid}><label>Service rule<select aria-label="Service rule" value={service.ruleId} onChange={e => setService({ ...service, ruleId: e.target.value })}>{equipment.maintenanceRules?.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><label>Actual service date<input aria-label="Service date" type="date" max={dateOnly(new Date())} value={service.date} onChange={e => setService({ ...service, date: e.target.value })} /></label><label>Measured hours at completed service<input aria-label="Service measured hours" inputMode="decimal" value={service.hours} onChange={e => setService({ ...service, hours: e.target.value })} /></label></div><p className={styles.note}>Record work already completed. Hours are optional only for calendar-only rules.</p><div className={styles.actions}><button type="submit" disabled={busy}>Save completed service</button><button type="button" disabled={busy} onClick={() => setService(null)}>Cancel service</button></div></form>}
    <h4>Completed service history</h4>{!equipment.serviceHistory?.length ? <p>No completed service recorded.</p> : <ul>{[...equipment.serviceHistory].sort((a,b) => b.date.localeCompare(a.date)).map(s => <li key={s.id}>{s.date}: {s.title} — {s.hours == null ? 'calendar service; hours not supplied' : `${s.hours} hours`}. Recorded by {s.recordedBy} at {s.recordedAt}.</li>)}</ul>}
  </div>;
}
