
export interface PdfAttachment {
  key: string;
  name: string;
  size: number;
  contentType: string;
  url?: string;
  text?: string;
  textUpdatedAt?: string;
}

export interface AIChatMessage {
  role: 'user' | 'ai';
  text: string;
  refs?: string[];
  createdAt?: string;
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

// AI Reviewer Types
export type QuestionType = 'identification' | 'multiple_choice' | 'true_false' | 'word_matching';
export type ReviewerDifficulty = 'easy' | 'medium' | 'hard';
export type ReviewerQuestionMode = 'identification' | 'multiple_choice' | 'true_false' | 'word_matching' | 'hybrid';

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface ReviewerQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer: string; // For identification, MC, T/F
  pairs?: MatchingPair[]; // For word matching
}

export interface QuizAttempt {
  id: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeTaken: number; // seconds
  completedAt: string; // ISO date
}

export interface AIReviewer {
  id: string;
  name: string;
  sourceId: string; // Library item ID (PDF)
  sourceFolderId: string;
  sourceName: string;
  difficulty: ReviewerDifficulty;
  questionCount: number;
  questionMode: ReviewerQuestionMode;
  timerMinutes: number | null; // null = unlimited
  questions: ReviewerQuestion[];
  createdAt: string;
  attempts: QuizAttempt[];
  status: 'generating' | 'ready' | 'error';
  errorMessage?: string;
}

export interface QuizProgress {
  reviewerId: string;
  currentIndex: number;
  answers: Record<string, string | string[]>; // questionId -> answer
  startedAt: string;
  timeRemaining: number | null; // seconds, null = unlimited
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
  aiReviewers: AIReviewer[];
  quizProgress: QuizProgress | null;
  aiChat: AIChatMessage[];
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
