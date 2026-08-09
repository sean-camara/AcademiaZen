export type AdminTab = 'overview' | 'users' | 'ai' | 'academics' | 'billing' | 'announcements' | 'health' | 'audit';

export interface OverviewMetrics {
  totalUsers: number;
  activeUsersToday: number;
  premiumUsers: number;
  freeUsers: number;
  promptsToday: number;
  promptsMonth: number;
  totalFocusMinutes: number;
  totalFocusSessions: number;
  estimatedMRR: number;
  conversionRate?: number;
  dailyStats?: Array<{ date: string; dayName: string; activeUsers: number; aiRequests: number }>;
  recentActivity?: Array<{ id: string; type: string; title: string; timestamp: string; badge: string }>;
  topSubjects?: Array<{ subject: string; count: number }>;
}

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  isSuspended?: boolean;
  plan: 'free' | 'premium';
  billingStatus: string;
  dailyAiCount: number;
  totalAiRequests: number;
  subjectCount?: number;
  taskCount?: number;
  createdAt: string;
  lastActive: string;
}

export interface AcademicAnalytics {
  topSubjects: Array<{ subject: string; count: number }>;
  avgQuizScore: number;
  totalQuizAttempts: number;
}

export interface AILogEntry {
  _id: string;
  uid: string;
  endpoint: string;
  model: string;
  mode: string;
  totalTokens: number;
  responseTimeMs: number;
  success: boolean;
  userTier: string;
  createdAt: string;
  errorMessage?: string;
}

export interface PaymentLog {
  uid: string;
  email: string;
  plan: string;
  interval: string;
  status: string;
  lastPaymentAt: string;
  paymentId: string;
  amount: string;
}

export interface AnnouncementItem {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'banner';
  isActive: boolean;
  createdAt: string;
}

export interface FeedbackItem {
  _id: string;
  uid: string;
  email: string;
  category: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  reply: string;
  createdAt: string;
}

export interface SystemHealth {
  database: string;
  memory: { rssMb: number; heapTotalMb: number; heapUsedMb: number };
  uptimeSeconds: number;
  maintenanceMode: boolean;
  nodeVersion: string;
}

export interface CollectionStats {
  users: number;
  focusSessions: number;
  aiLogs: number;
  announcements: number;
  feedback: number;
  auditLogs: number;
}

export interface AuditLogItem {
  _id: string;
  adminEmail: string;
  action: string;
  targetUid?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}
