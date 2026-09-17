'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  User as UserIcon,
  Send,
  RotateCcw,
  Check,
  CheckCheck,
  Camera,
  Image as ImageIcon,
  X,
  WifiOff,
  RefreshCw,
  Gauge,
  Fuel,
  LogOut,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { Vehicle, ChecklistQuestion, ChecklistCategoryConfig, InspectionResponse, FleetTask, Inspection } from '@/types';
import { canSubmitInspection, getUnansweredInspectionQuestions } from './inspectionValidation';
import {
  answerIndicatesIssue,
  buildEquipmentFlagPayload,
  getBinaryButtonLabels,
  listVehicleEquipmentForFamily,
  shouldShowPhotoCapture,
} from '@/lib/checklistPairing';
import { activeChecklistQuestions } from '@/lib/checklistQuestions';
import { occupancyKind, formatCheckoutStarted, vehicleInspectedOnLocalDay } from '@/lib/occupancy';
import { RecentInspectors } from '@/components/RecentInspectors';
import { RejectedInspectionBanner } from '@/components/RejectedInspectionBanner';
import { SignaturePad } from '@/components/SignaturePad';

export default function InspectClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vehicleId = searchParams?.get('id') || searchParams?.get('vehicle') || searchParams?.get('v') || '';
  const { user, role } = useAuth();
  const employeeFlow = role === 'employee' || searchParams?.get('mode') === 'employee';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<ChecklistCategoryConfig[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, { value: string; isFlagged: boolean; notes?: string; photoUrl?: string }>>({});
  const [flagIssues, setFlagIssues] = useState<Record<string, { title: string; description: string; photoUrl?: string }>>({});
  const [equipmentPicks, setEquipmentPicks] = useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [generalPhotos, setGeneralPhotos] = useState<string[]>([]);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [odometer, setOdometer] = useState<string>('');
  const [fuelLevel, setFuelLevel] = useState<number>(100);
  const [collectOdometer, setCollectOdometer] = useState(true);
  const [collectFuelLevel, setCollectFuelLevel] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedInspection, setSubmittedInspection] = useState<any | null>(null);
  const [tasks, setTasks] = useState<FleetTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  
  // Offline sync state
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  
  // Auto-save and draft recovery
  const [isSaved, setIsSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [rejectedInspection, setRejectedInspection] = useState<any | null>(null);
  const [occupancyBusy, setOccupancyBusy] = useState(false);

  const loadData = async () => {
    if (!vehicleId) {
      setIsLoading(false);
      setVehicle(null);
      return;
    }

    try {
      setIsLoading(true);
      let v = dbService.getVehicle(vehicleId) || dbService.getVehicleByQR(vehicleId);

      if (!v) {
        v = (await dbService.fetchVehicleAsync(vehicleId)) || undefined;
      }

      if (v) {
        setVehicle(v);
        if (v.odometer) setOdometer(String(v.odometer));
        if (v.fuelLevel !== undefined && v.fuelLevel !== null) setFuelLevel(v.fuelLevel);
      } else {
        setVehicle(null);
      }

      const checklist = dbService.getChecklistConfig();
      setCategories(checklist.categories || []);
      setQuestions(activeChecklistQuestions(checklist.questions || []));
      setCollectOdometer(checklist.collectOdometer !== false);
      setCollectFuelLevel(checklist.collectFuelLevel !== false);
      const vehicleTasks = dbService.getTasks().filter(task => !task.vehicleId || task.vehicleId === v?.id);
      setTasks(vehicleTasks);
      const openTask = vehicleTasks.find(task => task.status === 'open');
      setSelectedTaskId(prev => prev || openTask?.id || '');
      setOfflineCount(dbService.getOfflineInspections().length);
    } catch (error) {
      console.error('Error loading inspection data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);

    const handleOnline = () => {
      setIsOnline(true);
      setOfflineCount(dbService.getOfflineInspections().length);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setOfflineCount(dbService.getOfflineInspections().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('sunny_db_update', loadData);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [vehicleId]);

  const handleManualSync = async () => {
    try {
      setIsSyncingOffline(true);
      const synced = await dbService.syncOfflineInspections();
      setOfflineCount(dbService.getOfflineInspections().length);
      alert(`Synchronized ${synced} offline inspection(s) successfully!`);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncingOffline(false);
    }
  };

  const processImageFile = (file: File, callback: (base64: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          callback(dataUrl);
        } else {
          callback(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Draft recovery and rejection detection on mount
  useEffect(() => {
    if (!vehicleId || !user) return;

    // Check for rejected inspection
    const rejectedKey = `sunny_inspection_rejected_${vehicleId}_${user.id}`;
    const rejectedData = localStorage.getItem(rejectedKey);
    if (rejectedData) {
      try {
        const rejected = JSON.parse(rejectedData);
        setRejectedInspection(rejected);
        setShowDraftRecovery(true);
        // Pre-fill form with rejected data
        if (rejected.responses) {
          const prefilledResponses: typeof responses = {};
          rejected.responses.forEach((r: any) => {
            prefilledResponses[r.questionId] = {
              value: r.value,
              isFlagged: r.isFlagged,
              notes: r.notes,
              photoUrl: r.photoUrl
            };
          });
          setResponses(prefilledResponses);
        }
        if (rejected.generalNotes) {
          setGeneralNotes(rejected.generalNotes);
        }
      } catch (e) {
        console.error('Error parsing rejected inspection:', e);
      }
    } else {
      // Check for draft
      const draftKey = `sunny_inspection_draft_${vehicleId}`;
      const draftData = localStorage.getItem(draftKey);
      if (draftData) {
        setShowDraftRecovery(true);
        try {
          const draft = JSON.parse(draftData);
          if (draft.responses) {
            setResponses(draft.responses);
          }
          if (draft.flagIssues) {
            setFlagIssues(draft.flagIssues);
          }
          if (draft.generalNotes) {
            setGeneralNotes(draft.generalNotes);
          }
          if (draft.generalPhotos) {
            setGeneralPhotos(draft.generalPhotos);
          }
          if (draft.odometer) {
            setOdometer(draft.odometer);
          }
          if (draft.fuelLevel !== undefined) {
            setFuelLevel(draft.fuelLevel);
          }
          if (draft.signatureBase64) {
            setSignatureBase64(draft.signatureBase64);
          }
        } catch (e) {
          console.error('Error parsing draft:', e);
        }
      }
    }
  }, [vehicleId, user]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!vehicleId) return;

    const interval = setInterval(() => {
      const draftKey = `sunny_inspection_draft_${vehicleId}`;
      const draft = {
        responses,
        flagIssues,
        generalNotes,
        generalPhotos,
        odometer,
        fuelLevel,
        signatureBase64,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setIsSaved(true);
      setLastSaveTime(new Date());
      setTimeout(() => setIsSaved(false), 2000);
    }, 30000);

    return () => clearInterval(interval);
  }, [vehicleId, responses, flagIssues, generalNotes, generalPhotos, odometer, fuelLevel, signatureBase64]);

  if (isLoading || (vehicle && occupancyKind(vehicle, user?.id) === 'pending')) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-ink-muted">Loading Vehicle Inspection Checklist...</p>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    const allVehicles = dbService.getVehicles();
    return (
      <div className="page max-w-md mx-auto py-8 text-center space-y-6">
        <div className="card card-pad space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-ink">
              {vehicleId ? 'Vehicle Not Found' : 'Select Vehicle to Inspect'}
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              {vehicleId ? (
                <>The tag <code className="unit-tag font-mono text-[11px] font-bold">{vehicleId}</code> does not match an active vehicle.</>
              ) : (
                'Choose a vehicle from the fleet to begin today’s inspection checklist.'
              )}
            </p>
          </div>

          <div className="border-t border-line pt-4 text-left">
            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-2">
              Select vehicle:
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allVehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => router.push(`/inspect?id=${encodeURIComponent(v.id)}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-line hover:border-ink hover:bg-surface-sunk transition-all text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-ink-faint group-hover:text-ink" />
                    <div>
                      <div className="text-xs font-bold text-ink group-hover:text-ink">{v.vehicleNumber}</div>
                      <div className="text-[10px] text-ink-faint">{v.name} &bull; {v.licensePlate}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-ink transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Link href="/scan" className="link-action inline-flex items-center gap-1.5 text-xs font-bold">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Scan QR Code with Camera</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSetResponse = (q: ChecklistQuestion, value: string, isFlagged: boolean, notes?: string, photoUrl?: string) => {
    setResponses(prev => ({
      ...prev,
      [q.id]: {
        value,
        isFlagged,
        notes: isFlagged ? (notes !== undefined ? notes : prev[q.id]?.notes || '') : '',
        photoUrl: photoUrl !== undefined ? photoUrl : prev[q.id]?.photoUrl
      }
    }));

    if (isFlagged && !flagIssues[q.id]) {
      setFlagIssues(prev => ({
        ...prev,
        [q.id]: {
          title: `${q.equipmentName || q.text.split(':')[0]} issue`,
          description: '',
          photoUrl: photoUrl || prev[q.id]?.photoUrl
        }
      }));
    } else if (!isFlagged && flagIssues[q.id]) {
      const updated = { ...flagIssues };
      delete updated[q.id];
      setFlagIssues(updated);
    }
  };

  const handleIssueChange = (questionId: string, field: 'title' | 'description' | 'photoUrl', val: string) => {
    setFlagIssues(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: val
      }
    }));
    if (field === 'description') {
      setResponses(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          value: prev[questionId]?.value || '',
          isFlagged: Boolean(prev[questionId]?.isFlagged),
          notes: val
        }
      }));
    } else if (field === 'photoUrl') {
      setResponses(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          value: prev[questionId]?.value || '',
          isFlagged: Boolean(prev[questionId]?.isFlagged),
          photoUrl: val
        }
      }));
    }
  };

  const requiredQuestions = questions.filter(q => q.required);
  const answeredCount = requiredQuestions.filter(q => {
    const v = responses[q.id]?.value;
    return v !== undefined && v !== null && v !== '';
  }).length;

  const flaggedCount = Object.keys(flagIssues).length;
  const allRequiredAnswered = canSubmitInspection(questions, responses);
  const unansweredQuestions = getUnansweredInspectionQuestions(questions, responses);
  const photoMissing = questions.some(q => {
    if (!shouldShowPhotoCapture(q)) return false;
    const resp = responses[q.id];
    return q.required !== false && !resp?.photoUrl;
  });
  const canSubmit = allRequiredAnswered && !photoMissing && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allRequiredAnswered) {
      return;
    }

    if (photoMissing) {
      alert('Please attach required photos before submitting.');
      return;
    }

    const allEquipmentForGate = dbService.getEquipment();
    const missingEquipmentPick = questions.find(q => {
      const resp = responses[q.id];
      if (!resp?.isFlagged || !q.equipmentFamily) return false;
      const matches = listVehicleEquipmentForFamily(allEquipmentForGate, vehicle.id, q.equipmentFamily);
      return matches.length >= 2 && !equipmentPicks[q.id];
    });
    if (missingEquipmentPick) {
      alert(
        `Select which ${missingEquipmentPick.equipmentFamily} this flag applies to before submitting.`
      );
      return;
    }

    const currentOdo = vehicle.odometer || 0;
    const parsedOdo = collectOdometer && odometer ? Number(odometer) : null;
    if (collectOdometer && parsedOdo !== null && parsedOdo < currentOdo) {
      if (!confirm(`Warning: Entered odometer (${parsedOdo} mi) is less than previous recorded mileage (${currentOdo} mi). Do you wish to proceed?`)) {
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const allEquipment = dbService.getEquipment();
      const linkedByQuestion = new Map(
        questions.map(q => {
          const resp = responses[q.id];
          if (!resp?.isFlagged) return [q.id, null] as const;
          let linked = buildEquipmentFlagPayload(
            q,
            resp?.value || 'flagged',
            allEquipment,
            vehicle.id
          );
          if (!linked && q.equipmentFamily) {
            const matches = listVehicleEquipmentForFamily(
              allEquipment,
              vehicle.id,
              q.equipmentFamily
            );
            const pickId = equipmentPicks[q.id];
            const chosen = pickId ? matches.find(e => e.id === pickId) : undefined;
            if (chosen) {
              linked = {
                equipmentId: chosen.id,
                equipmentName: chosen.name,
                status: 'flagged',
              };
            }
          }
          return [q.id, linked] as const;
        })
      );

      const inspectionResponses: InspectionResponse[] = questions.map(q => {
        const resp = responses[q.id];
        const linked = linkedByQuestion.get(q.id);
        return {
          questionId: q.id,
          questionText: q.text,
          category: q.category,
          value: resp?.value || '',
          isFlagged: Boolean(resp?.isFlagged),
          notes: resp?.notes || '',
          photoUrl: resp?.photoUrl || flagIssues[q.id]?.photoUrl || null as any,
          equipmentId: linked?.equipmentId || q.equipmentId || null as any,
          equipmentName: linked?.equipmentName || q.equipmentName || null as any
        };
      });

      const flaggedList = Object.entries(flagIssues).map(([qId, issueData]) => {
        const question = questions.find(q => q.id === qId);
        const response = responses[qId];
        const quantities = issueData.description.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
        const linked = linkedByQuestion.get(qId) || null;
        return {
          equipmentId: linked?.equipmentId || question?.equipmentId || null,
          equipmentName:
            linked?.equipmentName ||
            question?.equipmentFamily ||
            question?.equipmentName ||
            issueData.title ||
            'Equipment Item',
          title: issueData.title || 'Flagged Issue',
          description: issueData.description || '',
          questionType: question?.type,
          value: response?.value,
          reportedQuantity: quantities.length >= 2 ? quantities[0] : null,
          requiredQuantity: quantities.length >= 2 ? quantities[1] : null,
          photoUrl: issueData.photoUrl || null
        };
      });

      const payload = {
        vehicleId: vehicle.id,
        userId: user?.id || 'emp-anon',
        userName: user?.name || 'Employee Operator',
        userEmail: user?.email || 'employee@sunnyfleet.com',
        responses: inspectionResponses,
        flaggedIssues: flaggedList,
        generalNotes: generalNotes.trim() || null,
        photoUrls: generalPhotos.length > 0 ? generalPhotos : null,
        odometer: collectOdometer ? parsedOdo : null,
        fuelLevel: collectFuelLevel ? Number(fuelLevel) : null,
        signatureBase64: signatureBase64 || null,
        taskId: selectedTaskId || null,
        scheduleLabel: selectedTask?.scheduleLabel || null,
        scheduledAt: selectedTask?.dueAt || null
      };

      // Offline submission check
      if (!navigator.onLine) {
        const nowIso = new Date().toISOString();
        const offlineInspection: Inspection = {
          id: `offline-${Date.now()}`,
          vehicleId: vehicle.id,
          vehicleNumber: vehicle.vehicleNumber,
          userId: payload.userId,
          userName: payload.userName,
          userEmail: payload.userEmail,
          status: flaggedList.length > 0 ? 'issues_found' : 'passed',
          startedAt: nowIso,
          submittedAt: nowIso,
          dateString: nowIso.split('T')[0],
          responses: inspectionResponses,
          issueIds: [],
          generalNotes: payload.generalNotes || undefined,
          odometer: payload.odometer ?? undefined,
          fuelLevel: payload.fuelLevel ?? undefined,
          signatureBase64: payload.signatureBase64 || undefined,
          photoUrls: payload.photoUrls || undefined,
          taskId: payload.taskId,
          scheduleLabel: payload.scheduleLabel,
          scheduledAt: payload.scheduledAt
        };
        dbService.saveOfflineInspection(offlineInspection);
        setOfflineCount(dbService.getOfflineInspections().length);

        const offlineResult = {
          inspection: { ...offlineInspection, isOfflineQueued: true },
          newIssues: flaggedList
        };

        setSubmittedInspection(offlineResult);
        const draftKey = `sunny_inspection_draft_${vehicleId}`;
        localStorage.removeItem(draftKey);
        return;
      }

      // If resubmitting a rejected inspection
      if (rejectedInspection) {
        const result = await dbService.resubmitInspection(
          rejectedInspection.id,
          inspectionResponses,
          generalNotes.trim() || undefined
        );
        
        setSubmittedInspection(result);
        
        // Clear rejection and draft
        const rejectedKey = `sunny_inspection_rejected_${vehicleId}_${user?.id}`;
        localStorage.removeItem(rejectedKey);
        const draftKey = `sunny_inspection_draft_${vehicleId}`;
        localStorage.removeItem(draftKey);
      } else {
        const result = dbService.submitInspection(payload);

        setSubmittedInspection(result);
        
        // Clear draft
        const draftKey = `sunny_inspection_draft_${vehicleId}`;
        localStorage.removeItem(draftKey);
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTask = tasks.find(task => task.id === selectedTaskId);
  const kind = vehicle ? occupancyKind(vehicle, user?.id) : 'free';
  const inspectedToday = vehicle
    ? vehicleInspectedOnLocalDay(vehicle, dbService.getInspections())
    : false;

  const handleTakeOver = async (thenInspect: boolean) => {
    if (!vehicle || !user) return;
    try {
      setOccupancyBusy(true);
      await dbService.checkOutVehicle(vehicle.id, { id: user.id, name: user.name });
      const next = dbService.getVehicle(vehicle.id);
      if (next) setVehicle(next);
      if (thenInspect) {
        /* stay on inspect — occupancy is now mine */
      } else {
        router.push(employeeFlow ? '/home' : '/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Could not take over this van');
    } finally {
      setOccupancyBusy(false);
    }
  };

  const handleReturnToShop = async () => {
    if (!vehicle) return;
    try {
      setOccupancyBusy(true);
      await dbService.checkInVehicle(vehicle.id);
      router.push(employeeFlow ? '/home' : '/dashboard');
    } catch (err: any) {
      alert(err.message || 'Could not return van');
    } finally {
      setOccupancyBusy(false);
    }
  };

  if (submittedInspection) {
    const isPassed = submittedInspection.inspection.status === 'passed';
    return (
      <div className="page max-w-lg mx-auto py-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="card card-pad text-center">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
            isPassed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {isPassed ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
          </div>

          <h2 className="text-2xl font-extrabold text-ink mb-1">
            Inspection Submitted!
          </h2>
          <p className="text-xs text-ink-muted mb-6">
            Permanent record logged on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>

          <div className="card card-pad mb-6 text-left text-xs space-y-2 bg-[var(--surface)]">
            <div className="flex justify-between">
              <span className="text-ink-muted">Vehicle:</span>
              <span className="font-bold text-ink">{vehicle.vehicleNumber} ({vehicle.licensePlate})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Operator:</span>
              <span className="font-bold text-ink">{user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Overall Result:</span>
              <span className={`font-bold ${isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isPassed ? 'PASSED — All Green' : `ISSUES FOUND (${submittedInspection.newIssues.length} Flagged)`}
              </span>
            </div>
          </div>

          <div className="mb-6 text-left">
            <RecentInspectors vehicleId={vehicle.id} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/scan" className="btn btn-primary flex-1 justify-center">
              {employeeFlow ? 'Back to Scanner' : 'Scan Another Vehicle'}
            </Link>
            {!employeeFlow && (
              <Link
                href={`/vehicles/detail?id=${encodeURIComponent(vehicle.id)}`}
                className="btn btn-secondary flex-1 justify-center"
              >
                View Vehicle Timeline
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'theirs') {
    return (
      <div className="page max-w-md mx-auto py-8">
        <div className="card card-pad stack">
          <h1 className="card-title">{vehicle.vehicleNumber} is in use</h1>
          <p className="text-sm text-ink-muted">
            {vehicle.currentUserName || 'Another driver'} has this van since {formatCheckoutStarted(vehicle)}.
            Take over to become the current driver.
            {inspectedToday ? ' A checklist was already submitted today — inspect again only if you need a new record.' : ' This van has not been inspected yet today.'}
          </p>
          <div className="stack gap-2">
            {inspectedToday ? (
              <>
                <button type="button" className="btn btn-primary" disabled={occupancyBusy || !user} onClick={() => void handleTakeOver(false)}>
                  {occupancyBusy ? 'Working...' : 'Take over'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={occupancyBusy || !user} onClick={() => void handleTakeOver(true)}>
                  Take over and inspect
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary" disabled={occupancyBusy || !user} onClick={() => void handleTakeOver(true)}>
                  {occupancyBusy ? 'Working...' : 'Take over and inspect'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={occupancyBusy || !user} onClick={() => void handleTakeOver(false)}>
                  Take over without inspecting
                </button>
              </>
            )}
            <Link href="/scan" className="btn btn-ghost">Cancel</Link>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = requiredQuestions.length
    ? (answeredCount / requiredQuestions.length) * 100
    : 0;

  return (
    <div className="page max-w-2xl mx-auto space-y-5 pb-12">
      {/* Offline Sync Banner */}
      {(!isOnline || offlineCount > 0) && (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 sticky top-2 z-20 shadow-sm ${
          !isOnline ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <WifiOff className="w-5 h-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-xs font-extrabold">
                {!isOnline ? 'You are currently offline' : 'Pending Offline Submissions'}
              </div>
              <p className="text-[11px] opacity-90 truncate">
                {offlineCount > 0
                  ? `${offlineCount} inspection(s) stored locally — will auto-sync when connection restores.`
                  : 'Submissions will be saved locally and auto-synced once back online.'}
              </p>
            </div>
          </div>
          {isOnline && offlineCount > 0 && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncingOffline}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
              <span>{isSyncingOffline ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      )}

      {/* Rejected Inspection Banner */}
      {rejectedInspection && (
        <RejectedInspectionBanner
          inspection={rejectedInspection}
          questions={questions}
          onClose={() => setRejectedInspection(null)}
        />
      )}

      {/* Auto-save Indicator */}
      {isSaved && lastSaveTime && (
        <div className="text-xs text-emerald-600 flex items-center gap-1 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Draft saved at {lastSaveTime.toLocaleTimeString()}</span>
        </div>
      )}

      {/* Draft Recovery Prompt */}
      {showDraftRecovery && !rejectedInspection && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 flex gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-900">Resume from draft?</p>
            <p className="text-xs text-blue-700 mt-1">
              We found an auto-saved inspection for this vehicle. Continue where you left off?
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setShowDraftRecovery(false);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded font-bold text-xs hover:bg-blue-700"
            >
              Resume
            </button>
            <button
              onClick={() => {
                const draftKey = `sunny_inspection_draft_${vehicleId}`;
                localStorage.removeItem(draftKey);
                setResponses({});
                setFlagIssues({});
                setGeneralNotes('');
                setGeneralPhotos([]);
                setSignatureBase64(null);
                setShowDraftRecovery(false);
              }}
              className="px-3 py-1 bg-gray-300 text-gray-800 rounded font-bold text-xs hover:bg-gray-400"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Link href="/scan" className="btn btn-secondary btn-sm cluster gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>Rescan QR</span>
        </Link>
        <div className="flex items-center gap-2">
          {employeeFlow && (
            <span className="text-xs font-bold text-ink bg-surface-sunk px-3 py-1.5 rounded-xl border border-line">
              Employee To-Do
            </span>
          )}
          {flaggedCount > 0 ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {flaggedCount} Item{flaggedCount > 1 ? 's' : ''} Flagged
            </span>
          ) : answeredCount === requiredQuestions.length && flaggedCount === 0 ? (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              All Clear
            </span>
          ) : null}
        </div>
      </div>

      <div className="card card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="cluster items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface-sunk text-ink flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="cluster flex-wrap gap-2">
              <h1 className="text-base font-extrabold text-ink">{vehicle.vehicleNumber}</h1>
              <span className="unit-tag">{vehicle.licensePlate}</span>
            </div>
            <p className="text-xs text-ink-muted">{vehicle.name}</p>
          </div>
        </div>

        <div className="cluster items-center gap-2 self-end sm:self-auto bg-surface-sunk p-2 rounded-xl border border-line">
          <UserIcon className="w-4 h-4 text-ink" />
          <div className="text-left">
            <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">Operator</div>
            {employeeFlow ? (
              <div className="text-xs font-bold text-ink">{user?.name || 'Employee Operator'}</div>
            ) : (
              <select
                value={user?.id || ''}
                onChange={(e) => {
                  const selected = dbService.getUser(e.target.value);
                  if (selected) {
                    localStorage.setItem('sunny_current_user_id', selected.id);
                    window.dispatchEvent(new Event('sunny_db_update'));
                  }
                }}
                className="text-xs font-bold text-ink bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
              >
                {dbService.getUsers().map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {kind === 'mine' && (
        <div className="card card-pad spread items-center flex-wrap gap-2" data-status="info">
          <p className="text-sm">
            You have {vehicle.vehicleNumber} since {formatCheckoutStarted(vehicle)}. Inspect again if you need another record, or return it to the shop.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={occupancyBusy} onClick={() => void handleReturnToShop()}>
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            Return to shop
          </button>
        </div>
      )}

      {(collectOdometer || collectFuelLevel) && (
      <div className="card card-pad space-y-4 bg-surface border border-line">
        <div className="border-b border-line pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-ink" />
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
              Vehicle Readings & Pre-Trip Check
            </h2>
          </div>
          {collectOdometer && vehicle.odometer ? (
            <span className="text-[11px] text-ink-muted">
              Last Odometer: <strong>{vehicle.odometer.toLocaleString()} mi</strong>
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {collectOdometer && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink flex items-center justify-between">
              <span>Current Odometer (Miles)</span>
              {odometer && vehicle.odometer && Number(odometer) < vehicle.odometer && (
                <span className="text-[10px] text-rose-600 font-extrabold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Lower than last record
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="e.g. 45200"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-ink/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-faint pointer-events-none">
                MI
              </span>
            </div>
          </div>
          )}

          {collectFuelLevel && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-ink-muted" />
                <span>Fuel Level: <strong>{fuelLevel}%</strong></span>
              </label>
              <div className="flex gap-1">
                {[25, 50, 75, 100].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFuelLevel(lvl)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                      fuelLevel === lvl
                        ? 'bg-ink text-white border-ink'
                        : 'bg-surface-sunk text-ink-muted border-line hover:text-ink'
                    }`}
                  >
                    {lvl === 100 ? 'Full' : `${lvl}%`}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={fuelLevel}
              onChange={(e) => setFuelLevel(Number(e.target.value))}
              className="w-full h-2 bg-surface-sunk rounded-lg appearance-none cursor-pointer accent-ink"
            />
          </div>
          )}
        </div>
      </div>
      )}

      <div className="sticky top-2 z-10 card card-pad space-y-3 shadow-sm">
        <div className="border-b border-line pb-2.5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
              Checklist Progress
            </h2>
            <p className="text-sm font-semibold text-ink mt-0.5">
              Answered {answeredCount} / {requiredQuestions.length}
            </p>
          </div>
          <span className="text-xs font-bold text-ink-muted tabular-nums shrink-0">
            {Math.round(progressPercent)}%
          </span>
        </div>

        <div className="h-2 bg-surface-sunk rounded-full overflow-hidden border border-line">
          <div
            className="h-full bg-ink rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {categories.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">
              Jump to category
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border border-line bg-surface-sunk text-ink-muted hover:text-ink hover:bg-surface-alt transition-colors"
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card card-pad space-y-6">
        <div className="border-b border-line pb-3">
          <h2 className="text-base font-bold text-ink">
            Inspection Checklist
          </h2>
          <p className="text-xs text-ink-faint mt-0.5">
            Complete all required items before vehicle checkout.
          </p>
        </div>

        <div className="space-y-8">
          {categories.map(cat => {
            const categoryQuestions = questions
              .filter(q => q.category === cat.id)
              .sort((a, b) => a.order - b.order);

            return (
              <section key={cat.id} id={`cat-${cat.id}`} className="space-y-3 scroll-mt-24">
                <div>
                  <h2 className="text-sm font-extrabold text-ink uppercase tracking-wide">
                    {cat.title}
                  </h2>
                  {cat.subtitle && (
                    <p className="text-xs text-ink-muted mt-0.5">{cat.subtitle}</p>
                  )}
                </div>

                <div className="space-y-4">
                  {categoryQuestions.map((q) => {
                    const resp = responses[q.id];
                    const isFlagged = Boolean(resp?.isFlagged);
                    const currentIssue = flagIssues[q.id];

                    return (
                      <div
                        key={q.id}
                        id={`question-${q.id}`}
                        className={`p-4 rounded-2xl border transition-all scroll-mt-24 ${
                          isFlagged
                            ? 'border-amber-300 bg-amber-50/40'
                            : 'border-line bg-surface-sunk/50 hover:bg-surface-sunk'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-ink leading-snug">{q.text}</p>
                            {q.helperText && (
                              <p className="text-[11px] text-ink-faint mt-0.5">{q.helperText}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {(q.type === 'equipment_status' || q.type === 'equipment_check' || q.type === 'pass_fail' || q.type === 'yes_no') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const labels = getBinaryButtonLabels(q.type);
                                    const value = labels.positiveValue;
                                    handleSetResponse(q, value, answerIndicatesIssue(q, value));
                                  }}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    !isFlagged && resp?.value && (resp.value === 'working' || resp.value === 'pass' || resp.value === 'yes')
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
                                  }`}
                                >
                                  {getBinaryButtonLabels(q.type).positive}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const labels = getBinaryButtonLabels(q.type);
                                    const value = labels.negativeValue;
                                    handleSetResponse(q, value, answerIndicatesIssue(q, value));
                                  }}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isFlagged
                                      ? 'bg-amber-500 text-white shadow-sm'
                                      : 'bg-surface border border-line text-amber-700 hover:bg-amber-50'
                                  }`}
                                >
                                  {getBinaryButtonLabels(q.type).negative}
                                </button>
                              </>
                            )}

                            {q.type === 'checkbox' && (
                              <label className="inline-flex items-center gap-2 text-sm font-bold text-ink cursor-pointer px-2 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-alt">
                                <input
                                  type="checkbox"
                                  checked={resp?.value === 'checked'}
                                  onChange={(e) =>
                                    handleSetResponse(q, e.target.checked ? 'checked' : '', false)
                                  }
                                  className="w-4 h-4 rounded border-slate-300 text-ink focus:ring-ink/20"
                                />
                                <span>Done</span>
                              </label>
                            )}

                            {q.type === 'text' && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSetResponse(q, resp?.value || '', !isFlagged)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    isFlagged
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
                                  }`}
                                >
                                  {isFlagged ? '⚠️ Flagged' : 'Flag Concern'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {q.type === 'text' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              placeholder="Type note or response..."
                              value={resp?.value || ''}
                              onChange={(e) => handleSetResponse(q, e.target.value, isFlagged)}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-ink/20"
                            />
                          </div>
                        )}

                        {q.type === 'photo' && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-surface-alt transition-colors">
                                <Camera className="w-3.5 h-3.5" />
                                <span>{resp?.photoUrl ? 'Change photo' : 'Take / attach photo'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      processImageFile(file, (dataUrl) => {
                                        handleSetResponse(q, 'captured', isFlagged, undefined, dataUrl);
                                      });
                                    }
                                  }}
                                />
                              </label>
                              {resp?.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleSetResponse(q, '', isFlagged, undefined, '')}
                                  className="text-xs text-[var(--critical)] hover:underline flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> Remove photo
                                </button>
                              )}
                            </div>
                            {resp?.photoUrl ? (
                              <img
                                src={resp.photoUrl}
                                alt="Captured answer"
                                className="w-28 h-28 object-cover rounded-xl border border-line"
                              />
                            ) : q.required ? (
                              <p className="text-[11px] text-ink-faint">A photo is required for this item.</p>
                            ) : null}
                          </div>
                        )}

                        {isFlagged && (
                          <div className="mt-3 pt-3 border-t border-amber-200/80 bg-amber-100/40 p-3 rounded-xl space-y-3 animate-in fade-in duration-150">
                            {q.equipmentFamily && vehicle && (() => {
                              const candidates = listVehicleEquipmentForFamily(
                                dbService.getEquipment(),
                                vehicle.id,
                                q.equipmentFamily
                              );
                              if (candidates.length === 0) {
                                return (
                                  <p className="text-[11px] font-semibold text-amber-900 m-0">
                                    No {q.equipmentFamily} assigned to this van — issue will not link to a
                                    specific unit.
                                  </p>
                                );
                              }
                              if (candidates.length === 1) {
                                return (
                                  <p className="text-[11px] text-amber-800/80 m-0">
                                    Links to {candidates[0].name}
                                  </p>
                                );
                              }
                              return (
                                <div>
                                  <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                                    Select which {q.equipmentFamily} this flag applies to
                                  </label>
                                  <select
                                    value={equipmentPicks[q.id] || ''}
                                    onChange={e =>
                                      setEquipmentPicks(prev => ({ ...prev, [q.id]: e.target.value }))
                                    }
                                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-surface focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                                    required
                                  >
                                    <option value="">Choose unit…</option>
                                    {candidates.map(c => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })()}
                            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Optional notes for the permanent log
                            </div>
                            <input
                              type="text"
                              placeholder="Issue title (e.g. Hose leak, Missing towel pack)"
                              value={currentIssue?.title || ''}
                              onChange={(e) => handleIssueChange(q.id, 'title', e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-surface focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            />
                            {q.reasonPresets && q.reasonPresets.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {q.reasonPresets.map(reason => (
                                  <button
                                    key={reason}
                                    type="button"
                                    onClick={() => handleIssueChange(q.id, 'description', currentIssue?.description ? `${currentIssue.description}, ${reason}` : reason)}
                                    className="px-2 py-1 rounded-lg bg-surface border border-amber-200 text-[10px] font-bold text-amber-800 hover:bg-amber-50"
                                  >
                                    {reason}
                                  </button>
                                ))}
                              </div>
                            )}
                            <textarea
                              rows={2}
                              placeholder="Optional: describe what is wrong or needs repair..."
                              value={currentIssue?.description || ''}
                              onChange={(e) => handleIssueChange(q.id, 'description', e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-surface focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />

                            {/* Photo only when photoRequirement === 'required' */}
                            {shouldShowPhotoCapture(q) && (
                            <div className="pt-1">
                              <div className="flex items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-surface text-xs font-bold text-amber-900 hover:bg-amber-50 transition-colors shadow-xs">
                                  <Camera className="w-3.5 h-3.5 text-amber-700" />
                                  <span>{currentIssue?.photoUrl ? 'Change Photo' : 'Attach required photo'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="sr-only"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        processImageFile(file, (dataUrl) => {
                                          handleIssueChange(q.id, 'photoUrl', dataUrl);
                                        });
                                      }
                                    }}
                                  />
                                </label>
                                {currentIssue?.photoUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleIssueChange(q.id, 'photoUrl', '')}
                                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                                  >
                                    <X className="w-3.5 h-3.5" /> Remove Photo
                                  </button>
                                )}
                              </div>
                              {currentIssue?.photoUrl && (
                                <div className="mt-2 relative inline-block">
                                  <img
                                    src={currentIssue.photoUrl}
                                    alt="Issue capture preview"
                                    className="w-24 h-24 object-cover rounded-lg border border-amber-300 shadow-sm"
                                  />
                                </div>
                              )}
                            </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {categoryQuestions.length === 0 && (
                    <div className="text-center py-6 bg-surface-sunk rounded-2xl border border-line text-xs text-ink-faint">
                      No questions configured in this category yet.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card card-pad space-y-5">
        {tasks.length > 0 && (
          <div className="p-3 rounded-2xl bg-surface-sunk border border-line">
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">Scheduled inspection / task</label>
            <select
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface"
            >
              <option value="">Unscheduled inspection</option>
              {tasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                  {task.status === 'completed' ? ' (completed)' : ''}
                  {task.dueAt ? ` · ${new Date(task.dueAt).toLocaleString()}` : ''}
                </option>
              ))}
            </select>
            {selectedTask?.status === 'completed' && (
              <p className="text-[11px] text-amber-700 mt-1">
                This scheduled task was already completed; submitting will create an additional intentional record.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
            General Inspection Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Any additional remarks, route notes, or route prep info..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-ink/20"
          />
        </div>

        {/* General Overview Photos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-ink-muted" />
              <span>Inspection Overview Photos (Optional)</span>
            </label>
            <label className="cursor-pointer inline-flex items-center gap-1 text-xs font-bold text-ink hover:text-ink-muted">
              <Camera className="w-3.5 h-3.5" />
              <span>Add Photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  files.forEach(file => {
                    processImageFile(file, (dataUrl) => {
                      setGeneralPhotos(prev => [...prev, dataUrl]);
                    });
                  });
                }}
              />
            </label>
          </div>
          {generalPhotos.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {generalPhotos.map((pUrl, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={pUrl}
                    alt={`Photo ${idx + 1}`}
                    className="w-20 h-20 object-cover rounded-xl border border-line"
                  />
                  <button
                    type="button"
                    onClick={() => setGeneralPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5 shadow-sm hover:bg-rose-700"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4.2 Digital Operator Signature */}
        <div className="pt-2 border-t border-line">
          <SignaturePad
            value={signatureBase64}
            onChange={setSignatureBase64}
            label="Digital Operator Signature (Pre-Trip / Checkout)"
          />
        </div>

        
        {unansweredQuestions.length > 0 && (
          <div className="mb-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
            <p className="text-xs font-bold text-amber-900">
              {unansweredQuestions.length} unanswered required question{unansweredQuestions.length === 1 ? '' : 's'}
            </p>
            <ul className="text-[11px] text-amber-800 list-disc pl-4 space-y-0.5">
              {unansweredQuestions.slice(0, 6).map(q => (
                <li key={q.id}>{q.text || q.id}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                const first = unansweredQuestions[0];
                if (!first) return;
                const el = document.getElementById(`question-${first.id}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.classList.add('ring-2', 'ring-amber-400');
                setTimeout(() => el?.classList.remove('ring-2', 'ring-amber-400'), 1600);
              }}
              className="text-xs font-bold text-amber-900 underline"
            >
              Take me to unanswered
            </button>
          </div>
        )}
<button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary btn-block py-4 rounded-2xl text-sm font-extrabold gap-2 active:scale-[0.99]"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Submitting to Fleet Log...' : 'Submit Vehicle Inspection'}</span>
        </button>
        {!isSubmitting && !allRequiredAnswered && (
          <p className="text-center text-xs text-ink-muted">
            Answer every required question before submitting.
          </p>
        )}
        
      </form>
    </div>
  );
}
