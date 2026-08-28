'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Edit2, Package, PackagePlus, Plus, QrCode, Search, Trash2, Wrench } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, EquipmentCategory, EquipmentKind, EquipmentStatus, Vehicle } from '@/types';
import { EquipmentStatusBadge } from '@/components/StatusBadges';
import { EquipmentQRCodeDisplay } from '@/components/EquipmentQRCodeDisplay';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmModal } from '@/components/ConfirmModal';
import { QuantityModal } from '@/components/QuantityModal';

const emptyForm = {
  name: '',
  assetTag: '',
  vehicleId: '',
  category: 'equipment' as EquipmentCategory,
  kind: 'reusable' as EquipmentKind,
  status: 'working' as EquipmentStatus,
  totalQuantity: '1',
  qrCodeToken: ''
};

const ALL_STATUSES: Array<'all' | EquipmentStatus> = ['all', 'working', 'flagged', 'needs_repair', 'being_repaired', 'fixed'];

export default function EquipmentPage() {
  return (
    <ManagerOnly>
      <EquipmentPageContent />
    </ManagerOnly>
  );
}

function EquipmentPageContent() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EquipmentStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | EquipmentCategory>('all');
  const [sortMode, setSortMode] = useState<'equipment' | 'vehicle'>('equipment');
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Equipment | null>(null);

  const load = () => {
    setEquipment(dbService.getEquipment());
    setVehicles(dbService.getVehicles());
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, []);

  const assignedQty = (eq: Equipment) => (eq.assignments || []).reduce((sum, assignment) => sum + assignment.quantity, 0);
  const unassignedQty = (eq: Equipment) => Math.max(0, eq.availableQuantity ?? ((eq.totalQuantity ?? 1) - assignedQty(eq)));
  const totalQty = (eq: Equipment) => Math.max(eq.totalQuantity ?? 1, assignedQty(eq) + unassignedQty(eq));
  const assignmentsLabel = (eq: Equipment) => (eq.assignments || []).map(a => `${a.vehicleNumber} (${a.quantity})`).join(', ') || 'In shop / unassigned';
  const globalSummary = dbService.getGlobalInventorySummary();

  const filtered = equipment.filter(eq => {
    const assignmentText = (eq.assignments || []).map(a => a.vehicleNumber).join(' ');
    const haystack = `${eq.name} ${eq.assetTag || ''} ${eq.category} ${assignmentText}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase())
      && (statusFilter === 'all' || eq.status === statusFilter)
      && (categoryFilter === 'all' || eq.category === categoryFilter);
  });

  const openAdd = () => {
    setSelected(null);
    setForm({ ...emptyForm });
    setModal('add');
  };

  const openEdit = (eq: Equipment) => {
    setSelected(eq);
    setForm({
      name: eq.name,
      assetTag: eq.assetTag || '',
      vehicleId: eq.assignments?.[0]?.vehicleId || eq.vehicleId || '',
      category: eq.category,
      kind: eq.kind || (eq.category === 'supplies' ? 'consumable' : 'reusable'),
      status: eq.status,
      totalQuantity: String(eq.totalQuantity ?? 1),
      qrCodeToken: eq.qrCodeToken || eq.qrCode || ''
    });
    setModal('edit');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    const totalQuantity = Number(form.totalQuantity);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1) {
      alert('Total quantity must be a positive whole number.');
      return;
    }

    const vehicle = vehicles.find(v => v.id === form.vehicleId);

    const existing = selected?.assignments || [];
    let assignments = existing;
    if (modal === 'edit') {
      if (!vehicle) {
        if (
          existing.length > 1 &&
          !window.confirm(
            `Move all assignments to In Shop?\n\nAffected vehicles: ${existing
              .map(assignment => assignment.vehicleNumber)
              .join(', ')}`,
          )
        ) {
          return;
        }
        assignments = [];
      } else if (!existing.some(a => a.vehicleId === vehicle.id)) {
        assignments = [...existing, { vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, quantity: 1 }];
      } else {
        assignments = existing;
      }
      const assignedTotal = assignments.reduce((sum, a) => sum + a.quantity, 0);
      if (assignedTotal > totalQuantity) {
        alert(`${assignedTotal} units are already assigned to vehicles. Total cannot be lower than that.`);
        return;
      }
    }

    try {
      setLoading(true);
      if (modal === 'add') {
        await dbService.createEquipment({
          name: form.name,
          assetTag: form.assetTag || null,
          vehicleId: form.vehicleId || null,
          category: form.category,
          kind: form.kind,
          status: form.status,
          totalQuantity,
          qrCodeToken: form.qrCodeToken || null
        });
      }

      if (modal === 'edit' && selected) {
        await dbService.updateEquipment({
          ...selected,
          name: form.name.trim(),
          assetTag: form.assetTag.trim() || null,
          category: form.category,
          kind: form.kind,
          status: form.status,
          totalQuantity,
          assignments,
          vehicleId: vehicle?.id || null,
          vehicleNumber: vehicle?.vehicleNumber || 'Unassigned',
          availableQuantity: Math.max(0, totalQuantity - assignments.reduce((sum, a) => sum + a.quantity, 0)),
          qrCodeToken: form.qrCodeToken || null,
          qrCode: form.qrCodeToken || null
        });
      }
      setModal(null);
    } catch (err: any) {
      alert(err.message || 'Could not save equipment.');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setLoading(true);
    await dbService.deleteEquipment(selected.id);
    setLoading(false);
    setModal(null);
  };

  const handleRestockConfirm = async (amount: number) => {
    if (!restockTarget) return;
    try {
      await dbService.restockEquipment(restockTarget.id, amount);
      setRestockTarget(null);
    } catch (err: any) {
      alert(err.message || 'Could not add stock.');
    }
  };

  const card = (eq: Equipment) => (
    <div key={eq.id} className="card card-pad">
      <div className="spread items-start mb-3">
        <div className="cluster items-start min-w-0">
          <span className="icon-tile" data-status="info" aria-hidden>
            <Wrench className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="card-title break-words">{eq.name}</h3>
            <span className="badge mt-1">
              {eq.kind === 'consumable' ? 'Consumable stock' : 'Reusable equipment'}
            </span>
            {eq.assetTag ? <p className="hint mt-1 break-words">Tag: {eq.assetTag}</p> : null}
          </div>
        </div>
        <EquipmentStatusBadge status={eq.status} />
      </div>

      <div className="card card-pad bg-[var(--surface-alt)] mb-3">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="stat">
            <span className="stat-label">Total Owned</span>
            <span className="stat-value text-base">{totalQty(eq)}</span>
          </div>
          <div className="stat" data-status="info">
            <span className="stat-label">Unassigned</span>
            <span className="stat-value text-base">{unassignedQty(eq)}</span>
          </div>
          <div className="stat" data-status="ok">
            <span className="stat-label">Assigned</span>
            <span className="stat-value text-base">{assignedQty(eq)}</span>
          </div>
        </div>
        <p className="hint mt-2 break-words leading-relaxed">{assignmentsLabel(eq)}</p>
      </div>

      <div className="card-foot mt-0 pt-3">
        <EquipmentQRCodeDisplay equipment={eq} />
        <div className="cluster">
          {eq.kind === 'consumable' && (
            <button
              type="button"
              onClick={() => setRestockTarget(eq)}
              className="btn btn-ghost btn-sm"
              title="Add stock (new delivery)"
            >
              <PackagePlus className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button type="button" onClick={() => openEdit(eq)} className="btn btn-ghost btn-sm" title="Edit / reassign">
            <Edit2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => { setSelected(eq); setModal('delete'); }}
            className="btn btn-ghost btn-sm text-[var(--critical)]"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );

  const groupedByVehicle = [
    { id: 'unassigned', number: 'In Shop / Unassigned', items: filtered.filter(e => !(e.assignments?.length || e.vehicleId)) },
    ...vehicles.map(v => ({
      id: v.id,
      number: v.vehicleNumber,
      items: filtered.filter(e => e.assignments?.some(a => a.vehicleId === v.id) || e.vehicleId === v.id)
    }))
  ].filter(group => group.items.length > 0);

  const formModal = modal === 'add' || modal === 'edit';

  return (
    <div className="page max-w-full overflow-x-hidden">
      <PageHeader
        title="Global Inventory"
        subtitle="Track total owned assets, in-shop inventory, and vehicle assignments."
        actions={
          <>
            <button type="button" onClick={openAdd} className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Add Equipment
            </button>
            <Link href="/equipment/scan" className="btn btn-primary">
              <QrCode className="h-4 w-4" aria-hidden />
              Scan Equipment
            </Link>
            <Link href="/issues" className="btn btn-attention">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Issues
            </Link>
          </>
        }
      />

      <div className="grid-auto" style={{ '--min': '14rem' } as React.CSSProperties}>
        <div className="card card-pad">
          <div className="stat">
            <span className="stat-label">Total Owned</span>
            <span className="stat-value">{globalSummary.totalOwned}</span>
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat" data-status="info">
            <span className="stat-label">Unassigned (In Shop)</span>
            <span className="stat-value">{globalSummary.unassigned}</span>
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat" data-status="ok">
            <span className="stat-label">Assigned</span>
            <span className="stat-value">{globalSummary.assigned}</span>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="spread flex-col md:flex-row gap-3">
          <div className="field w-full md:max-w-xs">
            <label className="label sr-only" htmlFor="equipment-search">
              Search equipment
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                id="equipment-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search equipment, tag, vehicle..."
                className="input pl-9"
              />
            </div>
          </div>
          <div className="cluster w-full md:w-auto md:justify-end">
            <label className="cluster text-sm font-semibold text-ink-muted">
              View
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as 'equipment' | 'vehicle')}
                className="select btn-sm w-auto"
              >
                <option value="equipment">Global inventory cards</option>
                <option value="vehicle">Vehicle assignments</option>
              </select>
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | EquipmentCategory)}
              className="select btn-sm w-auto"
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              <option value="equipment">Equipment</option>
              <option value="supplies">Supplies</option>
              <option value="vehicle_condition">Vehicle condition</option>
            </select>
            {ALL_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`btn btn-sm capitalize ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sortMode === 'equipment' ? (
        <div className="grid-auto">
          {filtered.map(card)}
        </div>
      ) : (
        <div className="stack">
          {groupedByVehicle.map(group => {
            const expanded = expandedVehicles[group.id] ?? true;
            return (
              <div key={group.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedVehicles(x => ({ ...x, [group.id]: !expanded }))}
                  className="card-head w-full text-left min-h-12"
                >
                  <span>
                    <strong className="block text-sm">{group.number}</strong>
                    <span className="hint">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="text-xs font-bold text-[var(--info)]">{expanded ? 'Collapse' : 'Expand'}</span>
                </button>
                {expanded ? (
                  <div className="grid-auto p-4 pt-0">
                    {group.items.map(card)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card card-pad">
          <EmptyState
            icon={<Package className="h-12 w-12 text-ink-faint" aria-hidden />}
            title="No equipment found"
          >
            Adjust search or filter settings to find inventory records.
          </EmptyState>
        </div>
      )}

      {formModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="card card-pad max-w-md w-full max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="equipment-form-title" className="card-title mb-4">
              {modal === 'add' ? 'Add Global Inventory Item' : 'Edit Equipment'}
            </h2>
            <form onSubmit={save} className="stack">
              <div className="field">
                <label className="label" htmlFor="equipment-name">Equipment name</label>
                <input
                  id="equipment-name"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Equipment name"
                  className="input"
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="equipment-tag">Serial / asset tag</label>
                <input
                  id="equipment-tag"
                  value={form.assetTag}
                  onChange={e => setForm({ ...form, assetTag: e.target.value })}
                  placeholder="Optional"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="field">
                  <label className="label" htmlFor="equipment-kind">Type</label>
                  <select
                    id="equipment-kind"
                    value={form.kind}
                    onChange={e => setForm({ ...form, kind: e.target.value as EquipmentKind })}
                    className="select"
                  >
                    <option value="reusable">Reusable equipment</option>
                    <option value="consumable">Consumable stock</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="equipment-total-qty">Total quantity owned</label>
                  <input
                    id="equipment-total-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={form.totalQuantity}
                    onChange={e => setForm({ ...form, totalQuantity: e.target.value })}
                    className="input"
                    placeholder="e.g. 12"
                  />
                </div>
              </div>
              <p className="hint">
                {form.kind === 'reusable'
                  ? 'Reusable: units move between the shop and trucks and are never used up. Enter how many you own in total, then assign them out.'
                  : 'Consumable: employees can mark stock as used, which removes it from the truck and from the fleet total.'}
              </p>
              <div className="field">
                <label className="label" htmlFor="equipment-vehicle">
                  {modal === 'add' ? 'Starting location' : 'Assigned vehicle'}
                </label>
                <select
                  id="equipment-vehicle"
                  value={form.vehicleId}
                  onChange={e => setForm({ ...form, vehicleId: e.target.value })}
                  className="select"
                >
                  <option value="">In shop / unassigned</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber} - {v.name}</option>)}
                </select>
                {modal === 'add' && (
                  <p className="hint">
                    All {Number(form.totalQuantity) > 1 ? Number(form.totalQuantity) : ''} units start in the shop
                    {form.vehicleId ? ' except one sent to the chosen truck' : ''}. Assign the rest per truck from the inventory list.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value as EquipmentCategory })}
                  className="select"
                  aria-label="Category"
                >
                  <option value="equipment">Equipment</option>
                  <option value="supplies">Supplies</option>
                  <option value="vehicle_condition">Vehicle condition</option>
                </select>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as EquipmentStatus })}
                  className="select"
                  aria-label="Status"
                >
                  <option value="working">Working</option>
                  <option value="flagged">Flagged</option>
                  <option value="needs_repair">Needs repair</option>
                  <option value="being_repaired">Being repaired</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="equipment-qr">QR token / code</label>
                <input
                  id="equipment-qr"
                  value={form.qrCodeToken}
                  onChange={e => setForm({ ...form, qrCodeToken: e.target.value })}
                  placeholder="Optional"
                  className="input"
                />
              </div>
              <div className="cluster justify-end">
                <button type="button" onClick={() => setModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={modal === 'delete' && selected !== null}
        title={`Delete ${selected?.name ?? 'equipment'}?`}
        message="This removes the inventory record and its assignments."
        confirmLabel={loading ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setModal(null)}
        onConfirm={() => void remove()}
      />

      <QuantityModal
        open={restockTarget !== null}
        title={restockTarget ? `Add stock for ${restockTarget.name}` : 'Add stock'}
        description="How many units were received?"
        initialValue={1}
        min={1}
        onConfirm={handleRestockConfirm}
        onCancel={() => setRestockTarget(null)}
      />
    </div>
  );
}
