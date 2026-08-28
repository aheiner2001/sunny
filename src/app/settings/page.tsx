'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Settings as SettingsIcon, 
  RotateCcw, 
  ListChecks, 
  ShieldCheck,
  Calendar,
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
  Check,
  AlertTriangle,
  Lock,
  KeyRound,
  History,
} from 'lucide-react';
import { dbService } from '@/lib/db';
import { ChecklistQuestion, ChecklistCategoryConfig, QuestionType, ChecklistConfig, EquipmentOption, FleetTask } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { ManagerOnly } from '@/components/ManagerOnly';
import { AiImportModal } from '@/components/AiImportModal';

type SettingsTab = 'checklist' | 'equipment' | 'tasks' | 'appearance' | 'danger';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'checklist', label: 'Checklist' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'danger', label: 'Danger zone' },
];

export default function SettingsPage() {
  return (
    <ManagerOnly message="Fleet configuration is restricted to manager accounts. Ask a manager if you need a checklist change.">
      <SettingsPageContent />
    </ManagerOnly>
  );
}

function SettingsPageContent() {
  const { isTrueManager, user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('checklist');

  // Passcode change form (own account)
  const [passcodeForm, setPasscodeForm] = useState({ current: '', next: '', confirm: '' });
  const [passcodeBusy, setPasscodeBusy] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [passcodeDone, setPasscodeDone] = useState(false);
  const [categories, setCategories] = useState<ChecklistCategoryConfig[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [newEquipmentOption, setNewEquipmentOption] = useState('');
  const [tasks, setTasks] = useState<FleetTask[]>([]);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', vehicleId: '', dueAt: '', scheduleLabel: '' });
  const [recentInspectorsDepth, setRecentInspectorsDepth] = useState<1 | 3>(3);

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
    reasonPresets: string;
  }>({
    text: '',
    category: 'equipment',
    type: 'pass_fail',
    required: true,
    helperText: '',
    equipmentName: '',
    reasonPresets: ''
  });

  const loadData = () => {
    const config = dbService.getChecklistConfig();
    setCategories(config.categories || []);
    setQuestions(config.questions || []);
    setEquipmentOptions(dbService.getEquipmentOptions());
    setTasks(dbService.getTasks());
    const settings = dbService.getAppSettings();
    setRecentInspectorsDepth(settings.recentInspectorsDepth);
  };

  const updateRecentInspectorsDepth = async (value: 1 | 3) => {
    setRecentInspectorsDepth(value);
    await dbService.saveAppSettings({ recentInspectorsDepth: value });
  };

  const saveEquipmentOption = async () => {
    const name = newEquipmentOption.trim();
    if (!name || equipmentOptions.some(option => option.name.toLowerCase() === name.toLowerCase())) return;
    const now = new Date().toISOString();
    const updated = [...equipmentOptions, { id: `equipment-option-${Date.now()}`, name, category: 'equipment' as const, createdAt: now, updatedAt: now }];
    setEquipmentOptions(updated);
    setNewEquipmentOption('');
    await dbService.saveEquipmentOptions(updated);
  };

  const updateEquipmentOption = async (option: EquipmentOption) => {
    const name = prompt('Equipment option name', option.name)?.trim();
    if (!name) return;
    await dbService.saveEquipmentOptions(equipmentOptions.map(item => item.id === option.id ? { ...item, name } : item));
  };

  const deleteEquipmentOption = async (id: string) => {
    if (!confirm('Remove this default option? Existing vehicle equipment will remain.')) return;
    await dbService.saveEquipmentOptions(equipmentOptions.filter(option => option.id !== id));
  };

  const createManagerTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    await dbService.createTask({
      title: taskForm.title,
      description: taskForm.description,
      vehicleId: taskForm.vehicleId || null,
      dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
      scheduleLabel: taskForm.scheduleLabel || null,
      assignedToId: null,
      assignedToName: null,
      createdById: 'manager',
      createdByName: 'Fleet Manager'
    });
    setTaskForm({ title: '', description: '', vehicleId: '', dueAt: '', scheduleLabel: '' });
  };

  useEffect(() => {
    loadData();
    window.addEventListener('sunny_db_update', loadData);
    return () => window.removeEventListener('sunny_db_update', loadData);
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && SETTINGS_TABS.some(entry => entry.id === tab)) {
      setActiveTab(tab as SettingsTab);
    }
  }, [searchParams]);

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

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPasscodeError(null);
    setPasscodeDone(false);

    if (passcodeForm.next !== passcodeForm.confirm) {
      setPasscodeError('New passcode and confirmation do not match.');
      return;
    }

    try {
      setPasscodeBusy(true);
      await dbService.changeUserPasscode(currentUser.id, passcodeForm.current, passcodeForm.next);
      setPasscodeForm({ current: '', next: '', confirm: '' });
      setPasscodeDone(true);
      setTimeout(() => setPasscodeDone(false), 4000);
    } catch (err: any) {
      // Cloud write failures surface here rather than silently diverging.
      setPasscodeError(err?.message || 'Could not update passcode. Check your connection and try again.');
    } finally {
      setPasscodeBusy(false);
    }
  };

  /**
   * Wipes all fleet data back to the built-in starter set. Requires a typed
   * confirmation because a stray click would destroy live records and every
   * access passcode.
   */
  const handleFactoryReset = async () => {
    const typed = prompt(
      'This permanently replaces all fleet data and access passcodes with the factory defaults.\n\nType RESET to confirm.'
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== 'RESET') {
      alert('Reset cancelled — confirmation text did not match.');
      return;
    }
    setIsResetting(true);
    dbService.resetToDefaults({ syncToCloud: true });
    dbService.clearSession();
    window.location.reload();
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
      equipmentName: '',
      reasonPresets: ''
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
      equipmentName: q.equipmentName || '',
      reasonPresets: (q.reasonPresets || []).join(', ')
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
        equipmentName: questionForm.equipmentName.trim() || undefined,
        reasonPresets: questionForm.reasonPresets.split(',').map(s => s.trim()).filter(Boolean)
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
        equipmentName: questionForm.equipmentName.trim() || undefined,
        reasonPresets: questionForm.reasonPresets.split(',').map(s => s.trim()).filter(Boolean)
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
    <div className="page stack max-w-5xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Fleet Settings</h1>
        <p className="hint mt-0.5">
          Configure checklists, equipment defaults, tasks, appearance, and fleet-wide options.
        </p>
      </div>

      <div className="cluster gap-2 flex-wrap">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'checklist' && (
        <div className="stack">
          <div className="spread flex-col sm:flex-row gap-4">
            <div>
              <h2 className="card-title">Inspection Checklist</h2>
              <p className="hint">
                Configure categories, questions, and response formats for vehicle scans.
              </p>
            </div>

            <div className="cluster gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAiImportOpen(true)}
                className="btn btn-secondary btn-sm cluster gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate / Import with AI</span>
              </button>

              <button
                type="button"
                onClick={handleResetToBaseline}
                className="btn btn-secondary btn-sm cluster gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Baseline</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToFirestore}
                disabled={isSaving}
                className="btn btn-primary btn-sm cluster gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving to Cloud...' : 'Save Checklist to Firestore'}</span>
              </button>
            </div>
          </div>

          {saveStatus && (
            <div className="card card-pad cluster gap-2 text-xs" data-status="ok">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
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
        </div>
      )}

      {activeTab === 'equipment' && (
        <section className="card card-pad stack">
          <div>
            <h2 className="card-title cluster gap-2">
              <Wrench className="w-5 h-5" />
              Default Equipment Options
            </h2>
            <p className="hint">
              Managers control the quick-select list used when creating vehicles. Custom one-off entries remain supported.
            </p>
          </div>
          <div className="cluster gap-2">
            <input
              value={newEquipmentOption}
              onChange={e => setNewEquipmentOption(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveEquipmentOption())}
              placeholder="Add equipment option"
              className="field flex-1"
            />
            <button type="button" onClick={saveEquipmentOption} className="btn btn-primary btn-sm">Add</button>
          </div>
          <div className="stack gap-2">
            {equipmentOptions.map(option => (
              <div key={option.id} className="spread gap-2 p-2.5 rounded-xl bg-surface-alt border border-line text-xs">
                <span className="font-semibold truncate">{option.name}</span>
                <div className="cluster gap-1">
                  <button type="button" onClick={() => updateEquipmentOption(option)} className="btn btn-ghost btn-sm p-1.5">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => deleteEquipmentOption(option.id)} className="btn btn-ghost btn-sm p-1.5 text-critical">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'tasks' && (
        <section className="card card-pad stack">
          <div>
            <h2 className="card-title cluster gap-2">
              <Calendar className="w-5 h-5" />
              Inspection Tasks &amp; Scheduling
            </h2>
            <p className="hint">Create intentional, repeatable inspection work with a label and due time.</p>
          </div>
          <form onSubmit={createManagerTask} className="stack gap-2">
            <input required value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task or schedule title" className="field" />
            <input value={taskForm.scheduleLabel} onChange={e => setTaskForm({ ...taskForm, scheduleLabel: e.target.value })} placeholder="Schedule label (e.g. Morning opening)" className="field" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={taskForm.vehicleId} onChange={e => setTaskForm({ ...taskForm, vehicleId: e.target.value })} className="field">
                <option value="">Any vehicle</option>
                {dbService.getVehicles().map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
              </select>
              <input type="datetime-local" value={taskForm.dueAt} onChange={e => setTaskForm({ ...taskForm, dueAt: e.target.value })} className="field" />
            </div>
            <input value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Instructions (optional)" className="field" />
            <button type="submit" className="btn btn-primary">Create Task</button>
          </form>
          <div className="stack gap-2 max-h-60 overflow-y-auto">
            {tasks.map(task => (
              <div key={task.id} className="spread gap-2 p-2.5 rounded-xl bg-surface-alt border border-line text-xs">
                <div className="min-w-0">
                  <p className="font-bold">{task.title}</p>
                  <p className="hint">{task.scheduleLabel || 'Unscheduled'}{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleString()}` : ''}</p>
                </div>
                <button type="button" onClick={() => dbService.deleteTask(task.id)} className="btn btn-ghost btn-sm p-1.5 text-critical shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'appearance' && (
        <div className="stack">
          <section className="card card-pad stack">
            <div>
              <h2 className="card-title cluster gap-2">
                <History className="w-5 h-5" />
                Recent Inspector History
              </h2>
              <p className="hint">How many recent inspectors to show on issues and vehicle detail.</p>
            </div>
            <fieldset className="cluster gap-3">
              <legend className="sr-only">Recent inspectors to show</legend>
              {([1, 3] as const).map(value => (
                <label
                  key={value}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${
                    recentInspectorsDepth === value ? 'border-ink bg-surface-alt' : 'border-line bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="recentInspectorsDepth"
                    value={value}
                    checked={recentInspectorsDepth === value}
                    onChange={() => updateRecentInspectorsDepth(value)}
                  />
                  Last {value}
                </label>
              ))}
            </fieldset>
          </section>

      {/* ACCOUNT SECURITY — change own access passcode, synced to Firestore */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-sky-600 shrink-0" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Your Access Passcode</h2>
            <p className="text-[11px] text-slate-500">
              Changes are written to Cloud Firestore, so the new code works on every device.
            </p>
          </div>
        </div>

        <div className="p-6">
          {dbService.isUsingInitialPasscode(currentUser) && (
            <div className="mb-5 flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] font-semibold text-amber-900">
                You are still signed in with the one-time setup code. It ships with the
                application source, so anyone with the repository can use it. Replace it now.
              </p>
            </div>
          )}

          <form onSubmit={handleChangePasscode} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Current Passcode
              </label>
              <input
                type="password"
                required
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                value={passcodeForm.current}
                onChange={(e) => setPasscodeForm({ ...passcodeForm, current: e.target.value.replace(/\D/g, '') })}
                className="w-full px-3 py-2 text-xs font-bold tracking-[0.3em] rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Passcode
                </label>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  placeholder="4-6 digits"
                  value={passcodeForm.next}
                  onChange={(e) => setPasscodeForm({ ...passcodeForm, next: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 text-xs font-bold tracking-[0.3em] rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm New
                </label>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={passcodeForm.confirm}
                  onChange={(e) => setPasscodeForm({ ...passcodeForm, confirm: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 text-xs font-bold tracking-[0.3em] rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {passcodeError && (
              <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                {passcodeError}
              </p>
            )}
            {passcodeDone && (
              <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Passcode updated and synced to Firestore.
              </p>
            )}

            <button
              type="submit"
              disabled={passcodeBusy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{passcodeBusy ? 'Updating...' : 'Update Passcode'}</span>
            </button>
          </form>
        </div>
      </div>
        </div>
      )}

      {activeTab === 'danger' && isTrueManager && (
      <div className="card overflow-hidden" data-status="critical">
        <div className="card-head border-b border-line">
          <div className="cluster gap-2">
            <AlertTriangle className="w-4 h-4 text-critical shrink-0" />
            <div>
              <h2 className="card-title">Danger Zone</h2>
              <p className="hint">Irreversible. Affects the entire fleet, not just this device.</p>
            </div>
          </div>
        </div>

        <div className="card-pad spread flex-col sm:flex-row gap-4">
          <div className="min-w-0">
            <h3 className="text-xs font-bold">Restore factory defaults</h3>
            <p className="hint mt-0.5 max-w-md">
              Replaces every vehicle, equipment item, inspection, issue, user, and access
              passcode with the built-in starter set. Anyone signed in will be locked out
              until a manager reissues codes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFactoryReset}
            disabled={isResetting}
            className="btn btn-sm shrink-0 cluster gap-1.5 bg-critical text-ink-inverse hover:opacity-90 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isResetting ? 'Resetting...' : 'Restore Defaults'}</span>
          </button>
        </div>
      </div>
      )}

      {activeTab === 'danger' && !isTrueManager && (
        <div className="card card-pad">
          <p className="hint">Factory reset is restricted to manager accounts.</p>
        </div>
      )}

      <AiImportModal isOpen={isAiImportOpen} onClose={() => setIsAiImportOpen(false)} />

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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Issue Reason Presets (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Low pressure, Leak, Missing item"
                  value={questionForm.reasonPresets}
                  onChange={(e) => setQuestionForm({ ...questionForm, reasonPresets: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Comma-separated buttons shown to inspectors when they flag this question.</p>
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
