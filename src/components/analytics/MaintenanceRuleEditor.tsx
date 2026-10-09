'use client';
import React from 'react';
import type { MaintenanceProfile, MaintenanceRule } from '@/types';
import styles from './analytics.module.css';
export const FORD_NORMAL_SOURCES: Record<number,string> = {
  2022:'https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G2213641&Uid=G2213639&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=USA&vFilteringEnabled=False&variantid=8431',
  2023:'https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G2327279&Uid=G2329664&buildType=web&countryCode=USA&div=f&languageCode=EN&userMarket=USA&vFilteringEnabled=False&variantid=9218',
};
export default function MaintenanceRuleEditor({profile,onChange,selectedRuleId}: {profile:MaintenanceProfile;onChange:(profile:MaintenanceProfile)=>void;selectedRuleId?:string}) {
  const rules=profile.rules || [];
  const update=(index:number,patch:Partial<MaintenanceRule>)=>onChange({...profile,rules:rules.map((r,i)=>i===index?{...r,...patch,confirmed:patch.confirmed ?? false}:r)});
  const num=(value:string)=>value===''?undefined:Number(value);
  const canDraft=profile.make?.toLowerCase()==='ford' && profile.model?.toLowerCase()==='maverick' && !!FORD_NORMAL_SOURCES[profile.year || 0] && profile.operatingProfile==='Normal use';
  return <section aria-label="Independent maintenance rules">
    <h3>Independent service rules</h3>
    <p className={styles.muted}>Each service needs its own source and actual completed-service baseline. Confirming a rule also verifies its baseline against records. Leave unknown values blank; no service history is invented.</p>
    {canDraft && <button type="button" className={styles.secondary} onClick={()=>onChange({...profile,oilIntervalMiles:profile.year===2022?10000:12500,oilIntervalMonths:12,scheduleSource:FORD_NORMAL_SOURCES[profile.year!],scheduleConfirmed:false})}>Review {profile.year} Maverick normal oil draft</button>}
    <p className={styles.muted}>Ford normal drafts require review against the original manual, configuration and usage. Normal use excludes extended idling and heavy towing; dusty or severe use needs manually verified limits. The instrument-cluster oil-life monitor may require service earlier.</p>
    {rules.map((rule,index)=><fieldset key={rule.id} className={styles.ruleFieldset} data-maintenance-rule={rule.id} data-selected-rule={selectedRuleId===rule.id?'true':undefined} tabIndex={-1}><legend>{rule.title || 'New service rule'}{selectedRuleId===rule.id?' · Selected rule':''}</legend>
      <label>Rule title<input value={rule.title} onChange={e=>update(index,{title:e.target.value})}/></label>
      <label>Service category<select value={rule.kind} onChange={e=>update(index,{kind:e.target.value as MaintenanceRule['kind']})}><option value="tires">Tires</option><option value="filters">Filters</option><option value="other">Brakes / coolant / other</option><option value="oil">Oil</option></select></label>
      <label>Cadence<select value={rule.recurrence} onChange={e=>update(index,{recurrence:e.target.value as MaintenanceRule['recurrence']})}><option value="after_service">Recurring after completed service</option><option value="initial_then_recurring">Initial then recurring</option></select></label>
      <div className={styles.formGrid}>{(['intervalMiles','intervalMonths',...(rule.recurrence==='initial_then_recurring'?['initialMiles','initialMonths']:[])] as const).map(key=><label key={key}>{({intervalMiles:'Recurring miles',intervalMonths:'Recurring months',initialMiles:'First-service odometer threshold',initialMonths:'Initial months from in-service date'} as Record<string,string>)[key]}<input type="number" min="1" value={rule[key as keyof MaintenanceRule] as number ?? ''} onChange={e=>update(index,{[key]:num(e.target.value)})}/></label>)}</div>
      <div className={styles.formGrid}><label>Actual baseline date<input type="date" max={new Date().toISOString().slice(0,10)} value={rule.baselineDate || ''} onChange={e=>update(index,{baselineDate:e.target.value || undefined})}/></label><label>Actual baseline odometer<input type="number" min="0" value={rule.baselineOdometer ?? ''} onChange={e=>update(index,{baselineOdometer:num(e.target.value)})}/></label></div>
      <label>Rule source / baseline reference<input value={rule.source} onChange={e=>update(index,{source:e.target.value})}/></label>
      <label className={styles.checkbox}><input type="checkbox" checked={rule.confirmed} onChange={e=>update(index,{confirmed:e.target.checked})}/>I verified this rule, applicable conditions and actual baseline or in-service date.</label>
      <button type="button" className={styles.secondary} onClick={()=>onChange({...profile,rules:rules.filter((_,i)=>i!==index)})}>Remove rule</button>
    </fieldset>)}
    <button type="button" className={styles.secondary} onClick={()=>onChange({...profile,rules:[...rules,{id:crypto.randomUUID(),title:'',kind:'other',recurrence:'after_service',source:'',confirmed:false}]})}>Add independent service rule</button>
  </section>;
}
