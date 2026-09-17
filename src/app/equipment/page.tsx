'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit2,
  Package,
  PackagePlus,
  Plus,
  QrCode,
  Search,
  Trash2,
  Truck,
  Wrench,
  Sparkles,
  RotateCcw,
  Archive,
  X,
  Printer,
  CheckSquare,
  Square,
  ArrowRightLeft,
  MoreHorizontal,
  Tag
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, EquipmentCategory, EquipmentKind, EquipmentStatus, LifespanMode, Vehicle } from '@/types';
import { EquipmentStatusBadge, LifespanStatusBadge } from '@/components/StatusBadges';
import { EquipmentQRCodeDisplay } from '@/components/EquipmentQRCodeDisplay';
import { ManagerOnly } from '@/components/ManagerOnly';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmModal } from '@/components/ConfirmModal';
import { QuantityModal } from '@/components/QuantityModal';
import { EquipmentAllocationModal } from '@/components/EquipmentAllocationModal';
import { LifespanActionModal } from '@/components/LifespanActionModal';
import { groupEquipmentByFamily } from '@/lib/equipmentGrouping';
import { QRCodeSVG } from 'qrcode.react';

const emptyForm = {
  name: '',
  assetTag: '',
  vehicleId: '',
  category: 'equipment' as EquipmentCategory,
  kind: 'reusable' as EquipmentKind,
  status: 'working' as EquipmentStatus,
  totalQuantity: '1',
  minRequiredStock: '0',
  lowWearThresholdPercent: '80',
  qrCodeToken: '',
  lifespanEnabled: false,
  lifespanMode: 'usage' as LifespanMode,
  expectedCars: '300',
  expectedMonths: '24',
  lifeStartedAt: new Date().toISOString().split('T')[0]
};

const ALL_STATUSES: Array<'all' | EquipmentStatus | 'low_stock'> = ['all', 'working', 'flagged', 'needs_repair', 'being_repaired', 'fixed', 'low_stock'];

type LifespanFilter = 'all' | 'due' | 'low' | 'tracked';

function parseLifespanFilter(raw: string | null): LifespanFilter {
  if (raw === 'due' || raw === 'low' || raw === 'tracked') return raw;
  return 'all';
}

export default function EquipmentPage() {
  return (
    <ManagerOnly>
      <EquipmentPageContent />
    </ManagerOnly>
  );
}

function EquipmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EquipmentStatus | 'low_stock'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | EquipmentCategory>('all');
  const [lifespanFilter, setLifespanFilter] = useState<LifespanFilter>(() =>
    parseLifespanFilter(searchParams?.get('lifespan') || null)
  );
  const [sortMode, setSortMode] = useState<'family' | 'equipment' | 'vehicle'>('family');
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [expandedQr, setExpandedQr] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Equipment | null>(null);
  const [addAnotherTarget, setAddAnotherTarget] = useState<{
    templateId: string;
    label: string;
  } | null>(null);
  const [allocationTarget, setAllocationTarget] = useState<Equipment | null>(null);
  const [lifespanAction, setLifespanAction] = useState<{ item: Equipment; mode: 'extend' | 'replace' | 'retire' | 'unretire' } | null>(null);

  // 3.3 Multi-Select Inventory Transfers
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [batchTransferModalOpen, setBatchTransferModalOpen] = useState(false);
  const [batchTargetVehicleId, setBatchTargetVehicleId] = useState('');
  const [batchQuantities, setBatchQuantities] = useState<Record<string, number>>({});

  // 3.4 Printable QR Sheet Modal
  const [printQrSheetOpen, setPrintQrSheetOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuBtnRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    if (!actionMenuId || !actionMenuBtnRef.current || !actionMenuRef.current) return;
    const btn = actionMenuBtnRef.current;
    const menu = actionMenuRef.current;
    const rect = btn.getBoundingClientRect();
    const mh = menu.offsetHeight;
    const mw = menu.offsetWidth;
    const gap = 4;
    const maxH = window.innerHeight - 16;
    menu.style.maxHeight = `${maxH}px`;
    menu.style.overflowY = mh > maxH ? 'auto' : 'visible';
    const height = Math.min(mh, maxH);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < height && rect.top > spaceBelow;
    const top = openUp ? rect.top - gap - height : rect.bottom + gap;
    let left = rect.right - mw;
    left = Math.min(Math.max(8, left), window.innerWidth - mw - 8);
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${left}px`;
  }, [actionMenuId]);

  useEffect(() => {
    if (!actionMenuId) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (actionMenuRef.current?.contains(t)) return;
      if (actionMenuBtnRef.current?.contains(t)) return;
      setActionMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionMenuId(null);
    };
    const onRepositionClose = () => setActionMenuId(null);
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
  }, [actionMenuId]);


  const load = () => {
    setEquipment(dbService.getEquipment());
    setVehicles(dbService.getVehicles());
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, []);

  useEffect(() => {
    const fromUrl = parseLifespanFilter(searchParams?.get('lifespan') || null);
    setLifespanFilter(fromUrl);
  }, [searchParams]);

  const applyLifespanFilter = (next: LifespanFilter) => {
    setLifespanFilter(next);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (next === 'all') {
      params.delete('lifespan');
    } else {
      params.set('lifespan', next);
    }
    const query = params.toString();
    router.replace(query ? `/equipment?${query}` : '/equipment', { scroll: false });
  };
  const assignedQty = (eq: Equipment) => (eq.assignments || []).reduce((sum, assignment) => sum + assignment.quantity, 0);
  const unassignedQty = (eq: Equipment) => Math.max(0, eq.availableQuantity ?? ((eq.totalQuantity ?? 1) - assignedQty(eq)));
  const totalQty = (eq: Equipment) => Math.max(eq.totalQuantity ?? 1, assignedQty(eq) + unassignedQty(eq));
  const assignmentsLabel = (eq: Equipment) => (eq.assignments || []).map(a => `${a.vehicleNumber} (${a.quantity})`).join(', ') || 'In shop / unassigned';
  const globalSummary = dbService.getGlobalInventorySummary();
  const dueForReviewCount = equipment.filter(eq => eq.lifespanEnabled && !eq.retiredAt && eq.lifespanStatus === 'due_for_review').length;
  const lowStockCount = equipment.filter(eq => (eq.minRequiredStock ?? 0) > 0 && unassignedQty(eq) < (eq.minRequiredStock ?? 0)).length;

  const filtered = equipment.filter(eq => {
    const assignmentText = (eq.assignments || []).map(a => a.vehicleNumber).join(' ');
    const haystack = `${eq.name} ${eq.assetTag || ''} ${eq.category} ${assignmentText}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const isBelowPar = (eq.minRequiredStock ?? 0) > 0 && unassignedQty(eq) < (eq.minRequiredStock ?? 0);
    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'low_stock'
      ? isBelowPar
      : eq.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || eq.category === categoryFilter;
    let matchesLifespan = true;
    if (lifespanFilter === 'due') {
      matchesLifespan = Boolean(eq.lifespanEnabled && !eq.retiredAt && eq.lifespanStatus === 'due_for_review');
    } else if (lifespanFilter === 'low') {
      matchesLifespan = Boolean(eq.lifespanEnabled && !eq.retiredAt && eq.lifespanStatus === 'getting_low');
    } else if (lifespanFilter === 'tracked') {
      matchesLifespan = Boolean(eq.lifespanEnabled);
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesLifespan;
  });

  const generateAutoTag = () => {
    const prefix = (form.name || 'EQ').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'EQ';
    const existingTags = equipment.map(e => e.assetTag || '').filter(t => t.startsWith(prefix));
    const nextNum = existingTags.length + 1;
    setForm(prev => ({ ...prev, assetTag: `${prefix}-${String(nextNum).padStart(3, '0')}` }));
  };

  const toggleSelectEquipment = (id: string) => {
    setSelectedEquipmentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (selectedEquipmentIds.length === filtered.length) {
      setSelectedEquipmentIds([]);
    } else {
      setSelectedEquipmentIds(filtered.map(e => e.id));
    }
  };

  const handleBatchTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchTargetVehicleId || selectedEquipmentIds.length === 0) return;
    try {
      setLoading(true);
      const transfers = selectedEquipmentIds.map(id => {
        const item = equipment.find(e => e.id === id);
        const available =
          typeof item?.availableQuantity === 'number'
            ? item.availableQuantity
            : typeof item?.totalQuantity === 'number'
              ? item.totalQuantity
              : 1;
        const qty = Math.max(1, Number(batchQuantities[id] ?? available) || 1);
        return { equipmentId: id, quantity: qty };
      });
      await dbService.batchTransferEquipment(transfers, batchTargetVehicleId);
      setSelectedEquipmentIds([]);
      setBatchTransferModalOpen(false);
      setBatchTargetVehicleId('');
      setBatchQuantities({});
      load();
    } catch (err: any) {
      alert(err.message || 'Batch transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchReplaceSelected = async () => {
    if (selectedEquipmentIds.length === 0) return;
    if (!window.confirm(`Mark ${selectedEquipmentIds.length} items as replaced?`)) return;
    try {
      setLoading(true);
      await dbService.batchReplaceLifespan(selectedEquipmentIds, { reason: 'Batch replaced from inventory table' });
      setSelectedEquipmentIds([]);
      load();
    } catch (err: any) {
      alert(err.message || 'Batch replacement failed');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setSelected(null);
    setForm({ ...emptyForm, lifeStartedAt: new Date().toISOString().split('T')[0] });
    setModal('add');
  };


  const renderItemActions = (eq: Equipment, opts?: { showQrToggle?: boolean; showRestock?: boolean }) => {
    const showQrToggle = opts?.showQrToggle !== false;
    const showRestock = Boolean(opts?.showRestock && eq.kind === 'consumable');
    const canLifespan = Boolean(eq.lifespanEnabled && !eq.retiredAt && totalQty(eq) <= 1);
    const open = actionMenuId === eq.id;
    const itemBtn = "btn btn-ghost btn-sm w-full justify-start gap-2";
    const menu = open ? createPortal(
          <div
            ref={actionMenuRef}
            role="menu"
            className="fixed z-[80] min-w-[13.5rem] rounded-[var(--radius)] border border-line bg-surface shadow-lg p-1 stack-tight"
            style={{ top: 0, left: 0 }}
          >
            {canLifespan && (
              <>
                <button type="button" role="menuitem" className={itemBtn} onClick={() => { setLifespanAction({ item: eq, mode: 'extend' }); setActionMenuId(null); }}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Extend lifespan
                </button>
                <button type="button" role="menuitem" className={itemBtn} onClick={() => { setLifespanAction({ item: eq, mode: 'replace' }); setActionMenuId(null); }}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Mark replaced
                </button>
                <button type="button" role="menuitem" className={itemBtn + " text-[var(--critical)]"} onClick={() => { setLifespanAction({ item: eq, mode: 'retire' }); setActionMenuId(null); }}>
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                  Retire
                </button>
              </>
            )}
            {showRestock && (
              <button type="button" role="menuitem" className={itemBtn} onClick={() => { setRestockTarget(eq); setActionMenuId(null); }}>
                <PackagePlus className="h-3.5 w-3.5" aria-hidden />
                Add stock
              </button>
            )}
            {showQrToggle && (
              <button type="button" role="menuitem" className={itemBtn} onClick={() => { setExpandedQr(x => ({ ...x, [eq.id]: !x[eq.id] })); setActionMenuId(null); }}>
                <QrCode className="h-3.5 w-3.5" aria-hidden />
                {expandedQr[eq.id] ? 'Hide QR code' : 'Show QR code'}
              </button>
            )}
            <button type="button" role="menuitem" className={itemBtn} onClick={() => { openEdit(eq); setActionMenuId(null); }}>
              <Edit2 className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
            <button type="button" role="menuitem" className={itemBtn + " text-[var(--critical)]"} onClick={() => { setSelected(eq); setModal('delete'); setActionMenuId(null); }}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </button>
          </div>,
          document.body
        ) : null;
    return (
      <div className="cluster gap-1 flex-wrap justify-end shrink-0">
        <button
          type="button"
          onClick={() => { setActionMenuId(null); setAllocationTarget(eq); }}
          className="btn btn-secondary btn-sm"
        >
          <Truck className="h-3.5 w-3.5" aria-hidden />
          Assign
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`More actions for ${eq.name}`}
          ref={open ? actionMenuBtnRef : undefined}
          onClick={() => setActionMenuId(open ? null : eq.id)}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
          More
        </button>
        {menu}
      </div>
    );
  };

  const openEdit = (eq: Equipment) => {
    setSelected(eq);
    setForm({
      name: eq.name,
      assetTag: eq.assetTag || '',
      vehicleId: eq.assignments?.[0]?.vehicleId || eq.vehicleId || '',
      category: eq.category,
      kind: eq.kind || (eq.category === 'supplies' ? 'consumable' : 'reusable'),
      status: eq.status,
      totalQuantity: String(eq.totalQuantity ?? 1),
      minRequiredStock: String(eq.minRequiredStock ?? 0),
      lowWearThresholdPercent: String(eq.lowWearThresholdPercent ?? 80),
      qrCodeToken: eq.qrCodeToken || eq.qrCode || '',
      lifespanEnabled: Boolean(eq.lifespanEnabled),
      lifespanMode: eq.lifespanMode || 'usage',
      expectedCars: eq.expectedCars != null ? String(eq.expectedCars) : '300',
      expectedMonths: eq.expectedMonths != null ? String(eq.expectedMonths) : '24',
      lifeStartedAt: eq.lifeStartedAt ? eq.lifeStartedAt.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setModal('edit');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    const totalQuantity = Number(form.totalQuantity);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1) {
      alert('Total quantity must be a positive whole number.');
      return;
    }

    const minRequiredStock = Math.max(0, Number(form.minRequiredStock) || 0);
    const lowWearThresholdPercent = Math.max(10, Math.min(99, Number(form.lowWearThresholdPercent) || 80));

    if (form.lifespanEnabled) {
      if (form.lifespanMode === 'usage') {
        const cars = Number(form.expectedCars);
        if (!Number.isInteger(cars) || cars <= 0) {
          alert('Expected cars must be a positive whole number.');
          return;
        }
      } else if (form.lifespanMode === 'time') {
        const months = Number(form.expectedMonths);
        if (!Number.isInteger(months) || months <= 0) {
          alert('Expected lifespan months must be a positive whole number.');
          return;
        }
      }
    }

    const vehicle = vehicles.find(v => v.id === form.vehicleId);

    const existing = selected?.assignments || [];
    let assignments = existing;
    if (modal === 'add') {
      if (vehicle && !form.lifespanEnabled) {
        assignments = [{ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, quantity: 1 }];
      } else {
        assignments = [];
      }
      const assignedTotal = assignments.reduce((sum, a) => sum + a.quantity, 0);
      if (!form.lifespanEnabled && assignedTotal > totalQuantity) {
        alert('Total quantity must be at least the units you assign on create.');
        return;
      }
    } else if (modal === 'edit') {
      const assignedTotal = existing.reduce((sum, a) => sum + a.quantity, 0);
      if (form.lifespanEnabled && (totalQuantity > 1 || assignedTotal > 1)) {
        alert(
          'Lifespan-tracked tools must be individual units. Use “Split into individual tools” on the card first, then edit each one.'
        );
        return;
      }
      if (assignedTotal > totalQuantity) {
        alert(`${assignedTotal} units are already assigned to vehicles. Total cannot be lower than that.`);
        return;
      }
      // Single-unit tools: vehicle dropdown is source of truth (empty = in shop).
      // Multi-qty stock: keep existing multi-assignments; use Allocation modal to move units.
      const isSingleUnit = form.lifespanEnabled || totalQuantity === 1 || assignedTotal <= 1;
      if (isSingleUnit) {
        if (vehicle) {
          assignments = [{ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, quantity: 1 }];
        } else {
          assignments = [];
        }
      } else {
        assignments = existing;
      }
    }

    try {
      setLoading(true);
      if (modal === 'add') {
        if (form.lifespanEnabled) {
          await dbService.createLifespanTrackedUnits(
            {
              name: form.name,
              assetTag: form.assetTag || null,
              vehicleId: form.vehicleId || null,
              category: form.category,
              kind: form.kind,
              status: form.status,
              minRequiredStock,
              lowWearThresholdPercent,
              qrCodeToken: form.qrCodeToken || null,
              lifespanMode: form.lifespanMode,
              expectedCars: form.lifespanMode === 'usage' ? Number(form.expectedCars) : null,
              expectedMonths: form.lifespanMode === 'time' ? Number(form.expectedMonths) : null,
              lifeStartedAt:
                form.lifespanMode === 'time'
                  ? form.lifeStartedAt
                    ? new Date(form.lifeStartedAt).toISOString()
                    : new Date().toISOString()
                  : null
            },
            totalQuantity
          );
        } else {
          await dbService.createEquipment({
            name: form.name,
            assetTag: form.assetTag || null,
            vehicleId: form.vehicleId || null,
            category: form.category,
            kind: form.kind,
            status: form.status,
            totalQuantity,
            minRequiredStock,
            lowWearThresholdPercent,
            qrCodeToken: form.qrCodeToken || null,
            lifespanEnabled: false,
            lifespanMode: null,
            expectedCars: null,
            expectedMonths: null,
            lifeStartedAt: null
          });
        }
      }

      if (modal === 'edit' && selected) {
        await dbService.updateEquipment({
          ...selected,
          name: form.name.trim(),
          assetTag: form.assetTag.trim() || null,
          category: form.category,
          kind: form.kind,
          status: form.status,
          minRequiredStock,
          lowWearThresholdPercent,
          totalQuantity: form.lifespanEnabled ? 1 : totalQuantity,
          assignments: form.lifespanEnabled
            ? (assignments || []).map(a => ({ ...a, quantity: Math.min(1, a.quantity) }))
            : assignments,
          vehicleId: assignments[0]?.vehicleId || null,
          vehicleNumber: assignments[0]?.vehicleNumber || 'Unassigned',
          availableQuantity: form.lifespanEnabled
            ? Math.max(0, 1 - (assignments || []).reduce((sum, a) => sum + Math.min(1, a.quantity), 0))
            : Math.max(0, totalQuantity - assignments.reduce((sum, a) => sum + a.quantity, 0)),
          qrCodeToken: form.qrCodeToken || null,
          qrCode: form.qrCodeToken || null,
          lifespanEnabled: form.lifespanEnabled,
          lifespanMode: form.lifespanEnabled ? form.lifespanMode : null,
          expectedCars: form.lifespanEnabled && form.lifespanMode === 'usage' ? Number(form.expectedCars) : null,
          expectedMonths: form.lifespanEnabled && form.lifespanMode === 'time' ? Number(form.expectedMonths) : null,
          lifeStartedAt:
            form.lifespanEnabled && form.lifespanMode === 'time'
              ? form.lifeStartedAt
                ? new Date(form.lifeStartedAt).toISOString()
                : new Date().toISOString()
              : null
        });
      }
      setModal(null);
    } catch (err: any) {
      alert(err.message || 'Could not save equipment.');
    } finally {
      setLoading(false);
    }
  };

  const splitIntoIndividuals = async (eq: Equipment) => {
    const assigned = (eq.assignments || []).reduce((sum, a) => sum + a.quantity, 0);
    const total = Math.max(eq.totalQuantity ?? 1, assigned);
    if (
      !confirm(
        `Split “${eq.name}” into ${total} separately tracked tools?\n\nEach will get its own life bar and can be assigned to a van one at a time. The shared stock record will be removed.`
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      await dbService.splitLifespanEquipmentIntoIndividuals(eq.id);
    } catch (err: any) {
      alert(err.message || 'Could not split into individual tools.');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setLoading(true);
    await dbService.deleteEquipment(selected.id);
    setLoading(false);
    setModal(null);
  };

  const handleRestockConfirm = async (amount: number) => {
    if (!restockTarget) return;
    try {
      await dbService.restockEquipment(restockTarget.id, amount);
      setRestockTarget(null);
    } catch (err: any) {
      alert(err.message || 'Could not add stock.');
    }
  };

  const handleAddAnotherConfirm = async (amount: number) => {
    if (!addAnotherTarget) return;
    try {
      setLoading(true);
      await dbService.addLifespanUnitsToFamily(addAnotherTarget.templateId, amount);
      setAddAnotherTarget(null);
    } catch (err: any) {
      alert(err.message || 'Could not add tools.');
    } finally {
      setLoading(false);
    }
  };

  const locationLabel = (eq: Equipment) =>
    (eq.assignments || []).map(a => a.vehicleNumber).join(', ') || 'In shop';

  const wearHint = (eq: Equipment) => {
    if (!eq.lifespanEnabled || eq.retiredAt) return null;
    if (eq.lifespanMode === 'usage') {
      const vans = (eq.assignments || []).map(a => a.vehicleNumber).filter(Boolean);
      if (vans.length === 0) {
        return 'Usage life: not worn until assigned to a van (jobs logged on that van)';
      }
      return `Usage life: worn when jobs are logged on ${vans.join(' / ')}`;
    }
    if (eq.lifespanMode === 'time') {
      return eq.dueDate
        ? `Calendar life: due ${new Date(eq.dueDate).toLocaleDateString()} (not tied to job count)`
        : 'Calendar life: expires by date (not tied to job count)';
    }
    return null;
  };

  const lifeLabel = (eq: Equipment) => {
    if (!eq.lifespanEnabled) return null;
    if (eq.retiredAt) return 'Retired';
    if (eq.lifespanMode === 'usage') return `${eq.carsUsed ?? 0}/${eq.expectedCars ?? 0} cars`;
    return eq.dueDate ? `Due ${new Date(eq.dueDate).toLocaleDateString()}` : 'Time-tracked';
  };

  const isLowPar = (eq: Equipment) =>
    (eq.minRequiredStock ?? 0) > 0 && unassignedQty(eq) < (eq.minRequiredStock ?? 0);

  const compactRow = (eq: Equipment) => {
    const isSelected = selectedEquipmentIds.includes(eq.id);
    const belowPar = isLowPar(eq);
    return (
      <div key={eq.id} className={`border-t border-line px-3 py-2.5 transition-colors ${isSelected ? 'bg-primary/5' : ''} ${belowPar ? 'border-l-4 border-l-red-500' : ''}`}>
        <div className="spread items-start gap-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelectEquipment(eq.id)}
              className="mt-1 cursor-pointer"
              aria-label={`Select ${eq.name}`}
            />
            <div className="min-w-0 flex-1">
              <div className="cluster flex-wrap gap-1.5">
                <span className="text-sm font-bold text-ink break-words">{eq.name}</span>
                <EquipmentStatusBadge status={eq.status} />
                {eq.lifespanEnabled && (
                  <LifespanStatusBadge status={eq.lifespanStatus} isRetired={Boolean(eq.retiredAt)} />
                )}
                {belowPar && (
                  <span className="badge" data-status="critical">
                    Low Stock: {unassignedQty(eq)} left (Par: {eq.minRequiredStock})
                  </span>
                )}
              </div>
              <p className="hint mt-0.5 break-words">
                {locationLabel(eq)}
                {lifeLabel(eq) ? ` · ${lifeLabel(eq)}` : ''}
                {eq.assetTag ? ` · Tag: ${eq.assetTag}` : ''}
                {eq.minRequiredStock ? ` · Par: ${eq.minRequiredStock}` : ''}
              </p>
              {wearHint(eq) && (
                <p className="hint text-[11px] mt-0.5 break-words text-ink-faint">{wearHint(eq)}</p>
              )}
            </div>
          </div>
          {renderItemActions(eq, { showQrToggle: true })}
        </div>
        {totalQty(eq) > 1 && eq.lifespanEnabled && !eq.retiredAt && (
          <div className="mt-2 ml-6">
            <button type="button" onClick={() => void splitIntoIndividuals(eq)} disabled={loading} className="btn btn-secondary btn-sm">
              Split into {totalQty(eq)} individual tools
            </button>
          </div>
        )}
        {expandedQr[eq.id] && (
          <div className="mt-2 ml-6">
            <EquipmentQRCodeDisplay equipment={eq} />
          </div>
        )}
      </div>
    );
  };

  const card = (eq: Equipment) => {
    const isSelected = selectedEquipmentIds.includes(eq.id);
    const belowPar = isLowPar(eq);
    return (
      <div key={eq.id} className={`card card-pad relative ${isSelected ? 'ring-2 ring-primary' : ''} ${belowPar ? 'border-2 border-red-500/50' : ''}`}>
        <div className="spread items-start mb-3">
          <div className="cluster items-start min-w-0 gap-2.5">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelectEquipment(eq.id)}
              className="mt-1 cursor-pointer"
              aria-label={`Select ${eq.name}`}
            />
            <span className="icon-tile" data-status="info" aria-hidden>
              <Wrench className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="card-title break-words">{eq.name}</h3>
              <div className="cluster gap-1.5 mt-1 flex-wrap">
                <span className="badge">
                  {eq.kind === 'consumable' ? 'Consumable stock' : 'Reusable equipment'}
                </span>
                {belowPar && (
                  <span className="badge" data-status="critical">
                    Low Stock: {unassignedQty(eq)} left (Par: {eq.minRequiredStock})
                  </span>
                )}
              </div>
              {eq.assetTag ? <p className="hint mt-1 break-words font-mono text-xs">Tag: {eq.assetTag}</p> : null}
            </div>
          </div>
          <div className="cluster gap-1.5 flex-wrap justify-end">
            <EquipmentStatusBadge status={eq.status} />
            {eq.lifespanEnabled && (
              <LifespanStatusBadge status={eq.lifespanStatus} isRetired={Boolean(eq.retiredAt)} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-line text-center text-xs">
          <div>
            <span className="text-ink-muted block text-[10px] uppercase">Owned</span>
            <span className="font-bold text-sm">{totalQty(eq)}</span>
          </div>
          <div>
            <span className="text-ink-muted block text-[10px] uppercase">Assigned</span>
            <span className="font-bold text-sm text-[var(--ok)]">{assignedQty(eq)}</span>
          </div>
          <div>
            <span className="text-ink-muted block text-[10px] uppercase">In Shop</span>
            <span className={`font-bold text-sm ${belowPar ? 'text-red-500 font-extrabold' : 'text-[var(--info)]'}`}>
              {unassignedQty(eq)}
            </span>
          </div>
        </div>

        {eq.lifespanEnabled && (
          <div className="my-2 stack-tight">
            <div className="spread text-xs text-ink-muted">
              <span>{lifeLabel(eq)}</span>
              {eq.lowWearThresholdPercent && <span className="text-[10px]">Warn @ {eq.lowWearThresholdPercent}%</span>}
            </div>
            {!eq.retiredAt && totalQty(eq) <= 1 && (
              <div className="cluster gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setLifespanAction({ item: eq, mode: 'extend' })}
                  className="btn btn-secondary btn-sm"
                  title="Add cars or months to lifespan" aria-label="Extend lifespan"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Extend
                </button>
                <button
                  type="button"
                  onClick={() => setLifespanAction({ item: eq, mode: 'replace' })}
                  className="btn btn-secondary btn-sm"
                  title="Mark replaced and reset wear" aria-label="Mark replaced and reset wear"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Replaced
                </button>
                <button
                  type="button"
                  onClick={() => setLifespanAction({ item: eq, mode: 'retire' })}
                  className="btn btn-ghost btn-sm text-[var(--critical)]"
                  title="Retire tool" aria-label="Retire tool"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Retire
                </button>
                {eq.retiredAt && (
                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm(
                        `Un-retire ${eq.name}? It will return to shop inventory. Choose OK for Working, or Cancel then use Needs Inspection from the dialog.`
                      );
                      if (!ok) {
                        setLifespanAction({ item: eq, mode: 'unretire' });
                        return;
                      }
                      setLifespanAction({ item: eq, mode: 'unretire' });
                    }}
                    className="btn btn-secondary btn-sm"
                    title="Un-retire tool back to shop"
                    aria-label="Un-retire tool"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Un-retire
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="card-foot mt-0 pt-3">
          <EquipmentQRCodeDisplay equipment={eq} />
          {renderItemActions(eq, { showQrToggle: false, showRestock: true })}
        </div>
      </div>
    );
  };

  const groupedByVehicle = [
    { id: 'unassigned', number: 'In Shop / Unassigned', items: filtered.filter(e => !(e.assignments?.length || e.vehicleId)) },
    ...vehicles.map(v => ({
      id: v.id,
      number: v.vehicleNumber,
      items: filtered.filter(e => e.assignments?.some(a => a.vehicleId === v.id) || e.vehicleId === v.id)
    }))
  ].filter(group => group.items.length > 0);

  const formModal = modal === 'add' || modal === 'edit';

  return (
    <div className="page max-w-full overflow-x-hidden stack gap-6">
      <PageHeader
        title="Global Inventory"
        subtitle="Track equipment, minimum shop par thresholds, multi-van allocation, QR codes, and wear lifespans."
        actions={
          <div className="cluster flex-wrap gap-2">
            <button type="button" onClick={openAdd} className="btn btn-primary cluster gap-1.5">
              <Plus className="h-4 w-4" aria-hidden />
              Add Equipment
            </button>
            <div className="relative">
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2.5"
                aria-label="More actions"
                aria-expanded={headerMenuOpen}
                onClick={() => setHeaderMenuOpen((v) => !v)}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
              {headerMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 min-w-[11rem] rounded-[var(--radius)] border border-line bg-surface shadow-lg p-1 stack-tight">
                  <button type="button" className="btn btn-ghost btn-sm w-full justify-start gap-2" onClick={() => { setPrintQrSheetOpen(true); setHeaderMenuOpen(false); }}>
                    <Printer className="h-3.5 w-3.5" /> Print QR
                  </button>
                  <Link href="/equipment/scan" className="btn btn-ghost btn-sm w-full justify-start gap-2" onClick={() => setHeaderMenuOpen(false)}>
                    <QrCode className="h-3.5 w-3.5" /> Scan
                  </Link>
                  <Link href="/issues" className="btn btn-ghost btn-sm w-full justify-start gap-2" onClick={() => setHeaderMenuOpen(false)}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Issues
                  </Link>
                </div>
              )}
            </div>
          </div>
        }
      />

      {selectedEquipmentIds.length > 0 && (
        <div className="card card-pad bg-primary/10 border-2 border-primary spread items-center flex-wrap gap-3">
          <div className="cluster gap-2">
            <span className="font-bold text-sm text-primary">
              {selectedEquipmentIds.length} item{selectedEquipmentIds.length === 1 ? '' : 's'} selected
            </span>
          </div>
          <div className="cluster gap-2">
            <button
              type="button"
              onClick={() => { setBatchQuantities({}); setBatchTransferModalOpen(true); }}
              className="btn btn-primary btn-sm cluster gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Transfer Selected to Vehicle
            </button>
            <button
              type="button"
              onClick={handleBatchReplaceSelected}
              className="btn btn-secondary btn-sm cluster gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Batch Replace Lifespan
            </button>
            <button
              type="button"
              onClick={() => setSelectedEquipmentIds([])}
              className="btn btn-ghost btn-sm text-xs"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <div className="cluster flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="text-ink-muted">
          <span className="font-semibold text-ink">{globalSummary.totalOwned}</span> owned
        </span>
        <span className="text-ink-muted">
          <span className="font-semibold text-ink">{globalSummary.unassigned}</span> in shop
        </span>
        <span className="text-ink-muted">
          <span className="font-semibold text-ink">{globalSummary.assigned}</span> assigned
        </span>
        {lowStockCount > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'low_stock' ? 'all' : 'low_stock')}
            className={`font-semibold ${statusFilter === 'low_stock' ? 'text-[var(--critical)] underline' : 'text-[var(--critical)]'}`}
          >
            {lowStockCount} low stock
          </button>
        )}
        {dueForReviewCount > 0 && (
          <button
            type="button"
            onClick={() => applyLifespanFilter(lifespanFilter === 'due' ? 'all' : 'due')}
            className={`font-semibold ${lifespanFilter === 'due' ? 'text-[var(--amber-text)] underline' : 'text-[var(--amber-text)]'}`}
            aria-pressed={lifespanFilter === 'due'}
          >
            {dueForReviewCount} due for review
          </button>
        )}
      </div>

      <div className="card card-pad">
        <div className="spread flex-col sm:flex-row gap-3">
          <div className="field w-full sm:max-w-xs">
            <label className="label sr-only" htmlFor="equipment-search">
              Search equipment
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                id="equipment-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search equipment, tag, vehicle..."
                className="input pl-9"
              />
            </div>
          </div>
          <div className="cluster w-full sm:w-auto sm:justify-end flex-wrap gap-2">
            {(['all', 'working', 'flagged'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`btn btn-sm capitalize ${statusFilter === status ? 'bg-surface-sunk text-ink font-semibold border border-line' : 'btn-secondary'}`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`btn btn-sm ${filtersOpen || categoryFilter !== 'all' || lifespanFilter !== 'all' || !(statusFilter === 'all' || statusFilter === 'working' || statusFilter === 'flagged') ? 'bg-surface-sunk text-ink font-semibold border border-line' : 'btn-secondary'}`}
              aria-expanded={filtersOpen}
            >
              Filters
            </button>
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="btn btn-ghost btn-sm cluster gap-1 text-xs"
            >
              {selectedEquipmentIds.length === filtered.length && filtered.length > 0 ? (
                <><CheckSquare className="w-3.5 h-3.5" /> Deselect</>
              ) : (
                <><Square className="w-3.5 h-3.5" /> Select</>
              )}
            </button>
          </div>
        </div>
        {filtersOpen && (
          <div className="mt-3 pt-3 border-t border-line cluster flex-wrap gap-2">
            <label className="cluster text-sm font-semibold text-ink-muted">
              View
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as "family" | "equipment" | "vehicle")}
                className="select btn-sm w-auto"
              >
                <option value="family">By tool type</option>
                <option value="vehicle">By vehicle</option>
                <option value="equipment">All cards</option>
              </select>
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as "all" | EquipmentCategory)}
              className="select btn-sm w-auto"
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              <option value="equipment">Equipment</option>
              <option value="supplies">Supplies</option>
              <option value="vehicle_condition">Vehicle condition</option>
            </select>
            <select
              value={lifespanFilter}
              onChange={(e) => applyLifespanFilter(e.target.value as LifespanFilter)}
              className="select btn-sm w-auto font-semibold"
              aria-label="Filter by lifespan status"
            >
              <option value="all">All lifespan states</option>
              <option value="due">Due for review ({dueForReviewCount})</option>
              <option value="low">Getting low</option>
              <option value="tracked">Lifespan tracked</option>
            </select>
            {ALL_STATUSES.filter((s) => s !== "all" && s !== "working" && s !== "flagged").map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`btn btn-sm capitalize ${statusFilter === status ? 'bg-surface-sunk text-ink font-semibold border border-line' : 'btn-secondary'}`}
              >
                {status === "low_stock" ? "Low Stock Par" : status.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>
      {sortMode === 'family' && (
        <div className="stack">
          {groupEquipmentByFamily(filtered).map(family => {
            const expanded = expandedFamilies[family.key] ?? (family.summary.unitCount <= 3 || family.summary.dueForReview > 0);
            const lifespanTemplate =
              family.items.find(eq => eq.lifespanEnabled && !eq.retiredAt) ||
              family.items.find(eq => eq.lifespanEnabled) ||
              null;
            return (
              <div key={family.key} className="card overflow-hidden">
                <div className="card-head min-h-12 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedFamilies(x => ({ ...x, [family.key]: !expanded }))}
                    className="cluster items-start min-w-0 flex-1 text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted mt-0.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted mt-0.5" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <strong className="block text-sm break-words">{family.label}</strong>
                      <span className="hint">
                        {family.summary.unitCount} unit{family.summary.unitCount === 1 ? '' : 's'}
                        {' · '}{family.summary.assigned} on vans
                        {' · '}{family.summary.inShop} in shop
                        {family.summary.lifespanTracked ? ' · lifespan tracked' : ''}
                      </span>
                    </span>
                  </button>
                  <span className="cluster gap-1.5 shrink-0">
                    {family.summary.dueForReview > 0 && (
                      <span className="badge" data-status="critical">
                        {family.summary.dueForReview} due
                      </span>
                    )}
                    {lifespanTemplate && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm cluster gap-1"
                        disabled={loading}
                        title={`Add more ${family.label}`}
                        onClick={() =>
                          setAddAnotherTarget({
                            templateId: lifespanTemplate.id,
                            label: family.label
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add another
                      </button>
                    )}
                  </span>
                </div>
                {expanded ? <div>{family.items.map(compactRow)}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      {sortMode === 'equipment' && (
        <div className="grid-auto">
          {filtered.map(card)}
        </div>
      )}

      {sortMode === 'vehicle' && (
        <div className="stack">
          {groupedByVehicle.map(group => {
            const expanded = expandedVehicles[group.id] ?? true;
            return (
              <div key={group.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedVehicles(x => ({ ...x, [group.id]: !expanded }))}
                  className="card-head w-full text-left min-h-12"
                >
                  <span>
                    <strong className="block text-sm">{group.number}</strong>
                    <span className="hint">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="text-xs font-bold text-[var(--info)]">{expanded ? 'Collapse' : 'Expand'}</span>
                </button>
                {expanded ? <div>{group.items.map(compactRow)}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card card-pad">
          <EmptyState
            icon={<Package className="h-12 w-12 text-ink-faint" aria-hidden />}
            title="No equipment found"
          >
            Adjust search or filter settings to find inventory records.
          </EmptyState>
        </div>
      )}

      {formModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="card max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="equipment-form-title" className="card-title px-5 pt-5 pb-3 border-b border-line shrink-0">
              {modal === 'add' ? 'Add Global Inventory Item' : 'Edit Equipment'}
            </h2>
            <form onSubmit={save} className="flex flex-col min-h-0 flex-1">
              <div className="stack gap-3 px-5 py-4 overflow-y-auto flex-1 min-h-0">
              <div className="field">
                <label className="label" htmlFor="equipment-name">Equipment name</label>
                <input
                  id="equipment-name"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Equipment name (e.g. Boars Hair Wheel Brush)"
                  className="input"
                />
              </div>

              <div className="field">
                <div className="spread items-center mb-1">
                  <label className="label m-0" htmlFor="equipment-tag">Serial / Asset Tag</label>
                  <button
                    type="button"
                    onClick={generateAutoTag}
                    className="btn btn-ghost btn-xs cluster gap-1 text-primary text-xs"
                  >
                    <Tag className="w-3 h-3" /> Auto-generate tag
                  </button>
                </div>
                <input
                  id="equipment-tag"
                  value={form.assetTag}
                  onChange={e => setForm({ ...form, assetTag: e.target.value })}
                  placeholder="e.g. BRUSH-001 (auto-generates sequence for batches)"
                  className="input font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="field">
                  <label className="label" htmlFor="equipment-kind">Type</label>
                  <select
                    id="equipment-kind"
                    value={form.kind}
                    onChange={e => setForm({ ...form, kind: e.target.value as EquipmentKind })}
                    className="select"
                  >
                    <option value="reusable">Reusable equipment</option>
                    <option value="consumable">Consumable stock</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="equipment-total-qty">
                    {form.lifespanEnabled
                      ? modal === 'add'
                        ? 'How many separate tools?'
                        : 'Quantity (always 1 when tracked)'
                      : 'Total quantity owned'}
                  </label>
                  <input
                    id="equipment-total-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={form.lifespanEnabled && modal === 'edit' ? '1' : form.totalQuantity}
                    onChange={e => setForm({ ...form, totalQuantity: e.target.value })}
                    className="input"
                    placeholder="e.g. 3"
                    disabled={form.lifespanEnabled && modal === 'edit'}
                  />
                  {form.lifespanEnabled && modal === 'add' && (
                    <p className="hint text-xs">
                      {Number(form.totalQuantity) > 1
                        ? `Creates ${Number(form.totalQuantity)} separate tools (${form.name.trim() || 'Name'} #1–#${Number(form.totalQuantity)}), each with its own life bar and QR.`
                        : 'Creates one tracked tool with its own life bar and QR. Enter 3 to add three separate washers, not one shared pool.'}
                    </p>
                  )}
                  {!form.lifespanEnabled && (
                    <p className="hint text-xs">
                      One inventory pool (shared count). Turn on Track lifespan below if each unit needs its own wear tracking.
                    </p>
                  )}
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="min-par-stock">
                  Minimum Shop Stock Par (Low Stock Alert Threshold)
                </label>
                <input
                  id="min-par-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.minRequiredStock}
                  onChange={e => setForm({ ...form, minRequiredStock: e.target.value })}
                  className="input"
                  placeholder="e.g. 5"
                />
                <p className="hint text-xs">
                  Alerts when unassigned shop inventory drops below this number.
                </p>
              </div>

              <div className="card card-pad bg-[var(--surface-alt)] stack-tight">
                <label className="cluster text-sm font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.lifespanEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setForm({
                        ...form,
                        lifespanEnabled: enabled,
                        totalQuantity: enabled && modal === 'edit' ? '1' : form.totalQuantity
                      });
                    }}
                    className="checkbox"
                  />
                  <span>Track lifespan</span>
                </label>
                <p className="hint text-xs">
                  Each physical tool is its own record with its own life. Example: 3 pressure washers → Washer #1, #2, and #3. Usage wears when cars are logged on the van that holds that tool; time mode flags by calendar date.
                </p>

                {form.lifespanEnabled && (
                  <div className="stack-tight pt-2 border-t border-line mt-2 gap-2">
                    <div className="field">
                      <label className="label text-xs">Lifespan mode</label>
                      <div className="cluster gap-4">
                        <label className="cluster text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="lifespanMode"
                            value="usage"
                            checked={form.lifespanMode === 'usage'}
                            onChange={() => setForm({ ...form, lifespanMode: 'usage' })}
                          />
                          <span>Usage (cars)</span>
                        </label>
                        <label className="cluster text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="lifespanMode"
                            value="time"
                            checked={form.lifespanMode === 'time'}
                            onChange={() => setForm({ ...form, lifespanMode: 'time' })}
                          />
                          <span>Time (months)</span>
                        </label>
                      </div>
                    </div>

                    {form.lifespanMode === 'usage' ? (
                      <div className="field">
                        <label className="label text-xs" htmlFor="expected-cars">Expected cars (lifespan)</label>
                        <input
                          id="expected-cars"
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={form.expectedCars}
                          onChange={(e) => setForm({ ...form, expectedCars: e.target.value })}
                          className="input"
                          placeholder="e.g. 300"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="field">
                          <label className="label text-xs" htmlFor="expected-months">Expected life (months)</label>
                          <input
                            id="expected-months"
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={form.expectedMonths}
                            onChange={(e) => setForm({ ...form, expectedMonths: e.target.value })}
                            className="input"
                            placeholder="e.g. 24"
                          />
                        </div>
                        <div className="field">
                          <label className="label text-xs" htmlFor="life-start-date">Life start date</label>
                          <input
                            id="life-start-date"
                            type="date"
                            required
                            value={form.lifeStartedAt}
                            onChange={(e) => setForm({ ...form, lifeStartedAt: e.target.value })}
                            className="input text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="field">
                      <label className="label text-xs" htmlFor="wear-warn-threshold">
                        Wear Warning Threshold (% used before &quot;Getting Low&quot;)
                      </label>
                      <input
                        id="wear-warn-threshold"
                        type="number"
                        min="10"
                        max="95"
                        step="5"
                        value={form.lowWearThresholdPercent}
                        onChange={(e) => setForm({ ...form, lowWearThresholdPercent: e.target.value })}
                        className="input text-xs"
                        placeholder="80"
                      />
                      <p className="hint text-[11px]">Defaults to 80% (flags warning at 20% life remaining).</p>
                    </div>
                  </div>
                )}
              </div>

              {(modal === 'add' || form.lifespanEnabled || Number(form.totalQuantity) === 1) ? (
                <div className="field">
                  <label className="label" htmlFor="equipment-vehicle">
                    {modal === 'add' ? 'Starting location' : 'Location'}
                  </label>
                  <select
                    id="equipment-vehicle"
                    value={form.vehicleId}
                    onChange={e => setForm({ ...form, vehicleId: e.target.value })}
                    className="select"
                  >
                    <option value="">In shop / unassigned</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber} - {v.name}
                      </option>
                    ))}
                  </select>
                  <p className="hint">
                    {modal === 'add'
                      ? 'Optional. Leave as shop if it is not on a van yet.'
                      : 'Shop or which van this unit is on. Save to apply.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-[var(--surface-alt)] p-3 stack gap-2">
                  <div>
                    <p className="text-xs font-semibold text-ink">Where units are</p>
                    <p className="hint mb-0 mt-1">{assignmentsLabel(selected!)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModal(null);
                      setAllocationTarget(selected);
                    }}
                    className="btn btn-secondary btn-sm self-start"
                  >
                    <Truck className="h-3.5 w-3.5" aria-hidden />
                    Move units between vans / shop
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value as EquipmentCategory })}
                  className="select"
                  aria-label="Category"
                >
                  <option value="equipment">Equipment</option>
                  <option value="supplies">Supplies</option>
                  <option value="vehicle_condition">Vehicle condition</option>
                </select>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as EquipmentStatus })}
                  className="select"
                  aria-label="Status"
                >
                  <option value="working">Working</option>
                  <option value="flagged">Flagged</option>
                  <option value="needs_repair">Needs repair</option>
                  <option value="being_repaired">Being repaired</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="equipment-qr">QR token / code</label>
                <input
                  id="equipment-qr"
                  value={form.qrCodeToken}
                  onChange={e => setForm({ ...form, qrCodeToken: e.target.value })}
                  placeholder="Optional"
                  className="input font-mono"
                />
              </div>
              </div>
              <div className="cluster justify-end gap-2 px-5 py-3 border-t border-line bg-surface shrink-0">
                <button type="button" onClick={() => setModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {batchTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card card-pad max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="card-head border-b border-line pb-3">
              <h2 className="card-title cluster gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                <span id="batch-transfer-title">Batch Transfer ({selectedEquipmentIds.length} items)</span>
              </h2>
            </div>
            <form onSubmit={handleBatchTransferSubmit} className="stack gap-4 mt-4">
              <div>
                <label className="label text-xs font-semibold">Select Destination Van</label>
                <select
                  value={batchTargetVehicleId}
                  onChange={(e) => setBatchTargetVehicleId(e.target.value)}
                  className="input w-full mt-1"
                  required
                >
                  <option value="">-- Choose destination vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} ({v.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-48 overflow-y-auto stack-tight pr-1 border border-line rounded p-2 text-xs">
                {selectedEquipmentIds.map(id => {
                  const eq = equipment.find(e => e.id === id);
                  if (!eq) return null;
                  const available =
                    typeof eq.availableQuantity === 'number'
                      ? eq.availableQuantity
                      : typeof eq.totalQuantity === 'number'
                        ? eq.totalQuantity
                        : 1;
                  const qty = batchQuantities[id] ?? Math.max(1, available);
                  return (
                    <div key={id} className="spread items-center gap-2 py-1 border-b border-line last:border-0">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold truncate block">{eq.name}</span>
                        <span className="hint text-[10px]">{eq.assetTag || 'No tag'} · available {available}</span>
                      </div>
                      <label className="sr-only" htmlFor={`batch-qty-${id}`}>Quantity for {eq.name}</label>
                      <input
                        id={`batch-qty-${id}`}
                        type="number"
                        min={1}
                        max={Math.max(1, available)}
                        value={qty}
                        onChange={(e) =>
                          setBatchQuantities(prev => ({
                            ...prev,
                            [id]: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        className="input w-16 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="cluster justify-end gap-2 border-t border-line pt-3 mt-2">
                <button
                  type="button"
                  onClick={() => setBatchTransferModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!batchTargetVehicleId || loading}
                  className="btn btn-primary btn-sm"
                >
                  {loading ? 'Transferring...' : 'Transfer All Selected'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printQrSheetOpen && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
          <div className="bg-surface card-pad max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl print:max-w-none print:max-h-none print:overflow-visible print:border-none print:shadow-none">
            <div className="spread items-center pb-4 border-b border-line print:hidden">
              <div>
                <h2 className="text-lg font-bold">Printable Equipment QR Labels</h2>
                <p className="hint text-xs">Avery 5160 / 30-label grid format preview. Click Print to open browser print dialog.</p>
              </div>
              <div className="cluster gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary btn-sm cluster gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setPrintQrSheetOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 print:grid-cols-3 print:gap-3 print:p-0">
              {equipment.map((eq) => {
                const qrValue = eq.qrCodeToken || eq.qrCode || `sunny-eq:${eq.id}`;
                return (
                  <div
                    key={eq.id}
                    className="border border-line rounded-lg p-3 flex items-center gap-3 bg-surface print:border-dashed print:border-gray-400 print:break-inside-avoid"
                  >
                    <div className="shrink-0 bg-white p-1 rounded">
                      <QRCodeSVG value={qrValue} size={64} level="M" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs truncate leading-tight text-ink">{eq.name}</p>
                      {eq.assetTag && (
                        <p className="font-mono text-[10px] font-semibold text-primary truncate mt-0.5">
                          {eq.assetTag}
                        </p>
                      )}
                      <p className="text-[10px] text-ink-muted truncate mt-0.5">
                        {eq.vehicleNumber ? eq.vehicleNumber : 'Shop Stock'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={modal === 'delete' && selected !== null}
        title={`Delete ${selected?.name ?? 'equipment'}?`}
        message="This removes the inventory record and its assignments."
        confirmLabel={loading ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setModal(null)}
        onConfirm={() => void remove()}
      />

      <QuantityModal
        open={restockTarget !== null}
        title={restockTarget ? `Add stock for ${restockTarget.name}` : 'Add stock'}
        description="How many units were received?"
        initialValue={1}
        min={1}
        onConfirm={handleRestockConfirm}
        onCancel={() => setRestockTarget(null)}
      />

      <QuantityModal
        open={addAnotherTarget !== null}
        title={addAnotherTarget ? `Add more ${addAnotherTarget.label}` : 'Add another'}
        description={
          addAnotherTarget
            ? `How many more separate ${addAnotherTarget.label} tools? Each gets its own life bar and QR. Existing units will be numbered #1, #2, …`
            : 'How many more?'
        }
        initialValue={1}
        min={1}
        max={50}
        onConfirm={(qty) => void handleAddAnotherConfirm(qty)}
        onCancel={() => setAddAnotherTarget(null)}
      />

      <EquipmentAllocationModal
        equipment={allocationTarget}
        vehicles={vehicles}
        open={allocationTarget !== null}
        onClose={() => setAllocationTarget(null)}
      />

      <LifespanActionModal
        item={lifespanAction?.item || null}
        mode={lifespanAction?.mode || null}
        onClose={() => setLifespanAction(null)}
        onSuccess={load}
      />
    </div>
  );
}
