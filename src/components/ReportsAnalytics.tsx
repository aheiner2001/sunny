'use client';

import React, { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Inspection, Issue } from '@/types';

type InspRow = {
  id: string;
  date: string;
  van: string;
  driver: string;
  kind: string;
  status: string;
  flagged: number;
};

type IssueRow = {
  id: string;
  opened: string;
  van: string;
  status: string;
  title: string;
  ageDays: number;
  resolvedLag: string;
};

function SimpleTable<T>({
  data,
  columns,
  filterPlaceholder,
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  filterPlaceholder: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="stack gap-2">
      <input
        type="search"
        className="input max-w-xs"
        placeholder={filterPlaceholder}
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
      />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunk sticky top-0">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="text-left px-3 py-2 text-xs font-bold text-ink-muted uppercase tracking-wider cursor-pointer select-none"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-surface-sunk/40">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-ink">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-muted">
                  No rows in this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportsAnalytics({
  inspections,
  issues,
}: {
  inspections: Inspection[];
  issues: Issue[];
}) {
  const inspRows: InspRow[] = useMemo(
    () =>
      inspections.map((i) => ({
        id: i.id,
        date: i.dateString || i.submittedAt?.slice(0, 10) || '',
        van: i.vehicleNumber,
        driver: i.userName,
        kind: i.kind === 'return' ? 'Return' : 'Pre-trip',
        status: i.status,
        flagged: (i.responses || []).filter((r) => r.isFlagged).length,
      })),
    [inspections]
  );

  const issueRows: IssueRow[] = useMemo(() => {
    const now = Date.now();
    return issues.map((iss) => {
      const opened = iss.dateString || iss.reportedAt?.slice(0, 10) || '';
      const openedMs = iss.reportedAt ? new Date(iss.reportedAt).getTime() : Date.parse(opened);
      const resolvedMs = iss.resolvedAt ? new Date(iss.resolvedAt).getTime() : NaN;
      const ageDays = Number.isFinite(openedMs)
        ? Math.max(0, Math.round(((Number.isFinite(resolvedMs) ? resolvedMs : now) - openedMs) / 86400000))
        : 0;
      const resolvedLag =
        Number.isFinite(resolvedMs) && Number.isFinite(openedMs)
          ? `${Math.max(0, Math.round((resolvedMs - openedMs) / 86400000))}d`
          : '—';
      return {
        id: iss.id,
        opened,
        van: iss.vehicleNumber || '—',
        status: iss.status,
        title: iss.title || iss.description?.slice(0, 60) || 'Issue',
        ageDays,
        resolvedLag,
      };
    });
  }, [issues]);

  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; inspections: number; passed: number; issues: number }>();
    for (const i of inspections) {
      const d = i.dateString || i.submittedAt?.slice(0, 10) || '';
      if (!d) continue;
      const row = map.get(d) || { date: d, inspections: 0, passed: 0, issues: 0 };
      row.inspections += 1;
      if (i.status === 'passed') row.passed += 1;
      map.set(d, row);
    }
    for (const iss of issues) {
      const d = iss.dateString || iss.reportedAt?.slice(0, 10) || '';
      if (!d) continue;
      const row = map.get(d) || { date: d, inspections: 0, passed: 0, issues: 0 };
      row.issues += 1;
      map.set(d, row);
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        ...r,
        passRate: r.inspections ? Math.round((r.passed / r.inspections) * 100) : 0,
      }));
  }, [inspections, issues]);

  const inspCols = useMemo<ColumnDef<InspRow>[]>(
    () => [
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'van', header: 'Van' },
      { accessorKey: 'driver', header: 'Driver' },
      { accessorKey: 'kind', header: 'Kind' },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'flagged', header: 'Flags' },
    ],
    []
  );

  const issueCols = useMemo<ColumnDef<IssueRow>[]>(
    () => [
      { accessorKey: 'opened', header: 'Opened' },
      { accessorKey: 'van', header: 'Van' },
      { accessorKey: 'title', header: 'Issue' },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'ageDays', header: 'Age (d)' },
      { accessorKey: 'resolvedLag', header: 'Resolve lag' },
    ],
    []
  );

  return (
    <div className="stack gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h3 className="card-title text-sm mb-3">Inspections & pass rate</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="inspections" name="Inspections" stroke="#0f172a" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="passRate" name="Pass %" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card card-pad">
          <h3 className="card-title text-sm mb-3">Issues opened by day</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="issues" name="Issues" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card card-pad stack gap-3">
        <h3 className="card-title text-sm">Inspections in range</h3>
        <SimpleTable data={inspRows} columns={inspCols} filterPlaceholder="Filter inspections…" />
      </div>

      <div className="card card-pad stack gap-3">
        <h3 className="card-title text-sm">Issues in range</h3>
        <SimpleTable data={issueRows} columns={issueCols} filterPlaceholder="Filter issues…" />
      </div>
    </div>
  );
}
