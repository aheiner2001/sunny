'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ManagerOnly } from '@/components/ManagerOnly';
import { useAuth } from '@/context/AuthContext';
import { dbService } from '@/lib/db';
import { exportInspectionAlertsAsCSV } from '@/lib/export';
import { Inspection, InspectionAlert, VehicleAssignment } from '@/types';
import { findPreviousVehicleUser } from '@/lib/previousVehicleUser';

export default function PendingPage() { return <ManagerOnly><PendingContent /></ManagerOnly>; }
function PendingContent() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<InspectionAlert[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => {
      setAlerts(dbService.getInspectionAlerts());
      setInspections(dbService.getInspections());
      setAssignments(dbService.getVehicleAssignments());
    };
    refresh(); window.addEventListener('sunny_db_update', refresh);
    return () => window.removeEventListener('sunny_db_update', refresh);
  }, []);
  const pendingCount = alerts.filter(a => a.status === 'pending').length;
  const shown = useMemo(() => alerts.filter(a => tab === 'pending' ? a.status === 'pending' : a.status !== 'pending')
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)), [alerts, tab]);
  async function review(alert: InspectionAlert, action: 'acknowledged' | 'converted') {
    if (!user) return;
    setBusy(true); setError('');
    try {
      await dbService.reviewInspectionAlert(alert.id, action, { id: user.id, name: user.name }, notes[alert.id] || '');
      setAlerts(dbService.getInspectionAlerts());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not review this report.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div>
      <h1 className="text-2xl font-extrabold text-ink">Pending reports</h1>
      <p className="text-sm text-ink-muted">Review inspection flags before creating an issue. {pendingCount} awaiting review.</p>
    </div><button type="button" className="btn btn-secondary" onClick={() => exportInspectionAlertsAsCSV(alerts)}>Export CSV</button></div>
    <div className="flex gap-2" role="tablist" aria-label="Report status">
      <button type="button" role="tab" aria-selected={tab === 'pending'} className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('pending')}>Pending ({pendingCount})</button>
      <button type="button" role="tab" aria-selected={tab === 'history'} className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('history')}>History</button>
    </div>
    {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    {shown.length === 0 && <div className="card card-pad text-sm text-ink-muted">{tab === 'pending' ? 'No reports waiting for review.' : 'No reviewed reports yet.'}</div>}
    <div className="space-y-3">{shown.map(alert => {
      const original = alert.sourceIssueId ? dbService.getIssue(alert.sourceIssueId) : null;
      const previousUser = findPreviousVehicleUser(alert, inspections.find(row => row.id === alert.inspectionId), assignments);
      const related = dbService.getOpenIssues().filter(issue => issue.vehicleId === alert.vehicleId &&
        (alert.equipmentId ? issue.equipmentId === alert.equipmentId : issue.equipmentName === alert.equipmentName));
      return <article className="card card-pad space-y-3" key={alert.id} data-status={alert.status === 'pending' ? 'flagged' : 'ok'}>
        <div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-bold text-ink">{alert.title}</h2>
          <p className="text-sm text-ink-muted">Truck {alert.vehicleNumber} · {alert.equipmentName} · {alert.sourceIssueId ? 'Existing issue' : alert.inspectionKind === 'return' ? 'Return' : 'Pretrip'}</p></div>
          <span className="text-xs text-ink-muted">{new Date(alert.reportedAt).toLocaleString()}</span></div>
        <p className="text-sm">Reported by {alert.reportedByName}{alert.description ? `: ${alert.description}` : ''}</p>
        <div className="rounded-lg border border-line bg-surface-alt p-3 space-y-1">
          {previousUser ? <>
            <p className="text-sm text-ink"><span className="font-semibold">Previous vehicle user:</span> {previousUser.userName}</p>
            <p className="text-xs text-ink-muted">Last assignment: {new Date(previousUser.startedAt).toLocaleString()}</p>
            <p className="text-xs text-ink-muted">Assignment history for follow-up; this does not confirm who caused the problem.</p>
          </> : <p className="text-sm text-ink-muted">Previous user unknown — no reliable earlier assignment found.</p>}
        </div>
        {original && <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer font-semibold">Original issue and repair history</summary>
          <p className="mt-2">Original status: {original.status.replace('_', ' ')} · Priority: {original.priority || 'moderate'}{original.priority === 'critical' ? ' · Safety warning remains until reviewed' : ''}</p>
          <ul className="mt-2 space-y-1">{(original.statusLogs || []).map(log => <li key={log.id}>{new Date(log.timestamp).toLocaleString()} · {log.changedByName}: {log.notes}</li>)}</ul>
        </details>}
        {alert.photoUrl && <a href={alert.photoUrl} target="_blank" rel="noreferrer" className="text-sm underline">View photo</a>}
        {related.length > 0 && <p className="text-xs text-amber-700">{related.length} open issue{related.length === 1 ? '' : 's'} for this truck and equipment. <Link className="underline" href={`/issues?issue=${encodeURIComponent(related[0].id)}`}>View existing issue</Link></p>}
        {alert.status === 'pending' ? <div className="space-y-2">
          <label className="block text-xs font-semibold" htmlFor={`notes-${alert.id}`}>Manager notes (optional)</label>
          <textarea id={`notes-${alert.id}`} className="input w-full" rows={2} value={notes[alert.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [alert.id]: e.target.value }))} placeholder="Add context before turning this into an issue" />
          <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void review(alert, 'acknowledged')}>Acknowledge</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void review(alert, 'converted')}>Turn into issue</button></div>
        </div> : <p className="text-xs text-ink-muted">{alert.status === 'converted' ? 'Turned into issue' : 'Acknowledged'} by {alert.reviewedByName} {alert.reviewedAt ? new Date(alert.reviewedAt).toLocaleString() : ''}{alert.reviewNotes ? ` · ${alert.reviewNotes}` : ''}{alert.issueId ? <> · <Link className="underline" href={`/issues?issue=${encodeURIComponent(alert.issueId)}`}>View issue</Link></> : null}</p>}
      </article>;
    })}</div>
  </div>;
}
