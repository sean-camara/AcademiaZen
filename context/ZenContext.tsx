import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { ZenState, Task, Subject, Flashcard, Folder, UserProfile, AppSettings, FocusSessionState, AmbienceType } from '../types';
import { INITIAL_STATE, DEFAULT_SETTINGS } from '../constants';
import { showLocalNotification, sendZenNotification, getPermissionStatus, syncTasksWithBackend, notifyNewTask } from '../utils/pushNotifications';
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
  deleteFolder: (id: string) => void;
  addItemToFolder: (folderId: string, item: { id: string; title: string; type: 'note' | 'pdf'; content?: string }) => void;
  deleteItemFromFolder: (folderId: string, itemId: string) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  
  // Focus Timer Actions
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: (duration?: number) => void;
  setAmbience: (ambience: AmbienceType) => void;
  
  // Data Management
  exportData: () => string;
  clearData: () => void;
  
  // Navbar visibility
  hideNavbar: boolean;
  setHideNavbar: (hide: boolean) => void;
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

  // Load initial state
  const [state, setState] = useState<ZenState>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_STATE;
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
  const syncTimeoutRef = useRef<number | null>(null);
  
  // Navbar visibility state
  const [hideNavbar, setHideNavbar] = useState(false);

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

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load remote state once user is authenticated
  useEffect(() => {
    let cancelled = false;

    const loadRemoteState = async () => {
      if (!user || !user.emailVerified) {
        setIsHydrated(true);
        return;
      }
      try {
        const response = await apiFetch('/api/state');
        if (!response.ok) throw new Error('Failed to load state');
        const data = await response.json();
        if (!cancelled && data?.state) {
          setState(data.state as ZenState);
        }
      } catch (err) {
        console.warn('[Zen] Failed to load remote state, using local cache', err);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    };

    loadRemoteState();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.emailVerified]);

  // Debounced sync to backend when state changes
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    if (!isHydrated) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(async () => {
      try {
        await apiFetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state }),
        });
      } catch (err) {
        console.warn('[Zen] Failed to sync state', err);
      }
    }, 1000);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [state, user?.uid, user?.emailVerified, isHydrated]);

  // Sync tasks with backend for deadline reminders whenever tasks change
  useEffect(() => {
    if (user?.emailVerified && state.settings.notifications && state.settings.deadlineAlerts) {
      syncTasksWithBackend(state.tasks);
    }
  }, [state.tasks, state.settings.notifications, state.settings.deadlineAlerts, user?.emailVerified]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (state.settings.ambience === 'silent') {
      return;
    }

    const url = AMBIENCE_URLS[state.settings.ambience];
    if (url) {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.25; 
      audioRef.current = audio;
      
      // Handle audio load error (offline or blocked)
      audio.onerror = () => {
        console.warn('Ambience audio failed to load (might be offline)');
      };
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.debug('Ambience autoplay blocked or unavailable:', e);
        });
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [state.settings.ambience]);

  useEffect(() => {
    if (focusSession.isActive && !focusSession.isPaused) {
      timerRef.current = window.setInterval(() => {
        setFocusSession((prev) => {
          if (prev.timeLeft <= 1) {
             if (timerRef.current) clearInterval(timerRef.current);
             playZenBell();
             
             // Send notification when focus session completes
             if (getPermissionStatus() === 'granted') {
               showLocalNotification('🎉 Focus Session Complete!', {
                 body: 'Great work! Time for a well-deserved break.',
                 icon: '/icons/icon-192x192.svg',
                 tag: 'focus-complete',
                 data: { url: '/?page=focus' }
               });
             }
             
             return { ...prev, isActive: false, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [focusSession.isActive, focusSession.isPaused]);

  // Actions
  const addTask = (task: Task) => {
    setState(prev => ({ ...prev, tasks: [...prev.tasks, task] }));
    
    // Send immediate notification if task is due within 3 days and notifications are enabled
    if (user?.emailVerified && state.settings.notifications && state.settings.deadlineAlerts && task.dueDate) {
      notifyNewTask({ id: task.id, title: task.title, dueDate: task.dueDate });
    }
  };
  
  const toggleTask = (id: string) => setState(prev => ({
    ...prev,
    tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
  }));

  const deleteTask = (id: string) => setState(prev => ({
    ...prev,
    tasks: prev.tasks.filter(t => t.id !== id)
  }));

  const updateTask = (updatedTask: Task) => setState(prev => ({
    ...prev,
    tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
  }));

  const addSubject = (subject: Subject) => setState(prev => ({ ...prev, subjects: [...prev.subjects, subject] }));

  const updateSubject = (updatedSubject: Subject) => setState(prev => ({
    ...prev,
    subjects: prev.subjects.map(s => s.id === updatedSubject.id ? updatedSubject : s)
  }));

  const deleteSubject = (id: string) => setState(prev => ({
    ...prev,
    subjects: prev.subjects.filter(s => s.id !== id),
    // Also delete all tasks associated with this subject
    tasks: prev.tasks.filter(t => t.subjectId !== id),
    // Also delete all flashcards associated with this subject
    flashcards: prev.flashcards.filter(f => f.subjectId !== id)
  }));

  const addFlashcard = (card: Flashcard) => setState(prev => ({ ...prev, flashcards: [...prev.flashcards, card] }));

  const updateFlashcard = (updatedCard: Flashcard) => setState(prev => ({
    ...prev,
    flashcards: prev.flashcards.map(c => c.id === updatedCard.id ? updatedCard : c)
  }));

  // Folder Actions
  const addFolder = (folder: Folder) => setState(prev => ({ ...prev, folders: [...prev.folders, folder] }));
  
  const deleteFolder = (id: string) => setState(prev => ({
    ...prev,
    folders: prev.folders.filter(f => f.id !== id)
  }));

  const addItemToFolder = (folderId: string, item: { id: string; title: string; type: 'note' | 'pdf'; content?: string }) => setState(prev => ({
    ...prev,
    folders: prev.folders.map(f => f.id === folderId ? { ...f, items: [...f.items, item] } : f)
  }));

  const deleteItemFromFolder = (folderId: string, itemId: string) => setState(prev => ({
    ...prev,
    folders: prev.folders.map(f => f.id === folderId ? { ...f, items: f.items.filter(i => i.id !== itemId) } : f)
  }));

  const updateProfile = (updates: Partial<UserProfile>) => setState(prev => ({
    ...prev,
    profile: { ...prev.profile, ...updates }
  }));

  const updateSettings = (updates: Partial<AppSettings>) => setState(prev => ({
    ...prev,
    settings: { ...prev.settings, ...updates },
  }));

  const startTimer = () => setFocusSession(prev => ({ ...prev, isActive: true, isPaused: false }));
  
  const pauseTimer = () => setFocusSession(prev => ({ ...prev, isPaused: true }));
  
  const resetTimer = (durationMinutes?: number) => {
    const mins = durationMinutes || state.settings.focusDuration;
    setFocusSession({
      isActive: false,
      isPaused: false,
      timeLeft: mins * 60,
      mode: 'focus'
    });
  };

  const setAmbience = (ambience: AmbienceType) => {
    updateSettings({ ambience });
  };

  const exportData = () => JSON.stringify(state, null, 2);
  
  const clearData = () => {
    setState(INITIAL_STATE);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
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
      deleteFolder,
      addItemToFolder,
      deleteItemFromFolder,
      updateProfile,
      updateSettings,
      startTimer,
      pauseTimer,
      resetTimer,
      setAmbience,
      exportData,
      clearData,
      hideNavbar,
      setHideNavbar
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
