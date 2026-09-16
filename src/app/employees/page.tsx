'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  RefreshCw,
  MoreHorizontal
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
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const detailMenuRef = useRef<HTMLDivElement | null>(null);
  const detailMenuBtnRef = useRef<HTMLButtonElement | null>(null);

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
    setDetailMenuOpen(false);
  }, [selectedUser?.id]);

  useLayoutEffect(() => {
    if (!detailMenuOpen || !detailMenuBtnRef.current || !detailMenuRef.current) return;
    const btn = detailMenuBtnRef.current;
    const menu = detailMenuRef.current;
    const rect = btn.getBoundingClientRect();
    const mh = menu.offsetHeight || 140;
    const mw = menu.offsetWidth || 192;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < mh && rect.top > spaceBelow;
    const top = openUp ? rect.top - gap - mh : rect.bottom + gap;
    let left = rect.right - mw;
    left = Math.min(Math.max(8, left), window.innerWidth - mw - 8);
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${left}px`;
  }, [detailMenuOpen]);

  useEffect(() => {
    if (!detailMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (detailMenuRef.current?.contains(t)) return;
      if (detailMenuBtnRef.current?.contains(t)) return;
      setDetailMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailMenuOpen(false);
    };
    const onRepositionClose = () => setDetailMenuOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onRepositionClose, true);
    window.addEventListener('resize', onRepositionClose);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onRepositionClose, true);
      window.removeEventListener('resize', onRepositionClose);
    };
  }, [detailMenuOpen]);

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.email && e.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
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
      email: target.email || '',
      role: target.role,
      status: target.status,
      avatarUrl: target.avatarUrl || '',
      passcode: target.passcode || dbService.generateUniquePasscode()
    });
    setIsEditModalOpen(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please provide a name');
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
        email: formData.email.trim() || undefined,
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
                      ? 'bg-[var(--info-wash)] border border-line'
                      : 'bg-[var(--surface-alt)] border border-line hover:bg-[var(--idle-wash)]/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getResolvedAvatarUrl(emp)}
                      alt={emp.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
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
                          emp.status === 'active' ? 'text-[var(--ok)]' : 'text-ink-faint'
                        }`}>
                          {emp.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {assignedVan && (
                      <span className="badge" data-status="info">
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
              <div className="card card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={getResolvedAvatarUrl(selectedUser)}
                    alt={selectedUser.name}
                    className="w-16 h-16 rounded-2xl object-cover shrink-0"
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
                      <span className="badge capitalize" data-status={selectedUser.status === 'active' ? 'ok' : 'idle'}>
                        {selectedUser.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-1">{selectedUser.email}</p>
                    <p className="text-xs text-ink-faint mt-1">
                      {userInspections.length} inspection{userInspections.length === 1 ? '' : 's'} · {userIssues.length} issue{userIssues.length === 1 ? '' : 's'}
                    </p>
                    
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
                            {codeCopied ? <Check className="w-3.5 h-3.5 text-[var(--ok)]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(selectedUser)}
                          title="No access code set — assign one"
                          aria-label="No access code set, assign one"
                          className="p-1.5 rounded-lg text-ink-faint hover:text-ink-muted hover:bg-[var(--idle-wash)] transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
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

                    {currentAssignedVehicle && (
                    <div className="mt-2 text-xs font-semibold text-ink-muted">
                      On van:{' '}
                      <Link
                        href={`/vehicles/detail?id=${encodeURIComponent(currentAssignedVehicle.id)}`}
                        className="text-[var(--info)] font-bold hover:underline"
                      >
                        {currentAssignedVehicle.vehicleNumber} ({currentAssignedVehicle.licensePlate})
                      </Link>
                    </div>
                    )}
                  </div>
                </div>

                <div className="relative pt-3 sm:pt-0 shrink-0">
                  <button
                    type="button"
                    ref={detailMenuBtnRef}
                    className="btn btn-ghost btn-sm"
                    aria-haspopup="menu"
                    aria-expanded={detailMenuOpen}
                    aria-label={`More actions for ${selectedUser.name}`}
                    onClick={() => setDetailMenuOpen((open) => !open)}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                    More
                  </button>
                  {detailMenuOpen && createPortal(
                    <div
                      ref={detailMenuRef}
                      role="menu"
                      className="fixed z-[80] min-w-[12rem] rounded-[var(--radius)] border border-line bg-surface shadow-lg p-1 stack-tight"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="btn btn-ghost btn-sm w-full justify-start gap-2"
                        onClick={() => { handleToggleStatus(selectedUser); setDetailMenuOpen(false); }}
                      >
                        {selectedUser.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {selectedUser.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="btn btn-ghost btn-sm w-full justify-start gap-2"
                        onClick={() => { handleOpenEdit(selectedUser); setDetailMenuOpen(false); }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="btn btn-ghost btn-sm w-full justify-start gap-2 text-[var(--critical)]"
                        onClick={() => { setIsDeleteModalOpen(true); setDetailMenuOpen(false); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              </div>

              <div className="card card-pad stack">
                <h3 className="eyebrow mb-0 px-0">
                  History
                </h3>

                <div className="-mx-4 sm:-mx-5">
                  {userInspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="px-4 sm:px-5 py-2.5 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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

                      <Link
                        href={`/vehicles/detail?id=${encodeURIComponent(insp.vehicleId)}`}
                        className="text-xs font-medium text-ink-muted hover:text-ink flex items-center gap-1 self-end sm:self-auto"
                      >
                        <span>View van</span>
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
                  Email Address <span className="text-ink-faint">(optional)</span>
                </label>
                <input
                  type="email"
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
                  Email Address <span className="text-ink-faint">(optional)</span>
                </label>
                <input
                  type="email"
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
