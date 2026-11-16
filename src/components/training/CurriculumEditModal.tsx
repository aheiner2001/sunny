import React, { useState } from 'react';
import { X, Image as ImageIcon, Clock, Lightbulb, AlertTriangle, Info, Plus, Trash2 } from 'lucide-react';
import type { TrainingItem, TrainingCategory, TrainingCard } from '@/lib/training/types';

export interface CurriculumEditModalProps {
  item: TrainingItem;
  isOpen: boolean;
  busy?: boolean;
  onClose: () => void;
  onSave: (updatedItem: TrainingItem) => Promise<void>;
}

export function CurriculumEditModal({
  item,
  isOpen,
  busy,
  onClose,
  onSave,
}: CurriculumEditModalProps) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');
  const [category, setCategory] = useState<TrainingCategory>(item.category || 'general');
  const [coverImageUrl, setCoverImageUrl] = useState(item.coverImageUrl || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(item.estimatedMinutes || 3);
  const [takeawayText, setTakeawayText] = useState((item.keyTakeaways || []).join('\n'));
  const [cards, setCards] = useState<TrainingCard[]>(
    item.cards && item.cards.length > 0
      ? item.cards
      : [
          {
            id: 'card-1',
            title: item.title,
            content: item.description || '',
            imageUrl: item.coverImageUrl || '',
            calloutType: 'tip',
            calloutText: '',
          },
        ]
  );

  if (!isOpen) return null;

  const handleAddCard = () => {
    setCards((prev) => [
      ...prev,
      {
        id: `card-${Date.now()}`,
        title: `Step ${prev.length + 1}`,
        content: '',
        imageUrl: '',
        calloutType: 'tip',
        calloutText: '',
      },
    ]);
  };

  const handleUpdateCard = (index: number, patch: Partial<TrainingCard>) => {
    setCards((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleDeleteCard = (index: number) => {
    if (cards.length <= 1) return;
    setCards((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const keyTakeaways = takeawayText
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    const updated: TrainingItem = {
      ...item,
      title: title.trim() || item.title,
      description: description.trim(),
      category,
      coverImageUrl: coverImageUrl.trim(),
      estimatedMinutes: Number(estimatedMinutes) || 3,
      keyTakeaways,
      cards: cards.filter((c) => c.title || c.content || c.imageUrl),
      updatedAt: new Date().toISOString(),
    };

    await onSave(updated);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="curriculum-edit-title"
    >
      <div className="bg-[var(--surface,#18181b)] text-[var(--foreground)] w-full max-w-2xl rounded-2xl border border-[var(--line,#27272a)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--line,#27272a)] flex items-center justify-between gap-3 bg-[var(--surface-muted,#121214)]">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-[var(--primary,#f59e0b)]">
              Khan Academy Microlearning Module Editor
            </span>
            <h3 id="curriculum-edit-title" className="text-base font-bold m-0 text-white">
              Edit Learning Module: {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1 text-sm">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Module Title</label>
              <input
                className="input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Category</label>
              <select
                className="input w-full capitalize"
                value={category}
                onChange={(e) => setCategory(e.target.value as TrainingCategory)}
              >
                <option value="inspection">Inspection</option>
                <option value="safety">Safety</option>
                <option value="chemicals">Chemicals</option>
                <option value="equipment">Equipment</option>
                <option value="maintenance">Maintenance</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Time & Cover Image */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Est. Duration (Minutes)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="input w-full"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Cover / Diagram Image URL</label>
              <input
                className="input w-full"
                placeholder="https://example.com/photo.jpg"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Short Summary / Instructions</label>
            <textarea
              className="input w-full h-20 py-2"
              placeholder="Brief explanation of why this step is performed and what to verify."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Key Takeaways */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">
              Key Takeaways (1 per line — rendered as bullet points)
            </label>
            <textarea
              className="input w-full h-20 py-2 font-mono text-xs"
              placeholder="Always wear eye protection&#10;Verify pressure valve is set to green zone&#10;Check oil sight glass before starting"
              value={takeawayText}
              onChange={(e) => setTakeawayText(e.target.value)}
            />
          </div>

          {/* Step Cards Section */}
          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 m-0">
                  Step-by-Step Lesson Cards ({cards.length})
                </h4>
                <p className="text-xs text-zinc-400 m-0">
                  Trainees will swipe through these cards in the Khan-style lesson runner modal.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-xs gap-1"
                onClick={handleAddCard}
              >
                <Plus className="h-3 w-3" />
                Add Step Card
              </button>
            </div>

            <div className="space-y-3">
              {cards.map((card, idx) => (
                <div
                  key={card.id}
                  className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-300">Step {idx + 1}</span>
                    {cards.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-300"
                        onClick={() => handleDeleteCard(idx)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <input
                    className="input w-full text-xs"
                    placeholder="Step Title (e.g. Inspect the pressure gauge)"
                    value={card.title || ''}
                    onChange={(e) => handleUpdateCard(idx, { title: e.target.value })}
                  />

                  <textarea
                    className="input w-full h-16 py-1.5 text-xs"
                    placeholder="Step guidance or procedural explanation..."
                    value={card.content}
                    onChange={(e) => handleUpdateCard(idx, { content: e.target.value })}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      className="input w-full text-xs"
                      placeholder="Step Image URL (optional)"
                      value={card.imageUrl || ''}
                      onChange={(e) => handleUpdateCard(idx, { imageUrl: e.target.value })}
                    />
                    <input
                      className="input w-full text-xs"
                      placeholder="Pro-Tip or Warning callout text"
                      value={card.calloutText || ''}
                      onChange={(e) => handleUpdateCard(idx, { calloutText: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-zinc-800 pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={busy}
            >
              Save Learning Module
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
