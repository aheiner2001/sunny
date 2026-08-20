'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  ShieldCheck,
  ArrowRight,
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  User as UserIcon,
  X,
  Plus
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { User, UserRole, Inspection, Issue, Vehicle } from '@/types';
import { InspectionStatusBadge, VehicleStatusBadge } from '@/components/StatusBadges';
import { useAuth } from '@/context/AuthContext';

export default function EmployeesPage() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    status: 'active' | 'inactive';
    avatarUrl: string;
  }>({
    name: '',
    email: '',
    role: 'employee',
    status: 'active',
    avatarUrl: ''
  });

  const loadData = () => {
    const userList = dbService.getUsers();
    setEmployees(userList);
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
    setVehicles(dbService.getVehicles());

    if (userList.length > 0) {
      setSelectedUser(prev => {
        if (!prev) return userList[0];
        const stillExists = userList.find(u => u.id === prev.id);
        return stillExists || userList[0];
      });
    } else {
      setSelectedUser(null);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const userInspections = selectedUser ? inspections.filter(i => i.userId === selectedUser.id || i.userName === selectedUser.name) : [];
  const userIssues = selectedUser ? issues.filter(iss => iss.reportedById === selectedUser.id || iss.reportedByName === selectedUser.name) : [];
  const currentAssignedVehicle = selectedUser ? vehicles.find(v => v.currentUserId === selectedUser.id || v.currentUserName === selectedUser.name) : undefined;

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      role: 'employee',
      status: 'active',
      avatarUrl: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (target: User) => {
    setFormData({
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status,
      avatarUrl: target.avatarUrl || ''
    });
    setIsEditModalOpen(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Please provide name and email');
      return;
    }
    try {
      setModalLoading(true);
      const created = await dbService.createUser({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        avatarUrl: formData.avatarUrl
      });
      setSelectedUser(created);
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create employee');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setModalLoading(true);
      const updated = await dbService.updateUser({
        ...selectedUser,
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        status: formData.status,
        avatarUrl: formData.avatarUrl.trim() || selectedUser.avatarUrl
      });
      setSelectedUser(updated);
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update employee');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async (target: User) => {
    try {
      const nextStatus = target.status === 'active' ? 'inactive' : 'active';
      const updated = await dbService.updateUser({
        ...target,
        status: nextStatus
      });
      if (selectedUser?.id === target.id) {
        setSelectedUser(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedUser) return;
    try {
      setModalLoading(true);
      await dbService.deleteUser(selectedUser.id);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete employee');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Employee Directory & Roles</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage team members, permissions, active statuses, and trace vehicle operational history.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee / Manager</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List (1 col) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Staff Members ({filteredEmployees.length})
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedUser?.id === emp.id;
              const assignedVan = vehicles.find(v => v.currentUserId === emp.id || v.currentUserName === emp.name);

              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedUser(emp)}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-50 border border-sky-300 shadow-sm'
                      : 'bg-slate-50/70 border border-slate-100 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {emp.avatarUrl ? (
                      <img
                        src={emp.avatarUrl}
                        alt={emp.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center ring-2 ring-white shadow-sm shrink-0">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-sky-900' : 'text-slate-900'}`}>
                          {emp.name}
                        </h3>
                        {emp.role === 'manager' && (
                          <Shield className="w-3 h-3 text-sky-600 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 capitalize">{emp.role}</span>
                        <span className="text-slate-300">•</span>
                        <span className={`text-[10px] font-semibold ${
                          emp.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {emp.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {assignedVan && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {assignedVan.vehicleNumber}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                No employees match your search.
              </div>
            )}
          </div>
        </div>

        {/* Selected Employee History Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUser ? (
            <>
              {/* Employee Profile Header Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {selectedUser.avatarUrl ? (
                    <img
                      src={selectedUser.avatarUrl}
                      alt={selectedUser.name}
                      className="w-16 h-16 rounded-2xl object-cover ring-4 ring-sky-500/20 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center ring-4 ring-sky-500/20 shadow-md shrink-0">
                      <UserIcon className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-extrabold text-slate-900">{selectedUser.name}</h2>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border capitalize flex items-center gap-1 ${
                        selectedUser.role === 'manager' 
                          ? 'text-sky-700 bg-sky-50 border-sky-200' 
                          : 'text-slate-700 bg-slate-100 border-slate-200'
                      }`}>
                        {selectedUser.role === 'manager' && <Shield className="w-3 h-3 text-sky-600" />}
                        {selectedUser.role}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border capitalize ${
                        selectedUser.status === 'active'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-slate-500 bg-slate-50 border-slate-200'
                      }`}>
                        {selectedUser.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{selectedUser.email}</p>
                    
                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      Currently Operating:{' '}
                      {currentAssignedVehicle ? (
                        <Link
                          href={`/vehicles/detail?id=${encodeURIComponent(currentAssignedVehicle.id)}`}
                          className="text-sky-600 font-bold hover:underline"
                        >
                          {currentAssignedVehicle.vehicleNumber} ({currentAssignedVehicle.licensePlate})
                        </Link>
                      ) : (
                        <span className="text-slate-400 font-normal">None (Off Route)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Management Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <button
                    onClick={() => handleToggleStatus(selectedUser)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      selectedUser.status === 'active'
                        ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title={selectedUser.status === 'active' ? 'Set Inactive' : 'Set Active'}
                  >
                    {selectedUser.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-emerald-600" />}
                    <span>{selectedUser.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(selectedUser)}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Stats & History Log */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">{userInspections.length}</div>
                    <div className="text-xs font-semibold text-slate-400">Total Inspections</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">{userIssues.length}</div>
                    <div className="text-xs font-semibold text-slate-400">Issues Reported</div>
                  </div>
                </div>
              </div>

              {/* Vehicle Usage & Inspection Log */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Vehicle Usage History & Submissions
                </h3>

                <div className="space-y-3">
                  {userInspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/vehicles/detail?id=${encodeURIComponent(insp.vehicleId)}`}
                              className="text-xs font-bold text-slate-900 hover:text-sky-600"
                            >
                              {insp.vehicleNumber}
                            </Link>
                            <InspectionStatusBadge status={insp.status} />
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(insp.submittedAt).toLocaleDateString()} at {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/vehicles/detail?id=${encodeURIComponent(insp.vehicleId)}`}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 self-end sm:self-auto"
                      >
                        <span>View Van</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}

                  {userInspections.length === 0 && (
                    <p className="text-xs text-slate-400 py-4 text-center">No inspection records logged for this employee yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-700">No employee selected</h3>
              <p className="text-xs text-slate-400 mt-1">Select an employee from the list or add a new team member.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Add New Team Member</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex@sunnyfleet.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="employee">Employee (Driver)</option>
                    <option value="manager">Manager (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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
                  {modalLoading ? 'Creating...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Member Details</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
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
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold"
                  >
                    <option value="active">Active</option>
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
                  {modalLoading ? 'Saving...' : 'Update Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Delete Team Member</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to remove <strong>{selectedUser.name}</strong> ({selectedUser.email})? This action cannot be undone.
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
                onClick={handleDeleteEmployee}
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
