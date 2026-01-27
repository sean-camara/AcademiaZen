
export interface PdfAttachment {
  key: string;
  name: string;
  size: number;
  contentType: string;
  url?: string;
  text?: string;
  textUpdatedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string; // ISO Date string
  completed: boolean;
  subjectId?: string;
  notes?: string;
  pdfAttachment?: PdfAttachment;
}

export interface Subject {
  id: string;
  name: string;
  color: string; // Hex code or tailwind class
}

export interface Flashcard {
  id: string;
  subjectId: string;
  front: string;
  back: string;
  box: number; // For spaced repetition (0-5)
  nextReviewDate: string; // ISO Date
}

export interface FolderItem {
  id: string;
  title: string;
  type: 'note' | 'pdf';
  content?: string;
  file?: PdfAttachment;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  items: FolderItem[];
}

export interface UserProfile {
  name: string;
  university: string;
  semester: string;
  quoteEnabled: boolean;
}

export interface AppSettings {
  focusDuration: number; // minutes
  autoBreak: boolean;
  ambience: 'silent' | 'rain' | 'lofi' | 'forest';
  notifications: boolean;
  deadlineAlerts: boolean;
  dailyBriefing: boolean;
  studyReminders: boolean;
}

export type AmbienceType = 'silent' | 'rain' | 'lofi' | 'forest';

export interface FocusSessionState {
  isActive: boolean;
  isPaused: boolean;
  timeLeft: number; // seconds
  mode: 'focus' | 'break';
}

export interface ZenState {
  tasks: Task[];
  subjects: Subject[];
  flashcards: Flashcard[];
  folders: Folder[];
  profile: UserProfile;
  settings: AppSettings;
}

// Enum for Navigation Tabs
export enum Tab {
  Home = 'home',
  Calendar = 'calendar',
  Review = 'review',
  Focus = 'focus',
  // Fixed: Renamed TabLibrary to Library to match usage in components/Layout.tsx
  Library = 'library'
}
