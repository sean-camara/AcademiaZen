
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useZen } from '../context/ZenContext';
import { AMBIENCE_OPTIONS } from '../constants';
import ConfirmModal from '../components/ConfirmModal';
import { apiFetch } from '../utils/api';

const Focus: React.FC = () => {
  const { focusSession, startTimer, pauseTimer, resetTimer, setFocusSessionState, setAmbience, state, updateTask, setHideNavbar } = useZen();
  const { isActive, isPaused, timeLeft } = focusSession;
  
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ type: 'task' | 'subject' | 'folderItem'; id: string; label: string; meta?: Record<string, string> } | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [suggestedMinutes, setSuggestedMinutes] = useState(35);
  const [suggestionHint, setSuggestionHint] = useState('Select a focus target to get a recommendation.');
  const [durationMinutes, setDurationMinutes] = useState(state.settings.focusDuration || 35);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionType, setReflectionType] = useState<'finished' | 'blocked' | null>(null);
  const [submitReflectionLoading, setSubmitReflectionLoading] = useState(false);
  const [quitWarning, setQuitWarning] = useState('');
  const [focusStreak, setFocusStreak] = useState(0);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const ACTIVE_SESSION_KEY = 'zen_focus_active_session_v1';
  
  // Track if session has been restored from localStorage to prevent re-running
  const sessionRestoredRef = useRef(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = isActive && durationMinutes > 0
    ? ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100
    : 0;

  const focusHeadline = focusTarget
    ? `Focus for ${durationMinutes} minutes on ${focusTarget.label}`
    : 'Select a focus target to begin';

  const tasks = state.tasks;
  const subjects = state.subjects;
  const folders = state.folders;

  const focusTargets = useMemo(() => {
    const subjectMap = new Map(subjects.map(subject => [subject.id, subject.name]));

    const taskTargets = tasks.map(task => {
      const subjectName = task.subjectId ? subjectMap.get(task.subjectId) : '';
      const label = subjectName ? `${subjectName} – ${task.title}` : task.title;
      return { type: 'task' as const, id: task.id, label, meta: { subjectId: task.subjectId || '' } };
    });

    const subjectTargets = subjects.map(subject => ({
      type: 'subject' as const,
      id: subject.id,
      label: subject.name,
      meta: {},
    }));

    const folderTargets = folders.flatMap(folder => {
      return folder.items.map(item => ({
        type: 'folderItem' as const,
        id: item.id,
        label: `${folder.name} – ${item.title}`,
        meta: { folderId: folder.id, itemType: item.type },
      }));
    });

    return { taskTargets, subjectTargets, folderTargets };
  }, [tasks, subjects, folders]);

  // Immersive mode: hide navbar during focus
  useEffect(() => {
    if ((isActive && !isPaused) || showReflection) {
      setHideNavbar(true);
    } else {
      setHideNavbar(false);
    }
  }, [isActive, isPaused, showReflection, setHideNavbar]);

  const computeSuggestedDuration = (summary: {
    successRate: number;
    lastSession: { status: string; plannedDurationMinutes: number } | null;
  } | null) => {
    const successRate = summary?.successRate ?? 0;
    let suggestion = 40;
    let hint = '';

    if (successRate < 0.4) {
      suggestion = 30;
      hint = 'Recent sessions are struggling. Try 25–35m.';
    } else if (successRate < 0.7) {
      suggestion = 40;
      hint = 'Stable focus. Try 35–45m.';
    } else {
      suggestion = 50;
      hint = 'Strong focus lately. Try 45–60m.';
    }

    const lastSession = summary?.lastSession;
    if (lastSession && lastSession.status !== 'completed' && lastSession.plannedDurationMinutes) {
      const last = lastSession.plannedDurationMinutes;
      if (last >= 55) {
        suggestion = 35;
        hint = `Last time you failed at ${last}m. Try 35m.`;
      } else if (last >= 45) {
        suggestion = 30;
        hint = `Last time you failed at ${last}m. Try 30m.`;
      } else if (last >= 35) {
        suggestion = 25;
        hint = `Last time you failed at ${last}m. Try 25m.`;
      }
    }

    return { suggestion, hint };
  };

  const loadSuggestion = async () => {
    if (!focusTarget) {
      setSuggestedMinutes(35);
      setSuggestionHint('Select a focus target to get a recommendation.');
      return;
    }
    try {
      const params = new URLSearchParams({ targetType: focusTarget.type, targetId: focusTarget.id });
      const res = await apiFetch(`/api/focus/summary?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load summary');
      const data = await res.json();
      const { suggestion, hint } = computeSuggestedDuration({
        successRate: data?.successRate ?? 0,
        lastSession: data?.lastSession || null,
      });
      setSuggestedMinutes(suggestion);
      setSuggestionHint(hint);
      setFocusStreak(data?.streak || 0);
      if (!isActive) {
        setDurationMinutes(suggestion);
      }
    } catch {
      setSuggestedMinutes(40);
      setSuggestionHint('Use a steady duration to build consistency.');
    }
  };

  useEffect(() => {
    loadSuggestion();
  }, [focusTarget?.id]);

  useEffect(() => {
    if (!isActive && !showReflection) {
      resetTimer(durationMinutes);
    }
  }, [durationMinutes, isActive, showReflection, resetTimer]);

  // Restore session from localStorage - only run once on mount
  useEffect(() => {
    // Skip if already restored
    if (sessionRestoredRef.current) return;
    
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.sessionId || !saved?.startedAt || !saved?.target || !saved?.durationMinutes) return;
      const startedAt = new Date(saved.startedAt);
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
      const remaining = Math.max(0, Math.round(saved.durationMinutes * 60 - elapsedSeconds));

      // Mark as restored before setting state to prevent re-runs
      sessionRestoredRef.current = true;

      setFocusTarget(saved.target);
      setDurationMinutes(saved.durationMinutes);
      setSessionId(saved.sessionId);
      setSessionStartedAt(saved.startedAt);

      if (remaining > 0) {
        setFocusSessionState({ isActive: true, isPaused: false, timeLeft: remaining, mode: 'focus' });
      } else {
        setFocusSessionState({ isActive: false, isPaused: false, timeLeft: 0, mode: 'focus' });
        setReflectionType('finished');
        setShowReflection(true);
      }
    } catch {
      // Ignore corrupted cache
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  useEffect(() => {
    if (sessionId && focusTarget && sessionStartedAt) {
      const payload = {
        sessionId,
        startedAt: sessionStartedAt,
        durationMinutes,
        target: focusTarget,
      };
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage errors
      }
    } else {
      try {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } catch {
        // Ignore
      }
    }
  }, [sessionId, focusTarget, sessionStartedAt, durationMinutes, ACTIVE_SESSION_KEY]);

  useEffect(() => {
    if (!sessionId) return;
    if (showReflection) return;
    if (!isActive && timeLeft === 0 && reflectionType === null) {
      setReflectionType('finished');
      setShowReflection(true);
    }
  }, [sessionId, isActive, timeLeft, showReflection, reflectionType]);

  useEffect(() => {
    if (!focusTarget && !isActive && !showTargetModal) {
      setShowTargetModal(true);
    }
  }, [focusTarget, isActive, showTargetModal]);

  const handleStartFocus = async () => {
    if (!focusTarget) {
      setShowTargetModal(true);
      return;
    }
    if (durationMinutes <= 0) return;
    try {
      const res = await apiFetch('/api/focus/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: focusTarget.type,
          targetId: focusTarget.id,
          targetLabel: focusTarget.label,
          targetMeta: focusTarget.meta || {},
          plannedDurationMinutes: durationMinutes,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to start focus session');
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setSessionStartedAt(data.startedAt || new Date().toISOString());
      setReflectionType(null);
      setReflectionText('');
      setQuitWarning('');
      resetTimer(durationMinutes);
      startTimer();
    } catch (err) {
      console.error('[Focus] Start failed:', err);
    }
  };

  const prepareQuitWarning = async () => {
    if (!focusTarget) return;
    try {
      const params = new URLSearchParams({ targetType: focusTarget.type, targetId: focusTarget.id });
      const res = await apiFetch(`/api/focus/summary?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const projected = (data?.quitCount7d || 0) + 1;
      if (projected >= 3) {
        setQuitWarning("You've quit 3 sessions on this task. Reduce duration or break it down?");
      } else {
        setQuitWarning('');
      }
    } catch {
      setQuitWarning('');
    }
  };

  const handleEarlyEnd = () => {
    setShowEndConfirm(false);
    setReflectionType('blocked');
    setShowReflection(true);
    prepareQuitWarning();
    resetTimer(durationMinutes);
  };

  const handleSubmitReflection = async () => {
    if (!sessionId || !reflectionType) return;
    if (!reflectionText.trim()) return;
    setSubmitReflectionLoading(true);
    try {
      const endpoint = reflectionType === 'finished' ? '/api/focus/sessions/complete' : '/api/focus/sessions/abandon';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          reflectionText: reflectionText.trim(),
        }),
      });
      
      // Handle specific error cases
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[Focus] Server error:', res.status, errorData);
        
        // If session not found or not active, it means the session was already closed
        // Clear local state and show modal to inform user
        if (res.status === 404 || (res.status === 400 && errorData?.error?.includes('not active'))) {
          console.warn('[Focus] Session already closed on server, clearing local state');
          setSessionId(null);
          setSessionStartedAt(null);
          setReflectionText('');
          setReflectionType(null);
          setShowReflection(false);
          setQuitWarning('');
          resetTimer(durationMinutes);
          setShowSessionExpiredModal(true);
          return;
        }
        
        throw new Error(errorData?.error || 'Failed to save focus session');
      }
      
      const data = await res.json();
      if (typeof data?.streak === 'number') {
        setFocusStreak(data.streak);
      } else if (reflectionType === 'blocked') {
        setFocusStreak(0);
      }
      if (reflectionType === 'finished' && focusTarget?.type === 'task') {
        const task = tasks.find(item => item.id === focusTarget.id);
        if (task) {
          updateTask({ ...task, completed: true });
        }
      }
      setSessionId(null);
      setSessionStartedAt(null);
      setReflectionText('');
      setReflectionType(null);
      setShowReflection(false);
      setQuitWarning('');
      resetTimer(durationMinutes);
    } catch (err) {
      console.error('[Focus] Submit failed:', err);
    } finally {
      setSubmitReflectionLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-between p-6 relative overflow-hidden bg-zen-bg">
        
        {/* Dynamic Background */}
        <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-tr from-zen-primary/5 via-transparent to-zen-secondary/5 blur-[100px] transition-all duration-[3000ms] ${isActive && !isPaused ? 'opacity-100 rotate-180 scale-110' : 'opacity-40 rotate-0 scale-100'}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,12,0.8)_100%)] opacity-80" />
        </div>

        {/* Desktop Title - Hidden on mobile to save space and prevent scrolling */}
        {/* Removed redundant header and system ready badge for clarity */}
        
        {/* Main Layout Container - Flex Column for vertical distribution without scroll */}
        <div className="w-full h-full max-w-lg md:max-w-4xl mx-auto flex flex-col items-center justify-evenly py-4 md:py-0 z-20">

            {/* 1. TOP SECTION: Goal & Timer (The Hero) */}
            <div className="flex flex-col items-center justify-center flex-grow-[2] w-full">
                
                {/* Focus Target */}
                <div className="mb-6 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zen-text-secondary uppercase tracking-widest hidden md:block">Focusing on:</span>
                        <button
                            onClick={() => !isActive && setShowTargetModal(true)}
                            className={`px-5 py-2 rounded-full border text-xs md:text-sm font-medium tracking-wide shadow-lg transition-all max-w-[80vw] truncate ${
                            focusTarget
                                ? 'bg-zen-surface/30 border-zen-surface/50 text-zen-primary hover:bg-zen-surface/50'
                                : 'bg-transparent border-zen-surface text-zen-text-disabled hover:text-zen-primary'
                            }`}
                        >
                            {focusTarget ? focusTarget.label : '+ Select focus target'}
                        </button>
                    </div>
                    {/* Removed ghost text */}
                    {focusStreak > 0 && (
                      <div className="text-[10px] uppercase tracking-[0.3em] text-zen-primary font-bold">
                        Streak {focusStreak}
                      </div>
                    )}
                </div>

                {/* THE TIMER */}
                <div className="relative group">
                    {/* Ring Container - Responsive sizing */}
                    <div className={`relative w-[65vw] h-[65vw] max-w-[280px] max-h-[280px] md:w-96 md:h-96 rounded-full flex items-center justify-center transition-all duration-[1500ms] ease-out ${isActive && !isPaused ? 'scale-105' : 'scale-100'}`}>
                        
                        {/* Decorative Rings */}
                        <div className="absolute inset-0 border-[0.5px] border-zen-surface/30 rounded-full" />
                        <div className="absolute inset-4 border-[0.5px] border-zen-surface/20 rounded-full" />
                        
                        {/* Progress Ring */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.01]">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="48%"
                                fill="none"
                                stroke="url(#timerGradient)"
                                strokeWidth="2"
                                strokeDasharray="100 100"
                                strokeDashoffset={100 - progress}
                                pathLength="100"
                                className="transition-all duration-1000 ease-linear"
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#64FFDA" />
                                    <stop offset="100%" stopColor="#7F5AF0" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Digital Time */}
                        <div className="text-center flex flex-col items-center z-10">
                             <span className={`text-[17vw] md:text-[6rem] leading-none font-extralight tracking-tighter tabular-nums transition-colors duration-500 ${isActive && !isPaused ? 'text-zen-primary drop-shadow-[0_0_15px_rgba(100,255,218,0.3)]' : 'text-zen-text-primary'}`}>
                                {formatTime(timeLeft)}
                            </span>
                            <span className="text-[10px] md:text-sm text-zen-text-disabled uppercase font-bold tracking-[0.3em] mt-2 md:mt-4 opacity-80">
                                {isActive ? (isPaused ? 'PAUSED' : 'FOCUSING') : 'READY'}
                            </span>
                             {!isActive && suggestionHint && (
                                <span className="text-xs text-zen-text-secondary mt-3 font-medium opacity-60 tracking-wide max-w-[200px] text-center">
                                    {suggestionHint}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. BOTTOM SECTION: Controls (Compact & Accessible) */}
            <div className="flex flex-col items-center w-full gap-8 md:gap-12 mt-auto flex-shrink-0">
                
                {/* Unified Control Bar */}
                <div className="flex items-center gap-6 md:gap-10">
                    
                    {/* Duration Adjust - Left Side */}
                    {!isActive && (
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={() => setDurationMinutes(Math.max(15, durationMinutes - 5))}
                                className="w-10 h-10 rounded-full bg-zen-surface/10 border border-zen-surface/30 text-zen-text-secondary hover:text-zen-primary hover:border-zen-primary/50 flex items-center justify-center transition-all"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20 12H4"/></svg>
                            </button>
                            <div className="flex flex-col items-center min-w-[3rem]">
                                <span className="text-xl font-light text-zen-text-primary">{durationMinutes}</span>
                                <span className="text-[9px] uppercase tracking-widest text-zen-text-disabled">min</span>
                            </div>
                            <button 
                                onClick={() => setDurationMinutes(Math.min(120, durationMinutes + 5))}
                                className="w-10 h-10 rounded-full bg-zen-surface/10 border border-zen-surface/30 text-zen-text-secondary hover:text-zen-primary hover:border-zen-primary/50 flex items-center justify-center transition-all"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 4v16m8-8H4"/></svg>
                            </button>
                        </div>
                    )}

                    {/* MAIN PLAY BUTTON (Center) */}
                    <div>
                         {!isActive ? (
                            <button 
                                onClick={handleStartFocus}
                                disabled={!focusTarget || durationMinutes < 15}
                                className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all shadow-xl z-20 ${
                                focusTarget && durationMinutes >= 15
                                    ? 'bg-zen-primary text-black hover:scale-105 hover:shadow-[0_0_30px_rgba(100,255,218,0.4)] active:scale-95'
                                    : 'bg-zen-surface text-zen-text-disabled cursor-not-allowed opacity-50'
                                }`}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 md:w-10 md:h-10 ml-1"><path d="M8 5v14l11-7z"/></svg>
                            </button>
                        ) : (
                            <div className="flex items-center gap-6">
                                <button 
                                    onClick={() => {
                                        console.log('[Focus] Pause/Play clicked, isPaused:', isPaused);
                                        if (isPaused) {
                                            startTimer();
                                        } else {
                                            pauseTimer();
                                        }
                                    }}
                                    className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all shadow-xl border ${isPaused ? 'bg-zen-primary text-black border-zen-primary' : 'bg-transparent text-zen-primary border-zen-primary hover:bg-zen-primary/10'}`}
                                >
                                    {isPaused ? (
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-1"><path d="M8 5v14l11-7z"/></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                    )}
                                </button>
                                
                                <button 
                                    onClick={() => setShowEndConfirm(true)}
                                    className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-red-400 bg-zen-surface/10 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 6h12v12H6z"/></svg>
                                </button>
                            </div>
                        )}
                    </div>

                     {/* Ambience Toggle (Right) */}                     
                     <div className="flex gap-1">
                        {AMBIENCE_OPTIONS.map(opt => (
                            <button 
                                key={opt.id}
                                onClick={() => setAmbience(opt.id as any)}
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${state.settings.ambience === opt.id ? 'text-zen-primary scale-110' : 'text-zen-text-disabled hover:text-zen-text-primary'}`}
                                title={opt.label}
                            >
                                <span className="text-lg">{opt.icon}</span>
                            </button>
                        ))}
                    </div>

                </div>

                <ConfirmModal
                    isOpen={showEndConfirm}
                    onClose={() => setShowEndConfirm(false)}
                    onConfirm={handleEarlyEnd}
                    title="End Session"
                    message="Stop current session? Progress will not be saved."
                    confirmText="End Session"
                    isDangerous
                />

                {showTargetModal && (
                    <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-fadeIn">
                        <div className="w-full max-w-lg bg-zen-card/90 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-light text-zen-text-primary">Select focus target</h3>
                                    <p className="text-xs md:text-sm text-zen-text-secondary">Choose one task, subject, or document.</p>
                                </div>
                                <button
                                    onClick={() => setShowTargetModal(false)}
                                    className="p-2 rounded-full text-zen-text-secondary hover:text-zen-text-primary hover:bg-zen-surface"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>

                            <div className="space-y-5 max-h-[55vh] overflow-y-auto no-scrollbar pr-1">
                                <div className="space-y-3">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-bold">Tasks</p>
                                    {focusTargets.taskTargets.length === 0 ? (
                                        <p className="text-xs text-zen-text-secondary">No tasks yet.</p>
                                    ) : (
                                        <div className="grid gap-2">
                                            {focusTargets.taskTargets.map(target => (
                                                <button
                                                    key={`task-${target.id}`}
                                                    onClick={() => { setFocusTarget(target); setShowTargetModal(false); }}
                                                    className="w-full text-left p-3 rounded-2xl bg-zen-surface/30 border border-zen-surface hover:border-zen-primary/30 hover:bg-zen-surface/50 transition-all"
                                                >
                                                    <p className="text-sm text-zen-text-primary">{target.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-bold">Subjects</p>
                                    {focusTargets.subjectTargets.length === 0 ? (
                                        <p className="text-xs text-zen-text-secondary">No subjects yet.</p>
                                    ) : (
                                        <div className="grid gap-2">
                                            {focusTargets.subjectTargets.map(target => (
                                                <button
                                                    key={`subject-${target.id}`}
                                                    onClick={() => { setFocusTarget(target); setShowTargetModal(false); }}
                                                    className="w-full text-left p-3 rounded-2xl bg-zen-surface/30 border border-zen-surface hover:border-zen-primary/30 hover:bg-zen-surface/50 transition-all"
                                                >
                                                    <p className="text-sm text-zen-text-primary">{target.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-bold">PDF / Notes</p>
                                    {focusTargets.folderTargets.length === 0 ? (
                                        <p className="text-xs text-zen-text-secondary">No documents yet.</p>
                                    ) : (
                                        <div className="grid gap-2">
                                            {focusTargets.folderTargets.map(target => (
                                                <button
                                                    key={`doc-${target.id}`}
                                                    onClick={() => { setFocusTarget(target); setShowTargetModal(false); }}
                                                    className="w-full text-left p-3 rounded-2xl bg-zen-surface/30 border border-zen-surface hover:border-zen-primary/30 hover:bg-zen-surface/50 transition-all"
                                                >
                                                    <p className="text-sm text-zen-text-primary">{target.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showReflection && reflectionType && (
                    <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6 animate-fadeIn">
                        <div className="w-full max-w-md bg-zen-card/95 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-xl md:text-2xl font-light text-zen-text-primary">
                                    {reflectionType === 'finished' ? 'What did you finish?' : 'What blocked you?'}
                                </h3>
                                <p className="text-xs md:text-sm text-zen-text-secondary">
                                    This reflection is required to close the session.
                                </p>
                            </div>

                            {quitWarning && reflectionType === 'blocked' && (
                                <div className="p-3 rounded-2xl bg-zen-surface/40 border border-zen-surface text-zen-text-primary text-xs uppercase tracking-[0.2em] font-bold">
                                    {quitWarning}
                                </div>
                            )}

                            <textarea
                                value={reflectionText}
                                onChange={(e) => setReflectionText(e.target.value)}
                                rows={4}
                                placeholder={reflectionType === 'finished' ? 'Briefly describe what you completed...' : 'Briefly describe what got in the way...'}
                                className="w-full bg-zen-surface/20 border border-zen-surface rounded-2xl p-4 text-sm text-zen-text-primary focus:outline-none focus:border-zen-primary/50 resize-none"
                            />

                            <button
                                onClick={handleSubmitReflection}
                                disabled={!reflectionText.trim() || submitReflectionLoading}
                                className="w-full py-3.5 rounded-2xl bg-zen-primary text-zen-bg text-[10px] md:text-xs font-black uppercase tracking-[0.25em] transition-all hover:shadow-glow-sm disabled:opacity-60"
                            >
                                {submitReflectionLoading ? 'Saving...' : 'Save Reflection'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Session Expired Modal */}
                {showSessionExpiredModal && (
                    <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[120] flex items-center justify-center p-6 animate-fadeIn">
                        <div className="w-full max-w-sm bg-zen-card/95 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-6 text-center">
                            {/* Icon */}
                            <div className="flex justify-center">
                                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-amber-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                </div>
                            </div>
                            
                            {/* Content */}
                            <div className="space-y-2">
                                <h3 className="text-xl font-light text-zen-text-primary">Session Already Ended</h3>
                                <p className="text-sm text-zen-text-secondary leading-relaxed">
                                    This focus session was already closed, possibly due to starting a new session or a timeout. No worries — you can start a fresh session anytime.
                                </p>
                            </div>
                            
                            {/* Action Button */}
                            <button
                                onClick={() => setShowSessionExpiredModal(false)}
                                className="w-full py-3.5 rounded-2xl bg-zen-primary text-zen-bg text-xs font-bold uppercase tracking-widest transition-all hover:shadow-glow-sm"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    </div>
  );
};

export default Focus;
