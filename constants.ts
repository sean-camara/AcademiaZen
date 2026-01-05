import { AppSettings, UserProfile, ZenState, Folder } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  focusDuration: 25,
  autoBreak: false,
  ambience: 'silent',
  notifications: true,
  deadlineAlerts: true,
  dailyBriefing: true,
  studyReminders: true,
};

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Student',
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
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
};

export const AMBIENCE_OPTIONS = [
  { id: 'silent', label: 'Silent', icon: '🔇' },
  { id: 'rain', label: 'Rain', icon: '🌧️' },
  { id: 'lofi', label: 'Lofi', icon: '☕' },
  { id: 'forest', label: 'Forest', icon: '🌲' },
];

export const FOCUS_DURATIONS = [25, 45, 60];