'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  RotateCcw, 
  ListChecks, 
  ShieldCheck, 
  CheckCircle2, 
  CloudUpload, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Sparkles, 
  Wrench, 
  Truck, 
  FileText,
  HelpCircle,
  Save,
  Check
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { ChecklistQuestion, ChecklistCategoryConfig, QuestionType, ChecklistConfig } from '@/types';

export default function SettingsPage() {
  const [categories, setCategories] = useState<ChecklistCategoryConfig[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ChecklistCategoryConfig | null>(null);
  const [categoryForm, setCategoryForm] = useState<{
    id: string;
    title: string;
    subtitle: string;
    iconName: string;
  }>({
    id: '',
    title: '',
    subtitle: '',
    iconName: 'Wrench'
  });

  // Question Modal State
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ChecklistQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState<{
    text: string;
    category: string;
    type: QuestionType;
    required: boolean;
    helperText: string;
    equipmentName: string;
  }>({
    text: '',
    category: 'equipment',
    type: 'pass_fail',
    required: true,
    helperText: '',
    equipmentName: ''
  });

  const loadData = () => {
    const config = dbService.getChecklistConfig();
    setCategories(config.categories || []);
    setQuestions(config.questions || []);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  // Save current state directly to Firestore
  const handleSaveToFirestore = async () => {
    try {
      setIsSaving(true);
      setSaveStatus(null);

      const config: ChecklistConfig = {
        id: 'standard-detailing-checklist',
        name: 'Standard Detailing Checklist',
        categories,
        questions,
        updatedAt: new Date().toISOString()
      };

      await dbService.saveChecklistConfig(config);
      setSaveStatus('Checklist saved & synchronized to Cloud Firestore!');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error saving checklist');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToBaseline = async () => {
    if (confirm('Are you sure you want to reset all checklist categories and questions to the standard detailing baseline?')) {
      await dbService.resetChecklistToDefaults();
      loadData();
      setSaveStatus('Checklist reset to standard baseline.');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // ==========================================
  // Category Handlers
  // ==========================================
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      id: `cat-${Date.now()}`,
      title: '',
      subtitle: '',
      iconName: 'Wrench'
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ChecklistCategoryConfig) => {
    setEditingCategory(cat);
    setCategoryForm({
      id: cat.id,
      title: cat.title,
      subtitle: cat.subtitle,
      iconName: cat.iconName || 'Wrench'
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.title.trim()) {
      alert('Please enter a category title.');
      return;
    }

    let updatedCats: ChecklistCategoryConfig[];
    const catId = editingCategory ? editingCategory.id : (categoryForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

    if (editingCategory) {
      updatedCats = categories.map(c => c.id === editingCategory.id ? {
        ...c,
        title: categoryForm.title.trim(),
        subtitle: categoryForm.subtitle.trim(),
        iconName: categoryForm.iconName
      } : c);
    } else {
      const newCat: ChecklistCategoryConfig = {
        id: catId,
        title: categoryForm.title.trim(),
        subtitle: categoryForm.subtitle.trim(),
        order: categories.length + 1,
        iconName: categoryForm.iconName
      };
      updatedCats = [...categories, newCat];
    }

    setCategories(updatedCats);
    await dbService.saveChecklistCategories(updatedCats);
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = async (catId: string) => {
    const qCount = questions.filter(q => q.category === catId).length;
    if (qCount > 0) {
      if (!confirm(`This category contains ${qCount} question(s). Deleting the category will also delete its questions. Proceed?`)) {
        return;
      }
    } else {
      if (!confirm('Are you sure you want to delete this category?')) return;
    }

    const updatedCats = categories.filter(c => c.id !== catId);
    const updatedQs = questions.filter(q => q.category !== catId);
    setCategories(updatedCats);
    setQuestions(updatedQs);

    await dbService.saveChecklistConfig({
      id: 'standard-detailing-checklist',
      name: 'Standard Detailing Checklist',
      categories: updatedCats,
      questions: updatedQs
    });

    if (activeCategoryTab === catId) {
      setActiveCategoryTab('all');
    }
  };

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reordered = updated.map((c, idx) => ({ ...c, order: idx + 1 }));
    setCategories(reordered);
    await dbService.saveChecklistCategories(reordered);
  };

  // ==========================================
  // Question Handlers
  // ==========================================
  const handleOpenAddQuestion = (presetCat?: string) => {
    setEditingQuestion(null);
    setQuestionForm({
      text: '',
      category: presetCat || (categories.length > 0 ? categories[0].id : 'equipment'),
      type: 'pass_fail',
      required: true,
      helperText: '',
      equipmentName: ''
    });
    setIsQuestionModalOpen(true);
  };

  const handleOpenEditQuestion = (q: ChecklistQuestion) => {
    setEditingQuestion(q);
    setQuestionForm({
      text: q.text,
      category: q.category,
      type: q.type,
      required: q.required,
      helperText: q.helperText || '',
      equipmentName: q.equipmentName || ''
    });
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.text.trim()) {
      alert('Please enter question text.');
      return;
    }

    let updatedQs: ChecklistQuestion[];

    if (editingQuestion) {
      updatedQs = questions.map(q => q.id === editingQuestion.id ? {
        ...q,
        text: questionForm.text.trim(),
        category: questionForm.category,
        type: questionForm.type,
        required: questionForm.required,
        helperText: questionForm.helperText.trim() || undefined,
        equipmentName: questionForm.equipmentName.trim() || undefined
      } : q);
    } else {
      const newQ: ChecklistQuestion = {
        id: `q-${Date.now()}`,
        text: questionForm.text.trim(),
        category: questionForm.category,
        type: questionForm.type,
        required: questionForm.required,
        order: questions.length + 1,
        helperText: questionForm.helperText.trim() || undefined,
        equipmentName: questionForm.equipmentName.trim() || undefined
      };
      updatedQs = [...questions, newQ];
    }

    setQuestions(updatedQs);
    await dbService.saveChecklistQuestions(updatedQs);
    setIsQuestionModalOpen(false);
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    const updatedQs = questions.filter(q => q.id !== qId);
    setQuestions(updatedQs);
    await dbService.saveChecklistQuestions(updatedQs);
  };

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reordered = updated.map((q, idx) => ({ ...q, order: idx + 1 }));
    setQuestions(reordered);
    await dbService.saveChecklistQuestions(reordered);
  };

  const filteredQuestions = activeCategoryTab === 'all'
    ? questions
    : questions.filter(q => q.category === activeCategoryTab);

  const getTypeName = (type: QuestionType) => {
    switch (type) {
      case 'pass_fail': return 'Pass / Fail';
      case 'yes_no': return 'Yes / No';
      case 'text': return 'Text Note';
      case 'equipment_status': return 'Equipment Status';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inspection Checklist Customization</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure inspection categories, questions, and response formats that employees see when scanning vehicles.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetToBaseline}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Baseline</span>
          </button>

          <button
            onClick={handleSaveToFirestore}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving to Cloud...' : 'Save Checklist to Firestore'}</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{saveStatus}</span>
        </div>
      )}

      {/* Section 1: Checklist Categories Management */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Inspection Categories</span>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                {categories.length} Total
              </span>
            </h2>
            <p className="text-xs text-slate-400">Categories define the multi-step inspection workflow for drivers.</p>
          </div>

          <button
            onClick={handleOpenAddCategory}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((cat, idx) => {
            const count = questions.filter(q => q.category === cat.id).length;

            return (
              <div
                key={cat.id}
                className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 truncate">{cat.title}</h3>
                    <p className="text-[11px] text-slate-400 truncate">{cat.subtitle || 'No description'}</p>
                    <span className="text-[10px] font-bold text-slate-500 mt-1 inline-block">
                      {count} Question{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleMoveCategory(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-20"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveCategory(idx, 'down')}
                    disabled={idx === categories.length - 1}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-20"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEditCategory(cat)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    title="Edit Category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Questions Customization Tool */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-sky-600" />
              <span>Inspection Questions & Answer Formats</span>
            </h2>
            <p className="text-xs text-slate-400">Configure questions, response choices (Pass/Fail, Yes/No, Text Note), and requirement rules.</p>
          </div>

          <button
            onClick={() => handleOpenAddQuestion(activeCategoryTab !== 'all' ? activeCategoryTab : undefined)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 text-xs font-bold shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        </div>

        {/* Filter Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategoryTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeCategoryTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories ({questions.length})
          </button>

          {categories.map((cat) => {
            const count = questions.filter(q => q.category === cat.id).length;
            const isSelected = activeCategoryTab === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryTab(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cat.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isSelected ? 'bg-sky-800 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Questions Table/List */}
        <div className="space-y-2.5">
          {filteredQuestions.map((q, idx) => {
            const categoryObj = categories.find(c => c.id === q.category);

            return (
              <div
                key={q.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 leading-snug">{q.text}</p>
                    {q.helperText && (
                      <p className="text-[11px] text-slate-400 mt-0.5 italic flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{q.helperText}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                        {categoryObj?.title || q.category}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {getTypeName(q.type)}
                      </span>
                      {q.required && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                      {q.equipmentName && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Linked: {q.equipmentName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <button
                    onClick={() => handleMoveQuestion(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveQuestion(idx, 'down')}
                    disabled={idx === filteredQuestions.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEditQuestion(q)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    title="Edit Question"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    title="Delete Question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredQuestions.length === 0 && (
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No questions found in this category. Click "Add Question" above to create one.
            </div>
          )}
        </div>
      </div>

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? 'Edit Inspection Category' : 'Add Inspection Category'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supplies & Chemicals"
                  value={categoryForm.title}
                  onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subtitle / Driver Guidance
                </label>
                <input
                  type="text"
                  placeholder="e.g. Towels, soap, coatings, PPE"
                  value={categoryForm.subtitle}
                  onChange={(e) => setCategoryForm({ ...categoryForm, subtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUESTION MODAL */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingQuestion ? 'Edit Inspection Question' : 'Add Inspection Question'}
              </h3>
              <button onClick={() => setIsQuestionModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question Text
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Microfiber Towel Supply: At least 30 clean towels stocked"
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Inspection Category
                  </label>
                  <select
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Response / Answer Type
                  </label>
                  <select
                    value={questionForm.type}
                    onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value as QuestionType })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold"
                  >
                    <option value="pass_fail">Pass / Fail</option>
                    <option value="yes_no">Yes / No</option>
                    <option value="text">Text Note</option>
                    <option value="equipment_status">Equipment Status (Working/Flag)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Helper / Inspection Guidance Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Check oil level, drain valve closed, listen for leaks."
                  value={questionForm.helperText}
                  onChange={(e) => setQuestionForm({ ...questionForm, helperText: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Associated Equipment Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pressure Washer, Air Compressor"
                  value={questionForm.equipmentName}
                  onChange={(e) => setQuestionForm({ ...questionForm, equipmentName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="requiredCheck"
                  checked={questionForm.required}
                  onChange={(e) => setQuestionForm({ ...questionForm, required: e.target.checked })}
                  className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                />
                <label htmlFor="requiredCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Mandatory question (required before inspection submission)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

