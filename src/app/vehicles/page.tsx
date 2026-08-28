'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  Search,
  QrCode,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, VehicleStatus, EquipmentOption } from '@/types';
import { VehicleStatusBadge, InspectionStatusBadge } from '@/components/StatusBadges';
import { QRScannerModal } from '@/components/QRScannerModal';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default function VehiclesPage() {
  return (
    <ManagerOnly>
      <VehiclesPageContent />
    </ManagerOnly>
  );
}

function VehiclesPageContent() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scannerOpen, setScannerOpen] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleteEquipmentMode, setDeleteEquipmentMode] = useState<'return_to_shop' | 'delete_associated'>('return_to_shop');

  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([
    'Air Compressor 200 PSI',
    'Pressure Washer',
    'Vacuum Extractor'
  ]);
  const [customEquipment, setCustomEquipment] = useState('');

  const [formData, setFormData] = useState<{
    vehicleNumber: string;
    name: string;
    licensePlate: string;
    qrCodeToken: string;
    status: VehicleStatus;
    imageUrl: string;
  }>({
    vehicleNumber: '',
    name: '',
    licensePlate: '',
    qrCodeToken: '',
    status: 'active',
    imageUrl: '',
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
      imageUrl: '',
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
      imageUrl: v.imageUrl || '',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (v: Vehicle) => {
    setSelectedVehicle(v);
    setDeleteEquipmentMode('return_to_shop');
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
          status: formData.status,
          imageUrl: formData.imageUrl
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
        status: formData.status,
        imageUrl: formData.imageUrl.trim() || null
      });

      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error updating vehicle');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVehicleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('Vehicle images must be PNG, JPG, or WebP files.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFormData(current => ({ ...current, imageUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const handleDeleteVehicle = async () => {
    if (!selectedVehicle) return;

    try {
      setModalLoading(true);
      await dbService.deleteVehicle(selectedVehicle.id, { equipmentMode: deleteEquipmentMode });
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error deleting vehicle');
    } finally {
      setModalLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (modalLoading) return;
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="page">
      <PageHeader
        title="Fleet Vehicles"
        subtitle="Manage fleet vehicles, create new vans, print QR badges, and track maintenance history."
        actions={
          <>
            <button type="button" onClick={handleOpenAdd} className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Add Vehicle
            </button>
            <button type="button" onClick={() => setScannerOpen(true)} className="btn btn-secondary">
              <QrCode className="h-4 w-4 text-[var(--info)]" aria-hidden />
              Scan Vehicle QR
            </button>
          </>
        }
      />

      <div className="card card-pad">
        <div className="spread flex-col sm:flex-row gap-3">
          <div className="field w-full sm:max-w-xs">
            <label className="label sr-only" htmlFor="vehicles-search">
              Search vehicles
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                id="vehicles-search"
                type="search"
                placeholder="Search van number, name, plate, driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>
          <div className="cluster w-full sm:w-auto sm:justify-end">
            {['all', 'in_use', 'active', 'maintenance'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm capitalize ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-auto">
        {filteredVehicles.map((vehicle) => {
          const vehicleEquipment = dbService.getEquipmentForVehicle(vehicle.id);
          const flaggedEqCount = vehicleEquipment.filter(e => e.status !== 'working' && e.status !== 'fixed').length;
          const cardStatus = flaggedEqCount > 0 ? 'flagged' : vehicle.status === 'maintenance' ? 'critical' : 'ok';

          return (
            <div key={vehicle.id} className="card card-pad flex flex-col justify-between" data-status={cardStatus}>
              <div className="stack-tight">
                <div className="spread items-start gap-2">
                  <div className="cluster items-start min-w-0">
                    {vehicle.imageUrl ? (
                      <img
                        src={vehicle.imageUrl}
                        alt=""
                        className="icon-tile-lg h-12 w-12 rounded-[var(--radius-lg)] object-cover"
                      />
                    ) : (
                      <span className="icon-tile icon-tile-lg" data-status="info" aria-hidden>
                        <Truck className="h-6 w-6" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="card-title">{vehicle.vehicleNumber}</h2>
                      <span className="unit-tag">{vehicle.licensePlate}</span>
                    </div>
                  </div>
                  <VehicleStatusBadge status={vehicle.status} />
                </div>

                <p className="text-sm text-ink-muted font-medium">{vehicle.name}</p>

                <div className="card card-pad bg-[var(--surface-alt)] stack-tight text-xs">
                  <div className="spread">
                    <span className="text-ink-faint font-medium">Current Driver:</span>
                    <span className="font-bold">{vehicle.currentUserName || 'Unassigned'}</span>
                  </div>
                  <div className="spread">
                    <span className="text-ink-faint font-medium">Last Inspection:</span>
                    <InspectionStatusBadge status={vehicle.lastInspectionStatus} />
                  </div>
                  <div className="spread">
                    <span className="text-ink-faint font-medium">Equipment Health:</span>
                    {flaggedEqCount > 0 ? (
                      <span className="font-bold text-[var(--amber-text)] cluster">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        {flaggedEqCount} Flagged
                      </span>
                    ) : (
                      <span className="font-bold text-[var(--ok)] cluster">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        All {vehicleEquipment.length} Working
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="card-foot">
                <div className="cluster w-full">
                  <Link
                    href={`/inspect?id=${encodeURIComponent(vehicle.id)}`}
                    className="btn btn-secondary btn-sm flex-1"
                  >
                    Inspect
                  </Link>
                  <Link
                    href={`/vehicles/detail?id=${encodeURIComponent(vehicle.id)}`}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    Vehicle Details
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
                <div className="cluster justify-end w-full pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(vehicle)}
                    className="btn btn-ghost btn-sm"
                  >
                    <Edit2 className="h-3 w-3" aria-hidden />
                    Edit Van
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(vehicle)}
                    className="btn btn-ghost btn-sm text-[var(--critical)]"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="card card-pad">
          <EmptyState
            icon={<Truck className="h-12 w-12 text-ink-faint" aria-hidden />}
            title="No vehicles match filter"
          >
            Create your first fleet vehicle or adjust search filters.
          </EmptyState>
        </div>
      )}

      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="card card-pad max-w-md w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-vehicle-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cluster mb-4 border-b border-line pb-4">
              <Truck className="h-5 w-5 text-[var(--info)]" aria-hidden />
              <h2 id="add-vehicle-title" className="card-title">Add New Fleet Vehicle</h2>
            </div>

            <form onSubmit={handleCreateVehicle} className="stack">
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label" htmlFor="add-vehicle-number">Number / Name</label>
                  <input
                    id="add-vehicle-number"
                    type="text"
                    required
                    placeholder="e.g. Van #2 or Rig Alpha"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="add-vehicle-plate">License Plate</label>
                  <input
                    id="add-vehicle-plate"
                    type="text"
                    required
                    placeholder="e.g. 4X2-SUN"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    className="input uppercase font-mono"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="add-vehicle-image">Vehicle Image</label>
                <div className="cluster">
                  {formData.imageUrl ? (
                    <img src={formData.imageUrl} alt="Vehicle preview" className="h-14 w-14 rounded-[var(--radius)] object-cover border border-line" />
                  ) : null}
                  <input
                    id="add-vehicle-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleVehicleImageUpload}
                    className="input text-xs file:mr-2 file:rounded file:border-0 file:bg-[var(--idle-wash)] file:px-3 file:py-2 file:text-xs file:font-bold"
                  />
                </div>
                <p className="hint">Saved with the vehicle record and synchronized through the existing Firebase data path.</p>
              </div>

              <div className="field">
                <label className="label" htmlFor="add-vehicle-desc">Model / Description</label>
                <input
                  id="add-vehicle-desc"
                  type="text"
                  required
                  placeholder="e.g. Ford Transit 250 - Ceramic Rig"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label" htmlFor="add-vehicle-qr">QR Token Identifier</label>
                  <input
                    id="add-vehicle-qr"
                    type="text"
                    placeholder="e.g. van-2"
                    value={formData.qrCodeToken}
                    onChange={(e) => setFormData({ ...formData, qrCodeToken: e.target.value })}
                    className="input font-mono"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="add-vehicle-status">Status</label>
                  <select
                    id="add-vehicle-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                    className="select"
                  >
                    <option value="active">Active (Available)</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <div className="spread mb-1.5">
                  <label className="label mb-0">Initial Equipment (Select all that apply)</label>
                  <span className="badge" data-status="info">{selectedEquipment.length} Selected</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 card card-pad bg-[var(--surface-alt)] max-h-44 overflow-y-auto">
                  {equipmentOptions.map((option) => {
                    const item = option.name;
                    const isChecked = selectedEquipment.includes(item);
                    return (
                      <label
                        key={item}
                        className={`cluster items-center gap-2 p-2 rounded-[var(--radius)] border text-xs font-medium cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-[var(--info)] bg-[var(--info-wash)] font-semibold'
                            : 'border-line bg-[var(--surface)] hover:bg-[var(--surface-alt)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEquipmentOption(item)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="truncate">{item}</span>
                      </label>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Add other custom gear (comma-separated)..."
                  value={customEquipment}
                  onChange={(e) => setCustomEquipment(e.target.value)}
                  className="input mt-2"
                />
                <p className="hint">
                  Selected equipment records will automatically be provisioned and assigned to this vehicle.
                </p>
              </div>

              <div className="cluster justify-end border-t border-line pt-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={modalLoading} className="btn btn-primary">
                  {modalLoading ? 'Saving...' : 'Create Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedVehicle && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="card card-pad max-w-md w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-vehicle-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cluster mb-4 border-b border-line pb-4">
              <Edit2 className="h-5 w-5 text-[var(--info)]" aria-hidden />
              <h2 id="edit-vehicle-title" className="card-title">Edit Fleet Vehicle</h2>
            </div>

            <form onSubmit={handleUpdateVehicle} className="stack">
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label" htmlFor="edit-vehicle-number">Number / Name</label>
                  <input
                    id="edit-vehicle-number"
                    type="text"
                    required
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="edit-vehicle-plate">License Plate</label>
                  <input
                    id="edit-vehicle-plate"
                    type="text"
                    required
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    className="input uppercase font-mono"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="edit-vehicle-image">Vehicle Image</label>
                <div className="cluster">
                  {formData.imageUrl ? (
                    <img src={formData.imageUrl} alt="Vehicle preview" className="h-14 w-14 rounded-[var(--radius)] object-cover border border-line" />
                  ) : null}
                  <input
                    id="edit-vehicle-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleVehicleImageUpload}
                    className="input text-xs file:mr-2 file:rounded file:border-0 file:bg-[var(--idle-wash)] file:px-3 file:py-2 file:text-xs file:font-bold"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="edit-vehicle-desc">Model / Description</label>
                <input
                  id="edit-vehicle-desc"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label" htmlFor="edit-vehicle-qr">QR Token Identifier</label>
                  <input
                    id="edit-vehicle-qr"
                    type="text"
                    value={formData.qrCodeToken}
                    onChange={(e) => setFormData({ ...formData, qrCodeToken: e.target.value })}
                    className="input font-mono"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="edit-vehicle-status">Status</label>
                  <select
                    id="edit-vehicle-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                    className="select"
                  >
                    <option value="active">Active (Available)</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="cluster justify-end border-t border-line pt-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={modalLoading} className="btn btn-primary">
                  {modalLoading ? 'Saving...' : 'Update Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && selectedVehicle && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeDeleteModal}
        >
          <div
            className="card card-pad max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-vehicle-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-center">
              <span className="icon-tile icon-tile-lg" data-status="critical" aria-hidden>
                <Trash2 className="h-6 w-6" />
              </span>
            </div>
            <h2 id="delete-vehicle-title" className="card-title text-center mb-1">
              Delete Vehicle
            </h2>
            <p className="text-sm text-ink-muted text-center mb-4">
              Are you sure you want to permanently delete <strong>{selectedVehicle.vehicleNumber}</strong>{' '}
              ({selectedVehicle.licensePlate}) and clean up its records?
            </p>

            <div className="stack-tight mb-6 text-left">
              <label className="cluster items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="deleteEquipmentMode"
                  checked={deleteEquipmentMode === 'return_to_shop'}
                  onChange={() => setDeleteEquipmentMode('return_to_shop')}
                  className="mt-0.5"
                />
                <span>
                  <strong>Return equipment to shop</strong>
                  <span className="block hint">
                    Delete the vehicle and move its assigned quantities back to global inventory.
                  </span>
                </span>
              </label>
              <label className="cluster items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="deleteEquipmentMode"
                  checked={deleteEquipmentMode === 'delete_associated'}
                  onChange={() => setDeleteEquipmentMode('delete_associated')}
                  className="mt-0.5"
                />
                <span>
                  <strong>Delete associated equipment records</strong>
                  <span className="block hint">
                    Removes catalog items that were only on this vehicle. Shared items keep other vehicles&apos; stock and only lose this van&apos;s assignment.
                  </span>
                </span>
              </label>
            </div>

            <div className="cluster justify-end">
              <button type="button" onClick={closeDeleteModal} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteVehicle()}
                disabled={modalLoading}
                className="btn btn-danger"
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
