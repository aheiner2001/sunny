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
  ArrowRight
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { User, Inspection, Issue, Vehicle } from '@/types';
import { INITIAL_USERS } from '@/lib/mockData';
import { InspectionStatusBadge, VehicleStatusBadge } from '@/components/StatusBadges';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<User[]>(INITIAL_USERS);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedUser, setSelectedUser] = useState<User>(INITIAL_USERS[1]); // Default John Smith
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = () => {
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
    setVehicles(dbService.getVehicles());
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

  const userInspections = inspections.filter(i => i.userId === selectedUser.id || i.userName === selectedUser.name);
  const userIssues = issues.filter(iss => iss.reportedById === selectedUser.id || iss.reportedByName === selectedUser.name);
  const currentAssignedVehicle = vehicles.find(v => v.currentUserId === selectedUser.id || v.currentUserName === selectedUser.name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Employee Accountability & Usage</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Trace vehicle usage by employee, check inspection integrity, and see driver problem reports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List (1 col) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="space-y-2">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedUser.id === emp.id;
              const assignedVan = vehicles.find(v => v.currentUserId === emp.id || v.currentUserName === emp.name);

              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedUser(emp)}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all ${
                    isSelected
                      ? 'bg-sky-50 border border-sky-300 shadow-sm'
                      : 'bg-slate-50/70 border border-slate-100 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={emp.avatarUrl}
                      alt={emp.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                    <div>
                      <h3 className={`text-xs font-bold ${isSelected ? 'text-sky-900' : 'text-slate-900'}`}>
                        {emp.name}
                      </h3>
                      <span className="text-[10px] text-slate-400 capitalize">{emp.role}</span>
                    </div>
                  </div>

                  {assignedVan && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      {assignedVan.vehicleNumber}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Employee History Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Employee Profile Header Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedUser.avatarUrl}
                alt={selectedUser.name}
                className="w-16 h-16 rounded-2xl object-cover ring-4 ring-sky-500/20 shadow-md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-900">{selectedUser.name}</h2>
                  <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200 capitalize">
                    {selectedUser.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{selectedUser.email}</p>
                <div className="mt-2 text-xs font-semibold text-slate-700">
                  Currently Operating:{' '}
                  {currentAssignedVehicle ? (
                    <Link
                      href={`/vehicles/${currentAssignedVehicle.id}`}
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

            <div className="flex gap-2">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center min-w-[90px]">
                <div className="text-base font-extrabold text-slate-900">{userInspections.length}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Inspections</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center min-w-[90px]">
                <div className="text-base font-extrabold text-amber-600">{userIssues.length}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Issues Logged</div>
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
                          href={`/vehicles/${insp.vehicleId}`}
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
                    href={`/vehicles/${insp.vehicleId}`}
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
        </div>
      </div>
    </div>
  );
}
