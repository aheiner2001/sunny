'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wrench, 
  Search, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  ArrowRight,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, EquipmentCategory, EquipmentStatus, Vehicle } from '@/types';
import { EquipmentStatusBadge } from '@/components/StatusBadges';

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    vehicleId: string;
    category: EquipmentCategory;
    status: EquipmentStatus;
  }>({
    name: '',
    vehicleId: '',
    category: 'equipment',
    status: 'working'
  });

  const loadData = () => {
    const eqList = dbService.getEquipment();
    const vList = dbService.getVehicles();
    setEquipment(eqList);
    setVehicles(vList);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch =
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || eq.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || eq.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      vehicleId: vehicles.length > 0 ? vehicles[0].id : '',
      category: 'equipment',
      status: 'working'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (eq: Equipment) => {
    setSelectedEq(eq);
    setFormData({
      name: eq.name,
      vehicleId: eq.vehicleId,
      category: eq.category,
      status: eq.status
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (eq: Equipment) => {
    setSelectedEq(eq);
    setIsDeleteModalOpen(true);
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.vehicleId) {
      alert('Please enter equipment name and assign a vehicle.');
      return;
    }

    try {
      setModalLoading(true);
      await dbService.createEquipment({
        name: formData.name,
        vehicleId: formData.vehicleId,
        category: formData.category,
        status: formData.status
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error creating equipment');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq) return;
    if (!formData.name.trim() || !formData.vehicleId) {
      alert('Please enter equipment name and assign a vehicle.');
      return;
    }

    try {
      setModalLoading(true);
      await dbService.updateEquipment({
        ...selectedEq,
        name: formData.name.trim(),
        vehicleId: formData.vehicleId,
        category: formData.category,
        status: formData.status
      });
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error updating equipment');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!selectedEq) return;
    try {
      setModalLoading(true);
      await dbService.deleteEquipment(selectedEq.id);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error deleting equipment');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Equipment & Tools Inventory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage fleet tools, reassign gear to detailing vehicles, and monitor maintenance condition.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Equipment</span>
          </button>

          <Link
            href="/issues"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Flagged Issues</span>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search equipment, van, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {['all', 'working', 'flagged', 'needs_repair', 'being_repaired', 'fixed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEquipment.map((eq) => (
          <div
            key={eq.id}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{eq.name}</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {eq.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <EquipmentStatusBadge status={eq.status} />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-xs flex items-center justify-between border border-slate-100 mb-3">
                <span className="text-slate-500">Dedicated Van:</span>
                <Link
                  href={`/vehicles/detail?id=${encodeURIComponent(eq.vehicleId)}`}
                  className="font-bold text-sky-600 hover:underline flex items-center gap-1"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>{eq.vehicleNumber}</span>
                </Link>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(eq)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Edit / Reassign Equipment"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleOpenDelete(eq)}
                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                  title="Delete Equipment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <Link
                href={`/vehicles/detail?id=${encodeURIComponent(eq.vehicleId)}`}
                className="font-bold text-slate-700 hover:text-sky-600 flex items-center gap-1"
              >
                <span>Van History</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredEquipment.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">No equipment found</h3>
          <p className="text-xs text-slate-400 mt-1">Add your first equipment piece or adjust search filters.</p>
        </div>
      )}

      {/* ADD EQUIPMENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Add Equipment / Tool</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Equipment / Tool Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heated Carpet Extractor"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assign to Fleet Vehicle
                </label>
                <select
                  required
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold"
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} - {v.name} ({v.licensePlate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as EquipmentCategory })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="equipment">Equipment</option>
                    <option value="supplies">Supplies</option>
                    <option value="vehicle_condition">Vehicle Condition</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Condition Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="working">Working</option>
                    <option value="flagged">Flagged</option>
                    <option value="needs_repair">Needs Repair</option>
                    <option value="being_repaired">Being Repaired</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50"
                >
                  {modalLoading ? 'Creating...' : 'Save Equipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT & REASSIGN MODAL */}
      {isEditModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Edit / Reassign Equipment</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEquipment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Equipment Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reassign to Vehicle
                </label>
                <select
                  required
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} - {v.name} ({v.licensePlate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as EquipmentCategory })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="equipment">Equipment</option>
                    <option value="supplies">Supplies</option>
                    <option value="vehicle_condition">Vehicle Condition</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Condition Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="working">Working</option>
                    <option value="flagged">Flagged</option>
                    <option value="needs_repair">Needs Repair</option>
                    <option value="being_repaired">Being Repaired</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : 'Update Equipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Delete Equipment</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to remove <strong>{selectedEq.name}</strong> from {selectedEq.vehicleNumber}?
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEquipment}
                disabled={modalLoading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {modalLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

