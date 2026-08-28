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
  X,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { User, UserRole, Inspection, Issue, Vehicle } from '@/types';
import { InspectionStatusBadge, VehicleStatusBadge } from '@/components/StatusBadges';
import { useAuth } from '@/context/AuthContext';
import { getResolvedAvatarUrl } from '@/lib/avatarPresets';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

const HOUR_MS = 60 * 60 * 1000;
const GRANT_PRESETS = [
  { label: '4h', ms: 4 * HOUR_MS },
  { label: '8h', ms: 8 * HOUR_MS },
  { label: '24h', ms: 24 * HOUR_MS },
  { label: '7d', ms: 7 * 24 * HOUR_MS }
];

export default function EmployeesPage() {
  return (
    <ManagerOnly requireTrueManager>
      <EmployeesPageContent />
    </ManagerOnly>
  );
}

function EmployeesPageContent() {
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

  // Reveals the selected member's access code on demand; resets per selection.
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    status: 'active' | 'inactive';
    avatarUrl: string;
    passcode: string;
  }>({
    name: '',
    email: '',
    role: 'employee',
    status: 'active',
    avatarUrl: '',
    passcode: ''
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

  // Never carry a revealed code across to another member.
  useEffect(() => {
    setCodeRevealed(false);
    setCodeCopied(false);
  }, [selectedUser?.id]);

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const userInspections = selectedUser ? inspections.filter(i => i.userId === selectedUser.id || i.userName === selectedUser.name) : [];
  const userIssues = selectedUser ? issues.filter(iss => iss.reportedById === selectedUser.id || iss.reportedByName === selectedUser.name) : [];
  const currentAssignedVehicle = selectedUser ? vehicles.find(v => v.currentUserId === selectedUser.id || v.currentUserName === selectedUser.name) : undefined;

  /** Shared rule for both modals: 4-6 digits, unique across the directory. */
  const validatePasscode = (code: string, exceptUserId?: string): string | null => {
    const trimmed = code.trim();
    if (!/^\d{4,6}$/.test(trimmed)) return 'Passcode must be 4 to 6 digits.';
    const conflict = dbService.findPasscodeConflict(trimmed, exceptUserId);
    if (conflict) return `Passcode ${trimmed} is already assigned to ${conflict.name}.`;
    return null;
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      role: 'employee',
      status: 'active',
      avatarUrl: '',
      passcode: dbService.generateUniquePasscode()
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (target: User) => {
    setFormData({
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status,
      avatarUrl: target.avatarUrl || '',
      passcode: target.passcode || dbService.generateUniquePasscode()
    });
    setIsEditModalOpen(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Please provide name and email');
      return;
    }
    const codeError = validatePasscode(formData.passcode);
    if (codeError) {
      alert(codeError);
      return;
    }
    try {
      setModalLoading(true);
      const created = await dbService.createUser({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        avatarUrl: formData.avatarUrl,
        passcode: formData.passcode.trim()
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
    const codeError = validatePasscode(formData.passcode, selectedUser.id);
    if (codeError) {
      alert(codeError);
      return;
    }
    try {
      setModalLoading(true);
      const updated = await dbService.updateUser({
        ...selectedUser,
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        status: formData.status,
        avatarUrl: formData.avatarUrl.trim() || selectedUser.avatarUrl,
        passcode: formData.passcode.trim()
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

  const handleGrantAdmin = async (durationMs: number) => {
    if (!currentUser || !selectedUser) return;
    try {
      const updated = await dbService.grantTemporaryManager(currentUser, selectedUser.id, durationMs);
      setSelectedUser(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to grant admin access');
    }
  };

  const handleRevokeAdmin = async () => {
    if (!currentUser || !selectedUser) return;
    try {
      const updated = await dbService.revokeTemporaryManager(currentUser, selectedUser.id);
      setSelectedUser(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke admin access');
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
    <div className="page">
      <PageHeader
        title="Employee Directory & Roles"
        subtitle="Manage team members, permissions, active statuses, and trace vehicle operational history."
        actions={
          <button type="button" onClick={handleOpenAdd} className="btn btn-primary">
            <UserPlus className="h-4 w-4" aria-hidden />
            Add Employee / Manager
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List (1 col) */}
        <div className="card card-pad stack">
          <div className="flex items-center justify-between">
            <span className="eyebrow mb-0">
              Staff Members ({filteredEmployees.length})
            </span>
          </div>

          <div className="field">
            <label className="label sr-only" htmlFor="employees-search">
              Search employees
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                id="employees-search"
                type="search"
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9"
              />
            </div>
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
                      ? 'ring-2 ring-ink bg-[var(--info-wash)] border border-line-strong'
                      : 'bg-[var(--surface-alt)] border border-line hover:bg-[var(--idle-wash)]/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getResolvedAvatarUrl(emp)}
                      alt={emp.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-surface shadow-sm shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-ink' : 'text-ink'}`}>
                          {emp.name}
                        </h3>
                        {emp.role === 'manager' && (
                          <Shield className="w-3 h-3 text-[var(--info)] shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-ink-faint capitalize">{emp.role}</span>
                        <span className="text-ink-faint">•</span>
                        <span className={`text-[10px] font-semibold ${
                          emp.status === 'active' ? 'text-emerald-600' : 'text-ink-faint'
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
              <EmptyState
                icon={<Users className="h-10 w-10 text-ink-faint" aria-hidden />}
                title="No employees match your search"
              >
                Try a different search term or add a new team member.
              </EmptyState>
            )}
          </div>
        </div>

        {/* Selected Employee History Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUser ? (
            <>
              {/* Employee Profile Header Card */}
              <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={getResolvedAvatarUrl(selectedUser)}
                    alt={selectedUser.name}
                    className="w-16 h-16 rounded-2xl object-cover ring-4 ring-ink/20 shadow-md shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-extrabold text-ink">{selectedUser.name}</h2>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border capitalize flex items-center gap-1 ${
                        selectedUser.role === 'manager' 
                          ? 'text-ink bg-[var(--info-wash)] border-line' 
                          : 'text-ink-muted bg-[var(--idle-wash)] border-line'
                      }`}>
                        {selectedUser.role === 'manager' && <Shield className="w-3 h-3 text-[var(--info)]" />}
                        {selectedUser.role}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border capitalize ${
                        selectedUser.status === 'active'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-ink-muted bg-[var(--surface-alt)] border-line'
                      }`}>
                        {selectedUser.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-1">{selectedUser.email}</p>
                    
                    {/* Access passcode: masked until revealed, so an open
                        directory does not broadcast every sign-in code. */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">
                        Access Code
                      </span>
                      {selectedUser.passcode ? (
                        <>
                          <code className="text-xs font-bold text-ink bg-[var(--idle-wash)] border border-line rounded-lg px-2 py-1 tracking-[0.2em] min-w-[68px] text-center">
                            {codeRevealed ? selectedUser.passcode : '••••'}
                          </code>
                          <button
                            onClick={() => setCodeRevealed(!codeRevealed)}
                            title={codeRevealed ? 'Hide code' : 'Reveal code'}
                            aria-label={codeRevealed ? 'Hide access code' : 'Reveal access code'}
                            className="p-1.5 rounded-lg text-ink-faint hover:text-ink-muted hover:bg-[var(--idle-wash)] transition-colors"
                          >
                            {codeRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(selectedUser.passcode || '');
                              setCodeCopied(true);
                              setTimeout(() => setCodeCopied(false), 1500);
                            }}
                            title="Copy code"
                            aria-label="Copy access code"
                            className="p-1.5 rounded-lg text-ink-faint hover:text-ink-muted hover:bg-[var(--idle-wash)] transition-colors"
                          >
                            {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenEdit(selectedUser)}
                          className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 hover:bg-amber-100 transition-colors"
                        >
                          No code set — assign one
                        </button>
                      )}
                    </div>

                    {/* Temporary admin cover. Managers already have the rights,
                        so the control only appears for employee accounts. */}
                    {selectedUser.role === 'employee' && (
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        {dbService.hasActiveManagerGrant(selectedUser) ? (
                          <>
                            <span className="text-[11px] font-bold text-ink bg-[var(--info-wash)] border border-line rounded-lg px-2 py-1 flex items-center gap-1.5">
                              <Shield className="w-3 h-3 text-[var(--info)]" />
                              Admin until {new Date(selectedUser.tempManagerUntil as string).toLocaleString([], {
                                weekday: 'short',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </span>
                            <button
                              onClick={handleRevokeAdmin}
                              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                            >
                              Revoke
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">
                              Grant Admin
                            </span>
                            {GRANT_PRESETS.map(preset => (
                              <button
                                key={preset.label}
                                onClick={() => handleGrantAdmin(preset.ms)}
                                className="btn btn-secondary btn-sm text-[11px]"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    <div className="mt-2 text-xs font-semibold text-ink-muted">
                      Currently Operating:{' '}
                      {currentAssignedVehicle ? (
                        <Link
                          href={`/vehicles/detail?id=${encodeURIComponent(currentAssignedVehicle.id)}`}
                          className="text-[var(--info)] font-bold hover:underline"
                        >
                          {currentAssignedVehicle.vehicleNumber} ({currentAssignedVehicle.licensePlate})
                        </Link>
                      ) : (
                        <span className="text-ink-faint font-normal">None (Off Route)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Management Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-line">
                  <button
                    onClick={() => handleToggleStatus(selectedUser)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      selectedUser.status === 'active'
                        ? 'border-line text-ink-muted hover:bg-[var(--surface-alt)]'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title={selectedUser.status === 'active' ? 'Set Inactive' : 'Set Active'}
                  >
                    {selectedUser.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-emerald-600" />}
                    <span>{selectedUser.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(selectedUser)}
                    className="p-2.5 rounded-xl bg-[var(--idle-wash)] hover:bg-[var(--surface-alt)] text-ink-muted font-bold text-xs flex items-center gap-1.5 transition-colors"
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
                <div className="bg-surface rounded-2xl p-5 border border-line shadow-sm flex items-center gap-4">
                  <span className="icon-tile" data-status="info" aria-hidden>
                    <CheckCircle2 className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="text-2xl font-extrabold text-ink">{userInspections.length}</div>
                    <div className="text-xs font-semibold text-ink-faint">Total Inspections</div>
                  </div>
                </div>

                <div className="bg-surface rounded-2xl p-5 border border-line shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-ink">{userIssues.length}</div>
                    <div className="text-xs font-semibold text-ink-faint">Issues Reported</div>
                  </div>
                </div>
              </div>

              {/* Vehicle Usage & Inspection Log */}
              <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-sm space-y-6">
                <h3 className="text-base font-bold text-ink border-b border-line pb-3">
                  Vehicle Usage History & Submissions
                </h3>

                <div className="space-y-3">
                  {userInspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="p-4 rounded-2xl border border-line bg-[var(--surface-alt)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-ink-muted font-bold">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/vehicles/detail?id=${encodeURIComponent(insp.vehicleId)}`}
                              className="text-xs font-bold text-ink hover:text-[var(--info)]"
                            >
                              {insp.vehicleNumber}
                            </Link>
                            <InspectionStatusBadge status={insp.status} />
                          </div>
                          <span className="text-[11px] text-ink-faint">
                            {new Date(insp.submittedAt).toLocaleDateString()} at {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/vehicles/detail?id=${encodeURIComponent(insp.vehicleId)}`}
                        className="text-xs font-bold text-[var(--info)] hover:text-ink flex items-center gap-1 self-end sm:self-auto"
                      >
                        <span>View Van</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}

                  {userInspections.length === 0 && (
                    <p className="text-xs text-ink-faint py-4 text-center">No inspection records logged for this employee yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card card-pad">
              <EmptyState
                icon={<Users className="h-12 w-12 text-ink-faint" aria-hidden />}
                title="No employee selected"
              >
                Select an employee from the list or add a new team member.
              </EmptyState>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-line animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[var(--info)]" />
                <h3 className="text-base font-bold text-ink">Add New Team Member</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-ink-faint hover:text-ink-muted p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line focus:ring-2  focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex@sunnyfleet.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line focus:ring-2  focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface focus:ring-2  focus:outline-none"
                  >
                    <option value="employee">Employee (Driver)</option>
                    <option value="manager">Manager (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface focus:ring-2  focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--info)]" />
                  Access Passcode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="4-6 digits"
                    value={formData.passcode}
                    onChange={(e) => setFormData({ ...formData, passcode: e.target.value.replace(/\D/g, '') })}
                    className="flex-1 px-3 py-2 text-xs font-bold tracking-[0.2em] rounded-xl border border-line focus:ring-2  focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, passcode: dbService.generateUniquePasscode() })}
                    title="Generate a new unused code"
                    className="px-3 rounded-xl border border-line text-ink-muted hover:bg-[var(--surface-alt)] hover:text-ink-muted transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint mt-1">
                  {formData.role === 'manager'
                    ? 'This code signs in with full manager permissions.'
                    : 'The employee enters this code to sign in and scan.'}
                </p>
              </div>

              <div className="pt-3 border-t border-line flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-line text-ink-muted font-bold text-xs hover:bg-[var(--surface-alt)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 py-2.5 rounded-xl btn btn-primary disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-line animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[var(--info)]" />
                <h3 className="text-base font-bold text-ink">Edit Member Details</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-ink-faint hover:text-ink-muted p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line focus:ring-2  focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line focus:ring-2  focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface focus:ring-2  focus:outline-none font-semibold"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface focus:ring-2  focus:outline-none font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--info)]" />
                  Access Passcode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="4-6 digits"
                    value={formData.passcode}
                    onChange={(e) => setFormData({ ...formData, passcode: e.target.value.replace(/\D/g, '') })}
                    className="flex-1 px-3 py-2 text-xs font-bold tracking-[0.2em] rounded-xl border border-line focus:ring-2  focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, passcode: dbService.generateUniquePasscode() })}
                    title="Generate a new unused code"
                    className="px-3 rounded-xl border border-line text-ink-muted hover:bg-[var(--surface-alt)] hover:text-ink-muted transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint mt-1">
                  Used to sign in. An already-signed-in session stays valid until it expires.
                </p>
              </div>

              <div className="pt-3 border-t border-line flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-line text-ink-muted font-bold text-xs hover:bg-[var(--surface-alt)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 py-2.5 rounded-xl btn btn-primary disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-line text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-ink mb-1">Delete Team Member</h3>
            <p className="text-xs text-ink-muted mb-6">
              Are you sure you want to remove <strong>{selectedUser.name}</strong> ({selectedUser.email})? This action cannot be undone.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-line text-ink-muted font-bold text-xs hover:bg-[var(--surface-alt)]"
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
