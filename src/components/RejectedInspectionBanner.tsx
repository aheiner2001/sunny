'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Inspection, ChecklistQuestion } from '@/types';

interface RejectedInspectionBannerProps {
  inspection: Inspection;
  questions: ChecklistQuestion[];
  onClose?: () => void;
}

export function RejectedInspectionBanner({
  inspection,
  questions,
  onClose
}: RejectedInspectionBannerProps) {
  if (inspection.status !== 'rejected') return null;

  const flaggedQuestions = inspection.flaggedForCorrection
    ? questions.filter(q => inspection.flaggedForCorrection?.includes(q.id))
    : [];

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4 relative">
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-red-900 text-sm">Inspection Needs Corrections</h3>
          
          <p className="text-xs text-red-700 mt-1">
            Rejected by <span className="font-semibold">{inspection.rejectedBy}</span> on{' '}
            <span className="font-semibold">
              {new Date(inspection.rejectedAt!).toLocaleDateString()}
            </span>
          </p>

          {inspection.rejectionReason && (
            <div className="mt-2 bg-red-100 rounded p-2">
              <p className="text-xs font-semibold text-red-900">Reason:</p>
              <p className="text-xs text-red-800 mt-1">{inspection.rejectionReason}</p>
            </div>
          )}

          {flaggedQuestions.length > 0 && (
            <div className="mt-3 bg-red-100 rounded p-2">
              <p className="text-xs font-semibold text-red-900 mb-1">
                {flaggedQuestions.length} question(s) need attention:
              </p>
              <ul className="text-xs text-red-800 space-y-1">
                {flaggedQuestions.map(q => (
                  <li key={q.id} className="ml-4">
                    • {q.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-red-700 mt-3 italic">
            Please review and correct the flagged areas below, then resubmit the inspection.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
