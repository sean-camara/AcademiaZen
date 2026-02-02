import { AppSettings, UserProfile, ZenState, Folder } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  focusDuration: 25,
  autoBreak: false,
  ambience: 'silent',
  ambienceVolume: 0.25,
  notifications: true,
  deadlineAlerts: true,
  dailyBriefing: true,
  studyReminders: true,
  weeklyFocusGoal: 600, // 10 hours in minutes
};

export const DEFAULT_PROFILE: UserProfile = {
  firstName: 'Student',
  lastName: '',
  university: '',
  semester: '',
  quoteEnabled: true,
};

export const INITIAL_FOLDERS: Folder[] = [
  {
    id: 'general',
    name: 'General',
    items: []
  }
];

export const INITIAL_STATE: ZenState = {
  tasks: [],
  subjects: [],
  flashcards: [],
  folders: INITIAL_FOLDERS,
  aiReviewers: [],
  quizProgress: null,
  aiChat: [],
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
  updatedAt: new Date().toISOString(),
};

export const AMBIENCE_OPTIONS = [
  { id: 'silent', label: 'Silent', icon: '🔇' },
  { id: 'rain', label: 'Rain', icon: '🌧️' },
  { id: 'forest', label: 'Forest', icon: '🌲' },
];

export const FOCUS_DURATIONS = [25, 45, 60];

// Pomodoro cycle configurations
export const POMODORO_MODES = {
  classic: { work: 25, break: 5, label: 'Classic (25/5)' },
  long: { work: 50, break: 10, label: 'Long (50/10)' },
  custom: { work: 25, break: 5, label: 'Custom' },
};

// Quick blocker chips for reflection
export const BLOCKER_CHIPS = [
  { id: 'distracted', label: 'Got distracted', icon: '🤯' },
  { id: 'tired', label: 'Too tired', icon: '😴' },
  { id: 'phone', label: 'Phone/notifications', icon: '📱' },
  { id: 'noise', label: 'Noisy environment', icon: '🔊' },
  { id: 'urgent', label: 'Urgent task came up', icon: '🚨' },
  { id: 'hungry', label: 'Needed a break', icon: '☕' },
  { id: 'confused', label: 'Material too hard', icon: '😕' },
  { id: 'technical', label: 'Technical issues', icon: '💻' },
];
