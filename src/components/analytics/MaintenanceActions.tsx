'use client';
import React, { useId, useState } from 'react';
import type { Vehicle } from '@/types';
import type { MaintenanceForecast } from '@/lib/maintenanceRules';
import type { EditorMode } from './VehicleMaintenanceForm';
import styles from './analytics.module.css';

export function issueAction(
  issue: string,
  ruleId?: string,
  independentRule = !!ruleId && ruleId !== 'oil',
): { label: string; mode: EditorMode; step: number } {
  if (/conflicting.*chronology/i.test(issue)) return { label: 'Review service history', mode: 'history', step: 1 };
  if (/prior service is unknown|history.*unknown|unknown.*history/i.test(issue))
    return { label: 'Verify service history', mode: 'profile', step: 2 };
  if (/current.*mileage|measured.*mileage|reading from|Current mileage/i.test(issue))
    return { label: 'Measure mileage', mode: 'reading', step: 2 };
  if (/source|interval|confirm.*rule|configuration.*usage/i.test(issue))
    return {
      label: /source/i.test(issue) ? 'Verify rule source' : 'Review intervals and applicability',
      mode: 'profile',
      step: 3,
    };
  if (/baseline|history|in-service|completed.*service/i.test(issue))
    return { label: 'Verify service baseline', mode: 'profile', step: independentRule ? 3 : 2 };
  return { label: issue.replace(/[.]$/, ''), mode: 'profile', step: 1 };
}

type RowAction = { issue: string; label: string; mode: EditorMode; step: number; ruleId: string };

function uniqueActions(vehicle: Vehicle, f: MaintenanceForecast): RowAction[] {
  const seen = new Set<string>();
  const out: RowAction[] = [];
  for (const issue of Array.from(new Set(f.missing))) {
    const action = issueAction(
      issue,
      f.ruleId,
      vehicle.maintenance?.rules?.some(rule => rule.id === f.ruleId) || f.ruleId !== 'oil',
    );
    if (seen.has(action.label)) continue;
    seen.add(action.label);
    out.push({ issue, label: action.label, mode: action.mode, step: action.step, ruleId: f.ruleId });
  }
  return out;
}

function PriorityMore({
  actions,
  onPick,
}: {
  actions: RowAction[];
  onPick: (action: RowAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  if (!actions.length) return null;
  return (
    <div className={styles.moreMenu}>
      <button
        type="button"
        className={styles.secondary}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(value => !value)}
      >
        More ▾
      </button>
      {open && (
        <ul id={menuId} role="menu" className={styles.moreMenuList}>
          {actions.map(action => (
            <li key={action.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.moreMenuItem}
                title={action.issue}
                onClick={() => {
                  setOpen(false);
                  onPick(action);
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MaintenanceActions({
  rows,
  onEdit,
}: {
  rows: { vehicle: Vehicle; forecasts: MaintenanceForecast[] }[];
  onEdit: (id: string, mode: EditorMode, ruleId?: string, step?: number) => void;
}) {
  const priority = { overdue: 0, due_soon: 1, needs_setup: 2, scheduled: 3 };
  const work = rows
    .flatMap(({ vehicle, forecasts }) => forecasts.filter(f => f.status !== 'scheduled').map(f => ({ vehicle, f })))
    .sort(
      (a, b) =>
        priority[a.f.status] - priority[b.f.status] ||
        (a.f.dueDate || '').localeCompare(b.f.dueDate || '') ||
        a.vehicle.vehicleNumber.localeCompare(b.vehicle.vehicleNumber),
    );

  return (
    <section className={styles.panel} aria-label="Weekly maintenance actions">
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>THIS WEEK</span>
          <h2>Priority actions</h2>
          <p className={styles.sectionHint}>One next step per truck; more setup actions stay in the menu.</p>
        </div>
        <span className={styles.softBadge}>{work.length} to review</span>
      </div>
      {!work.length ? (
        <p className={styles.muted}>
          No due work or setup gaps in this view. Review oil-life warnings and actual conditions weekly.
        </p>
      ) : (
        <ol className={styles.priorityList}>
          {work.map(({ vehicle, f }) => {
            const actions = uniqueActions(vehicle, f);
            const primary = actions[0];
            const rest = actions.slice(1);
            return (
              <li key={`${vehicle.id}-${f.ruleId}`}>
                <div className={styles.cardTop}>
                  <strong>
                    {vehicle.vehicleNumber} · {f.title}
                  </strong>
                  <span className={`${styles.badge} ${styles[f.status]}`}>
                    {f.status === 'overdue' ? 'Due now' : f.status === 'due_soon' ? 'Due soon' : 'Needs setup'}
                  </span>
                </div>
                <p>{f.reason}</p>
                {f.status === 'needs_setup' ? (
                  <div className={styles.cardActions}>
                    {primary && (
                      <button
                        type="button"
                        className={styles.primary}
                        title={primary.issue}
                        onClick={() => onEdit(vehicle.id, primary.mode, f.ruleId, primary.step)}
                      >
                        {primary.label}
                      </button>
                    )}
                    <PriorityMore actions={rest} onPick={action => onEdit(vehicle.id, action.mode, f.ruleId, action.step)} />
                  </div>
                ) : (
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.primary} onClick={() => onEdit(vehicle.id, 'service', f.ruleId)}>
                      Log completed service
                    </button>
                    <PriorityMore
                      actions={[
                        {
                          issue: 'Book appointment',
                          label: 'Book appointment',
                          mode: 'appointment',
                          step: 1,
                          ruleId: f.ruleId,
                        },
                      ]}
                      onPick={action => onEdit(vehicle.id, action.mode, f.ruleId, action.step)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
