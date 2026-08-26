import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  GraduationCap,
  ArrowRight,
  Archive,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Users,
  ShieldCheck,
  Building2,
  GripVertical,
} from 'lucide-react';
import { promotionApi, orgApi } from '@/lib/api';

export default function AcademicPromotionModal({ isOpen, onClose, orgId, onPromotionSuccess }) {
  const [activeTab, setActiveTab] = useState('EXECUTE'); // EXECUTE | PIPELINE | ARCHIVES | UNIFIED_POOL
  const [pipeline, setPipeline] = useState([]);
  const [archives, setArchives] = useState([]);
  const [unifiedStudents, setUnifiedStudents] = useState([]);
  const [orgTeams, setOrgTeams] = useState([]);

  const availableClassOptions = useMemo(() => {
    const options = new Set();
    [
      'Playschool', 'Nursery', 'LKG - Sec A', 'UKG - Sec A',
      'Grade 1 - Sec A', 'Grade 2 - Sec A', 'Grade 3 - Sec A', 'Grade 4 - Sec A', 'Grade 5 - Sec A',
      'Grade 6 - Sec A', 'Grade 7 - Sec A', 'Grade 8 - Sec A', 'Grade 9 - Sec A', 'Grade 10 - Sec A',
      'Class 11 - Unified', 'Grade 12 - Science A', 'Grade 12 - Commerce A', 'Grade 12 - Arts A'
    ].forEach((c) => options.add(c));

    orgTeams.forEach((t) => {
      if (t.name) options.add(t.name);
    });

    return Array.from(options);
  }, [orgTeams]);

  const class11StreamSections = useMemo(() => {
    return orgTeams.filter(
      (t) =>
        !t.name.toLowerCase().includes('unified') &&
        (t.name.toLowerCase().includes('class 11') ||
          t.name.toLowerCase().includes('grade 11') ||
          t.name.toLowerCase().includes('science') ||
          t.name.toLowerCase().includes('commerce') ||
          t.name.toLowerCase().includes('arts'))
    );
  }, [orgTeams]);

  const handleAllocateStreamInline = async (studentMembershipId, teamId) => {
    try {
      setLoading(true);
      await promotionApi.allocateStream(orgId, {
        studentMembershipId,
        targetTeamId: teamId,
      });
      await fetchOrgData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to allocate stream section.');
    } finally {
      setLoading(false);
    }
  };

  const [sessionName, setSessionName] = useState(`${new Date().getFullYear() - 1}-${new Date().getFullYear()} Academic Session`);
  const [allStudents, setAllStudents] = useState([]);
  const [retainedStudentIds, setRetainedStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [showRetentionSelector, setShowRetentionSelector] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const updated = [...pipeline];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    setPipeline(updated);
    setDraggedIndex(null);
  };

  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [error, setError] = useState(null);

  // Stream Allocation Modal State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [targetTeamId, setTargetTeamId] = useState('');
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    if (isOpen && orgId) {
      fetchPipeline();
      fetchArchives();
      fetchOrgData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orgId]);

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await promotionApi.getConfig(orgId);
      setPipeline(data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load promotion pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    try {
      const data = await promotionApi.getArchives(orgId);
      setArchives(data || []);
    } catch (err) {
      console.error('Failed to load batch archives:', err);
    }
  };

  const fetchOrgData = async () => {
    try {
      const res = await orgApi.get(orgId);
      const teams = res?.departments?.flatMap((d) => d.teams) || [];
      setOrgTeams(teams);

      // Collect all active student memberships for retention selection
      const extractedStudents = [];
      teams.forEach((t) => {
        if (t.memberships) {
          t.memberships.forEach((m) => {
            if (m.role === 'STUDENT') {
              extractedStudents.push({ ...m, teamName: t.name });
            }
          });
        }
      });
      setAllStudents(extractedStudents);

      // Find Class 11 Unified Pool students
      const unified = teams.find((t) => t.name.toLowerCase().includes('class 11 - unified'));
      if (unified && unified.memberships) {
        setUnifiedStudents(unified.memberships.filter((m) => m.role === 'STUDENT'));
      }
    } catch (err) {
      console.error('Failed to fetch org details:', err);
    }
  };

  const toggleStudentRetention = (studentId) => {
    setRetainedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSavePipeline = async () => {
    try {
      setLoading(true);
      setError(null);
      await promotionApi.saveConfig(orgId, pipeline);
      alert('Promotion progression pipeline saved successfully!');
      fetchPipeline();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save promotion pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleExecutePromotion = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmExecutePromotion = async () => {
    setShowConfirmModal(false);
    try {
      setExecuting(true);
      setError(null);
      setExecutionResult(null);

      const data = await promotionApi.execute(orgId, {
        sessionName,
        retainedStudentIds,
      });
      setExecutionResult(data);
      fetchArchives();
      fetchOrgData();
      if (onPromotionSuccess) onPromotionSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to execute academic promotion.');
    } finally {
      setExecuting(false);
    }
  };

  const handleAllocateStream = async () => {
    if (!selectedStudent || !targetTeamId) return;
    try {
      setAllocating(true);
      await promotionApi.allocateStream(orgId, {
        studentMembershipId: selectedStudent.id,
        targetTeamId,
      });
      alert(`Student successfully assigned to stream section!`);
      setSelectedStudent(null);
      setTargetTeamId('');
      fetchOrgData();
      if (onPromotionSuccess) onPromotionSuccess();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to allocate stream.');
    } finally {
      setAllocating(false);
    }
  };

  const handleAddStep = () => {
    const newStep = {
      orderIndex: pipeline.length + 1,
      fromClassName: 'Grade 1 - Sec A',
      toClassName: 'Grade 2 - Sec A',
      isEntryLevel: false,
      isUnifiedPool: false,
      isAlumniTarget: false,
    };
    setPipeline([...pipeline, newStep]);
  };

  const handleRemoveStep = (index) => {
    const updated = pipeline.filter((_, i) => i !== index);
    setPipeline(updated);
  };

  const handleMoveStep = (index, direction) => {
    const updated = [...pipeline];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPipeline(updated);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto text-card-foreground">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                Academic Session Promotion Engine
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full">
                  Automated Pipeline
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Promote academic batches, archive previous session structures & manage Alumni transitions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Header */}
        <div className="px-6 py-2 border-b border-border bg-muted/40 flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('EXECUTE')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'EXECUTE'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>1-Click Session Promotion</span>
          </button>

          <button
            onClick={() => setActiveTab('PIPELINE')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'PIPELINE'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Promotion Order Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('UNIFIED_POOL')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap relative ${
              activeTab === 'UNIFIED_POOL'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Class 11 - Unified Pool</span>
            {unifiedStudents.length > 0 && (
              <span className="w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500 text-black flex items-center justify-center ml-1">
                {unifiedStudents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ARCHIVES')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'ARCHIVES'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Archived Previous Batches ({archives.length})</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center space-x-3 text-rose-500 dark:text-rose-400 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: EXECUTE PROMOTION */}
          {activeTab === 'EXECUTE' && (
            <div className="space-y-6">
              <div className="bg-muted/30 p-6 rounded-2xl border border-primary/20 relative overflow-hidden">
                <div className="max-w-2xl space-y-4">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Automatic Structure Snapshot & Alumni Separation</span>
                  </div>

                  <h3 className="text-xl font-bold text-foreground tracking-tight">
                    Promote All Classes to Next Academic Session
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Executing promotion will save the current school roster structure in a dedicated **Session Archive Tab**, transfer students up their configured pipeline, place Class 10 graduates into the **Class 11 - Unified Pool**, and transition Class 12 passed-out students into their isolated **Alumni Batch** network.
                  </p>

                  <div className="pt-2 flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Academic Session Archive Name
                      </label>
                      <input
                        type="text"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        placeholder="e.g. 2025-2026 Academic Session"
                        className="w-full bg-background border border-input rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    <div className="self-end">
                      <button
                        onClick={handleExecutePromotion}
                        disabled={executing}
                        className="px-6 py-2.5 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-primary/30 transition-all flex items-center space-x-2 disabled:opacity-50"
                      >
                        {executing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Promotion...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Run Mass Academic Promotion</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Summary Result */}
              {executionResult && (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <h4 className="text-sm font-bold">{executionResult.message}</h4>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-300/80">Batch snapshot created & WebSocket tabs refreshed.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 pt-2">
                    <div className="bg-card p-4 rounded-xl border border-emerald-500/20 text-center">
                      <span className="block text-2xl font-black text-foreground">{executionResult.summary?.totalPromoted || 0}</span>
                      <span className="text-xs text-muted-foreground font-medium">Standard Grade Promotions</span>
                    </div>

                    <div className="bg-card p-4 rounded-xl border border-emerald-500/20 text-center">
                      <span className="block text-2xl font-black text-amber-500">{executionResult.summary?.unifiedPool || 0}</span>
                      <span className="text-xs text-muted-foreground font-medium">Placed in Class 11 Unified</span>
                    </div>

                    <div className="bg-card p-4 rounded-xl border border-emerald-500/20 text-center">
                      <span className="block text-2xl font-black text-purple-500">{executionResult.summary?.alumniGraduated || 0}</span>
                      <span className="text-xs text-muted-foreground font-medium">Graduated to Alumni Channel</span>
                    </div>

                    <div className="bg-card p-4 rounded-xl border border-emerald-500/20 text-center">
                      <span className="block text-2xl font-black text-rose-500">{executionResult.summary?.retainedStudents || 0}</span>
                      <span className="text-xs text-muted-foreground font-medium">Retained / Detained</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Retention Exception Selector */}
              <div className="bg-card p-5 rounded-2xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Student Retention Exceptions (Repeaters / Detained)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Select specific students who should NOT be promoted. (Faculty timetables are automatically kept unchanged).
                    </p>
                  </div>

                  <button
                    onClick={() => setShowRetentionSelector(!showRetentionSelector)}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border text-xs font-semibold text-foreground rounded-lg transition-colors"
                  >
                    {showRetentionSelector ? 'Hide Selector' : `Manage Exceptions (${retainedStudentIds.length} Selected)`}
                  </button>
                </div>

                {showRetentionSelector && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search student by name, ID or current class..."
                      className="w-full bg-background border border-input rounded-xl px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />

                    <div className="max-h-56 overflow-y-auto divide-y divide-border bg-background rounded-xl border border-border">
                      {allStudents
                        .filter((st) => {
                          if (!studentSearch.trim()) return true;
                          const q = studentSearch.toLowerCase();
                          return (
                            st.user?.fullName?.toLowerCase().includes(q) ||
                            st.title?.toLowerCase().includes(q) ||
                            st.teamName?.toLowerCase().includes(q)
                          );
                        })
                        .map((st) => {
                          const isRetained = retainedStudentIds.includes(st.id);
                          return (
                            <label
                              key={st.id}
                              className="p-3 flex items-center justify-between hover:bg-muted/60 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isRetained}
                                  onChange={() => toggleStudentRetention(st.id)}
                                  className="rounded bg-background border-input text-primary focus:ring-0"
                                />
                                <div>
                                  <div className="text-xs font-bold text-foreground">{st.user?.fullName}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {st.title || 'Student'} • Current Class: <span className="text-primary font-semibold">{st.teamName || 'Unassigned'}</span>
                                  </div>
                                </div>
                              </div>

                              {isRetained ? (
                                <span className="px-2.5 py-0.5 text-[10px] bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 font-semibold rounded-full">
                                  Retained in {st.teamName}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold rounded-full">
                                  Eligible for Promotion
                                </span>
                              )}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Pipeline Preview */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Current Promotion Progression Sequence</span>
                  <span className="text-muted-foreground font-normal">{pipeline.length} Configured Steps</span>
                </h4>

                <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {pipeline.map((step, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/40 transition-colors">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-lg bg-muted text-muted-foreground font-semibold flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <div className="flex items-center space-x-2 font-medium text-foreground">
                          <span className="px-2.5 py-1 bg-muted rounded-md border border-border">{step.fromClassName}</span>
                          <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                          <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-md border border-primary/20 font-semibold">
                            {step.toClassName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {step.isEntryLevel && (
                          <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full font-medium">
                            Entry Level Class
                          </span>
                        )}
                        {step.isUnifiedPool && (
                          <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full font-medium">
                            Class 11 Unified Target
                          </span>
                        )}
                        {step.isAlumniTarget && (
                          <span className="px-2 py-0.5 text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-full font-medium">
                            Alumni Passing Target
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROMOTION PIPELINE CONFIGURATOR */}
          {activeTab === 'PIPELINE' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Configure Order of Promotion Sequence</h3>
                  <p className="text-xs text-muted-foreground">
                    Define step-by-step how students advance from one class/section to the next
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleAddStep}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Progression Step</span>
                  </button>

                  <button
                    onClick={handleSavePipeline}
                    disabled={loading}
                    className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-md transition-all flex items-center space-x-1.5"
                  >
                    <span>Save Progression Order</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {pipeline.map((step, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={() => setDraggedIndex(null)}
                    className={`bg-card p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      draggedIndex === idx
                        ? 'border-primary bg-primary/10 opacity-60 scale-[0.99] shadow-lg'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex items-center space-x-1">
                        <div
                          className="p-1.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing rounded hover:bg-muted transition-colors"
                          title="Drag to reorder step"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleMoveStep(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMoveStep(idx, 1)}
                            disabled={idx === pipeline.length - 1}
                            className="p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <span className="w-6 h-6 rounded-lg bg-muted text-foreground font-bold flex items-center justify-center text-xs shrink-0">
                        #{idx + 1}
                      </span>

                      <div className="grid grid-cols-2 gap-3 flex-1">
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">From Class / Section</label>
                          <select
                            value={step.fromClassName}
                            onChange={(e) => {
                              const updated = [...pipeline];
                              updated[idx].fromClassName = e.target.value;
                              setPipeline(updated);
                            }}
                            className="w-full bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                          >
                            <option value="" disabled>Select From Class...</option>
                            {availableClassOptions.map((cls) => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                            {!availableClassOptions.includes(step.fromClassName) && step.fromClassName && (
                              <option value={step.fromClassName}>{step.fromClassName} (Custom)</option>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Promote To Target</label>
                          {step.isUnifiedPool ? (
                            <div className="w-full bg-amber-500/15 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-amber-600 dark:text-amber-300 font-bold flex items-center justify-between shadow-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                Class 11 - Unified Pool
                              </span>
                              <span className="text-[9px] bg-amber-500/30 text-amber-700 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Fixed Tag
                              </span>
                            </div>
                          ) : step.isAlumniTarget ? (
                            <div className="w-full bg-purple-500/15 border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs text-purple-600 dark:text-purple-300 font-bold flex items-center justify-between shadow-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                                Alumni Network / Passout
                              </span>
                              <span className="text-[9px] bg-purple-500/30 text-purple-700 dark:text-purple-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Fixed Tag
                              </span>
                            </div>
                          ) : (
                            <select
                              value={step.toClassName}
                              onChange={(e) => {
                                const updated = [...pipeline];
                                updated[idx].toClassName = e.target.value;
                                setPipeline(updated);
                              }}
                              className="w-full bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                            >
                              <option value="" disabled>Select Target Class...</option>
                              {availableClassOptions.map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                              {!availableClassOptions.includes(step.toClassName) && step.toClassName && (
                                <option value={step.toClassName}>{step.toClassName} (Custom)</option>
                              )}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 border-t md:border-t-0 pt-3 md:pt-0 border-border">
                      <label className="flex items-center space-x-1.5 text-xs text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.isEntryLevel || false}
                          onChange={(e) => {
                            const updated = [...pipeline];
                            updated[idx].isEntryLevel = e.target.checked;
                            setPipeline(updated);
                          }}
                          className="rounded bg-background border-input text-primary focus:ring-0"
                        />
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Entry Level</span>
                      </label>

                      <label className="flex items-center space-x-1.5 text-xs text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.isUnifiedPool || false}
                          onChange={(e) => {
                            const updated = [...pipeline];
                            const checked = e.target.checked;
                            updated[idx].isUnifiedPool = checked;
                            if (checked) {
                              updated[idx].isAlumniTarget = false;
                              updated[idx].toClassName = 'Class 11 - Unified';
                            }
                            setPipeline(updated);
                          }}
                          className="rounded bg-background border-input text-amber-500 focus:ring-0"
                        />
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Unified 11</span>
                      </label>

                      <label className="flex items-center space-x-1.5 text-xs text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.isAlumniTarget || false}
                          onChange={(e) => {
                            const updated = [...pipeline];
                            const checked = e.target.checked;
                            updated[idx].isAlumniTarget = checked;
                            if (checked) {
                              updated[idx].isUnifiedPool = false;
                              updated[idx].toClassName = 'Alumni Network';
                            }
                            setPipeline(updated);
                          }}
                          className="rounded bg-background border-input text-purple-600 focus:ring-0"
                        />
                        <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">Alumni Passout</span>
                      </label>

                      <button
                        onClick={() => handleRemoveStep(idx)}
                        className="p-1.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CLASS 11 UNIFIED HOLDING POOL */}
          {activeTab === 'UNIFIED_POOL' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Class 11 Unified Holding Pool</h3>
                  <p className="text-xs text-muted-foreground">
                    Students promoted from Class 10 stay here until assigned to specific streams (Science, Commerce, Arts)
                  </p>
                </div>
                <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-full">
                  {unifiedStudents.length} Students Pending Stream Assignment
                </div>
              </div>

              {unifiedStudents.length === 0 ? (
                <div className="p-12 text-center bg-muted/20 border border-border rounded-2xl space-y-3">
                  <Users className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                  <h4 className="text-sm font-medium text-foreground">No Students in Unified Pool</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    When Grade 10 students are promoted, they automatically populate in this pool until assigned a stream.
                  </p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl divide-y divide-border">
                  {unifiedStudents.map((st) => (
                    <div key={st.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-muted text-primary font-bold flex items-center justify-center text-xs">
                          {st.user?.fullName?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">{st.user?.fullName || 'Student'}</div>
                          <div className="text-[11px] text-muted-foreground">{st.title || 'STU-2026'} • {st.user?.email || 'No email set'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium hidden md:inline">Stream Section:</span>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAllocateStreamInline(st.id, e.target.value);
                            }
                          }}
                          className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer font-medium"
                        >
                          <option value="" disabled>Select Class 11 Section...</option>
                          {class11StreamSections.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                          {class11StreamSections.length === 0 && (
                            <>
                              <option value="" disabled>No Class 11 specific sections found</option>
                              {orgTeams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SESSION ARCHIVES */}
          {activeTab === 'ARCHIVES' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-foreground">Archived Previous Batches</h3>
                <p className="text-xs text-muted-foreground">
                  Full historical snapshots of past academic sessions saved during mass promotion
                </p>
              </div>

              {archives.length === 0 ? (
                <div className="p-12 text-center bg-muted/20 border border-border rounded-2xl space-y-3">
                  <Archive className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                  <h4 className="text-sm font-medium text-foreground">No Past Batch Archives Found</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    When you run "1-Click Session Promotion", a complete snapshot of the school's structure and student rosters will be saved here automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {archives.map((arc) => {
                    let parsedData = null;
                    try {
                      parsedData = JSON.parse(arc.structureJson);
                    } catch (e) {}

                    return (
                      <div key={arc.id} className="bg-card border border-border p-5 rounded-2xl space-y-4 hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">{arc.sessionName}</h4>
                            <span className="text-[11px] text-muted-foreground">
                              Archived on {new Date(arc.archivedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-semibold rounded-full">
                            {arc.studentCount} Students
                          </span>
                        </div>

                        {parsedData && (
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                              Snapshot Departments ({parsedData.departments?.length || 0})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {parsedData.departments?.map((dept, i) => (
                                <span key={i} className="px-2 py-1 bg-muted border border-border rounded-md text-[11px] text-foreground">
                                  {dept.name} ({dept.teams?.length || 0} classes)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stream Assignment Sub-Modal */}
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl text-card-foreground">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Assign Stream Section</h3>
                <button onClick={() => setSelectedStudent(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-1">
                <div className="text-xs font-bold text-foreground">{selectedStudent.user?.fullName}</div>
                <div className="text-[11px] text-muted-foreground">Currently in: Class 11 - Unified Pool</div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">Select Target Stream Class</label>
                <select
                  value={targetTeamId}
                  onChange={(e) => setTargetTeamId(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Select Stream Section...</option>
                  {orgTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAllocateStream}
                  disabled={!targetTeamId || allocating}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {allocating ? 'Assigning...' : 'Assign to Class'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Confirmation Popup Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99999]">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl relative text-card-foreground">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary rounded-xl border border-primary/30 shrink-0">
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground tracking-tight">
                    Execute Mass Academic Promotion?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Are you sure you want to execute mass academic promotion for{' '}
                    <span className="text-primary font-semibold">"{sessionName}"</span>?
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl p-3.5 border border-border space-y-2 text-xs">
                {retainedStudentIds.length > 0 && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{retainedStudentIds.length} student(s) selected to be retained in current class</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Faculty timetables & schedules will remain 100% untouched.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExecutePromotion}
                  disabled={executing}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {executing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Confirm & Execute Promotion</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
