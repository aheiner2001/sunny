'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight,
  Info,
  Clock,
  Wrench,
  Sparkles
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle, Inspection, Issue } from '@/types';
import { InspectionStatusBadge, IssueStatusBadge, VehicleStatusBadge } from '@/components/StatusBadges';

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 7, 19)); // Aug 2026

  const loadData = () => {
    setVehicles(dbService.getVehicles());
    setInspections(dbService.getInspections());
    setIssues(dbService.getIssues());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  const totalVehiclesCount = vehicles.length;
  const todayInspectionsCount = inspections.filter(i => i.dateString === '2026-08-19').length;
  const openIssuesCount = issues.filter(i => i.status !== 'fixed').length;
  const vehiclesInUse = vehicles.filter(v => v.status === 'in_use');

  // Mini Calendar Calculations
  const daysInMonth = 31; // August
  const startDayOffset = 5; // Aug 1 2026 was Saturday (offset in Mon-start grid)
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Check activity per day for calendar dots
  const getDayStatus = (day: number) => {
    const dayStr = `2026-08-${String(day).padStart(2, '0')}`;
    const dayInspections = inspections.filter(i => i.dateString === dayStr);
    const dayIssues = issues.filter(i => i.dateString === dayStr || (dayInspections.some(insp => insp.status === 'issues_found')));
    const hasInspection = dayInspections.length > 0;
    const hasIssue = dayIssues.length > 0;
    return { hasInspection, hasIssue };
  };

  return (
    <div className="space-y-6">
      {/* Top Row Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Total Vehicles */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-slate-900">{totalVehiclesCount}</div>
              <div className="text-xs font-semibold text-slate-400">Total Vehicles</div>
            </div>
          </div>
          <Link
            href="/vehicles"
            className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 group"
          >
            <span>View all vehicles</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Card 2: Inspections Today */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-slate-900">{todayInspectionsCount}</div>
              <div className="text-xs font-semibold text-slate-400">Inspections Today</div>
            </div>
          </div>
          <Link
            href="/inspections"
            className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 group"
          >
            <span>View today's inspections</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Card 3: Open Issues */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-slate-900">{openIssuesCount}</div>
              <div className="text-xs font-semibold text-slate-400">Open Issues</div>
            </div>
          </div>
          <Link
            href="/issues"
            className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 group"
          >
            <span>View all issues</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Card 4: Vehicles in Use */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-slate-900">{vehiclesInUse.length}</div>
              <div className="text-xs font-semibold text-slate-400">Vehicles in Use</div>
            </div>
          </div>
          <Link
            href="/employees"
            className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 group"
          >
            <span>View active users</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Middle Row: Today's Activity | Inspection Calendar | Open Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget 1: Today's Activity */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-base">Today's Activity</h2>
              <Link href="/inspections" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 truncate">Inspection Completed</p>
                    <span className="text-[11px] text-slate-400 font-medium">8:42 AM</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Van #3 - John Smith</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 truncate">Inspection Completed</p>
                    <span className="text-[11px] text-slate-400 font-medium">8:15 AM</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Van #1 - Sarah Johnson</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 truncate">Issue Reported</p>
                    <span className="text-[11px] text-slate-400 font-medium">7:58 AM</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Van #2 - Vacuum Hose</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 truncate">Inspection Completed</p>
                    <span className="text-[11px] text-slate-400 font-medium">7:41 AM</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Van #5 - Chris Brown</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 truncate">Inspection Started</p>
                    <span className="text-[11px] text-slate-400 font-medium">7:20 AM</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Van #4 - Emily Wilson</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Widget 2: Inspection Calendar */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-base">Inspection Calendar</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">August 2026</span>
                <div className="flex items-center">
                  <button className="p-1 rounded hover:bg-slate-100 text-slate-400">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1 rounded hover:bg-slate-100 text-slate-400">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 py-1 uppercase">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Calendar Numbers Grid */}
            <div className="grid grid-cols-7 text-center text-xs gap-y-1.5 py-2 font-medium">
              {/* Prev month fill */}
              <span className="text-slate-300">28</span>
              <span className="text-slate-300">29</span>
              <span className="text-slate-300">30</span>
              <span className="text-slate-300">31</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>

              <span>4</span>
              <span>5</span>
              <span className="relative">
                6
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              </span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>

              <span>11</span>
              <span className="relative">
                12
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              </span>
              <span>13</span>
              <span className="relative">
                14
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              </span>
              <span className="relative">
                15
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              </span>
              <span>16</span>
              <span className="relative">
                17
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
              </span>

              {/* Today Aug 18/19 */}
              <span className="relative flex items-center justify-center">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shadow-sm">
                  18
                </span>
              </span>
              <span className="relative">
                19
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
              </span>
              <span className="relative">
                20
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
              </span>
              <span className="relative">
                21
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
              </span>
              <span>22</span>
              <span>23</span>
              <span>24</span>

              <span>25</span>
              <span>26</span>
              <span>27</span>
              <span>28</span>
              <span>29</span>
              <span>30</span>
              <span>31</span>
            </div>
          </div>

          {/* Calendar Legend */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Inspections</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Issues</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-600" />
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Widget 3: Open Issues */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-base">Open Issues</h2>
              <Link href="/issues" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-3.5">
              {issues.slice(0, 5).map((issue) => (
                <div key={issue.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{issue.equipmentName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{issue.vehicleNumber}</p>
                    </div>
                  </div>
                  <IssueStatusBadge status={issue.status} />
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/issues"
            className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 group"
          >
            <span>View all issues</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Bottom Row: Vehicles In Use | Recent Inspections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicles in Use Table (Takes 2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-base">Vehicles in Use</h2>
            <Link href="/vehicles" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="pb-3 font-bold">Vehicle</th>
                  <th className="pb-3 font-bold">Current User</th>
                  <th className="pb-3 font-bold">Start Time</th>
                  <th className="pb-3 font-bold">Last Inspection</th>
                  <th className="pb-3 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.slice(0, 5).map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                      <Link href={`/vehicles/${vehicle.id}`} className="hover:text-sky-600 font-bold">
                        {vehicle.vehicleNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 text-slate-600 font-medium">{vehicle.currentUserName || '—'}</td>
                    <td className="py-3.5 text-slate-500 font-medium">{vehicle.currentUserStartTime || '7:00 AM'}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-medium">Today, {vehicle.lastInspectionAt ? new Date(vehicle.lastInspectionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '8:00 AM'}</span>
                        {vehicle.lastInspectionStatus === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {vehicle.lastInspectionStatus === 'issues_found' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {vehicle.lastInspectionStatus === 'in_progress' && <Info className="w-4 h-4 text-sky-500" />}
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <VehicleStatusBadge status={vehicle.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Inspections (Takes 1 col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-base">Recent Inspections</h2>
              <Link href="/inspections" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {inspections.slice(0, 5).map((insp) => (
                <div key={insp.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      insp.status === 'passed' ? 'bg-emerald-50 text-emerald-600' :
                      insp.status === 'issues_found' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
                    }`}>
                      {insp.status === 'passed' && <CheckCircle2 className="w-4 h-4" />}
                      {insp.status === 'issues_found' && <AlertTriangle className="w-4 h-4" />}
                      {insp.status === 'in_progress' && <Clock className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{insp.vehicleNumber}</p>
                      <p className="text-[11px] text-slate-400 truncate">{insp.userName}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-medium text-slate-400">
                      {new Date(insp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={`text-xs font-bold ${
                      insp.status === 'passed' ? 'text-emerald-600' :
                      insp.status === 'issues_found' ? 'text-amber-600' : 'text-sky-600'
                    }`}>
                      {insp.status === 'passed' ? 'Passed' : insp.status === 'issues_found' ? 'Issues Found' : 'In Progress'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/inspections"
            className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 group"
          >
            <span>View all inspections</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
