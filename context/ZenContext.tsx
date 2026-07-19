import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { ZenState, Task, Subject, Flashcard, Folder, FolderItem, UserProfile, AppSettings, FocusSessionState, AmbienceType, AIReviewer, QuizProgress, AIChatMessage } from '../types';
import { INITIAL_STATE, DEFAULT_SETTINGS, DEFAULT_PROFILE } from '../constants';
import { showLocalNotification, sendZenNotification, getPermissionStatus, syncTasksWithBackend, notifyNewTask } from '../utils/pushNotifications';
import { uploadPdfDataUrlToR2 } from '../utils/pdfStorage';
import { useAuth } from './AuthContext';
import { apiFetch } from '../utils/api';

interface ZenContextType {
  state: ZenState;
  focusSession: FocusSessionState;
  addTask: (task: Task) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (task: Task) => void;
  addSubject: (subject: Subject) => void;
  updateSubject: (subject: Subject) => void;
  deleteSubject: (id: string) => void;
  addFlashcard: (card: Flashcard) => void;
  updateFlashcard: (card: Flashcard) => void; 
  addFolder: (folder: Folder) => void;
  updateFolder: (folder: Folder) => void;
  deleteFolder: (id: string) => void;
  addItemToFolder: (folderId: string, item: FolderItem) => void;
  deleteItemFromFolder: (folderId: string, itemId: string) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  
  // Focus Timer Actions
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: (duration?: number) => void;
  setFocusSessionState: (updates: Partial<FocusSessionState>) => void;
  setAmbience: (ambience: AmbienceType) => void;
  setAmbienceVolume: (volume: number) => void;
  
  // Audio control for Focus page
  isOnFocusPage: boolean;
  setIsOnFocusPage: (isOn: boolean) => void;
  
  // AI Reviewer Actions
  addAIReviewer: (reviewer: AIReviewer) => void;
  updateAIReviewer: (reviewer: AIReviewer) => void;
  deleteAIReviewer: (id: string) => void;
  setQuizProgress: (progress: QuizProgress | null) => void;

  // AI Chat
  setAIChat: (messages: AIChatMessage[]) => void;
  clearAIChat: () => void;
  
  // Data Management
  exportData: () => string;
  clearData: () => void;
  
  // Navbar visibility
  hideNavbar: boolean;
  setHideNavbar: (hide: boolean) => void;

  // Hydration status
  isHydrated: boolean;
  syncConflict: boolean;
}

const ZenContext = createContext<ZenContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'zen_app_data';

// Ambience Audio Map using local sound files
const AMBIENCE_URLS: Record<string, string> = {
  rain: '/sounds/rain-ambience-gentle-downpour-vincentmets-1-01-50.mp3',
  forest: '/sounds/forest-ambience-light-birdsong-distant-rooster-vincentmets-1-03-38.mp3',
};

export const ZenProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncConflict, setSyncConflict] = useState(false);
  const serverRevisionRef = useRef<number | null>(null);

  // Load initial state
  const [state, setState] = useState<ZenState>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return INITIAL_STATE;
    try {
      const parsed = JSON.parse(saved) as ZenState;
      
      // Migrate old 'name' field to 'firstName' if needed
      const profile = parsed.profile || DEFAULT_PROFILE;
      const legacyName = (profile as any).name;
      
      if (legacyName && (!profile.firstName || profile.firstName === 'Student')) {
        profile.firstName = legacyName;
        delete (profile as any).name;
      }
      
      return {
        ...parsed,
        profile: { ...DEFAULT_PROFILE, ...profile },
        aiChat: Array.isArray((parsed as any).aiChat) ? (parsed as any).aiChat : [],
        updatedAt: typeof (parsed as any).updatedAt === 'string' ? (parsed as any).updatedAt : '',
      };
    } catch {
      return INITIAL_STATE;
    }
  });

  // Focus Session State
  const [focusSession, setFocusSession] = useState<FocusSessionState>({
    isActive: false,
    isPaused: false,
    timeLeft: DEFAULT_SETTINGS.focusDuration * 60,
    mode: 'focus'
  });

  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellAudioRef = useRef<HTMLAudioElement | null>(null);
  const legacyMigrationRef = useRef(false);
  const audioInitializedRef = useRef(false); // Track if audio was initialized
  const initialLoadRef = useRef(true); // Track if this is the initial load (prevent empty sync)
  
  const setStateWithTimestamp = useCallback((updater: (prev: ZenState) => ZenState) => {
    setState(prev => {
      const next = updater(prev);
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);
  
  // Navbar visibility state
  const [hideNavbar, setHideNavbar] = useState(false);
  
  // Track if user is on Focus page (for audio control)
  const [isOnFocusPage, setIsOnFocusPage] = useState(false);

  const isWithinThreeDays = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return diffMs > 0 && diffMs <= threeDaysMs;
  };

  // Play notification sound when focus session completes
  const playZenBell = () => {
    try {
      // Use the notification sound file
      if (!bellAudioRef.current) {
        bellAudioRef.current = new Audio('/sounds/phone-alert-marimba-bubble-om-fx-1-00-01.mp3');
      }
      bellAudioRef.current.currentTime = 0;
      bellAudioRef.current.volume = 0.8;
      bellAudioRef.current.play().catch(e => {
        console.warn('Audio playback blocked:', e);
        // Fallback to Web Audio API synthesis
        playFallbackBell();
      });
    } catch (e) {
      console.warn('Audio playback inhibited by browser policy:', e);
      playFallbackBell();
    }
  };

  // Fallback synthesized bell sound
  const playFallbackBell = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 3); 

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 3);
    } catch (e) {
      console.warn('Fallback bell failed:', e);
    }
  };

  // NOTE: localStorage saves are now handled immediately in the backend sync effect below
  // This ensures data is persisted locally even if the user refreshes before backend sync completes

  // Load remote state once user is authenticated
  useEffect(() => {
    let cancelled = false;

    const normalizeState = (incoming: ZenState | null): ZenState | null => {
      if (!incoming) return null;
      
      // Migrate old 'name' field to 'firstName' if needed
      const profile = incoming.profile || DEFAULT_PROFILE;
      const legacyName = (profile as any).name;
      
      // If old 'name' field exists and firstName is not set or is default 'Student', migrate it
      if (legacyName && (!profile.firstName || profile.firstName === 'Student')) {
        profile.firstName = legacyName;
        // Remove the old 'name' field
        delete (profile as any).name;
      }
      
      return {
        ...incoming,
        profile: { ...DEFAULT_PROFILE, ...profile },
        aiChat: Array.isArray((incoming as any).aiChat) ? (incoming as any).aiChat : [],
        updatedAt: typeof (incoming as any).updatedAt === 'string' ? (incoming as any).updatedAt : '',
      };
    };

    const parseCachedState = (raw: string | null): ZenState | null => {
      if (!raw) return null;
      try {
        return normalizeState(JSON.parse(raw) as ZenState);
      } catch {
        return null;
      }
    };

    const getUpdatedAtMs = (candidate: ZenState | null) => {
      if (!candidate?.updatedAt) return 0;
      const ts = Date.parse(candidate.updatedAt);
      return Number.isNaN(ts) ? 0 : ts;
    };

    const pickLatestState = (remote: ZenState | null, local: ZenState | null): ZenState => {
      // Helper to check if state has real data (not just defaults)
      const hasRealData = (s: ZenState | null): boolean => {
        if (!s) return false;
        return (s.tasks?.length > 0) || 
               (s.subjects?.length > 0) || 
               (s.folders?.some(f => f.items?.length > 0)) ||
               (s.aiReviewers?.length > 0) ||
               Boolean(s.profile?.firstName && s.profile.firstName !== 'Student');
      };

      const remoteHasData = hasRealData(remote);
      const localHasData = hasRealData(local);

      console.log('[Zen] pickLatestState:', { 
        remoteHasData, 
        localHasData, 
        remoteTasks: remote?.tasks?.length || 0,
        localTasks: local?.tasks?.length || 0,
        remoteSubjects: remote?.subjects?.length || 0, 
        localSubjects: local?.subjects?.length || 0,
        remoteUpdatedAt: remote?.updatedAt,
        localUpdatedAt: local?.updatedAt
      });

      // SMART MERGE: Compare timestamps to pick the most recent state
      // This handles the case where local has newer data that wasn't synced yet
      const remoteTime = remote?.updatedAt ? Date.parse(remote.updatedAt) : 0;
      const localTime = local?.updatedAt ? Date.parse(local.updatedAt) : 0;
      
      // If both have data, pick the one with the more recent timestamp
      if (remoteHasData && localHasData) {
        if (localTime > remoteTime) {
          console.log('[Zen] Using local state (more recent timestamp)');
          return local!;
        } else {
          console.log('[Zen] Using remote state (more recent or equal timestamp)');
          return remote!;
        }
      }
      
      // If only remote has data, use remote
      if (remoteHasData) {
        console.log('[Zen] Using remote state (has data)');
        return remote!;
      }
      
      // If only local has data, use local
      if (localHasData) {
        console.log('[Zen] Using local state (remote empty, local has data)');
        return local!;
      }
      
      // Both empty - return remote if exists, otherwise initial
      console.log('[Zen] Both empty, using remote or initial');
      return remote || local || INITIAL_STATE;
    };

    const ensureUpdatedAt = (incoming: ZenState): ZenState => {
      if (incoming.updatedAt) return incoming;
      return { ...incoming, updatedAt: new Date().toISOString() };
    };

    const loadRemoteState = async () => {
      if (!user || !user.emailVerified) {
        setIsHydrated(true);
        return;
      }
      
      // First, try to load from user-specific localStorage (for offline support)
      const userLocalKey = `${LOCAL_STORAGE_KEY}_${user.uid}`;
      const cachedData = localStorage.getItem(userLocalKey);
      const userLocalState = parseCachedState(cachedData);
      const legacyState = userLocalState ? null : parseCachedState(localStorage.getItem(LOCAL_STORAGE_KEY));
      const localState = userLocalState || legacyState;
      const shouldMigrateLegacy = Boolean(!userLocalState && legacyState);
      
      try {
        const response = await apiFetch('/api/state');
        if (!response.ok) throw new Error('Failed to load state');
        const data = await response.json();
        if (!cancelled) {
          serverRevisionRef.current = Number.isInteger(data?.revision) ? data.revision : null;
          setSyncConflict(false);
          const remoteState = normalizeState((data?.state || null) as ZenState | null);
          const nextState = ensureUpdatedAt(pickLatestState(remoteState, localState));
          setState(nextState);
          if (shouldMigrateLegacy) {
            try {
              localStorage.setItem(userLocalKey, JSON.stringify(nextState));
            } catch (err) {
              console.warn('[Zen] Failed to migrate legacy cache:', err);
            }
          }
        }
      } catch (err) {
        console.warn('[Zen] Failed to load remote state, using local cache if available', err);
        if (!cancelled) {
          const fallbackState = ensureUpdatedAt(pickLatestState(null, localState));
          setState(fallbackState);
          if (shouldMigrateLegacy) {
            try {
              localStorage.setItem(userLocalKey, JSON.stringify(fallbackState));
            } catch (err) {
              console.warn('[Zen] Failed to migrate legacy cache:', err);
            }
          }
        }
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    };

    // Reset to initial state while loading (prevents showing wrong user's data)
    setState(INITIAL_STATE);
    setIsHydrated(false);
    initialLoadRef.current = true; // Reset the initial load flag when user changes
    
    loadRemoteState();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.emailVerified]);

  // Check for pending profile data from signup and apply it
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    if (!isHydrated) return;
    
    try {
      const pendingProfile = localStorage.getItem('zen_pending_profile');
      if (pendingProfile) {
        const { firstName, lastName } = JSON.parse(pendingProfile);
        if (firstName || lastName) {
          setStateWithTimestamp(prev => ({
            ...prev,
            profile: {
              ...prev.profile,
              firstName: firstName || prev.profile.firstName,
              lastName: lastName || prev.profile.lastName,
            }
          }));
        }
        localStorage.removeItem('zen_pending_profile');
      }
    } catch (err) {
      console.warn('[Zen] Failed to apply pending profile:', err);
      localStorage.removeItem('zen_pending_profile');
    }
  }, [user?.uid, user?.emailVerified, isHydrated, setStateWithTimestamp]);

  // Track if we have pending changes that need to be synced
  const pendingStateRef = useRef<ZenState | null>(null);
  const isSyncingRef = useRef(false);

  // Function to sync state to backend (MongoDB) - called immediately on state change
  const syncToBackend = useCallback(async (stateToSync: ZenState) => {
    if (isSyncingRef.current) {
      // If already syncing, queue this state for after current sync completes
      pendingStateRef.current = stateToSync;
      return;
    }

    isSyncingRef.current = true;
    let conflicted = false;
    try {
      console.log('[Zen] Syncing state to database:', { tasks: stateToSync.tasks.length, subjects: stateToSync.subjects.length });
      const response = await apiFetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: stateToSync,
          ...(serverRevisionRef.current !== null ? { baseRevision: serverRevisionRef.current } : {}),
        }),
      });
      if (response.status === 409) {
        conflicted = true;
        pendingStateRef.current = null;
        setSyncConflict(true);
        console.warn('[Zen] Sync paused because the state changed in another session');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.warn('[Zen] Database sync failed:', data);
      } else {
        const data = await response.json().catch(() => ({}));
        if (Number.isInteger(data?.revision)) serverRevisionRef.current = data.revision;
        setSyncConflict(false);
        console.log('[Zen] State saved to database successfully');
      }
    } catch (err) {
      console.warn('[Zen] Failed to sync state to database:', err);
    } finally {
      isSyncingRef.current = false;
      // If there's a pending state update, sync it now
      if (!conflicted && pendingStateRef.current) {
        const pending = pendingStateRef.current;
        pendingStateRef.current = null;
        syncToBackend(pending);
      }
    }
  }, []);

  // Sync to backend IMMEDIATELY when state changes (no debounce)
  // This ensures data is saved to MongoDB and accessible from all devices
  useEffect(() => {
    console.log('[Zen] Sync effect triggered:', { 
      hasUser: !!user, 
      emailVerified: user?.emailVerified, 
      isHydrated, 
      initialLoadRef: initialLoadRef.current,
      taskCount: state.tasks.length,
      subjectCount: state.subjects.length
    });
    
    if (!user || !user.emailVerified) {
      console.log('[Zen] Sync skipped - no user or not verified');
      return;
    }
    if (!isHydrated) {
      console.log('[Zen] Sync skipped - not hydrated yet');
      return;
    }
    
    // CRITICAL: Skip sync on initial load to prevent empty state from overwriting remote
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      console.log('[Zen] Skipping initial sync after hydration');
      return;
    }
    
    // Additional safety: Don't sync if state looks completely empty (likely a bug)
    const hasAnyData = state.tasks.length > 0 || state.subjects.length > 0 || 
                       state.folders.some(f => f.items.length > 0) || 
                       state.aiReviewers.length > 0 ||
                       (state.profile.firstName && state.profile.firstName !== 'Student');
    
    if (!hasAnyData) {
      console.warn('[Zen] Skipping sync - state appears empty, this may be a bug');
      return;
    }

    console.log('[Zen] Proceeding with sync to database:', { tasks: state.tasks.length, subjects: state.subjects.length });

    // Also save to localStorage as a backup cache (for offline support)
    try {
      const userLocalKey = `${LOCAL_STORAGE_KEY}_${user.uid}`;
      localStorage.setItem(userLocalKey, JSON.stringify(state));
    } catch (err) {
      console.warn('[Zen] Failed to cache state locally:', err);
    }

    // Sync to database IMMEDIATELY
    syncToBackend(state);

  }, [state, user?.uid, user?.emailVerified, isHydrated, syncToBackend]);

  // Migrate legacy base64 PDFs to R2 after hydration
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    if (!isHydrated) return;
    if (legacyMigrationRef.current) return;
    legacyMigrationRef.current = true;

    const migrateLegacyPdfs = async () => {
      try {
        let updatedTasks = [...state.tasks];
        let updatedFolders = [...state.folders];
        let didUpdate = false;

        for (const task of state.tasks) {
          const legacyData = (task as any)?.pdfAttachment?.data;
          if (legacyData && String(legacyData).startsWith('data:application/pdf')) {
            try {
              const uploaded = await uploadPdfDataUrlToR2(legacyData, task.pdfAttachment?.name || `${task.title}.pdf`);
              updatedTasks = updatedTasks.map(t => t.id === task.id ? { ...t, pdfAttachment: uploaded } : t);
              didUpdate = true;
            } catch (err) {
              console.warn('[Zen] Legacy task PDF migration failed:', err);
            }
          }
        }

        for (const folder of state.folders) {
          let folderUpdated = false;
          const updatedItems = await Promise.all(folder.items.map(async (item) => {
            if (item.type !== 'pdf') return item;
            const legacyData = item.content && String(item.content).startsWith('data:application/pdf') ? item.content : '';
            if (!legacyData) return item;
            try {
              const uploaded = await uploadPdfDataUrlToR2(legacyData, item.title || 'document.pdf');
              folderUpdated = true;
              return { ...item, content: '', file: uploaded };
            } catch (err) {
              console.warn('[Zen] Legacy folder PDF migration failed:', err);
              return item;
            }
          }));
          if (folderUpdated) {
            updatedFolders = updatedFolders.map(f => f.id === folder.id ? { ...f, items: updatedItems } : f);
            didUpdate = true;
          }
        }

        if (didUpdate) {
          setStateWithTimestamp(prev => ({ ...prev, tasks: updatedTasks, folders: updatedFolders }));
        }
      } catch (err) {
        console.warn('[Zen] Legacy PDF migration failed:', err);
      }
    };

    migrateLegacyPdfs();
  }, [user?.uid, user?.emailVerified, isHydrated]);

  // Sync tasks with backend for deadline reminders whenever tasks change
  // CRITICAL: Only sync AFTER hydration to prevent overwriting with empty data
  useEffect(() => {
    if (!isHydrated) return; // Don't sync before hydration completes
    if (!user?.emailVerified) return;
    if (!state.settings.notifications || !state.settings.deadlineAlerts) return;
    
    // Additional safety: don't sync if this is the initial load
    if (initialLoadRef.current) return;
    
    syncTasksWithBackend(state.tasks);
  }, [state.tasks, state.settings.notifications, state.settings.deadlineAlerts, user?.emailVerified, isHydrated]);

  // ========== AMBIENCE AUDIO MANAGEMENT ==========
  // Audio should ONLY play when:
  // 1. User is on Focus page
  // 2. Timer is active AND not paused
  // 3. Ambience is not 'silent'
  
  // Stop audio helper
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = ''; // Release the audio resource
      audioRef.current = null;
      audioInitializedRef.current = false;
    }
  }, []);

  // Main audio control effect
  useEffect(() => {
    const shouldPlayAudio = 
      isOnFocusPage && 
      focusSession.isActive && 
      !focusSession.isPaused && 
      state.settings.ambience !== 'silent';

    if (!shouldPlayAudio) {
      // Stop audio when conditions aren't met
      stopAudio();
      return;
    }

    const url = AMBIENCE_URLS[state.settings.ambience];
    if (!url) {
      stopAudio();
      return;
    }

    // If audio already exists with same source, just ensure it's playing
    if (audioRef.current && audioInitializedRef.current) {
      audioRef.current.volume = state.settings.ambienceVolume ?? 0.25;
      if (audioRef.current.paused) {
        audioRef.current.play().catch(e => {
          console.debug('Ambience resume blocked:', e);
        });
      }
      return;
    }

    // Create new audio instance
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = state.settings.ambienceVolume ?? 0.25;
    audio.preload = 'auto';
    
    // Handle audio load error (offline or blocked)
    audio.onerror = () => {
      console.warn('Ambience audio failed to load (might be offline)');
      audioInitializedRef.current = false;
    };

    audioRef.current = audio;
    audioInitializedRef.current = true;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        console.debug('Ambience autoplay blocked or unavailable:', e);
        audioInitializedRef.current = false;
      });
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      stopAudio();
    };
  }, [isOnFocusPage, focusSession.isActive, focusSession.isPaused, state.settings.ambience, stopAudio]);

  // Volume change effect (separate to avoid recreating audio)
  useEffect(() => {
    if (audioRef.current && audioInitializedRef.current) {
      audioRef.current.volume = state.settings.ambienceVolume ?? 0.25;
    }
  }, [state.settings.ambienceVolume]);

  useEffect(() => {
    console.log('[ZenContext] Timer effect running - isActive:', focusSession.isActive, 'isPaused:', focusSession.isPaused);
    
    if (!focusSession.isActive || focusSession.isPaused) {
      if (timerRef.current) {
        console.log('[ZenContext] Clearing timer interval');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    console.log('[ZenContext] Starting timer interval');
    timerRef.current = window.setInterval(() => {
      setFocusSession((prev) => {
        if (!prev.isActive || prev.isPaused) return prev;
        if (prev.timeLeft <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          playZenBell();

          // Send notification when focus session completes
          if (getPermissionStatus() === 'granted') {
            showLocalNotification('ðŸŽ‰ Focus Session Complete!', {
              body: 'Great work! Time for a well-deserved break.',
              icon: '/icons/icon-192x192.svg',
              tag: 'focus-complete',
              data: { url: '/?page=focus' }
            });
          }

          return { ...prev, isActive: false, isPaused: false, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [focusSession.isActive, focusSession.isPaused]);



  // Actions
  const addTask = (task: Task) => {
    console.log('[Zen] addTask called:', { taskId: task.id, taskTitle: task.title });
    setStateWithTimestamp(prev => {
      const newTasks = [...prev.tasks, task];
      console.log('[Zen] New tasks array:', { count: newTasks.length, titles: newTasks.map(t => t.title) });
      return { ...prev, tasks: newTasks };
    });
    
    // Send immediate notification if task is due within 3 days and notifications are enabled
    if (
      user?.emailVerified &&
      state.settings.notifications &&
      state.settings.deadlineAlerts &&
      task.dueDate &&
      isWithinThreeDays(task.dueDate)
    ) {
      notifyNewTask({ id: task.id, title: task.title, dueDate: task.dueDate });
    }
  };
  
  const toggleTask = (id: string) => setStateWithTimestamp(prev => ({
    ...prev,
    tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
  }));

  const deleteTask = (id: string) => setStateWithTimestamp(prev => ({
    ...prev,
    tasks: prev.tasks.filter(t => t.id !== id)
  }));

  const updateTask = (updatedTask: Task) => {
    const prevTask = state.tasks.find(t => t.id === updatedTask.id);
    setStateWithTimestamp(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    }));

    const shouldNotify = Boolean(
      user?.emailVerified &&
      state.settings.notifications &&
      state.settings.deadlineAlerts &&
      updatedTask.dueDate &&
      !updatedTask.completed &&
      isWithinThreeDays(updatedTask.dueDate) &&
      (prevTask?.dueDate !== updatedTask.dueDate || prevTask?.completed !== updatedTask.completed)
    );

    if (shouldNotify) {
      notifyNewTask({ id: updatedTask.id, title: updatedTask.title, dueDate: updatedTask.dueDate });
    }
  };

  const addSubject = (subject: Subject) => setStateWithTimestamp(prev => ({ ...prev, subjects: [...prev.subjects, subject] }));

  const updateSubject = (updatedSubject: Subject) => setStateWithTimestamp(prev => ({
    ...prev,
    subjects: prev.subjects.map(s => s.id === updatedSubject.id ? updatedSubject : s)
  }));

  const deleteSubject = (id: string) => setStateWithTimestamp(prev => ({
    ...prev,
    subjects: prev.subjects.filter(s => s.id !== id),
    // Also delete all tasks associated with this subject
    tasks: prev.tasks.filter(t => t.subjectId !== id),
    // Also delete all flashcards associated with this subject
    flashcards: prev.flashcards.filter(f => f.subjectId !== id)
  }));

  const addFlashcard = (card: Flashcard) => setStateWithTimestamp(prev => ({ ...prev, flashcards: [...prev.flashcards, card] }));

  const updateFlashcard = (updatedCard: Flashcard) => setStateWithTimestamp(prev => ({
    ...prev,
    flashcards: prev.flashcards.map(c => c.id === updatedCard.id ? updatedCard : c)
  }));

  // Folder Actions
  const addFolder = (folder: Folder) => setStateWithTimestamp(prev => ({ ...prev, folders: [...prev.folders, folder] }));

  const updateFolder = (updatedFolder: Folder) => setStateWithTimestamp(prev => ({
    ...prev,
    folders: prev.folders.map(f => f.id === updatedFolder.id ? updatedFolder : f)
  }));
  
  const deleteFolder = (id: string) => setStateWithTimestamp(prev => ({
    ...prev,
    folders: prev.folders.filter(f => f.id !== id)
  }));

  const addItemToFolder = (folderId: string, item: FolderItem) => setStateWithTimestamp(prev => ({
    ...prev,
    folders: prev.folders.map(f => f.id === folderId ? { ...f, items: [...f.items, item] } : f)
  }));

  const deleteItemFromFolder = (folderId: string, itemId: string) => setStateWithTimestamp(prev => ({
    ...prev,
    folders: prev.folders.map(f => f.id === folderId ? { ...f, items: f.items.filter(i => i.id !== itemId) } : f)
  }));

  const updateProfile = (updates: Partial<UserProfile>) => setStateWithTimestamp(prev => ({
    ...prev,
    profile: { ...prev.profile, ...updates }
  }));

  const updateSettings = (updates: Partial<AppSettings>) => setStateWithTimestamp(prev => ({
    ...prev,
    settings: { ...prev.settings, ...updates },
  }));

  // AI Reviewer Actions
  const addAIReviewer = (reviewer: AIReviewer) => setStateWithTimestamp(prev => ({ 
    ...prev, 
    aiReviewers: [...(prev.aiReviewers || []), reviewer] 
  }));

  const updateAIReviewer = (updatedReviewer: AIReviewer) => setStateWithTimestamp(prev => ({
    ...prev,
    aiReviewers: (prev.aiReviewers || []).map(r => r.id === updatedReviewer.id ? updatedReviewer : r)
  }));

  const deleteAIReviewer = (id: string) => setStateWithTimestamp(prev => ({
    ...prev,
    aiReviewers: (prev.aiReviewers || []).filter(r => r.id !== id),
    // Clear quiz progress if it was for this reviewer
    quizProgress: prev.quizProgress?.reviewerId === id ? null : prev.quizProgress
  }));

  const setQuizProgress = (progress: QuizProgress | null) => setStateWithTimestamp(prev => ({
    ...prev,
    quizProgress: progress
  }));

  // AI Chat
  const setAIChat = useCallback((messages: AIChatMessage[]) => {
    setStateWithTimestamp(prev => {
      if (prev.aiChat === messages) return prev;
      return { ...prev, aiChat: messages };
    });
  }, [setStateWithTimestamp]);

  const clearAIChat = useCallback(() => {
    setStateWithTimestamp(prev => ({ ...prev, aiChat: [] }));
  }, [setStateWithTimestamp]);

  const startTimer = useCallback(() => {
    console.log('[ZenContext] startTimer called');
    setFocusSession(prev => {
      console.log('[ZenContext] startTimer - prev state:', prev);
      return { ...prev, isActive: true, isPaused: false };
    });
  }, []);
  
  const pauseTimer = useCallback(() => {
    console.log('[ZenContext] pauseTimer called');
    setFocusSession(prev => {
      console.log('[ZenContext] pauseTimer - prev state:', prev);
      return { ...prev, isPaused: true };
    });
  }, []);
  
  const resetTimer = useCallback((durationMinutes?: number) => {
    const mins = durationMinutes || state.settings.focusDuration;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setFocusSession({
      isActive: false,
      isPaused: false,
      timeLeft: mins * 60,
      mode: 'focus'
    });
  }, [state.settings.focusDuration]);

  const setFocusSessionState = useCallback((updates: Partial<FocusSessionState>) => {
    setFocusSession(prev => ({ ...prev, ...updates }));
  }, []);

  const setAmbience = (ambience: AmbienceType) => {
    updateSettings({ ambience });
  };

  const setAmbienceVolume = useCallback((volume: number) => {
    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, volume));
    updateSettings({ ambienceVolume: clampedVolume });
  }, []);


  const exportData = () => JSON.stringify(state, null, 2);
  
  const clearData = () => {
    setStateWithTimestamp(() => INITIAL_STATE);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      if (user?.uid) {
        localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${user.uid}`);
      }
    } catch (err) {
      console.warn('[Zen] Failed to clear local cache:', err);
    }
  };

  return (
    <ZenContext.Provider value={{
      state,
      focusSession,
      addTask,
      toggleTask,
      deleteTask,
      updateTask,
      addSubject,
      updateSubject,
      deleteSubject,
      addFlashcard,
      updateFlashcard,
      addFolder,
      updateFolder,
      deleteFolder,
      addItemToFolder,
      deleteItemFromFolder,
      updateProfile,
      updateSettings,
      startTimer,
      pauseTimer,
      resetTimer,
      setFocusSessionState,
      setAmbience,
      setAmbienceVolume,
      isOnFocusPage,
      setIsOnFocusPage,
      addAIReviewer,
      updateAIReviewer,
      deleteAIReviewer,
      setQuizProgress,
      setAIChat,
      clearAIChat,
      exportData,
      clearData,
      hideNavbar,
      setHideNavbar,
      isHydrated,
      syncConflict,
    }}>
      {children}
    </ZenContext.Provider>
  );
};

export const useZen = () => {
  const context = useContext(ZenContext);
  if (!context) throw new Error("useZen must be used within ZenProvider");
  return context;
};
