'use client';
import React from 'react';
import type {Vehicle} from '@/types';
import type {MaintenanceForecast} from '@/lib/maintenanceRules';
import type {EditorMode} from './VehicleMaintenanceForm';
import styles from './analytics.module.css';
export function issueAction(issue:string,ruleId?:string,independentRule=!!ruleId && ruleId!=='oil'):{label:string;mode:EditorMode;step:number} {
 if(/prior service is unknown|history.*unknown|unknown.*history/i.test(issue))return {label:'Verify service history',mode:'profile',step:2};
 if(/current.*mileage|measured.*mileage|reading from|Current mileage/i.test(issue))return {label:'Measure mileage',mode:'reading',step:2};
 if(/source|interval|confirm.*rule|configuration.*usage/i.test(issue))return {label:/source/i.test(issue)?'Verify rule source':'Review intervals and applicability',mode:'profile',step:3};
 if(/baseline|history|in-service|completed.*service/i.test(issue))return {label:'Verify service baseline',mode:'profile',step:independentRule?3:2};
 return {label:issue.replace(/[.]$/,''),mode:'profile',step:1};
}
export default function MaintenanceActions({rows,onEdit}:{rows:{vehicle:Vehicle;forecasts:MaintenanceForecast[]}[];onEdit:(id:string,mode:EditorMode,ruleId?:string,step?:number)=>void}) {
 const priority={overdue:0,due_soon:1,needs_setup:2,scheduled:3};
 const work=rows.flatMap(({vehicle,forecasts})=>forecasts.filter(f=>f.status!=='scheduled').map(f=>({vehicle,f}))).sort((a,b)=>priority[a.f.status]-priority[b.f.status]||(a.f.dueDate || '').localeCompare(b.f.dueDate || '')||a.vehicle.vehicleNumber.localeCompare(b.vehicle.vehicleNumber));
 return <section className={styles.panel} aria-label="Weekly maintenance actions"><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>THIS WEEK</span><h2>Priority actions</h2></div><span className={styles.softBadge}>{work.length} to review</span></div>{!work.length?<p className={styles.muted}>No due work or setup gaps in this view. Review oil-life warnings and actual conditions weekly.</p>:<ol className={styles.priorityList}>{work.map(({vehicle,f})=><li key={`${vehicle.id}-${f.ruleId}`}><div className={styles.cardTop}><strong>{vehicle.vehicleNumber} · {f.title}</strong><span className={`${styles.badge} ${styles[f.status]}`}>{f.status==='overdue'?'Due now':f.status==='due_soon'?'Due soon':'Needs setup'}</span></div><p>{f.reason}</p>{f.status==='needs_setup'?<div className={styles.cardActions}>{Array.from(new Set(f.missing)).map(issue=>{const action=issueAction(issue,f.ruleId,vehicle.maintenance?.rules?.some(rule=>rule.id===f.ruleId) || f.ruleId!=='oil');return <button key={issue} className={styles.secondary} onClick={()=>onEdit(vehicle.id,action.mode,f.ruleId,action.step)} title={issue}>{action.label}</button>;})}</div>:<div className={styles.cardActions}><button className={styles.primary} onClick={()=>onEdit(vehicle.id,'service',f.ruleId)}>Log completed service</button><button className={styles.secondary} onClick={()=>onEdit(vehicle.id,'appointment',f.ruleId)}>Book appointment</button></div>}</li>)}</ol>}</section>;
}
