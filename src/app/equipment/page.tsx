'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wrench, Search, AlertTriangle, Plus, Edit2, Trash2, X, QrCode, Package } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, EquipmentCategory, EquipmentKind, EquipmentStatus, Vehicle } from '@/types';
import { EquipmentStatusBadge } from '@/components/StatusBadges';
import { EquipmentQRCodeDisplay } from '@/components/EquipmentQRCodeDisplay';

const emptyForm = { name: '', vehicleId: '', category: 'equipment' as EquipmentCategory, kind: 'reusable' as EquipmentKind, status: 'working' as EquipmentStatus, totalQuantity: '1', qrCodeToken: '' };

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'equipment' | 'vehicle'>('equipment');
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const load = () => { setEquipment(dbService.getEquipment()); setVehicles(dbService.getVehicles()); };
  useEffect(() => { load(); window.addEventListener('sunny_db_update', load); return () => window.removeEventListener('sunny_db_update', load); }, []);

  const filtered = equipment.filter(eq => {
    const assignedText = (eq.assignments || []).map(a => a.vehicleNumber).join(' ') || eq.vehicleNumber || 'unassigned';
    return `${eq.name} ${assignedText} ${eq.category}`.toLowerCase().includes(searchTerm.toLowerCase())
      && (statusFilter === 'all' || eq.status === statusFilter)
      && (categoryFilter === 'all' || eq.category === categoryFilter);
  });
  const available = (eq: Equipment) => Math.max(0, eq.availableQuantity ?? ((eq.totalQuantity || 1) - (eq.assignments || []).reduce((s, a) => s + a.quantity, 0)));
  const assignmentsLabel = (eq: Equipment) => (eq.assignments || []).map(a => `${a.vehicleNumber} (${a.quantity})`).join(', ') || 'Shared / Unassigned';

  const openAdd = () => { setSelected(null); setForm({ ...emptyForm, vehicleId: '' }); setModal('add'); };
  const openEdit = (eq: Equipment) => {
    setSelected(eq);
    setForm({ name: eq.name, vehicleId: eq.assignments?.[0]?.vehicleId || eq.vehicleId || '', category: eq.category, kind: eq.kind || (eq.category === 'supplies' ? 'consumable' : 'reusable'), status: eq.status, totalQuantity: String(eq.totalQuantity || 1), qrCodeToken: eq.qrCodeToken || eq.qrCode || '' });
    setModal('edit');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const totalQuantity = Number(form.totalQuantity);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1) return alert('Total quantity must be a positive whole number.');
    const vehicle = vehicles.find(v => v.id === form.vehicleId);
    const assignments = vehicle ? [{ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, quantity: form.kind === 'reusable' ? 1 : totalQuantity }] : [];
    try {
      setLoading(true);
      if (modal === 'add') await dbService.createEquipment({ name: form.name, vehicleId: form.vehicleId || null, category: form.category, kind: form.kind, status: form.status, totalQuantity, qrCodeToken: form.qrCodeToken || null });
      if (modal === 'edit' && selected) await dbService.updateEquipment({ ...selected, name: form.name.trim(), category: form.category, kind: form.kind, status: form.status, totalQuantity, assignments, vehicleId: vehicle?.id || null, vehicleNumber: vehicle?.vehicleNumber || 'Unassigned', availableQuantity: Math.max(0, totalQuantity - assignments.reduce((s, a) => s + a.quantity, 0)), qrCodeToken: form.qrCodeToken || null, qrCode: form.qrCodeToken || null });
      setModal(null);
    } catch (err: any) { alert(err.message || 'Could not save equipment.'); } finally { setLoading(false); }
  };
  const remove = async () => { if (!selected) return; setLoading(true); await dbService.deleteEquipment(selected.id); setLoading(false); setModal(null); };

  const card = (eq: Equipment) => (
    <div key={eq.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center"><Wrench className="w-5 h-5" /></div><div><h3 className="text-xs font-bold text-slate-900">{eq.name}</h3><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{eq.kind === 'consumable' ? 'Consumable stock' : 'Reusable equipment'}</span></div></div>
        <EquipmentStatusBadge status={eq.status} />
      </div>
      <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-2 mb-3">
        <div className="flex justify-between"><span className="text-slate-500">Available stock</span><strong className="text-sky-700">{available(eq)} / {eq.totalQuantity || 1}</strong></div>
        <div className="text-slate-500">{assignmentsLabel(eq)}</div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <EquipmentQRCodeDisplay equipment={eq} />
        <div className="flex gap-1"><button onClick={() => openEdit(eq)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit / reassign"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => { setSelected(eq); setModal('delete'); }} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button></div>
      </div>
    </div>
  );

  const formModal = modal === 'add' || modal === 'edit';
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-extrabold text-slate-900">Equipment & Tools Inventory</h1><p className="text-xs text-slate-500 mt-0.5">Manage shared stock, reusable tools, assignments, and maintenance.</p></div><div className="flex gap-2"><button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs"><Plus className="w-4 h-4" />Add Equipment</button><Link href="/equipment/scan" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"><QrCode className="w-4 h-4" />Scan Equipment</Link><Link href="/issues" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs"><AlertTriangle className="w-4 h-4" />Issues</Link></div></div>
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search equipment, vehicle, category..." className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200" /></div>
        <div className="flex flex-wrap items-center gap-2"><label className="text-xs font-bold text-slate-600">View <select value={sortMode} onChange={e => setSortMode(e.target.value as any)} className="px-2 py-1.5 rounded-xl border border-slate-200"><option value="equipment">Equipment</option><option value="vehicle">Vehicle</option></select></label><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-2 py-1.5 rounded-xl border border-slate-200 text-xs"><option value="all">All categories</option><option value="equipment">Equipment</option><option value="supplies">Supplies</option><option value="vehicle_condition">Vehicle condition</option></select>{['all', 'working', 'flagged', 'needs_repair', 'being_repaired', 'fixed'].map(st => <button key={st} onClick={() => setStatusFilter(st)} className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{st.replace('_', ' ')}</button>)}</div>
      </div>
      {sortMode === 'equipment' ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(card)}</div> : <div className="space-y-3">{[{ id: 'unassigned', number: 'Shared / Unassigned', items: filtered.filter(e => !(e.assignments?.length || e.vehicleId)) }, ...vehicles.map(v => ({ id: v.id, number: v.vehicleNumber, items: filtered.filter(e => e.assignments?.some(a => a.vehicleId === v.id) || e.vehicleId === v.id) }))].filter(group => group.items.length).map(group => { const expanded = expandedVehicles[group.id] ?? true; return <div key={group.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"><button onClick={() => setExpandedVehicles(x => ({ ...x, [group.id]: !expanded }))} className="w-full flex justify-between p-4 text-left"><span><strong className="block text-sm">{group.number}</strong><span className="text-xs text-slate-500">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span></span><span className="text-xs font-bold text-sky-600">{expanded ? 'Collapse' : 'Expand'}</span></button>{expanded && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0">{group.items.map(card)}</div>}</div>; })}</div>}
      {filtered.length === 0 && <div className="bg-white rounded-3xl p-12 text-center border border-slate-200"><Package className="w-12 h-12 text-slate-300 mx-auto mb-2" /><h3 className="text-base font-bold text-slate-700">No equipment found</h3></div>}

      {formModal && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl"><div className="flex justify-between items-center mb-4"><h3 className="font-bold">{modal === 'add' ? 'Add Equipment' : 'Edit / Reassign Equipment'}</h3><button onClick={() => setModal(null)}><X className="w-5 h-5 text-slate-400" /></button></div><form onSubmit={save} className="space-y-3">
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Equipment / stock name" className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200" />
        <div className="grid grid-cols-2 gap-2"><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as EquipmentKind })} className="px-3 py-2.5 text-xs rounded-xl border border-slate-200"><option value="reusable">Reusable equipment</option><option value="consumable">Consumable stock</option></select><input type="number" min="1" step="1" value={form.totalQuantity} onChange={e => setForm({ ...form, totalQuantity: e.target.value })} className="px-3 py-2.5 text-xs rounded-xl border border-slate-200" placeholder="Total quantity" /></div>
        <select value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })} className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200"><option value="">Shared / unassigned inventory</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber} - {v.name}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as EquipmentCategory })} className="px-3 py-2.5 text-xs rounded-xl border border-slate-200"><option value="equipment">Equipment</option><option value="supplies">Supplies</option><option value="vehicle_condition">Vehicle condition</option></select><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as EquipmentStatus })} className="px-3 py-2.5 text-xs rounded-xl border border-slate-200"><option value="working">Working</option><option value="flagged">Flagged</option><option value="needs_repair">Needs repair</option><option value="being_repaired">Being repaired</option><option value="fixed">Fixed</option></select></div>
        <input value={form.qrCodeToken} onChange={e => setForm({ ...form, qrCodeToken: e.target.value })} placeholder="Optional QR token/code" className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200" />
        <div className="flex gap-2 pt-2"><button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-bold">Cancel</button><button disabled={loading} className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold">{loading ? 'Saving...' : 'Save'}</button></div>
      </form></div></div>}
      {modal === 'delete' && selected && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl"><Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-2" /><h3 className="font-bold">Delete {selected.name}?</h3><p className="text-xs text-slate-500 my-3">This removes the inventory record and its assignments.</p><div className="flex gap-2"><button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-bold">Cancel</button><button onClick={remove} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold">Delete</button></div></div></div>}
    </div>
  );
}
