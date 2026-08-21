'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Edit2, Package, PackagePlus, Plus, QrCode, Search, Trash2, Wrench, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, EquipmentCategory, EquipmentKind, EquipmentStatus, Vehicle } from '@/types';
import { EquipmentStatusBadge } from '@/components/StatusBadges';
import { EquipmentQRCodeDisplay } from '@/components/EquipmentQRCodeDisplay';
import { ManagerOnly } from '@/components/ManagerOnly';

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
  // `?? 1` rather than `|| 1`: a fully consumed item really does hold 0.
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

    // Preserve an existing multi-vehicle distribution. Rebuilding assignments
    // from the single vehicle picker would silently drop every other truck's
    // allocation, so only the picked vehicle's own entry is touched here.
    const existing = selected?.assignments || [];
    let assignments = existing;
    if (modal === 'edit') {
      if (vehicle && !existing.some(a => a.vehicleId === vehicle.id)) {
        assignments = [...existing, { vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, quantity: 1 }];
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

  const handleRestock = async (eq: Equipment) => {
    const entered = prompt(`Add stock for ${eq.name}\n\nHow many units were received?`, '1');
    if (entered === null) return;
    const amount = Number(entered);
    if (!Number.isInteger(amount) || amount <= 0) {
      alert('Enter a positive whole number.');
      return;
    }
    try {
      await dbService.restockEquipment(eq.id, amount);
    } catch (err: any) {
      alert(err.message || 'Could not add stock.');
    }
  };

  const card = (eq: Equipment) => (
    <div key={eq.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-xs font-bold text-slate-900 break-words">{eq.name}</h3>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {eq.kind === 'consumable' ? 'Consumable stock' : 'Reusable equipment'}
            </span>
            {eq.assetTag && <p className="text-[11px] sm:text-[10px] text-slate-500 mt-0.5 break-words">Tag: {eq.assetTag}</p>}
          </div>
        </div>
        <EquipmentStatusBadge status={eq.status} />
      </div>

      <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-2 mb-3">
        <div className="grid grid-cols-3 gap-2">
          <div><div className="text-slate-500 text-[10px]">Total Owned</div><div className="font-extrabold text-slate-900">{totalQty(eq)}</div></div>
          <div><div className="text-slate-500 text-[10px]">Unassigned</div><div className="font-extrabold text-sky-700">{unassignedQty(eq)}</div></div>
          <div><div className="text-slate-500 text-[10px]">Assigned</div><div className="font-extrabold text-emerald-700">{assignedQty(eq)}</div></div>
        </div>
        <div className="text-slate-500 break-words leading-relaxed">{assignmentsLabel(eq)}</div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <EquipmentQRCodeDisplay equipment={eq} />
        <div className="flex gap-1">
          {eq.kind === 'consumable' && (
            <button onClick={() => handleRestock(eq)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Add stock (new delivery)">
              <PackagePlus className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => openEdit(eq)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit / reassign">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setSelected(eq); setModal('delete'); }} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
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
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-900">Global Inventory</h1>
          <p className="text-sm sm:text-xs text-slate-500 mt-0.5 leading-relaxed">Track total owned assets, in-shop inventory, and vehicle assignments.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={openAdd} className="flex items-center justify-center gap-2 px-4 min-h-12 rounded-xl bg-sky-600 text-white font-bold text-sm sm:text-xs">
            <Plus className="w-4 h-4" />Add Equipment
          </button>
          <Link href="/equipment/scan" className="flex items-center justify-center gap-2 px-4 min-h-12 rounded-xl bg-slate-900 text-white font-bold text-sm sm:text-xs">
            <QrCode className="w-4 h-4" />Scan Equipment
          </Link>
          <Link href="/issues" className="flex items-center justify-center gap-2 px-4 min-h-12 rounded-xl bg-amber-500 text-white font-bold text-sm sm:text-xs">
            <AlertTriangle className="w-4 h-4" />Issues
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Owned</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{globalSummary.totalOwned}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unassigned (In Shop)</div>
          <div className="text-2xl font-black text-sky-700 mt-1">{globalSummary.unassigned}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{globalSummary.assigned}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search equipment, tag, vehicle..."
            className="w-full pl-10 pr-4 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <label className="text-sm sm:text-xs font-bold text-slate-600 flex items-center gap-2">
            View{' '}
            <select value={sortMode} onChange={e => setSortMode(e.target.value as 'equipment' | 'vehicle')} className="px-3 min-h-12 rounded-xl border border-slate-200 text-sm sm:text-xs">
              <option value="equipment">Global inventory cards</option>
              <option value="vehicle">Vehicle assignments</option>
            </select>
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | EquipmentCategory)}
            className="px-3 min-h-12 rounded-xl border border-slate-200 text-sm sm:text-xs"
          >
            <option value="all">All categories</option>
            <option value="equipment">Equipment</option>
            <option value="supplies">Supplies</option>
            <option value="vehicle_condition">Vehicle condition</option>
          </select>
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 min-h-11 rounded-xl text-sm sm:text-xs font-bold capitalize ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {sortMode === 'equipment' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(card)}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByVehicle.map(group => {
            const expanded = expandedVehicles[group.id] ?? true;
            return (
              <div key={group.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedVehicles(x => ({ ...x, [group.id]: !expanded }))} className="w-full flex justify-between items-center gap-3 p-4 text-left min-h-12">
                  <span>
                    <strong className="block text-sm">{group.number}</strong>
                    <span className="text-xs text-slate-500">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="text-xs font-bold text-sky-600">{expanded ? 'Collapse' : 'Expand'}</span>
                </button>
                {expanded && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0">{group.items.map(card)}</div>}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">No equipment found</h3>
        </div>
      )}

      {formModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{modal === 'add' ? 'Add Global Inventory Item' : 'Edit Equipment'}</h3>
              <button onClick={() => setModal(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Equipment name"
                className="w-full px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200"
              />
              <input
                value={form.assetTag}
                onChange={e => setForm({ ...form, assetTag: e.target.value })}
                placeholder="Serial / asset tag (optional)"
                className="w-full px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={form.kind}
                    onChange={e => setForm({ ...form, kind: e.target.value as EquipmentKind })}
                    className="w-full px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200"
                  >
                    <option value="reusable">Reusable equipment</option>
                    <option value="consumable">Consumable stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total quantity owned</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.totalQuantity}
                    onChange={e => setForm({ ...form, totalQuantity: e.target.value })}
                    className="w-full px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200"
                    placeholder="e.g. 12"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">
                {form.kind === 'reusable'
                  ? 'Reusable: units move between the shop and trucks and are never used up. Enter how many you own in total, then assign them out.'
                  : 'Consumable: employees can mark stock as used, which removes it from the truck and from the fleet total.'}
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {modal === 'add' ? 'Starting location' : 'Assigned vehicle'}
                </label>
                <select value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })} className="w-full px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200">
                  <option value="">In shop / unassigned</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber} - {v.name}</option>)}
                </select>
                {modal === 'add' && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    All {Number(form.totalQuantity) > 1 ? Number(form.totalQuantity) : ''} units start in the shop
                    {form.vehicleId ? ' except one sent to the chosen truck' : ''}. Assign the rest per truck from the inventory list.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as EquipmentCategory })} className="px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200">
                  <option value="equipment">Equipment</option>
                  <option value="supplies">Supplies</option>
                  <option value="vehicle_condition">Vehicle condition</option>
                </select>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as EquipmentStatus })} className="px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200">
                  <option value="working">Working</option>
                  <option value="flagged">Flagged</option>
                  <option value="needs_repair">Needs repair</option>
                  <option value="being_repaired">Being repaired</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <input value={form.qrCodeToken} onChange={e => setForm({ ...form, qrCodeToken: e.target.value })} placeholder="Optional QR token/code" className="w-full px-3 min-h-12 text-sm sm:text-xs rounded-xl border border-slate-200" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="flex-1 min-h-12 rounded-xl border text-sm sm:text-xs font-bold">Cancel</button>
                <button disabled={loading} className="flex-1 min-h-12 rounded-xl bg-sky-600 text-white text-sm sm:text-xs font-bold">{loading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'delete' && selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h3 className="font-bold">Delete {selected.name}?</h3>
            <p className="text-sm sm:text-xs text-slate-500 my-3 leading-relaxed">This removes the inventory record and its assignments.</p>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 min-h-12 rounded-xl border text-sm sm:text-xs font-bold">Cancel</button>
              <button onClick={remove} disabled={loading} className="flex-1 min-h-12 rounded-xl bg-rose-600 text-white text-sm sm:text-xs font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
