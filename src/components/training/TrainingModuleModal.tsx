import React, { useState } from 'react';
import {
  CheckCircle2,
  BookOpen,
  Clock,
  AlertTriangle,
  Lightbulb,
  Info,
  ChevronRight,
  ChevronLeft,
  X,
  ExternalLink,
} from 'lucide-react';
import type { TrainingItem, TrainingCard } from '@/lib/training/types';

export interface TrainingModuleModalProps {
  item: TrainingItem;
  isOpen: boolean;
  canCertify: boolean;
  busy: boolean;
  onClose: () => void;
  onCertify?: () => void;
}

export function TrainingModuleModal({
  item,
  isOpen,
  canCertify,
  busy,
  onClose,
  onCertify,
}: TrainingModuleModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const cards: TrainingCard[] = item.cards && item.cards.length > 0
    ? item.cards
    : [
        {
          id: 'summary-card',
          title: item.title,
          content: item.description || 'Follow the procedures demonstrated by your trainer.',
          imageUrl: item.coverImageUrl,
          calloutType: 'tip',
          calloutText: 'Ensure you review all equipment settings and verify with your trainer.',
        },
      ];

  const activeCard = cards[currentStep] || cards[0];
  const isLastStep = currentStep === cards.length - 1;

  const renderCalloutIcon = (type?: 'info' | 'warning' | 'tip') => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'tip':
        return <Lightbulb className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-module-title"
    >
      <div className="bg-[var(--surface)] text-[var(--foreground)] w-full max-w-xl rounded-2xl border border-[var(--line)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between gap-3 bg-[var(--surface-muted,#18181b)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="capitalize font-medium text-[var(--primary,#f59e0b)]">
                {item.category || 'General'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.estimatedMinutes || 3} min
              </span>
              <span>•</span>
              <span>
                Step {currentStep + 1} of {cards.length}
              </span>
            </div>
            <h3
              id="training-module-title"
              className="text-base font-semibold m-0 truncate"
            >
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover,#27272a)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close training module"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-[var(--line)] h-1.5">
          <div
            className="bg-[var(--primary,#f59e0b)] h-1.5 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / cards.length) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Card Image */}
          {activeCard.imageUrl ? (
            <div className="rounded-xl overflow-hidden border border-[var(--line)] bg-black/20 aspect-video flex items-center justify-center relative">
              <img
                src={activeCard.imageUrl}
                alt={activeCard.title || item.title}
                className="w-full h-full object-cover"
              />
              {activeCard.imageCaption ? (
                <div className="absolute bottom-0 inset-x-0 bg-black/70 p-2 text-xs text-white">
                  {activeCard.imageCaption}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Card Title & Content */}
          <div className="space-y-2">
            {activeCard.title ? (
              <h4 className="text-base font-medium m-0">{activeCard.title}</h4>
            ) : null}
            <div className="text-sm leading-relaxed whitespace-pre-line text-[var(--foreground)]">
              {activeCard.content}
            </div>
          </div>

          {/* Callout Box */}
          {activeCard.calloutText ? (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                activeCard.calloutType === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : activeCard.calloutType === 'tip'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-200'
              }`}
            >
              {renderCalloutIcon(activeCard.calloutType)}
              <div className="leading-snug">{activeCard.calloutText}</div>
            </div>
          ) : null}

          {/* Key Takeaways (if on first step and present) */}
          {currentStep === 0 && item.keyTakeaways && item.keyTakeaways.length > 0 ? (
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle,#1c1917)] space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] m-0">
                Key Takeaways
              </h5>
              <ul className="text-xs space-y-1.5 m-0 pl-4 list-disc text-[var(--foreground)]">
                {item.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx}>{takeaway}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--surface-muted,#18181b)] flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>

          <div className="flex items-center gap-2">
            {!isLastStep ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setCurrentStep((prev) => Math.min(cards.length - 1, prev + 1))}
              >
                Next Step
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            ) : canCertify ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => {
                  if (onCertify) onCertify();
                  onClose();
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-white" />
                I was trained — certify
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onClose}
              >
                Finish Review
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
