'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Truck, 
  Search, 
  Filter, 
  QrCode, 
  ArrowRight, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, VehicleStatus, EquipmentOption } from '@/types';
import { VehicleStatusBadge, InspectionStatusBadge } from '@/components/StatusBadges';
import { QRScannerModal } from '@/components/QRScannerModal';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Common standard equipment options
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([
    'Air Compressor 200 PSI',
    'Pressure Washer',
    'Vacuum Extractor'
  ]);
  const [customEquipment, setCustomEquipment] = useState('');

  // Form states
  const [formData, setFormData] = useState<{
    vehicleNumber: string;
    name: string;
    licensePlate: string;
    qrCodeToken: string;
    status: VehicleStatus;
  }>({
    vehicleNumber: '',
    name: '',
    licensePlate: '',
    qrCodeToken: '',
    status: 'active',
  });

  const loadData = () => {
    setVehicles(dbService.getVehicles());
    setEquipmentOptions(dbService.getEquipmentOptions());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = 
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.currentUserName && v.currentUserName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    const nextNum = vehicles.length + 1;
    setFormData({
      vehicleNumber: `Van #${nextNum}`,
      name: 'Ford Transit 250 - Detailing Rig',
      licensePlate: `${nextNum}U${Math.floor(Math.random() * 9 + 1)}-SUN`,
      qrCodeToken: `van-${nextNum}`,
      status: 'active',
    });
    setSelectedEquipment(equipmentOptions.slice(0, 3).map(option => option.name));
    setCustomEquipment('');
    setIsAddModalOpen(true);
  };

  const toggleEquipmentOption = (item: string) => {
    setSelectedEquipment(prev => 
      prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
    );
  };

  const handleOpenEdit = (v: Vehicle) => {
    setSelectedVehicle(v);
    setFormData({
      vehicleNumber: v.vehicleNumber,
      name: v.name,
      licensePlate: v.licensePlate,
      qrCodeToken: v.qrCodeToken,
      status: v.status,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (v: Vehicle) => {
    setSelectedVehicle(v);
    setIsDeleteModalOpen(true);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleNumber.trim() || !formData.name.trim() || !formData.licensePlate.trim()) {
      alert('Please fill out all required vehicle fields.');
      return;
    }

    try {
      setModalLoading(true);
      
      // Combine checked equipment + any extra custom comma-separated items
      const extraItems = customEquipment
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      const allEquipment = Array.from(new Set([...selectedEquipment, ...extraItems]));

      await dbService.createVehicle(
        {
          vehicleNumber: formData.vehicleNumber,
          name: formData.name,
          licensePlate: formData.licensePlate,
          qrCodeToken: formData.qrCodeToken || formData.vehicleNumber.toLowerCase().replace(/\s+/g, '-'),
          status: formData.status
        },
        allEquipment
      );

      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error creating vehicle');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    try {
      setModalLoading(true);
      await dbService.updateVehicle({
        ...selectedVehicle,
        vehicleNumber: formData.vehicleNumber.trim(),
        name: formData.name.trim(),
        licensePlate: formData.licensePlate.trim().toUpperCase(),
        qrCodeToken: formData.qrCodeToken.trim() || selectedVehicle.qrCodeToken,
        status: formData.status
      });

      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error updating vehicle');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!selectedVehicle) return;

    try {
      setModalLoading(true);
      await dbService.deleteVehicle(selectedVehicle.id);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error deleting vehicle');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fleet Vehicles</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage fleet vehicles, create new vans, print QR badges, and track maintenance history.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>

          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-colors"
          >
            <QrCode className="w-4 h-4 text-sky-600" />
            <span>Scan Vehicle QR</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search van number, name, plate, driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'in_use', 'active', 'maintenance'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
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

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => {
          const equipment = dbService.getEquipmentForVehicle(vehicle.id);
          const flaggedEqCount = equipment.filter(e => e.status !== 'working' && e.status !== 'fixed').length;

          return (
            <div
              key={vehicle.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">{vehicle.vehicleNumber}</h2>
                      <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {vehicle.licensePlate}
                      </span>
                    </div>
                  </div>
                  <VehicleStatusBadge status={vehicle.status} />
                </div>

                <p className="text-xs text-slate-600 font-medium mb-4">{vehicle.name}</p>

                {/* Driver & Inspection Info */}
                <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2 border border-slate-100 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Current Driver:</span>
                    <span className="font-bold text-slate-900">{vehicle.currentUserName || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Last Inspection:</span>
                    <InspectionStatusBadge status={vehicle.lastInspectionStatus} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Equipment Health:</span>
                    {flaggedEqCount > 0 ? (
                      <span className="text-amber-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        {flaggedEqCount} Flagged
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        All {equipment.length} Working
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/inspect?id=${encodeURIComponent(vehicle.id)}`}
                    className="flex-1 py-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-xs text-center transition-colors"
                  >
                    Inspect
                  </Link>
                  <Link
                    href={`/vehicles/detail?id=${encodeURIComponent(vehicle.id)}`}
                    className="flex-1 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs text-center transition-colors flex items-center justify-center gap-1 group"
                  >
                    <span>Vehicle Details</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    onClick={() => handleOpenEdit(vehicle)}
                    className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Van</span>
                  </button>
                  <button
                    onClick={() => handleOpenDelete(vehicle)}
                    className="px-2.5 py-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">No vehicles match filter</h3>
          <p className="text-xs text-slate-400 mt-1">Create your first fleet vehicle or adjust search filters.</p>
        </div>
      )}

      {/* CREATE VEHICLE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Add New Fleet Vehicle</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Number / Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Van #2 or Rig Alpha"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    License Plate
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 4X2-SUN"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Model / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ford Transit 250 - Ceramic Rig"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    QR Token Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. van-2"
                    value={formData.qrCodeToken}
                    onChange={(e) => setFormData({ ...formData, qrCodeToken: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="active">Active (Available)</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Quick Select Initial Equipment Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Initial Equipment (Select all that apply)
                  </label>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                    {selectedEquipment.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 max-h-44 overflow-y-auto">
                  {equipmentOptions.map((option) => {
                    const item = option.name;
                    const isChecked = selectedEquipment.includes(item);
                    return (
                      <label
                        key={item}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEquipmentOption(item)}
                          className="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                        />
                        <span className="truncate">{item}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Additional Custom Equipment Input */}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Add other custom gear (comma-separated)..."
                    value={customEquipment}
                    onChange={(e) => setCustomEquipment(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selected equipment records will automatically be provisioned and assigned to this vehicle.
                </p>
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
                  {modalLoading ? 'Saving...' : 'Create Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VEHICLE MODAL */}
      {isEditModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Fleet Vehicle</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Number / Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    License Plate
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Model / Description
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    QR Token Identifier
                  </label>
                  <input
                    type="text"
                    value={formData.qrCodeToken}
                    onChange={(e) => setFormData({ ...formData, qrCodeToken: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="active">Active (Available)</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
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
                  {modalLoading ? 'Saving...' : 'Update Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE VEHICLE MODAL */}
      {isDeleteModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Delete Vehicle</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to permanently delete <strong>{selectedVehicle.vehicleNumber}</strong> ({selectedVehicle.licensePlate}) and clean up its records?
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
                onClick={handleDeleteVehicle}
                disabled={modalLoading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {modalLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
