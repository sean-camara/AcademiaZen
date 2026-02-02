import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useZen } from '../context/ZenContext';
import { AMBIENCE_OPTIONS, POMODORO_MODES, BLOCKER_CHIPS } from '../constants';
import ConfirmModal from '../components/ConfirmModal';
import { apiFetch } from '../utils/api';
import type { FocusCompletionStatus, PomodoroMode, FocusAnalytics, FocusSuggestion } from '../types';

const Focus: React.FC = () => {
  const { focusSession, startTimer, pauseTimer, resetTimer, setFocusSessionState, setAmbience, state, updateTask, setHideNavbar } = useZen();
  const { isActive, isPaused, timeLeft } = focusSession;
  
  // Core session states
  const [focusTarget, setFocusTarget] = useState<{ type: 'task' | 'subject' | 'folderItem'; id: string; label: string; meta?: Record<string, string> } | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(state.settings.focusDuration || 25);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [focusStreak, setFocusStreak] = useState(0);
  
  // Completion flow states (NEW)
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<FocusCompletionStatus | null>(null);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [selectedBlockers, setSelectedBlockers] = useState<string[]>([]);
  const [sessionWasAbandoned, setSessionWasAbandoned] = useState(false);
  
  // Pomodoro mode states (NEW)
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>('classic');
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [cycleNumber, setCycleNumber] = useState(1);
  const [customWorkMinutes, setCustomWorkMinutes] = useState(25);
  const [customBreakMinutes, setCustomBreakMinutes] = useState(5);
  const [showModeSelector, setShowModeSelector] = useState(false);
  
  // Analytics states (NEW)
  const [analytics, setAnalytics] = useState<FocusAnalytics | null>(null);
  const [suggestions, setSuggestions] = useState<FocusSuggestion[]>([]);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  
  // Session summary for post-completion display (NEW)
  const [sessionSummary, setSessionSummary] = useState<{
    targetLabel: string;
    plannedMinutes: number;
    actualMinutes: number;
    status: FocusCompletionStatus;
    streak: number;
  } | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  // UI states
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const [suggestionHint, setSuggestionHint] = useState('');
  
  const ACTIVE_SESSION_KEY = 'zen_focus_active_session_v2';
  const sessionRestoredRef = useRef(false);

  // ========== UTILITY FUNCTIONS ==========
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCurrentDurations = useCallback(() => {
    if (pomodoroMode === 'custom') {
      return { work: customWorkMinutes, break: customBreakMinutes };
    }
    return POMODORO_MODES[pomodoroMode];
  }, [pomodoroMode, customWorkMinutes, customBreakMinutes]);

  const progress = isActive && durationMinutes > 0
    ? ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100
    : 0;

  const tasks = state.tasks;
  const subjects = state.subjects;
  const folders = state.folders;

  // Build focus targets from tasks and folders
  const focusTargets = useMemo(() => {
    const subjectMap = new Map(subjects.map(subject => [subject.id, subject.name]));

    const taskTargets = tasks
      .filter(task => !task.completed)
      .map(task => {
        const subjectName = task.subjectId ? subjectMap.get(task.subjectId) : '';
        const label = subjectName ? `${subjectName} – ${task.title}` : task.title;
        return { type: 'task' as const, id: task.id, label, meta: { subjectId: task.subjectId || '' } };
      });

    const folderTargets = folders.flatMap(folder => {
      return folder.items.map(item => ({
        type: 'folderItem' as const,
        id: item.id,
        label: `${folder.name} – ${item.title}`,
        meta: { folderId: folder.id, itemType: item.type },
      }));
    });

    return { taskTargets, folderTargets };
  }, [tasks, subjects, folders]);

  // ========== IMMERSIVE MODE ==========
  
  useEffect(() => {
    const shouldHide = (isActive && !isPaused) || showCompletionModal || showReflectionModal || showSummaryModal;
    setHideNavbar(shouldHide);
  }, [isActive, isPaused, showCompletionModal, showReflectionModal, showSummaryModal, setHideNavbar]);

  // ========== LOAD ANALYTICS & SUGGESTIONS ==========
  
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await apiFetch('/api/focus/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        setFocusStreak(data.streak || 0);
      }
    } catch (err) {
      console.error('[Focus] Failed to load analytics:', err);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/focus/suggestions');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('[Focus] Failed to load suggestions:', err);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
    loadSuggestions();
  }, [loadAnalytics, loadSuggestions]);

  // ========== SESSION PERSISTENCE ==========
  
  // Restore session from localStorage on mount
  useEffect(() => {
    if (sessionRestoredRef.current) return;
    
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.sessionId || !saved?.startedAt || !saved?.target || !saved?.durationMinutes) return;
      
      const startedAt = new Date(saved.startedAt);
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
      const remaining = Math.max(0, Math.round(saved.durationMinutes * 60 - elapsedSeconds));

      sessionRestoredRef.current = true;
      setFocusTarget(saved.target);
      setDurationMinutes(saved.durationMinutes);
      setSessionId(saved.sessionId);
      setSessionStartedAt(saved.startedAt);
      if (saved.pomodoroMode) setPomodoroMode(saved.pomodoroMode);
      if (saved.cycleNumber) setCycleNumber(saved.cycleNumber);
      if (saved.isBreak !== undefined) setIsBreakTime(saved.isBreak);

      if (remaining > 0) {
        setFocusSessionState({ isActive: true, isPaused: false, timeLeft: remaining, mode: 'focus' });
      } else {
        // Timer expired - show completion modal
        setFocusSessionState({ isActive: false, isPaused: false, timeLeft: 0, mode: 'focus' });
        setShowCompletionModal(true);
      }
    } catch {
      // Ignore corrupted cache
    }
  }, [setFocusSessionState]);

  // Save session to localStorage
  useEffect(() => {
    if (sessionId && focusTarget && sessionStartedAt) {
      const payload = {
        sessionId,
        startedAt: sessionStartedAt,
        durationMinutes,
        target: focusTarget,
        pomodoroMode,
        cycleNumber,
        isBreak: isBreakTime,
      };
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage errors
      }
    } else if (!sessionId) {
      try {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } catch {
        // Ignore
      }
    }
  }, [sessionId, focusTarget, sessionStartedAt, durationMinutes, pomodoroMode, cycleNumber, isBreakTime]);

  // Timer completion detection
  useEffect(() => {
    if (!sessionId) return;
    if (showCompletionModal || showReflectionModal) return;
    if (!isActive && timeLeft === 0) {
      // Timer finished naturally - show completion step
      setShowCompletionModal(true);
    }
  }, [sessionId, isActive, timeLeft, showCompletionModal, showReflectionModal]);

  // ========== DURATION SYNC ==========
  
  useEffect(() => {
    if (!isActive && !showCompletionModal && !showReflectionModal) {
      const durations = getCurrentDurations();
      const newDuration = isBreakTime ? durations.break : durations.work;
      setDurationMinutes(newDuration);
      resetTimer(newDuration);
    }
  }, [pomodoroMode, isBreakTime, customWorkMinutes, customBreakMinutes, isActive, showCompletionModal, showReflectionModal, getCurrentDurations, resetTimer]);

  // ========== HANDLERS ==========

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
          pomodoroMode,
          cycleNumber,
          isBreak: isBreakTime,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to start focus session');
      
      const data = await res.json();
      setSessionId(data.sessionId);
      setSessionStartedAt(data.startedAt || new Date().toISOString());
      setSessionWasAbandoned(false);
      setCompletionStatus(null);
      setReflectionText('');
      setSelectedBlockers([]);
      resetTimer(durationMinutes);
      startTimer();
    } catch (err) {
      console.error('[Focus] Start failed:', err);
    }
  };

  const handleEarlyEnd = () => {
    setShowEndConfirm(false);
    setSessionWasAbandoned(true);
    pauseTimer();
    setShowCompletionModal(true);
  };

  const handleCompletionSelect = (status: FocusCompletionStatus) => {
    setCompletionStatus(status);
    setShowCompletionModal(false);
    setShowReflectionModal(true);
  };

  const handleSkipReflection = async () => {
    await submitSession(completionStatus!, '', []);
  };

  const handleSubmitReflection = async () => {
    await submitSession(completionStatus!, reflectionText.trim(), selectedBlockers);
  };

  const submitSession = async (
    status: FocusCompletionStatus,
    reflection: string,
    blockers: string[]
  ) => {
    if (!sessionId) return;
    setSubmitLoading(true);
    
    try {
      const endpoint = status === 'not_finished' ? '/api/focus/sessions/abandon' : '/api/focus/sessions/end';
      const actualMinutes = sessionStartedAt 
        ? Math.round((Date.now() - new Date(sessionStartedAt).getTime()) / 60000)
        : durationMinutes;
      
      // Build request body - always include reflectionText (for backward compatibility with old server)
      const requestBody: Record<string, unknown> = {
        sessionId,
        reflectionText: reflection || 'No reflection provided', // Always send a string for old server compatibility
      };
      
      // Add new fields for updated server (will be ignored by old server)
      if (status !== 'not_finished') {
        requestBody.completionStatus = status;
      }
      if (blockers.length > 0) {
        requestBody.blockerChips = blockers;
      }
      requestBody.actualDurationMinutes = actualMinutes;
      
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      // If new endpoint returns 404, fall back to old endpoint
      let finalRes = res;
      if (res.status === 404 && endpoint === '/api/focus/sessions/end') {
        // Try the old /complete endpoint
        finalRes = await apiFetch('/api/focus/sessions/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      }
      
      if (!finalRes.ok) {
        const errorData = await finalRes.json().catch(() => ({}));
        if (finalRes.status === 404 || (finalRes.status === 400 && errorData?.error?.includes('not active'))) {
          clearSessionState();
          setShowSessionExpiredModal(true);
          return;
        }
        throw new Error(errorData?.error || 'Failed to save session');
      }
      
      const data = await finalRes.json();
      
      // Show session summary
      setSessionSummary({
        targetLabel: focusTarget?.label || 'Focus session',
        plannedMinutes: durationMinutes,
        actualMinutes: actualMinutes,
        status: status,
        streak: data?.streak || 0,
      });
      
      if (typeof data?.streak === 'number') {
        setFocusStreak(data.streak);
      }
      
      // Mark task as completed if fully completed
      if (status === 'completed' && focusTarget?.type === 'task') {
        const task = tasks.find(item => item.id === focusTarget.id);
        if (task) {
          updateTask({ ...task, completed: true });
        }
      }
      
      clearSessionState();
      setShowReflectionModal(false);
      setShowSummaryModal(true);
      
      // Refresh analytics
      loadAnalytics();
      
    } catch (err) {
      console.error('[Focus] Submit failed:', err);
    } finally {
      setSubmitLoading(false);
    }
  };

  const clearSessionState = () => {
    setSessionId(null);
    setSessionStartedAt(null);
    setCompletionStatus(null);
    setReflectionText('');
    setSelectedBlockers([]);
    setSessionWasAbandoned(false);
    setShowCompletionModal(false);
    setShowReflectionModal(false);
    resetTimer(durationMinutes);
  };

  const handleStartBreak = () => {
    setIsBreakTime(true);
    const durations = getCurrentDurations();
    setDurationMinutes(durations.break);
    setShowSummaryModal(false);
    resetTimer(durations.break);
  };

  const handleStartNextCycle = () => {
    setIsBreakTime(false);
    setCycleNumber(prev => prev + 1);
    const durations = getCurrentDurations();
    setDurationMinutes(durations.work);
    setShowSummaryModal(false);
    resetTimer(durations.work);
  };

  const handleCloseSummary = () => {
    setShowSummaryModal(false);
    setSessionSummary(null);
    setIsBreakTime(false);
    setCycleNumber(1);
  };

  const toggleBlocker = (id: string) => {
    setSelectedBlockers(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  // ========== RENDER ==========

  return (
    <div className="h-full flex flex-col items-center justify-between p-6 relative overflow-hidden bg-zen-bg">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-tr from-zen-primary/5 via-transparent to-zen-secondary/5 blur-[100px] transition-all duration-[3000ms] ${isActive && !isPaused ? 'opacity-100 rotate-180 scale-110' : isBreakTime ? 'opacity-60 rotate-90 scale-105' : 'opacity-40 rotate-0 scale-100'}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,12,0.8)_100%)] opacity-80" />
      </div>

      {/* Main Layout Container */}
      <div className="w-full h-full max-w-lg md:max-w-4xl mx-auto flex flex-col items-center justify-evenly py-4 md:py-0 z-20">

        {/* TOP SECTION: Stats Bar (New) */}
        {!isActive && analytics && (
          <div className="w-full flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setShowStatsPanel(!showStatsPanel)}
              className="flex items-center gap-3 px-4 py-2 bg-zen-surface/20 rounded-xl border border-zen-surface/30 hover:border-zen-primary/30 transition-all"
            >
              <div className="text-center">
                <p className="text-lg font-semibold text-zen-primary">{Math.round(analytics.weekMinutes / 60)}h</p>
                <p className="text-[9px] uppercase tracking-widest text-zen-text-secondary">This Week</p>
              </div>
              <div className="w-px h-8 bg-zen-surface/50" />
              <div className="text-center">
                <p className="text-lg font-semibold text-zen-text-primary">{focusStreak}</p>
                <p className="text-[9px] uppercase tracking-widest text-zen-text-secondary">Streak</p>
              </div>
              <div className="w-px h-8 bg-zen-surface/50" />
              <div className="text-center">
                <p className="text-lg font-semibold text-zen-text-primary">{analytics.totalSessions}</p>
                <p className="text-[9px] uppercase tracking-widest text-zen-text-secondary">Sessions</p>
              </div>
            </button>
          </div>
        )}

        {/* HERO SECTION: Target & Timer */}
        <div className="flex flex-col items-center justify-center flex-grow-[2] w-full">
          
          {/* Focus Target */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zen-text-secondary uppercase tracking-widest hidden md:block">
                {isBreakTime ? 'Break Time' : 'Focusing on:'}
              </span>
              <button
                onClick={() => !isActive && setShowTargetModal(true)}
                disabled={isActive}
                className={`px-5 py-2 rounded-full border text-xs md:text-sm font-medium tracking-wide shadow-lg transition-all max-w-[80vw] truncate ${
                  isBreakTime
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                    : focusTarget
                    ? 'bg-zen-surface/30 border-zen-surface/50 text-zen-primary hover:bg-zen-surface/50'
                    : 'bg-transparent border-zen-surface text-zen-text-disabled hover:text-zen-primary'
                } ${isActive ? 'cursor-default' : ''}`}
              >
                {isBreakTime ? `☕ Break (Cycle ${cycleNumber})` : focusTarget ? focusTarget.label : '+ Select focus target'}
              </button>
            </div>
            
            {/* Pomodoro Mode Selector */}
            {!isActive && !isBreakTime && (
              <button
                onClick={() => setShowModeSelector(true)}
                className="text-[10px] uppercase tracking-[0.2em] text-zen-text-secondary hover:text-zen-primary transition-colors"
              >
                {POMODORO_MODES[pomodoroMode]?.label || 'Classic (25/5)'} ▾
              </button>
            )}
            
            {/* Streak Badge */}
            {focusStreak > 0 && !isBreakTime && (
              <div className="text-[10px] uppercase tracking-[0.3em] text-zen-primary font-bold">
                🔥 Streak {focusStreak}
              </div>
            )}
          </div>

          {/* THE TIMER */}
          <div className="relative group">
            <div className={`relative w-[65vw] h-[65vw] max-w-[280px] max-h-[280px] md:w-96 md:h-96 rounded-full flex items-center justify-center transition-all duration-[1500ms] ease-out ${isActive && !isPaused ? 'scale-105' : 'scale-100'}`}>
              
              {/* Decorative Rings */}
              <div className={`absolute inset-0 border-[0.5px] rounded-full ${isBreakTime ? 'border-purple-500/30' : 'border-zen-surface/30'}`} />
              <div className={`absolute inset-4 border-[0.5px] rounded-full ${isBreakTime ? 'border-purple-500/20' : 'border-zen-surface/20'}`} />
              
              {/* Progress Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.01]">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke={isBreakTime ? 'url(#breakGradient)' : 'url(#timerGradient)'}
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
                  <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A78BFA" />
                    <stop offset="100%" stopColor="#F472B6" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Digital Time */}
              <div className="text-center flex flex-col items-center z-10">
                <span className={`text-[17vw] md:text-[6rem] leading-none font-extralight tracking-tighter tabular-nums transition-colors duration-500 ${
                  isBreakTime
                    ? 'text-purple-400 drop-shadow-[0_0_15px_rgba(167,139,250,0.3)]'
                    : isActive && !isPaused 
                    ? 'text-zen-primary drop-shadow-[0_0_15px_rgba(100,255,218,0.3)]' 
                    : 'text-zen-text-primary'
                }`}>
                  {formatTime(timeLeft)}
                </span>
                <span className="text-[10px] md:text-sm text-zen-text-disabled uppercase font-bold tracking-[0.3em] mt-2 md:mt-4 opacity-80">
                  {isActive ? (isPaused ? 'PAUSED' : isBreakTime ? 'BREAK' : 'FOCUSING') : 'READY'}
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

        {/* BOTTOM SECTION: Controls */}
        <div className="w-full mt-auto pb-4 md:pb-0 z-30">
          
          {!isActive ? (
            /* INACTIVE STATE: Duration | Play | Ambience */
            <div className="grid grid-cols-3 items-center w-full max-w-full px-2 md:max-w-2xl mx-auto gap-1 md:gap-8">
              
              {/* Left: Duration Controls */}
              <div className="flex justify-start justify-self-start min-w-0">
                <div className="flex items-center gap-0 bg-zen-surface/20 rounded-xl p-0.5 backdrop-blur-sm border border-zen-surface/20 shadow-lg">
                  <button 
                    onClick={() => {
                      const newDur = Math.max(5, durationMinutes - 5);
                      setDurationMinutes(newDur);
                      resetTimer(newDur);
                    }}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-lg hover:bg-zen-surface/30 text-zen-text-secondary hover:text-zen-primary flex items-center justify-center transition-all active:scale-95"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M20 12H4"/></svg>
                  </button>
                  <div className="flex flex-col items-center min-w-[2.2rem] md:min-w-[2.5rem] px-1">
                    <span className="text-sm md:text-lg font-medium text-zen-text-primary leading-none tabular-nums">{durationMinutes}</span>
                    <span className="text-[7px] md:text-[9px] uppercase tracking-widest text-zen-text-disabled mt-0.5">min</span>
                  </div>
                  <button 
                    onClick={() => {
                      const newDur = Math.min(120, durationMinutes + 5);
                      setDurationMinutes(newDur);
                      resetTimer(newDur);
                    }}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-lg hover:bg-zen-surface/30 text-zen-text-secondary hover:text-zen-primary flex items-center justify-center transition-all active:scale-95"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 4v16m8-8H4"/></svg>
                  </button>
                </div>
              </div>

              {/* Center: Play Button */}
              <div className="flex justify-center justify-self-center">
                <button 
                  onClick={handleStartFocus}
                  disabled={durationMinutes < 5}
                  className={`w-14 h-14 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all shadow-2xl group relative ${
                    isBreakTime
                      ? 'bg-purple-500 text-white hover:scale-105 active:scale-95'
                      : durationMinutes >= 5
                      ? 'bg-zen-primary text-black hover:scale-105 active:scale-95'
                      : 'bg-zen-surface text-zen-text-disabled cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity ${isBreakTime ? 'bg-purple-500' : 'bg-zen-primary'}`} />
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 md:w-10 md:h-10 ml-0.5 relative z-10"><path d="M8 5v14l11-7z"/></svg>
                </button>
              </div>

              {/* Right: Ambience Toggles */}                     
              <div className="flex justify-end justify-self-end min-w-0">
                <div className="flex items-center gap-0 bg-zen-surface/20 rounded-xl p-0.5 backdrop-blur-sm border border-zen-surface/20 shadow-lg">
                  {AMBIENCE_OPTIONS.map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => setAmbience(opt.id as any)}
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all ${state.settings.ambience === opt.id ? 'bg-zen-surface/50 text-zen-primary shadow-sm' : 'text-zen-text-disabled hover:text-zen-text-primary'}`}
                      title={opt.label}
                    >
                      <span className="text-lg md:text-lg">{opt.icon}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE STATE: Stop | Pause | Ambience */
            <div className="flex items-center justify-center gap-4 md:gap-6 w-full max-w-md mx-auto px-4">
              
              {/* Stop Button */}
              <button 
                onClick={() => setShowEndConfirm(true)}
                className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all shadow-lg"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path d="M6 6h12v12H6z"/></svg>
              </button>
              
              {/* Pause/Resume Button */}
              <button 
                onClick={() => isPaused ? startTimer() : pauseTimer()}
                className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all shadow-xl border-2 ${
                  isBreakTime
                    ? isPaused ? 'bg-purple-500 text-white border-purple-500 animate-pulse-slow' : 'bg-transparent text-purple-400 border-purple-400 hover:bg-purple-500/10'
                    : isPaused ? 'bg-zen-primary text-black border-zen-primary animate-pulse-slow' : 'bg-transparent text-zen-primary border-zen-primary hover:bg-zen-primary/10'
                }`}
              >
                {isPaused ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 md:w-8 md:h-8 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 md:w-8 md:h-8"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                )}
              </button>
              
              {/* Ambience Toggles */}
              <div className="flex items-center gap-0 bg-zen-surface/20 rounded-xl p-0.5 backdrop-blur-sm border border-zen-surface/20 shadow-lg">
                {AMBIENCE_OPTIONS.map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => setAmbience(opt.id as any)}
                    className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center transition-all ${state.settings.ambience === opt.id ? 'bg-zen-surface/50 text-zen-primary shadow-sm' : 'text-zen-text-disabled hover:text-zen-text-primary'}`}
                    title={opt.label}
                  >
                    <span className="text-lg">{opt.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== MODALS ========== */}

      {/* End Session Confirm */}
      <ConfirmModal
        isOpen={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={handleEarlyEnd}
        title="End Session Early?"
        message="You can still record this as partial progress."
        confirmText="End Session"
        isDangerous
      />

      {/* Target Selection Modal */}
      {showTargetModal && (
        <>
          <div className="fixed inset-0 lg:left-72 bg-zen-bg/95 backdrop-blur-xl z-[100]" onClick={() => setShowTargetModal(false)} />
          <div className="fixed inset-0 lg:left-72 z-[101] flex items-center justify-center p-6 pointer-events-none animate-fadeIn">
            <div className="w-full max-w-lg bg-zen-card/90 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-6 pointer-events-auto shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl md:text-2xl text-zen-text-primary font-medium tracking-tight">Select target</h3>
                  <p className="text-xs md:text-sm text-zen-text-secondary mt-1">What would you like to focus on?</p>
                </div>
                <button
                  onClick={() => setShowTargetModal(false)}
                  className="p-2 rounded-full text-zen-text-secondary hover:text-zen-text-primary hover:bg-zen-surface transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Smart Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-zen-surface/30 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zen-text-primary font-bold">Suggested</p>
                  </div>
                  <div className="grid gap-2">
                    {suggestions.slice(0, 3).map(sugg => (
                      <button
                        key={`sugg-${sugg.id}`}
                        onClick={() => {
                          const target = focusTargets.taskTargets.find(t => t.id === sugg.id);
                          if (target) {
                            setFocusTarget(target);
                            setShowTargetModal(false);
                          }
                        }}
                        className="group w-full text-left p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/30 hover:border-amber-400/50 transition-all shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-zen-text-primary group-hover:text-white transition-colors line-clamp-1">{sugg.label}</p>
                            <p className="text-[10px] text-amber-400 mt-0.5">{sugg.reason === 'overdue' ? '⚠️ Overdue' : sugg.reason === 'due_soon' ? '⏰ Due soon' : '📝 Unfinished'}</p>
                          </div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1"><path d="M9 18l6-6-6-6"/></svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6 max-h-[55vh] overflow-y-auto no-scrollbar pr-1">
                {/* Tasks */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-zen-surface/30 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-zen-primary"></div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zen-text-primary font-bold">Tasks</p>
                  </div>
                  {focusTargets.taskTargets.length === 0 ? (
                    <p className="text-xs text-zen-text-secondary pl-2 italic">No pending tasks.</p>
                  ) : (
                    <div className="grid gap-2">
                      {focusTargets.taskTargets.map(target => (
                        <button
                          key={`task-${target.id}`}
                          onClick={() => { setFocusTarget(target); setShowTargetModal(false); }}
                          className="group w-full text-left p-3.5 rounded-xl bg-gradient-to-br from-zen-surface/40 to-zen-surface/20 border border-zen-surface/50 hover:border-zen-primary/50 hover:from-zen-surface/60 hover:to-zen-surface/40 transition-all shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-zen-text-primary group-hover:text-white transition-colors line-clamp-1">{target.label}</p>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-zen-text-disabled group-hover:text-zen-primary opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1"><path d="M9 18l6-6-6-6"/></svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-zen-surface/30 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zen-text-primary font-bold">Documents</p>
                  </div>
                  {focusTargets.folderTargets.length === 0 ? (
                    <p className="text-xs text-zen-text-secondary pl-2 italic">No documents found.</p>
                  ) : (
                    <div className="grid gap-2">
                      {focusTargets.folderTargets.map(target => (
                        <button
                          key={`doc-${target.id}`}
                          onClick={() => { setFocusTarget(target); setShowTargetModal(false); }}
                          className="group w-full text-left p-3.5 rounded-xl bg-gradient-to-br from-zen-surface/40 to-zen-surface/20 border border-zen-surface/50 hover:border-purple-400/50 hover:from-zen-surface/60 hover:to-zen-surface/40 transition-all shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-zen-text-primary group-hover:text-white transition-colors line-clamp-1">{target.label}</p>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-zen-text-disabled group-hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1"><path d="M9 18l6-6-6-6"/></svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pomodoro Mode Selector Modal */}
      {showModeSelector && (
        <>
          <div className="fixed inset-0 lg:left-72 bg-zen-bg/90 backdrop-blur-sm z-[100]" onClick={() => setShowModeSelector(false)} />
          <div className="fixed inset-0 lg:left-72 z-[101] flex items-center justify-center p-6 pointer-events-none animate-fadeIn">
            <div className="w-full max-w-sm bg-zen-card/95 border border-zen-surface rounded-2xl p-6 pointer-events-auto shadow-2xl space-y-4">
              <h3 className="text-lg text-zen-text-primary font-medium">Pomodoro Mode</h3>
              
              <div className="space-y-2">
                {(['classic', 'long', 'custom'] as PomodoroMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setPomodoroMode(mode);
                      if (mode !== 'custom') {
                        setDurationMinutes(POMODORO_MODES[mode].work);
                        resetTimer(POMODORO_MODES[mode].work);
                      }
                      if (mode !== 'custom') setShowModeSelector(false);
                    }}
                    className={`w-full p-3 rounded-xl text-left transition-all ${
                      pomodoroMode === mode
                        ? 'bg-zen-primary/20 border border-zen-primary/50 text-zen-primary'
                        : 'bg-zen-surface/20 border border-zen-surface/30 text-zen-text-secondary hover:text-zen-text-primary'
                    }`}
                  >
                    <p className="font-medium">{POMODORO_MODES[mode].label}</p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {mode === 'custom' 
                        ? `${customWorkMinutes}min work / ${customBreakMinutes}min break`
                        : `${POMODORO_MODES[mode].work}min work / ${POMODORO_MODES[mode].break}min break`}
                    </p>
                  </button>
                ))}
              </div>
              
              {/* Custom Duration Inputs */}
              {pomodoroMode === 'custom' && (
                <div className="space-y-3 pt-2 border-t border-zen-surface/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zen-text-secondary">Work duration</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCustomWorkMinutes(Math.max(5, customWorkMinutes - 5))} className="w-8 h-8 rounded bg-zen-surface/30 text-zen-text-primary">-</button>
                      <span className="w-12 text-center text-zen-text-primary">{customWorkMinutes}m</span>
                      <button onClick={() => setCustomWorkMinutes(Math.min(120, customWorkMinutes + 5))} className="w-8 h-8 rounded bg-zen-surface/30 text-zen-text-primary">+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zen-text-secondary">Break duration</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCustomBreakMinutes(Math.max(1, customBreakMinutes - 1))} className="w-8 h-8 rounded bg-zen-surface/30 text-zen-text-primary">-</button>
                      <span className="w-12 text-center text-zen-text-primary">{customBreakMinutes}m</span>
                      <button onClick={() => setCustomBreakMinutes(Math.min(30, customBreakMinutes + 1))} className="w-8 h-8 rounded bg-zen-surface/30 text-zen-text-primary">+</button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDurationMinutes(customWorkMinutes);
                      resetTimer(customWorkMinutes);
                      setShowModeSelector(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-zen-primary text-zen-bg text-xs font-bold uppercase tracking-widest"
                  >
                    Apply Custom
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* COMPLETION STEP MODAL (NEW) */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-md bg-zen-card/95 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="text-4xl mb-2">{sessionWasAbandoned ? '⏸️' : '⏱️'}</div>
              <h3 className="text-xl md:text-2xl font-light text-zen-text-primary">
                {sessionWasAbandoned ? 'Session Ended Early' : 'Time\'s Up!'}
              </h3>
              <p className="text-sm text-zen-text-secondary">
                How much did you accomplish?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleCompletionSelect('completed')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-green-500/20 to-green-500/10 border border-green-500/30 hover:border-green-400/60 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div className="text-left">
                    <p className="font-medium text-green-400">Completed</p>
                    <p className="text-xs text-zen-text-secondary">Finished what I planned</p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleCompletionSelect('partial')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-amber-500/10 border border-amber-500/30 hover:border-amber-400/60 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔶</span>
                  <div className="text-left">
                    <p className="font-medium text-amber-400">Partial Progress</p>
                    <p className="text-xs text-zen-text-secondary">Made some progress, not done</p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleCompletionSelect('not_finished')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-red-500/20 to-red-500/10 border border-red-500/30 hover:border-red-400/60 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">❌</span>
                  <div className="text-left">
                    <p className="font-medium text-red-400">Not Finished</p>
                    <p className="text-xs text-zen-text-secondary">Got stuck or distracted</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFLECTION MODAL (OPTIONAL) */}
      {showReflectionModal && completionStatus && (
        <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-md bg-zen-card/95 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-5">
            <div className="space-y-1">
              <h3 className="text-xl md:text-2xl font-light text-zen-text-primary">
                {completionStatus === 'completed' ? 'Nice work! 🎉' : completionStatus === 'partial' ? 'Good effort!' : 'What blocked you?'}
              </h3>
              <p className="text-xs md:text-sm text-zen-text-secondary">
                {completionStatus === 'not_finished' 
                  ? 'Help us understand so we can help you improve'
                  : 'Optional: Add a note about what you accomplished'}
              </p>
            </div>

            {/* Quick Blocker Chips (shown for partial/not_finished) */}
            {(completionStatus === 'partial' || completionStatus === 'not_finished') && (
              <div className="space-y-2">
                <p className="text-xs text-zen-text-secondary uppercase tracking-wider">What got in the way?</p>
                <div className="flex flex-wrap gap-2">
                  {BLOCKER_CHIPS.map(chip => (
                    <button
                      key={chip.id}
                      onClick={() => toggleBlocker(chip.id)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                        selectedBlockers.includes(chip.id)
                          ? 'bg-zen-primary/20 border border-zen-primary/50 text-zen-primary'
                          : 'bg-zen-surface/30 border border-zen-surface/50 text-zen-text-secondary hover:text-zen-text-primary'
                      }`}
                    >
                      {chip.icon} {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Text Reflection */}
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              rows={3}
              placeholder={completionStatus === 'completed' ? 'What did you accomplish? (optional)' : 'Any additional notes? (optional)'}
              className="w-full bg-zen-surface/20 border border-zen-surface rounded-2xl p-4 text-sm text-zen-text-primary focus:outline-none focus:border-zen-primary/50 resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={handleSkipReflection}
                disabled={submitLoading}
                className="flex-1 py-3 rounded-2xl bg-zen-surface/30 text-zen-text-secondary text-xs font-bold uppercase tracking-widest transition-all hover:bg-zen-surface/50 disabled:opacity-60"
              >
                Skip
              </button>
              <button
                onClick={handleSubmitReflection}
                disabled={submitLoading}
                className="flex-1 py-3 rounded-2xl bg-zen-primary text-zen-bg text-xs font-bold uppercase tracking-widest transition-all hover:shadow-glow-sm disabled:opacity-60"
              >
                {submitLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SESSION SUMMARY MODAL */}
      {showSummaryModal && sessionSummary && (
        <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-md bg-zen-card/95 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="text-5xl">
                {sessionSummary.status === 'completed' ? '🎉' : sessionSummary.status === 'partial' ? '💪' : '🔄'}
              </div>
              <h3 className="text-xl md:text-2xl font-light text-zen-text-primary">
                {sessionSummary.status === 'completed' ? 'Session Complete!' : sessionSummary.status === 'partial' ? 'Progress Made!' : 'Session Recorded'}
              </h3>
              <p className="text-sm text-zen-text-secondary line-clamp-1">{sessionSummary.targetLabel}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-zen-surface/30">
              <div className="text-center">
                <p className="text-2xl font-semibold text-zen-text-primary">{sessionSummary.actualMinutes}</p>
                <p className="text-[10px] uppercase tracking-wider text-zen-text-secondary">Minutes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-zen-primary">🔥 {sessionSummary.streak}</p>
                <p className="text-[10px] uppercase tracking-wider text-zen-text-secondary">Streak</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-zen-text-primary">#{cycleNumber}</p>
                <p className="text-[10px] uppercase tracking-wider text-zen-text-secondary">Cycle</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {sessionSummary.status === 'completed' && (
                <button
                  onClick={handleStartBreak}
                  className="w-full py-3.5 rounded-2xl bg-purple-500/20 border border-purple-500/50 text-purple-300 text-xs font-bold uppercase tracking-widest transition-all hover:bg-purple-500/30"
                >
                  ☕ Take a {getCurrentDurations().break}min Break
                </button>
              )}
              
              {(sessionSummary.status === 'completed' || sessionSummary.status === 'partial') && (
                <button
                  onClick={handleStartNextCycle}
                  className="w-full py-3.5 rounded-2xl bg-zen-primary text-zen-bg text-xs font-bold uppercase tracking-widest transition-all hover:shadow-glow-sm"
                >
                  Start Next Cycle
                </button>
              )}
              
              <button
                onClick={handleCloseSummary}
                className="w-full py-3 rounded-2xl bg-zen-surface/30 text-zen-text-secondary text-xs font-bold uppercase tracking-widest transition-all hover:bg-zen-surface/50"
              >
                Done for Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Expired Modal */}
      {showSessionExpiredModal && (
        <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[120] flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-sm bg-zen-card/95 border border-zen-surface rounded-3xl p-6 md:p-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-light text-zen-text-primary">Session Already Ended</h3>
              <p className="text-sm text-zen-text-secondary leading-relaxed">
                This session was already closed. You can start a fresh session anytime.
              </p>
            </div>
            <button
              onClick={() => setShowSessionExpiredModal(false)}
              className="w-full py-3.5 rounded-2xl bg-zen-primary text-zen-bg text-xs font-bold uppercase tracking-widest transition-all hover:shadow-glow-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Stats Panel (Expandable) */}
      {showStatsPanel && analytics && (
        <>
          <div className="fixed inset-0 lg:left-72 bg-zen-bg/80 backdrop-blur-sm z-[95]" onClick={() => setShowStatsPanel(false)} />
          <div className="fixed top-20 left-4 right-4 lg:left-80 lg:right-8 z-[96] bg-zen-card/95 border border-zen-surface rounded-2xl p-6 shadow-2xl animate-fadeIn max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zen-text-primary">Focus Stats</h3>
              <button onClick={() => setShowStatsPanel(false)} className="p-2 rounded-full hover:bg-zen-surface/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-zen-text-secondary"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zen-surface/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-zen-primary">{Math.round(analytics.weekMinutes / 60)}h</p>
                <p className="text-xs text-zen-text-secondary mt-1">This Week</p>
              </div>
              <div className="bg-zen-surface/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-zen-text-primary">{Math.round(analytics.monthMinutes / 60)}h</p>
                <p className="text-xs text-zen-text-secondary mt-1">This Month</p>
              </div>
              <div className="bg-zen-surface/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-zen-text-primary">{analytics.totalSessions}</p>
                <p className="text-xs text-zen-text-secondary mt-1">Total Sessions</p>
              </div>
              <div className="bg-zen-surface/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-zen-text-primary">{Math.round(analytics.completionRate * 100)}%</p>
                <p className="text-xs text-zen-text-secondary mt-1">Completion Rate</p>
              </div>
            </div>

            {/* Weekly Goal Progress */}
            {state.settings.weeklyFocusGoal && (
              <div className="mt-4 p-4 bg-zen-surface/10 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zen-text-secondary">Weekly Goal</span>
                  <span className="text-zen-primary">{Math.round(analytics.weekMinutes / 60)}h / {Math.round(state.settings.weeklyFocusGoal / 60)}h</span>
                </div>
                <div className="h-2 bg-zen-surface/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-zen-primary to-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (analytics.weekMinutes / state.settings.weeklyFocusGoal) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Daily Breakdown */}
            {analytics.dailyBreakdown && analytics.dailyBreakdown.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zen-text-secondary uppercase tracking-wider mb-3">Last 7 Days</p>
                <div className="flex items-end justify-between gap-1 h-20">
                  {analytics.dailyBreakdown.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-zen-primary/60 rounded-t transition-all"
                        style={{ height: `${Math.max(4, (day.minutes / 120) * 100)}%` }}
                      />
                      <span className="text-[10px] text-zen-text-disabled">{day.dayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Focus;
