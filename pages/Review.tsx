import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useZen } from '../context/ZenContext';
import { generateId } from '../utils/helpers';
import { IconPlus, IconChevronLeft, IconChevronRight, IconTrash, IconEdit, IconSearch, IconX, IconRefresh, IconClock, IconCheck } from '../components/Icons';
import { AIReviewer, ReviewerQuestion, QuizAttempt, QuizProgress, ReviewerDifficulty, ReviewerQuestionMode, FolderItem, Folder } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import { apiFetch } from '../utils/api';
import { showLocalNotification } from '../utils/pushNotifications';
import { getPdfSignedUrl } from '../utils/pdfStorage';
import { useToast } from '../context/ToastContext';

// Loading messages for generation
const LOADING_MESSAGES = [
  "Analyzing your PDF content...",
  "Crafting thoughtful questions...",
  "Almost there, preparing your reviewer...",
  "Generating quiz questions...",
  "Fine-tuning the difficulty...",
  "Just a moment more..."
];

// Timer options
const TIMER_OPTIONS = [
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 25, label: '25 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: null, label: 'Unlimited' },
];

// Score-based messages
const getScoreMessage = (percentage: number): { emoji: string; message: string } => {
  if (percentage === 100) return { emoji: '', message: "Perfect Score! You're a genius!" };
  if (percentage >= 80) return { emoji: '', message: "Excellent work!" };
  if (percentage >= 60) return { emoji: '', message: "Good job, keep studying!" };
  return { emoji: '', message: "Review the material and try again!" };
};

const Review: React.FC = () => {
  const { state, addAIReviewer, updateAIReviewer, deleteAIReviewer, setQuizProgress, setHideNavbar } = useZen();
  const { folders, aiReviewers = [], quizProgress } = state;
  
  // Premium status
  const [isPremium, setIsPremium] = useState(false);
  const [billingChecked, setBillingChecked] = useState(false);
  
  // Navigation states
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingReviewerId, setGeneratingReviewerId] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Creation form state
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedPdfId, setSelectedPdfId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<ReviewerDifficulty>('easy');
  const [questionMode, setQuestionMode] = useState<ReviewerQuestionMode>('multiple_choice');
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [customTimer, setCustomTimer] = useState<string>('');
  
  // Quiz taking state
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string | string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showAnswerReview, setShowAnswerReview] = useState(false);
  const [matchingSelections, setMatchingSelections] = useState<{ left: string | null; pairs: Record<string, string> }>({ left: null, pairs: {} });
  
  // Editing state
  const [editingReviewerName, setEditingReviewerName] = useState<string | null>(null);
  const [newReviewerName, setNewReviewerName] = useState('');
  
  // Confirmation modal
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });
  
  // Premium upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string>('');
  
  // Generation status (to prevent abuse)
  const [generationStatus, setGenerationStatus] = useState<{
    remainingGenerations: number;
    maxGenerations: number;
    windowHours: number;
    resetIn: number;
    isPremium: boolean;
  } | null>(null);
  
  const toast = useToast();
  
  const timerRef = useRef<number | null>(null);
  const loadingIntervalRef = useRef<number | null>(null);
  const quizAnswersRef = useRef<Record<string, string | string[]>>({});
  const currentQuestionIndexRef = useRef(0);
  const timeRemainingRef = useRef<number | null>(null);
  const selectedReviewerIdRef = useRef<string | null>(null);
  const showResultsRef = useRef(false);

  // Free tier limitations
  const FREE_TIER_LIMITS = {
    maxQuestions: 10,
    maxReviewers: 3,
    allowedDifficulties: ['easy'],
    allowedModes: ['multiple_choice', 'true_false'],
    maxPdfSizeMB: 2,
    maxPdfUploads: 3,
  };

  // Check if a feature is available for the current user
  const isFeatureAvailable = (feature: 'difficulty' | 'mode' | 'questionCount', value?: string | number): boolean => {
    if (isPremium) return true;
    
    if (feature === 'difficulty' && value) {
      return FREE_TIER_LIMITS.allowedDifficulties.includes(value as string);
    }
    if (feature === 'mode' && value) {
      return FREE_TIER_LIMITS.allowedModes.includes(value as string);
    }
    if (feature === 'questionCount' && value) {
      return (value as number) <= FREE_TIER_LIMITS.maxQuestions;
    }
    return false;
  };

  // Show upgrade modal for premium features
  const handlePremiumFeatureClick = (feature: string, featureLabel: string) => {
    if (!isPremium) {
      setUpgradeFeature(featureLabel);
      setShowUpgradeModal(true);
      return true; // Blocked
    }
    return false; // Not blocked
  };

  // Check billing status on mount
  useEffect(() => {
    let active = true;
    apiFetch('/api/billing/status')
      .then(async (res) => {
        if (!res.ok) return null;
        return await res.json();
      })
      .then((data) => {
        if (!active) return;
        const plan = data?.billing?.plan || 'free';
        const status = data?.billing?.status || 'free';
        const isActive = !!data?.billing?.isActive;
        setIsPremium(plan === 'premium' && (isActive || status === 'canceled'));
        setBillingChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setIsPremium(false);
        setBillingChecked(true);
      });
    return () => { active = false; };
  }, []);

  // Fetch generation status (remaining generations)
  const fetchGenerationStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/ai/reviewer-status');
      if (res.ok) {
        const data = await res.json();
        setGenerationStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch generation status:', err);
    }
  }, []);

  useEffect(() => {
    fetchGenerationStatus();
  }, [fetchGenerationStatus]);

  // Format reset time
  const formatResetTime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Get PDFs from all folders
  const getAllPdfs = useCallback((): { pdf: FolderItem; folder: Folder }[] => {
    const pdfs: { pdf: FolderItem; folder: Folder }[] = [];
    folders.forEach(folder => {
      folder.items.forEach(item => {
        if (item.type === 'pdf' && item.file) {
          pdfs.push({ pdf: item, folder });
        }
      });
    });
    return pdfs;
  }, [folders]);

  // Filter PDFs by search query
  const filteredPdfs = getAllPdfs().filter(({ pdf, folder }) => {
    const query = searchQuery.toLowerCase();
    return pdf.title.toLowerCase().includes(query) || folder.name.toLowerCase().includes(query);
  });

  // Get PDFs for selected folder
  const getPdfsForFolder = (folderId: string): FolderItem[] => {
    const folder = folders.find(f => f.id === folderId);
    return folder?.items.filter(item => item.type === 'pdf' && item.file) || [];
  };

  // Hide navbar during quiz or creating
  useEffect(() => {
    setHideNavbar(isQuizActive || isCreating);
  }, [isQuizActive, isCreating, setHideNavbar]);

  useEffect(() => {
    quizAnswersRef.current = quizAnswers;
  }, [quizAnswers]);

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    selectedReviewerIdRef.current = selectedReviewerId;
  }, [selectedReviewerId]);

  useEffect(() => {
    showResultsRef.current = showResults;
  }, [showResults]);

  // Validate stored quiz progress on mount (do not auto-resume)
  useEffect(() => {
    if (!quizProgress) return;
    const reviewer = aiReviewers.find(r => r.id === quizProgress.reviewerId);
    const isValid = Boolean(
      reviewer &&
      reviewer.status === 'ready' &&
      reviewer.questions &&
      reviewer.questions.length > 0 &&
      typeof quizProgress.currentIndex === 'number' &&
      quizProgress.currentIndex < reviewer.questions.length
    );
    if (!isValid) {
      setQuizProgress(null);
    }
  }, [aiReviewers, quizProgress, setQuizProgress]);

  // Timer for quiz
  useEffect(() => {
    if (isQuizActive && timeRemaining !== null && timeRemaining > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleQuizSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isQuizActive, timeRemaining]);

  // Save quiz progress on significant changes (answers/index)
  useEffect(() => {
    if (isQuizActive && selectedReviewerId && !showResults) {
      const progress: QuizProgress = {
        reviewerId: selectedReviewerId,
        currentIndex: currentQuestionIndex,
        answers: quizAnswers,
        startedAt: quizProgress?.startedAt || new Date().toISOString(),
        timeRemaining: timeRemainingRef.current
      };
      setQuizProgress(progress);
    }
  }, [quizAnswers, currentQuestionIndex, isQuizActive, selectedReviewerId, showResults]);

  // Periodically save quiz progress to avoid syncing every second
  useEffect(() => {
    if (!isQuizActive || !selectedReviewerId || showResults) return;
    const interval = window.setInterval(() => {
      const reviewerId = selectedReviewerIdRef.current;
      if (!reviewerId || showResultsRef.current) return;
      const progress: QuizProgress = {
        reviewerId,
        currentIndex: currentQuestionIndexRef.current,
        answers: quizAnswersRef.current,
        startedAt: quizProgress?.startedAt || new Date().toISOString(),
        timeRemaining: timeRemainingRef.current
      };
      setQuizProgress(progress);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isQuizActive, selectedReviewerId, showResults, quizProgress?.startedAt, setQuizProgress]);

  // Loading message rotation during generation
  useEffect(() => {
    if (isGenerating) {
      loadingIntervalRef.current = window.setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [isGenerating]);

  // Premium is now checked via useEffect above

  // Get selected reviewer
  const selectedReviewer = aiReviewers.find(r => r.id === selectedReviewerId);

  // Handle PDF text extraction using pdf.js
  const extractPdfText = async (pdfItem: FolderItem): Promise<string> => {
    // First check if text is already cached
    if (pdfItem.file?.text && pdfItem.file.text.trim().length > 0) {
      return pdfItem.file.text;
    }
    
    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        console.error('pdf.js library not loaded');
        return '';
      }
      
      let pdfSource: string | { data: Uint8Array } | null = null;
      
      // Get PDF source - either from URL/key or content
      if (pdfItem.file?.key) {
        pdfSource = pdfItem.file.url || await getPdfSignedUrl(pdfItem.file.key);
      } else if (pdfItem.content && pdfItem.content.startsWith('data:')) {
        // Convert base64 to Uint8Array
        const base64 = pdfItem.content.split(',')[1] || '';
        if (!base64) return '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        pdfSource = { data: bytes };
      }
      
      if (!pdfSource) {
        console.error('No PDF source found');
        return '';
      }
      
      // Load and extract text from PDF
      const loadingTask = pdfjsLib.getDocument(pdfSource);
      const pdf = await loadingTask.promise;
      const maxPages = Math.min(pdf.numPages || 0, 50); // Limit to 50 pages
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = (textContent.items || [])
          .map((item: any) => item?.str || '')
          .join(' ');
        fullText += pageText + '\n';
        
        // Limit total text to prevent huge payloads
        if (fullText.length >= 100000) {
          fullText = fullText.slice(0, 100000);
          break;
        }
      }
      
      const cleaned = fullText.replace(/\s+/g, ' ').trim();
      console.log('Extracted PDF text:', cleaned.length, 'characters');
      return cleaned;
      
    } catch (error) {
      console.error('Failed to extract PDF text:', error);
      return '';
    }
  };

  // Create new reviewer
  const handleCreateReviewer = async () => {
    console.log('handleCreateReviewer called', { selectedPdfId, selectedFolderId });
    
    // Check generation limit first
    if (generationStatus && generationStatus.remainingGenerations <= 0) {
      const resetTime = formatResetTime(generationStatus.resetIn);
      toast.warning(`Generation limit reached. Wait ${resetTime} or upgrade to Premium.`);
      if (!isPremium) {
        setUpgradeFeature('more reviewer generations');
        setShowUpgradeModal(true);
      }
      return;
    }
    
    if (!selectedPdfId || !selectedFolderId) {
      console.log('Missing PDF or folder selection');
      toast.warning('Please select a PDF first');
      return;
    }
    
    const folder = folders.find(f => f.id === selectedFolderId);
    const pdfItem = folder?.items.find(i => i.id === selectedPdfId);
    console.log('Found folder and PDF:', { folder: folder?.name, pdfItem: pdfItem?.title });
    
    if (!pdfItem || !pdfItem.file) {
      console.log('PDF item or file not found');
      toast.error('PDF file not found');
      return;
    }

    const pdfText = await extractPdfText(pdfItem);
    console.log('Extracted PDF text length:', pdfText?.length);
    
    if (!pdfText || pdfText.trim().length < 100) {
      toast.error("This PDF doesn't contain readable text. Try a different PDF.");
      return;
    }

    const reviewerId = generateId();
    const finalTimer = customTimer ? parseInt(customTimer, 10) : timerMinutes;
    
    const newReviewer: AIReviewer = {
      id: reviewerId,
      name: 'Generating...',
      sourceId: selectedPdfId,
      sourceFolderId: selectedFolderId,
      sourceName: pdfItem.title,
      difficulty,
      questionCount,
      questionMode,
      timerMinutes: finalTimer,
      questions: [],
      createdAt: new Date().toISOString(),
      attempts: [],
      status: 'generating'
    };
    
    addAIReviewer(newReviewer);
    setIsCreating(false);
    setIsGenerating(true);
    setGeneratingReviewerId(reviewerId);
    setLoadingMessageIndex(0);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await apiFetch('/api/ai/generate-reviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfText,
          config: { questionCount, difficulty, questionMode },
          reviewerId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate reviewer');
      }

      const data = await response.json();
      
      updateAIReviewer({
        ...newReviewer,
        name: data.suggestedName || pdfItem.title,
        questions: data.questions,
        status: 'ready'
      });

      // Update generation status from response
      if (data.remainingGenerations !== undefined) {
        setGenerationStatus(prev => prev ? {
          ...prev,
          remainingGenerations: data.remainingGenerations
        } : null);
      }

      toast.success('Your AI Reviewer is ready!');
      
      showLocalNotification('AI Reviewer Ready! ??', {
        body: `"${data.suggestedName || pdfItem.title}" reviewer is ready to use.`,
      });

    } catch (err: any) {
      // Don't show error if it was cancelled by user
      if (err.name === 'AbortError') {
        console.log('Generation cancelled by user');
        return;
      }
      console.error('Failed to generate reviewer:', err);
      updateAIReviewer({
        ...newReviewer,
        status: 'error',
        errorMessage: err.message || "We're sorry, something went wrong. Please try again."
      });
      toast.error(err.message || 'Failed to generate reviewer');
    } finally {
      setIsGenerating(false);
      setGeneratingReviewerId(null);
      abortControllerRef.current = null;
    }

    setSelectedFolderId('');
    setSelectedPdfId('');
    setQuestionCount(10);
    setDifficulty('medium');
    setQuestionMode('hybrid');
    setTimerMinutes(null);
    setCustomTimer('');
  };

  // Start quiz
  const startQuiz = (reviewer: AIReviewer) => {
    setSelectedReviewerId(reviewer.id);
    setCurrentQuestionIndex(0);
    setQuizAnswers({});
    setMatchingSelections({ left: null, pairs: {} });
    setTimeRemaining(reviewer.timerMinutes ? reviewer.timerMinutes * 60 : null);
    setShowResults(false);
    setShowAnswerReview(false);
    setIsQuizActive(true);
    setQuizProgress({
      reviewerId: reviewer.id,
      currentIndex: 0,
      answers: {},
      startedAt: new Date().toISOString(),
      timeRemaining: reviewer.timerMinutes ? reviewer.timerMinutes * 60 : null
    });
  };

  const resumeQuiz = (reviewer: AIReviewer) => {
    const progress = quizProgress;
    if (!progress || progress.reviewerId !== reviewer.id) {
      startQuiz(reviewer);
      return;
    }
    const index = typeof progress.currentIndex === 'number' ? progress.currentIndex : 0;
    if (!reviewer.questions || reviewer.questions.length === 0 || index >= reviewer.questions.length) {
      setQuizProgress(null);
      startQuiz(reviewer);
      return;
    }
    const safeAnswers = (progress.answers && typeof progress.answers === 'object')
      ? (progress.answers as Record<string, string | string[]>)
      : {};
    setSelectedReviewerId(reviewer.id);
    setCurrentQuestionIndex(index);
    setQuizAnswers(safeAnswers);
    setMatchingSelections({ left: null, pairs: {} });
    setTimeRemaining(progress.timeRemaining ?? (reviewer.timerMinutes ? reviewer.timerMinutes * 60 : null));
    setShowResults(false);
    setShowAnswerReview(false);
    setIsQuizActive(true);
  };

  // Handle quiz answer
  const handleAnswer = (questionId: string, answer: string | string[]) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // Handle matching question selection
  const handleMatchingSelect = (questionId: string, side: 'left' | 'right', value: string, question: ReviewerQuestion) => {
    if (side === 'left') {
      // If this term is already matched, unmatch it (undo)
      if (value in matchingSelections.pairs) {
        const newPairs = { ...matchingSelections.pairs };
        delete newPairs[value];
        setMatchingSelections(prev => ({ ...prev, pairs: newPairs, left: null }));
        // Clear the answer since pairs changed
        handleAnswer(questionId, '');
        return;
      }
      // If clicking the already-selected term, deselect it
      if (matchingSelections.left === value) {
        setMatchingSelections(prev => ({ ...prev, left: null }));
        return;
      }
      setMatchingSelections(prev => ({ ...prev, left: value }));
    } else if (side === 'right') {
      // If this definition is already matched, unmatch it (undo)
      const matchedTerm = Object.entries(matchingSelections.pairs).find(([, r]) => r === value)?.[0];
      if (matchedTerm) {
        const newPairs = { ...matchingSelections.pairs };
        delete newPairs[matchedTerm];
        setMatchingSelections(prev => ({ ...prev, pairs: newPairs, left: null }));
        handleAnswer(questionId, '');
        return;
      }
      if (matchingSelections.left) {
        const newPairs = { ...matchingSelections.pairs, [matchingSelections.left]: value };
        setMatchingSelections({ left: null, pairs: newPairs });
        
        const totalPairs = question.pairs?.length || 0;
        if (Object.keys(newPairs).length === totalPairs) {
          handleAnswer(questionId, Object.entries(newPairs).map(([l, r]) => l+'::'+r));
        }
      }
    }
  };

  // Calculate score
  const calculateScore = (reviewer: AIReviewer): { correct: number; total: number; percentage: number } => {
    let correct = 0;
    const total = reviewer.questions.length;
    if (total === 0) {
      return { correct: 0, total: 0, percentage: 0 };
    }

    reviewer.questions.forEach(q => {
      const userAnswer = quizAnswers[q.id];
      if (!userAnswer) return;

      if (q.type === 'identification') {
        if (String(userAnswer).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim()) {
          correct++;
        }
      } else if (q.type === 'multiple_choice') {
        if (String(userAnswer).toUpperCase() === String(q.correctAnswer).toUpperCase()) {
          correct++;
        }
      } else if (q.type === 'true_false') {
        if (String(userAnswer).toLowerCase() === String(q.correctAnswer).toLowerCase()) {
          correct++;
        }
      } else if (q.type === 'word_matching' && Array.isArray(userAnswer)) {
        const correctPairs = q.pairs?.reduce((acc, p) => ({ ...acc, [p.left]: p.right }), {}) || {};
        const userPairs = userAnswer.reduce((acc, pair) => {
          const [l, r] = pair.split('::');
          return { ...acc, [l]: r };
        }, {} as Record<string, string>);
        
        let allCorrect = true;
        Object.entries(correctPairs).forEach(([left, right]) => {
          if (userPairs[left] !== right) allCorrect = false;
        });
        if (allCorrect) correct++;
      }
    });

    return { correct, total, percentage: Math.round((correct / total) * 100) };
  };

  // Submit quiz
  const handleQuizSubmit = () => {
    if (!selectedReviewer) return;

    const { correct, total, percentage } = calculateScore(selectedReviewer);
    
    const attempt: QuizAttempt = {
      id: generateId(),
      score: percentage,
      totalQuestions: total,
      correctAnswers: correct,
      timeTaken: selectedReviewer.timerMinutes 
        ? (selectedReviewer.timerMinutes * 60) - (timeRemaining || 0)
        : 0,
      completedAt: new Date().toISOString()
    };

    updateAIReviewer({
      ...selectedReviewer,
      attempts: [...selectedReviewer.attempts, attempt]
    });

    setQuizProgress(null);
    setShowResults(true);
    setShowAnswerReview(false);
    
    if (timerRef.current) clearInterval(timerRef.current);

    const { message } = getScoreMessage(percentage);
    if (percentage >= 80) {
      toast.success(message);
    } else if (percentage >= 60) {
      toast.info(message);
    } else {
      toast.warning(message);
    }
  };

  // Delete reviewer
  const handleDeleteReviewer = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete AI Reviewer',
      message: 'This will permanently delete this reviewer and all attempt history.',
      action: () => {
        deleteAIReviewer(id);
        if (selectedReviewerId === id) {
          setSelectedReviewerId(null);
          setIsQuizActive(false);
        }
      }
    });
  };

  // Cancel ongoing generation
  const cancelGeneration = () => {
    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Store the ID before clearing state
    const reviewerToDelete = generatingReviewerId;
    
    // Clear generation state first
    setIsGenerating(false);
    setGeneratingReviewerId(null);
    
    // Then remove the reviewer
    if (reviewerToDelete) {
      deleteAIReviewer(reviewerToDelete);
    }
    
    toast.info('Generation cancelled');
  };

  // Regenerate reviewer
  const handleRegenerate = async (reviewer: AIReviewer) => {
    const folder = folders.find(f => f.id === reviewer.sourceFolderId);
    const pdfItem = folder?.items.find(i => i.id === reviewer.sourceId);
    if (!pdfItem || !pdfItem.file) {
      toast.error('Original PDF not found');
      return;
    }

    const pdfText = await extractPdfText(pdfItem);
    if (!pdfText || pdfText.trim().length < 100) {
      toast.error("This PDF doesn't contain readable text");
      return;
    }

    updateAIReviewer({ ...reviewer, status: 'generating', questions: [] });
    setIsGenerating(true);
    setGeneratingReviewerId(reviewer.id);
    setLoadingMessageIndex(0);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await apiFetch('/api/ai/generate-reviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          pdfText,
          config: {
            questionCount: reviewer.questionCount,
            difficulty: reviewer.difficulty,
            questionMode: reviewer.questionMode
          },
          reviewerId: reviewer.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate');
      }

      const data = await response.json();
      
      updateAIReviewer({
        ...reviewer,
        questions: data.questions,
        status: 'ready'
      });

      toast.success('New questions generated!');

    } catch (err: any) {
      // Don't show error if it was cancelled by user
      if (err.name === 'AbortError') {
        console.log('Regeneration cancelled by user');
        return;
      }
      updateAIReviewer({
        ...reviewer,
        status: 'error',
        errorMessage: err.message
      });
      toast.error(err.message || 'Failed to regenerate');
    } finally {
      setIsGenerating(false);
      setGeneratingReviewerId(null);
      abortControllerRef.current = null;
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins+':'+secs.toString().padStart(2, '0');
  };

  // --- RENDER: Loading billing status ---
  if (!billingChecked) {
    return (
      <>
        <div className="h-full w-full flex items-center justify-center bg-zen-bg">
          <div className="w-8 h-8 border-2 border-zen-primary border-t-transparent rounded-full animate-spin" />
        </div>
        
        {/* Global Modals */}
        <ConfirmModal
          isOpen={confirmState.isOpen}
          onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmState.action}
          title={confirmState.title}
          message={confirmState.message}
          isDangerous
          confirmText="Delete"
        />
      </>
    );
  }

  // --- RENDER: Quiz Results ---
  if (showResults && selectedReviewer) {
    const { correct, total, percentage } = calculateScore(selectedReviewer);
    const { emoji, message} = getScoreMessage(percentage);

    // Answer review screen
    if (showAnswerReview) {
      return (
        <>
          <div className="fixed inset-0 bg-zen-bg z-50 flex flex-col animate-reveal">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-zen-surface/30">
              <button 
                onClick={() => setShowAnswerReview(false)}
                className="flex items-center gap-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors"
              >
                <IconChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back to Results</span>
              </button>
              <h2 className="text-lg font-light text-zen-text-primary">Answer Review</h2>
              <div className="w-20" />
            </div>

            {/* Answers List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-3xl mx-auto space-y-6">
                {selectedReviewer.questions.map((question, idx) => {
                  const userAnswer = quizAnswers[question.id];
                  let isCorrect = false;

                  // Check correctness
                  if (question.type === 'identification') {
                    isCorrect = String(userAnswer || '').toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim();
                  } else if (question.type === 'multiple_choice') {
                    isCorrect = String(userAnswer || '').toUpperCase() === String(question.correctAnswer).toUpperCase();
                  } else if (question.type === 'true_false') {
                    isCorrect = String(userAnswer || '').toLowerCase() === String(question.correctAnswer).toLowerCase();
                  } else if (question.type === 'word_matching' && Array.isArray(userAnswer)) {
                    const correctPairs = question.pairs?.reduce((acc, p) => ({ ...acc, [p.left]: p.right }), {}) || {};
                    const userPairs = userAnswer.reduce((acc, pair) => {
                      const [l, r] = pair.split('::');
                      return { ...acc, [l]: r };
                    }, {} as Record<string, string>);
                    isCorrect = Object.entries(correctPairs).every(([left, right]) => userPairs[left] === right);
                  }

                  return (
                    <div key={question.id} className={`bg-zen-card rounded-2xl p-6 border-2 transition-all ${isCorrect ? 'border-green-500/30' : 'border-red-500/30'}`}>
                      {/* Question Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {isCorrect ? <IconCheck className="w-5 h-5" /> : <IconX className="w-5 h-5" />}
                          </div>
                          <span className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">Question {idx + 1}</span>
                        </div>
                        <span className="text-[10px] font-bold text-zen-primary uppercase tracking-widest bg-zen-primary/10 px-3 py-1 rounded-full">
                          {question.type.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Question */}
                      <p className="text-lg text-zen-text-primary mb-4 leading-relaxed">{question.question}</p>

                      {/* Answers */}
                      <div className="space-y-3">
                        {/* Your Answer */}
                        <div className="bg-zen-surface/50 rounded-xl p-4">
                          <p className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest mb-2">Your Answer</p>
                          <p className={`text-base font-medium ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            {question.type === 'word_matching' && Array.isArray(userAnswer)
                              ? userAnswer.map(pair => pair.split('::').join(' ? ')).join(', ') || 'No answer'
                              : String(userAnswer || 'No answer')}
                          </p>
                        </div>

                        {/* Correct Answer */}
                        {!isCorrect && (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                            <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Correct Answer</p>
                            <p className="text-base font-medium text-green-400">
                              {question.type === 'word_matching' && question.pairs
                                ? question.pairs.map(p => `${p.left} ? ${p.right}`).join(', ')
                                : question.type === 'multiple_choice' && question.options
                                ? question.options.find(opt => opt.startsWith(question.correctAnswer)) || question.correctAnswer
                                : String(question.correctAnswer)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Global Modals */}
          <ConfirmModal
            isOpen={confirmState.isOpen}
            onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            onConfirm={confirmState.action}
            title={confirmState.title}
            message={confirmState.message}
            isDangerous
            confirmText="Delete"
          />
        </>
      );
    }

    return (
      <>
        <div className="fixed inset-0 bg-zen-bg z-50 flex flex-col items-center justify-center p-6 animate-reveal overflow-y-auto">
          <div className="max-w-lg w-full text-center">
            <div className="text-7xl mb-6">{emoji}</div>
            <h2 className="text-3xl md:text-4xl font-light text-zen-text-primary mb-2">{message}</h2>
            <p className="text-zen-text-secondary mb-8">You scored {correct} out of {total} questions</p>
            
            <div className="bg-zen-card rounded-3xl p-8 mb-8 border border-zen-surface">
              <div className="text-6xl font-light text-zen-primary mb-2">{percentage}%</div>
              <p className="text-sm text-zen-text-disabled uppercase tracking-widest">Final Score</p>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <button
                onClick={() => setShowAnswerReview(true)}
                className="w-full py-4 bg-zen-primary text-zen-bg rounded-xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Review Answers
              </button>
              <button
                onClick={() => startQuiz(selectedReviewer)}
                className="w-full py-4 bg-zen-surface text-zen-text-primary rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-zen-surface/80 transition-all"
              >
                Retake Quiz
              </button>
              <button
                onClick={() => {
                  setShowResults(false);
                  setShowAnswerReview(false);
                  setIsQuizActive(false);
                  setSelectedReviewerId(null);
                }}
                className="w-full py-3 text-zen-text-secondary hover:text-zen-text-primary transition-colors text-sm font-medium"
              >
                Back to Reviewers
              </button>
            </div>
          </div>
        </div>
        
        {/* Global Modals */}
        <ConfirmModal
          isOpen={confirmState.isOpen}
          onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmState.action}
          title={confirmState.title}
          message={confirmState.message}
          isDangerous
          confirmText="Delete"
        />
      </>
    );
  }

  // --- RENDER: Quiz Taking ---
  if (isQuizActive && selectedReviewer) {
    const question = selectedReviewer.questions[currentQuestionIndex];
    if (!question) {
      setIsQuizActive(false);
      return null;
    }
    const progress = ((currentQuestionIndex) / selectedReviewer.questions.length) * 100;
    const currentAnswer = quizAnswers[question.id];

    return (
      <>
        <div className="fixed inset-0 bg-zen-bg z-50 flex flex-col animate-reveal">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-zen-surface">
          <div className="h-full bg-zen-primary transition-all duration-300" style={{ width: progress+'%' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-zen-surface/30">
          <button 
            onClick={() => {
              setIsQuizActive(false);
              setSelectedReviewerId(null);
            }}
            className="flex items-center gap-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors"
          >
            <IconChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium hidden md:inline">Exit Quiz</span>
          </button>
          
          <div className="flex items-center gap-4">
            {timeRemaining !== null && (
              <div className={'flex items-center gap-2 px-3 py-1.5 rounded-full '+(timeRemaining < 60 ? 'bg-red-500/20 text-red-400' : 'bg-zen-surface text-zen-text-secondary')}>
                <IconClock className="w-4 h-4" />
                <span className="text-sm font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            )}
            <span className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest bg-zen-surface/50 px-3 py-1.5 rounded-full">
              {currentQuestionIndex + 1} / {selectedReviewer.questions.length}
            </span>
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto">
            {/* Question Type Badge */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-zen-primary uppercase tracking-widest bg-zen-primary/10 px-3 py-1 rounded-full">
                {question.type.replace('_', ' ')}
              </span>
            </div>

            {/* Question */}
            <h3 className="text-xl md:text-2xl font-light text-zen-text-primary mb-8 leading-relaxed">
              {question.question}
            </h3>

            {/* Answer Input based on type */}
            {question.type === 'identification' && (
              <input
                type="text"
                value={(currentAnswer as string) || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                placeholder="Type your answer..."
                className="w-full bg-zen-card rounded-2xl p-4 text-lg text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 border border-zen-surface"
                autoFocus
              />
            )}

            {question.type === 'multiple_choice' && question.options && (
              <div className="space-y-3">
                {question.options.map((option, idx) => {
                  const letter = option.charAt(0);
                  const isSelected = currentAnswer === letter;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(question.id, letter)}
                      className={'w-full text-left p-4 rounded-2xl border transition-all '+(
                        isSelected 
                          ? 'bg-zen-primary/10 border-zen-primary text-zen-text-primary' 
                          : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-zen-primary/30'
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === 'true_false' && (
              <div className="flex gap-4">
                <button
                  onClick={() => handleAnswer(question.id, 'true')}
                  className={'flex-1 py-6 rounded-2xl border text-lg font-medium transition-all '+(
                    currentAnswer === 'true'
                      ? 'bg-green-500/10 border-green-500 text-green-400'
                      : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-green-500/30'
                  )}
                >
                  True
                </button>
                <button
                  onClick={() => handleAnswer(question.id, 'false')}
                  className={'flex-1 py-6 rounded-2xl border text-lg font-medium transition-all '+(
                    currentAnswer === 'false'
                      ? 'bg-red-500/10 border-red-500 text-red-400'
                      : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-red-500/30'
                  )}
                >
                  False
                </button>
              </div>
            )}

            {question.type === 'word_matching' && question.pairs && question.pairs.length > 0 && (
              <div className="space-y-6">
                {/* Instructions with visual indicator */}
                <div className="flex items-center gap-3 p-4 bg-zen-primary/5 border border-zen-primary/20 rounded-xl">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zen-primary/20 flex items-center justify-center">
                    <span className="text-lg">??</span>
                  </div>
                  <p className="text-sm text-zen-text-secondary">
                    <span className="text-zen-primary font-medium">Step 1:</span> Tap a term on the left
                    <br />
                    <span className="text-zen-primary font-medium">Step 2:</span> Tap its matching definition on the right
                  </p>
                </div>

                {/* Matching Progress */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zen-text-disabled uppercase tracking-widest">Progress</span>
                  <span className="font-bold text-zen-primary">
                    {Object.keys(matchingSelections.pairs).length} / {question.pairs.length} matched
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left column - terms */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-4 bg-zen-primary rounded-full"></div>
                      <p className="text-xs font-bold text-zen-text-primary uppercase tracking-widest">Terms</p>
                    </div>
                    {question.pairs.map((pair, idx) => {
                      const isSelected = matchingSelections.left === pair.left;
                      const isMatched = pair.left in matchingSelections.pairs;
                      const matchedDef = matchingSelections.pairs[pair.left];
                      
                      return (
                        <div key={pair.id} className="relative">
                          <button
                            onClick={() => handleMatchingSelect(question.id, 'left', pair.left, question)}
                            className={'group w-full text-left p-4 rounded-xl border-2 text-sm transition-all duration-200 '+(
                              isMatched
                                ? 'bg-gradient-to-r from-zen-primary/10 to-transparent border-zen-primary/50 text-zen-text-primary cursor-pointer shadow-lg shadow-zen-primary/10 hover:border-red-400/50 hover:from-red-500/10'
                                : isSelected
                                  ? 'bg-zen-primary/20 border-zen-primary text-zen-text-primary scale-[1.02] shadow-lg shadow-zen-primary/20 animate-pulse'
                                  : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-zen-primary/50 hover:scale-[1.01] active:scale-95'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{pair.left}</span>
                              {isMatched && (
                                <div className="flex items-center gap-1 text-zen-primary animate-fade-in">
                                  <IconCheck className="w-5 h-5" />
                                  <span className="text-xs">?</span>
                                </div>
                              )}
                              {isSelected && !isMatched && (
                                <div className="w-2 h-2 rounded-full bg-zen-primary animate-ping"></div>
                              )}
                            </div>
                            {isMatched && matchedDef && (
                              <div className="mt-2 pt-2 border-t border-zen-primary/20 text-xs text-zen-text-disabled">
                                ? {matchedDef}
                              </div>
                            )}
                          </button>
                          {/* Visual connector line when matched */}
                          {isMatched && (
                            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-0.5 bg-gradient-to-r from-zen-primary to-transparent animate-fade-in"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Right column - definitions */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                      <p className="text-xs font-bold text-zen-text-primary uppercase tracking-widest">Definitions</p>
                    </div>
                    {question.pairs.map((pair, idx) => {
                      const isMatched = matchingSelections?.pairs ? Object.values(matchingSelections.pairs).includes(pair.right) : false;
                      const hasSelection = !!matchingSelections.left;
                      
                      return (
                        <div key={pair.id} className="relative">
                          <button
                            onClick={() => handleMatchingSelect(question.id, 'right', pair.right, question)}
                            disabled={!isMatched && !matchingSelections.left}
                            className={'group w-full text-left p-4 rounded-xl border-2 text-sm transition-all duration-200 '+(
                              isMatched
                                ? 'bg-gradient-to-l from-emerald-500/10 to-transparent border-emerald-500/50 text-zen-text-primary cursor-pointer shadow-lg shadow-emerald-500/10 hover:border-red-400/50 hover:from-red-500/10'
                                : !matchingSelections.left
                                ? 'bg-zen-card border-zen-surface/50 text-zen-text-disabled cursor-not-allowed opacity-50'
                                : 'bg-zen-card border-emerald-500/30 text-zen-text-secondary hover:bg-emerald-500/5 hover:border-emerald-500/50 hover:scale-[1.01] active:scale-95'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{pair.right}</span>
                              {isMatched && (
                                <div className="flex items-center gap-1 text-emerald-500 animate-fade-in">
                                  <IconCheck className="w-5 h-5" />
                                  <span className="text-xs">?</span>
                                </div>
                              )}
                              {!isMatched && hasSelection && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <IconChevronLeft className="w-4 h-4 text-emerald-500" />
                                </div>
                              )}
                            </div>
                          </button>
                          {/* Visual connector line when matched */}
                          {isMatched && (
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-0.5 bg-gradient-to-l from-emerald-500 to-transparent animate-fade-in"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 md:p-6 border-t border-zen-surface/30 safe-area-bottom">
          <div className="max-w-2xl mx-auto flex gap-4">
            <button
              onClick={() => {
                setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
                setMatchingSelections({ left: null, pairs: {} });
              }}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-3 bg-zen-surface text-zen-text-secondary rounded-xl font-bold uppercase tracking-wider text-sm disabled:opacity-30 transition-all"
            >
              Previous
            </button>
            
            {currentQuestionIndex < selectedReviewer.questions.length - 1 ? (
              <button
                onClick={() => {
                  setCurrentQuestionIndex(prev => prev + 1);
                  setMatchingSelections({ left: null, pairs: {} });
                }}
                className="flex-1 py-3 bg-zen-primary text-zen-bg rounded-xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/20 hover:scale-[1.01] active:scale-95 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleQuizSubmit}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-green-500/20 hover:scale-[1.01] active:scale-95 transition-all"
              >
                Submit Quiz
              </button>
            )}
          </div>
        </div>
      </div>
        
      {/* Global Modals */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        isDangerous
        confirmText="Delete"
      />
      </>
    );
  }

  // --- RENDER: Create Reviewer Modal ---
  if (isCreating) {
    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    const availablePdfs = selectedFolderId ? getPdfsForFolder(selectedFolderId) : [];

    return (
      <>
        <div className="fixed inset-0 bg-zen-bg z-50 flex flex-col animate-reveal overflow-y-auto">
          <div className="p-4 md:p-6 border-b border-zen-surface/30">
            <div className="max-w-2xl mx-auto flex items-center gap-4">
              <button 
                onClick={() => setIsCreating(false)}
                className="p-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors rounded-full hover:bg-zen-surface"
              >
                <IconChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl md:text-2xl font-light text-zen-text-primary">Create AI Reviewer</h2>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zen-text-disabled" />
              <input
                type="text"
                placeholder="Search PDFs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zen-card rounded-2xl pl-12 pr-4 py-4 text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 border border-zen-surface"
              />
            </div>

            {/* Folder Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">Select Folder</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {folders.filter(f => f.items.some(i => i.type === 'pdf')).map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setSelectedPdfId('');
                    }}
                    className={'p-4 rounded-2xl border text-left transition-all '+(
                      selectedFolderId === folder.id
                        ? 'bg-zen-primary/10 border-zen-primary'
                        : 'bg-zen-card border-zen-surface hover:border-zen-primary/30'
                    )}
                  >
                    <p className="font-medium text-zen-text-primary truncate">{folder.name}</p>
                    <p className="text-xs text-zen-text-disabled mt-1">
                      {folder.items.filter(i => i.type === 'pdf').length} PDFs
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* PDF Selection */}
            {selectedFolderId && (
              <div className="space-y-3 animate-reveal">
                <label className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">Select PDF</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availablePdfs.length === 0 ? (
                    <p className="text-zen-text-secondary text-sm py-4 text-center">No PDFs in this folder</p>
                  ) : (
                    availablePdfs.map(pdf => (
                      <button
                        key={pdf.id}
                        onClick={() => setSelectedPdfId(pdf.id)}
                        className={'w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3 '+(
                          selectedPdfId === pdf.id
                            ? 'bg-zen-primary/10 border-zen-primary'
                            : 'bg-zen-card border-zen-surface hover:border-zen-primary/30'
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                          <span className="text-red-400 text-xs font-bold">PDF</span>
                        </div>
                        <p className="font-medium text-zen-text-primary truncate">{pdf.title}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Configuration */}
            {selectedPdfId && (
              <div className="space-y-6 animate-reveal">
                {/* Question Count */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">
                    Number of Questions
                    {!isPremium && <span className="ml-2 text-zen-primary">(Max 10 for Free)</span>}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[10, 20, 30, 40, 50].map(count => {
                      const isLocked = !isFeatureAvailable('questionCount', count);
                      return (
                        <button
                          key={count}
                          onClick={() => {
                            if (isLocked) {
                              handlePremiumFeatureClick('questionCount', `${count} Questions`);
                            } else {
                              setQuestionCount(count);
                            }
                          }}
                          className={'px-4 py-2 rounded-xl border text-sm font-medium transition-all relative '+(
                            questionCount === count
                              ? 'bg-zen-primary text-zen-bg border-zen-primary'
                              : isLocked
                                ? 'bg-zen-card/50 border-zen-surface/50 text-zen-text-disabled'
                                : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-zen-primary/30'
                          )}
                        >
                          {count}
                          {isLocked && (
                            <span className="absolute -top-1 -right-1 text-xs">??</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">
                    Difficulty
                    {!isPremium && <span className="ml-2 text-zen-primary">(Easy only for Free)</span>}
                  </label>
                  <div className="flex gap-2">
                    {(['easy', 'medium', 'hard'] as ReviewerDifficulty[]).map(d => {
                      const isLocked = !isFeatureAvailable('difficulty', d);
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            if (isLocked) {
                              handlePremiumFeatureClick('difficulty', `${d.charAt(0).toUpperCase() + d.slice(1)} Difficulty`);
                            } else {
                              setDifficulty(d);
                            }
                          }}
                          className={'flex-1 py-3 rounded-xl border text-sm font-medium capitalize transition-all relative '+(
                            difficulty === d
                              ? d === 'easy' ? 'bg-green-500/20 border-green-500 text-green-400'
                                : d === 'medium' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                                : 'bg-red-500/20 border-red-500 text-red-400'
                              : isLocked
                                ? 'bg-zen-card/50 border-zen-surface/50 text-zen-text-disabled'
                                : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-zen-primary/30'
                          )}
                        >
                          {d}
                          {isLocked && (
                            <span className="absolute -top-1 -right-1 text-xs">??</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Type */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">
                    Question Type
                    {!isPremium && <span className="ml-2 text-zen-primary">(MC & T/F for Free)</span>}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {([
                      { value: 'identification', label: 'Identification' },
                      { value: 'multiple_choice', label: 'Multiple Choice' },
                      { value: 'true_false', label: 'True/False' },
                      { value: 'word_matching', label: 'Word Matching' },
                      { value: 'hybrid', label: 'Hybrid (Mix)' },
                    ] as { value: ReviewerQuestionMode; label: string }[]).map(type => {
                      const isLocked = !isFeatureAvailable('mode', type.value);
                      return (
                        <button
                          key={type.value}
                          onClick={() => {
                            if (isLocked) {
                              handlePremiumFeatureClick('mode', type.label);
                            } else {
                              setQuestionMode(type.value);
                            }
                          }}
                          className={'py-3 px-4 rounded-xl border text-sm font-medium transition-all relative '+(
                            questionMode === type.value
                              ? 'bg-zen-primary/10 border-zen-primary text-zen-primary'
                              : isLocked
                                ? 'bg-zen-card/50 border-zen-surface/50 text-zen-text-disabled'
                                : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-zen-primary/30'
                          )}
                        >
                          {type.label}
                          {isLocked && (
                            <span className="absolute -top-1 -right-1 text-xs">??</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Timer */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">Quiz Timer</label>
                  <div className="flex flex-wrap gap-2">
                    {TIMER_OPTIONS.map(option => (
                      <button
                        key={option.label}
                        onClick={() => {
                          setTimerMinutes(option.value);
                          setCustomTimer('');
                        }}
                        className={'px-4 py-2 rounded-xl border text-sm font-medium transition-all '+(
                          timerMinutes === option.value && !customTimer
                            ? 'bg-zen-primary text-zen-bg border-zen-primary'
                            : 'bg-zen-card border-zen-surface text-zen-text-secondary hover:border-zen-primary/30'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      placeholder="Custom (minutes)"
                      value={customTimer}
                      onChange={(e) => {
                        setCustomTimer(e.target.value);
                        setTimerMinutes(null);
                      }}
                      className="flex-1 bg-zen-card rounded-xl px-4 py-2 text-sm text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 border border-zen-surface"
                      min="1"
                      max="180"
                    />
                    <span className="text-xs text-zen-text-disabled">min</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Button */}
        <div className="p-4 md:p-6 border-t border-zen-surface/30 safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleCreateReviewer}
              disabled={!selectedPdfId}
              className="w-full py-4 bg-zen-primary text-zen-bg rounded-xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              Generate AI Reviewer
            </button>
          </div>
        </div>
      </div>
        
      {/* Global Modals */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        isDangerous
        confirmText="Delete"
      />
      </>
    );
  }

  // --- RENDER: Reviewer Detail ---
  if (selectedReviewer) {
    const bestScore = selectedReviewer.attempts.length > 0 
      ? Math.max(...selectedReviewer.attempts.map(a => a.score))
      : null;

    return (
      <>
        <div className="h-full w-full flex flex-col bg-zen-bg animate-reveal overflow-y-auto no-scrollbar desktop-scroll-area p-4 md:p-8 pb-24">
          <div className="max-w-4xl mx-auto w-full">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => setSelectedReviewerId(null)}
                className="flex items-center gap-2 text-zen-text-secondary hover:text-zen-text-primary mb-6 transition-all group active:scale-95"
              >
                <div className="p-1.5 rounded-full bg-zen-surface group-hover:bg-zen-surface/80 transition-colors">
                  <IconChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                </div>
                <span className="text-sm font-medium">Back to Reviewers</span>
              </button>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    {editingReviewerName === selectedReviewer.id ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={newReviewerName}
                          onChange={(e) => setNewReviewerName(e.target.value)}
                          maxLength={50}
                          className="w-full bg-transparent border-b-2 border-zen-primary pb-2 text-2xl md:text-4xl font-light text-zen-text-primary focus:outline-none placeholder-zen-text-disabled/30 pr-24"
                          autoFocus
                          placeholder="Reviewer Name"
                        />
                        <div className="flex items-center gap-1 absolute right-0 bottom-2">
                          <button
                            onClick={() => {
                              if (newReviewerName.trim()) {
                                updateAIReviewer({ ...selectedReviewer, name: newReviewerName.trim() });
                              }
                              setEditingReviewerName(null);
                            }}
                            className="p-2 bg-zen-primary text-zen-bg rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-zen-primary/20"
                          >
                            <IconCheck className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setEditingReviewerName(null)}
                            className="p-2 bg-zen-surface text-zen-text-secondary rounded-lg hover:bg-zen-surface/80 active:scale-95 transition-all"
                          >
                            <IconX className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 group/header">
                        <div className="flex items-start gap-4">
                          <h2 className="text-3xl md:text-5xl font-light text-zen-text-primary leading-tight break-words">
                            {selectedReviewer.name}
                          </h2>
                          <button
                            onClick={() => {
                              setEditingReviewerName(selectedReviewer.id);
                              setNewReviewerName(selectedReviewer.name);
                            }}
                            className="p-2 rounded-xl text-zen-text-disabled hover:text-zen-primary hover:bg-zen-primary/5 transition-all opacity-100 md:opacity-0 group-hover/header:opacity-100 shrink-0"
                          >
                            <IconEdit className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zen-surface/80 border border-zen-surface text-xs font-bold text-zen-text-secondary uppercase tracking-wider">
                            {selectedReviewer.questionCount} Qs
                          </span>
                          <span className={'inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold uppercase tracking-wider ' + 
                            (selectedReviewer.difficulty === 'easy' ? 'bg-green-500/5 border-green-500/20 text-green-500' : 
                             selectedReviewer.difficulty === 'medium' ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500' : 
                             'bg-red-500/5 border-red-500/20 text-red-500')}>
                            {selectedReviewer.difficulty}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zen-surface/80 border border-zen-surface text-xs font-bold text-zen-text-secondary uppercase tracking-wider">
                            {selectedReviewer.questionMode.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-zen-text-disabled text-sm">
                       <span className="px-2 py-0.5 rounded bg-zen-surface/50 text-[10px] font-bold uppercase tracking-widest text-zen-text-disabled">From</span>
                       <span className="truncate max-w-[200px] md:max-w-md" title={selectedReviewer.sourceName}>{selectedReviewer.sourceName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleRegenerate(selectedReviewer)}
                      disabled={selectedReviewer.status === 'generating'}
                      className="flex-1 md:flex-none justify-center px-6 py-3 bg-zen-surface text-zen-text-secondary rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-zen-surface/80 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <IconRefresh className="w-4 h-4" />
                      <span className="md:hidden lg:inline">Regenerate</span>
                    </button>
                    <button
                      onClick={() => handleDeleteReviewer(selectedReviewer.id)}
                      className="flex-none px-6 py-3 bg-red-500/10 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 active:scale-95 transition-all"
                      title="Delete Reviewer"
                    >
                      <IconTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-zen-card p-4 md:p-6 rounded-2xl border border-zen-surface">
              <p className="text-xs text-zen-text-disabled uppercase tracking-widest mb-2">Best Score</p>
              <p className="text-2xl md:text-3xl font-light text-zen-primary">
                {bestScore !== null ? bestScore+'%' : '-'}
              </p>
            </div>
            <div className="bg-zen-card p-4 md:p-6 rounded-2xl border border-zen-surface">
              <p className="text-xs text-zen-text-disabled uppercase tracking-widest mb-2">Attempts</p>
              <p className="text-2xl md:text-3xl font-light text-zen-text-primary">
                {selectedReviewer.attempts.length}
              </p>
            </div>
            <div className="bg-zen-card p-4 md:p-6 rounded-2xl border border-zen-surface">
              <p className="text-xs text-zen-text-disabled uppercase tracking-widest mb-2">Questions</p>
              <p className="text-2xl md:text-3xl font-light text-zen-text-primary">
                {selectedReviewer.questions.length}
              </p>
            </div>
            <div className="bg-zen-card p-4 md:p-6 rounded-2xl border border-zen-surface">
              <p className="text-xs text-zen-text-disabled uppercase tracking-widest mb-2">Timer</p>
              <p className="text-2xl md:text-3xl font-light text-zen-text-primary">
                {selectedReviewer.timerMinutes ? selectedReviewer.timerMinutes+'m' : ''}
              </p>
            </div>
          </div>

          {/* Start Quiz Button */}
          {selectedReviewer.status === 'ready' && (
            <button
              onClick={() => {
                const hasUnfinished = Boolean(
                  quizProgress &&
                  quizProgress.reviewerId === selectedReviewer.id &&
                  typeof quizProgress.currentIndex === 'number' &&
                  selectedReviewer.questions &&
                  quizProgress.currentIndex < selectedReviewer.questions.length
                );
                if (hasUnfinished) {
                  resumeQuiz(selectedReviewer);
                } else {
                  startQuiz(selectedReviewer);
                }
              }}
              className="w-full py-5 bg-zen-primary text-zen-bg rounded-2xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/20 hover:scale-[1.01] active:scale-95 transition-all mb-8"
            >
              {quizProgress?.reviewerId === selectedReviewer.id ? 'Resume Quiz' : 'Start Quiz'}
            </button>
          )}

          {selectedReviewer.status === 'generating' && (
            <div className="w-full bg-zen-surface rounded-2xl mb-8 overflow-hidden">
              <div className="py-5 flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-zen-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-zen-text-secondary">{LOADING_MESSAGES[loadingMessageIndex]}</span>
              </div>
              <div className="flex border-t border-zen-bg/20">
                <button
                  onClick={cancelGeneration}
                  className="flex-1 py-3 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteAIReviewer(selectedReviewer.id);
                    setSelectedReviewerId(null);
                    toast.success('Reviewer deleted');
                  }}
                  className="flex-1 py-3 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all border-l border-zen-bg/20"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {selectedReviewer.status === 'error' && (
            <div className="w-full p-5 bg-red-500/10 border border-red-500/30 rounded-2xl mb-8">
              <p className="text-red-400 text-center">{selectedReviewer.errorMessage}</p>
              <button
                onClick={() => handleRegenerate(selectedReviewer)}
                className="mt-4 w-full py-3 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Attempt History */}
          {selectedReviewer.attempts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-zen-text-primary">Attempt History</h3>
              <div className="space-y-2">
                {[...selectedReviewer.attempts].reverse().map((attempt, idx) => (
                  <div key={attempt.id} className="flex items-center justify-between p-4 bg-zen-card rounded-xl border border-zen-surface">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-zen-text-disabled">#{selectedReviewer.attempts.length - idx}</span>
                      <div>
                        <p className="text-zen-text-primary font-medium">{attempt.score}%</p>
                        <p className="text-xs text-zen-text-disabled">
                          {attempt.correctAnswers}/{attempt.totalQuestions} correct
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zen-text-secondary">
                        {new Date(attempt.completedAt).toLocaleDateString()}
                      </p>
                      {attempt.timeTaken > 0 && (
                        <p className="text-xs text-zen-text-disabled">
                          {Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
        
      {/* Global Modals */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        isDangerous
        confirmText="Delete"
      />
      </>
    );
  }

  // --- RENDER: Main Dashboard ---
  const hasPdfs = folders.some(f => f.items.some(i => i.type === 'pdf'));
  const hasReviewers = aiReviewers.length > 0;

  return (
    <div className="h-full w-full flex flex-col bg-zen-bg animate-reveal overflow-y-auto no-scrollbar desktop-scroll-area p-4 md:p-6 lg:p-10 pb-24">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="md:hidden py-4 mb-4 border-b border-zen-surface/30">
          <h2 className="text-3xl font-light text-zen-text-primary tracking-tight">Review</h2>
          <p className="text-sm text-zen-text-secondary mt-1">AI-Powered Quiz Generation</p>
        </div>

        <div className="hidden md:block py-6 md:py-10 lg:py-16 space-y-2 md:space-y-4 text-left">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-extralight text-zen-text-primary tracking-tight">AI Reviewers</h2>
          <p className="text-zen-text-secondary font-light text-sm md:text-lg max-w-lg">
            Generate intelligent quizzes from your PDFs using AI.
          </p>
        </div>

        {/* Empty State */}
        {!hasReviewers && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 rounded-full bg-zen-surface flex items-center justify-center mb-6 overflow-hidden border border-zen-primary/20 shadow-lg shadow-zen-primary/10">
              <img src="/icons/icon.svg" alt="AcademiaZen" className="w-14 h-14 opacity-90" />
            </div>
            <h3 className="text-xl md:text-2xl font-light text-zen-text-primary mb-2">Create your first AI Reviewer</h3>
            <p className="text-zen-text-secondary max-w-md mb-8">
              Transform your PDF study materials into interactive quizzes powered by AI.
            </p>
            
            {hasPdfs ? (
              <>
                {generationStatus?.remainingGenerations === 0 ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                      <IconClock className="w-8 h-8 text-amber-400" />
                    </div>
                    <p className="text-amber-400 font-medium mb-2">Cooldown Active</p>
                    <p className="text-zen-text-disabled text-sm mb-4">
                      Wait {formatResetTime(generationStatus.resetIn)} to generate more reviewers
                    </p>
                    {!isPremium && (
                      <button
                        onClick={() => {
                          setUpgradeFeature('10 generations per 5 hours');
                          setShowUpgradeModal(true);
                        }}
                        className="px-6 py-3 bg-zen-primary text-zen-bg rounded-xl font-medium"
                      >
                        Upgrade to Premium
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="px-8 py-4 bg-zen-primary text-zen-bg rounded-xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <IconPlus className="w-5 h-5" />
                    Create AI Reviewer
                  </button>
                )}
                {generationStatus && generationStatus.remainingGenerations > 0 && (
                  <p className="text-zen-text-disabled text-xs mt-4">
                    {generationStatus.remainingGenerations} of {generationStatus.maxGenerations} generations remaining
                  </p>
                )}
              </>
            ) : (
              <div className="text-center">
                <p className="text-zen-text-disabled mb-4">You need to upload PDFs to your Library first.</p>
                <a 
                  href="/?page=library"
                  className="px-6 py-3 bg-zen-surface text-zen-text-primary rounded-xl font-medium hover:bg-zen-surface/80 transition-all inline-block"
                >
                  Go to Library
                </a>
              </div>
            )}
          </div>
        )}

        {/* Reviewers Grid */}
        {hasReviewers && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-4 md:mb-8">
              <div className="bg-zen-card hover:bg-zen-surface/30 p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-zen-surface/50 transition-all">
                <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.2em] font-bold mb-2 md:mb-4">Reviewers</p>
                <div className="flex items-end gap-1 md:gap-2">
                  <p className="text-2xl md:text-4xl text-zen-text-primary font-light leading-none">{aiReviewers.length}</p>
                  <p className="text-[10px] md:text-sm text-zen-text-disabled mb-1 font-medium">/ {isPremium ? '10' : '3'}</p>
                </div>
              </div>
              
              <div className="bg-zen-card hover:bg-zen-surface/30 p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-zen-surface/50 transition-all">
                <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.2em] font-bold mb-2 md:mb-4">Total Attempts</p>
                <div className="flex items-end gap-1 md:gap-2">
                  <p className="text-2xl md:text-4xl text-zen-primary font-light leading-none">
                    {aiReviewers.reduce((acc, r) => acc + r.attempts.length, 0)}
                  </p>
                </div>
              </div>

              <div 
                onClick={() => hasPdfs && aiReviewers.length < (isPremium ? 10 : 3) && generationStatus?.remainingGenerations !== 0 && setIsCreating(true)}
                className={'col-span-2 md:col-span-1 bg-gradient-to-br from-zen-primary/10 to-transparent p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-zen-primary/20 backdrop-blur-sm relative overflow-hidden group '+(hasPdfs && aiReviewers.length < (isPremium ? 10 : 3) && generationStatus?.remainingGenerations !== 0 ? 'cursor-pointer active:scale-[0.98]' : 'opacity-50')+' transition-all flex items-center justify-between md:flex-col md:items-start md:gap-8'}
              >
                <div className="relative z-10 flex flex-col justify-center">
                  <p className="text-[10px] md:text-xs text-zen-primary uppercase tracking-[0.2em] font-bold mb-1 md:mb-4">Quick Action</p>
                  <p className="text-base md:text-xl text-zen-text-primary font-medium tracking-tight">
                    {aiReviewers.length >= (isPremium ? 10 : 3) ? 'Limit Reached' : generationStatus?.remainingGenerations === 0 ? 'Cooldown Active' : 'Create Reviewer'}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zen-primary text-zen-bg flex items-center justify-center group-hover:rotate-90 transition-transform duration-500 shadow-lg relative z-10 md:mt-auto">
                  <IconPlus className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="absolute inset-0 bg-zen-primary/5 group-hover:bg-zen-primary/10 transition-colors" />
              </div>
            </div>

            {/* Generation Status Banner */}
            {generationStatus && (
              <div className={`mb-8 md:mb-16 p-4 md:p-6 rounded-2xl border ${
                generationStatus.remainingGenerations === 0 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-zen-surface/30 border-zen-surface/50'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      generationStatus.remainingGenerations === 0 ? 'bg-amber-500/20' : 'bg-zen-primary/20'
                    }`}>
                      {generationStatus.remainingGenerations === 0 ? (
                        <IconClock className="w-5 h-5 text-amber-400" />
                      ) : (
                        <IconRefresh className="w-5 h-5 text-zen-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-zen-text-primary font-medium">
                        {generationStatus.remainingGenerations === 0 
                          ? `Cooldown Active · Resets in ${formatResetTime(generationStatus.resetIn)}`
                          : `${generationStatus.remainingGenerations} of ${generationStatus.maxGenerations} generations left`
                        }
                      </p>
                      <p className="text-xs text-zen-text-disabled">
                        {isPremium 
                          ? `Premium: ${generationStatus.maxGenerations} generations per ${generationStatus.windowHours} hours`
                          : `Free tier: ${generationStatus.maxGenerations} generations per ${generationStatus.windowHours} hours`
                        }
                      </p>
                    </div>
                  </div>
                  {!isPremium && generationStatus.remainingGenerations <= 1 && (
                    <button
                      onClick={() => {
                        setUpgradeFeature('10 generations per 5 hours');
                        setShowUpgradeModal(true);
                      }}
                      className="px-4 py-2 bg-zen-primary/20 text-zen-primary rounded-lg text-sm font-medium hover:bg-zen-primary/30 transition-colors"
                    >
                      Get More with Premium
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Reviewer Cards */}
            <div className="space-y-4 md:space-y-8">
              <div className="flex items-center justify-between border-b border-zen-surface/30 pb-2 md:pb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg md:text-2xl font-light text-zen-text-primary tracking-tight">Your Reviewers</h3>
                  <span className="bg-zen-surface/50 text-zen-text-disabled text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-tighter">
                    {aiReviewers.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {aiReviewers.map((reviewer, idx) => {
                  const bestScore = reviewer.attempts.length > 0 
                    ? Math.max(...reviewer.attempts.map(a => a.score))
                    : null;
                  const isCurrentlyGenerating = generatingReviewerId === reviewer.id;
                  const hasUnfinished = Boolean(
                    quizProgress &&
                    quizProgress.reviewerId === reviewer.id &&
                    typeof quizProgress.currentIndex === 'number' &&
                    reviewer.questions &&
                    quizProgress.currentIndex < reviewer.questions.length
                  );

                  return (
                    <div
                      key={reviewer.id}
                      onClick={() => {
                        if (reviewer.status === 'ready' && hasUnfinished) {
                          resumeQuiz(reviewer);
                          return;
                        }
                        setSelectedReviewerId(reviewer.id);
                      }}
                      className={'group relative bg-zen-card hover:bg-zen-surface/40 p-5 md:p-6 rounded-3xl md:rounded-[2rem] border border-zen-surface hover:border-zen-primary/30 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-xl animate-reveal min-h-[160px] flex flex-col'}
                      style={{ animationDelay: idx * 0.05+'s' }}
                    >
                      {/* Status Badge */}
                      {reviewer.status === 'generating' && (
                        <div className="absolute top-3 right-3 flex items-center gap-2 bg-zen-primary/20 text-zen-primary px-3 py-1 rounded-full">
                          <div className="w-3 h-3 border-2 border-zen-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] font-bold uppercase">Generating</span>
                        </div>
                      )}
                      
                      {reviewer.status === 'error' && (
                        <div className="absolute top-3 right-3 bg-red-500/20 text-red-400 px-3 py-1 rounded-full">
                          <span className="text-[10px] font-bold uppercase">Error</span>
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1">
                        <h4 className="text-lg md:text-xl font-medium text-zen-text-primary mb-2 line-clamp-2 leading-tight group-hover:text-zen-primary transition-colors">
                          {reviewer.name}
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-zen-surface text-zen-text-secondary px-2 py-1 rounded-md">
                            {reviewer.questionCount} Qs
                          </span>
                          <span className={'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ' + 
                            (reviewer.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' : 
                             reviewer.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400' : 
                             'bg-red-500/10 text-red-400')}>
                            {reviewer.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-zen-text-disabled line-clamp-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-zen-text-disabled/50"></span>
                          {reviewer.sourceName}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="flex items-end justify-between border-t border-zen-surface/50 pt-4 mt-4">
                        <div>
                          {bestScore !== null ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-zen-text-disabled uppercase tracking-widest font-bold mb-0.5">Best Score</span>
                              <span className="text-2xl font-light text-zen-primary leading-none">{bestScore}%</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-zen-text-disabled uppercase tracking-widest font-bold mb-0.5">Status</span>
                              <span className="text-sm font-medium text-zen-text-secondary">
                                {quizProgress?.reviewerId === reviewer.id ? 'Unfinished' : 'Not Started'}
                              </span>
                            </div>
                          )}
                        </div>
                        {reviewer.status === 'ready' && (
                          <div className="w-8 h-8 rounded-full bg-zen-surface group-hover:bg-zen-primary group-hover:text-zen-bg text-zen-text-secondary flex items-center justify-center transition-all group-hover:scale-110 shadow-sm">
                            <IconChevronRight className="w-5 h-5" />
                          </div>
                        )}
                        {reviewer.status === 'generating' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelGeneration();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Global Modals */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        isDangerous
        confirmText="Delete"
      />

      {/* Premium Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50" onClick={() => setShowUpgradeModal(false)}>
          <div 
            className="bg-gradient-to-b from-zen-card to-zen-bg w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-zen-primary/10 via-purple-500/10 to-amber-500/10 px-6 py-8 text-center relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 left-1/4 w-32 h-32 bg-zen-primary/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-purple-500/20 rounded-full blur-3xl" />
              
              <div className="relative">
                <span className="text-6xl mb-3 block drop-shadow-lg">??</span>
                <h2 className="text-2xl font-bold text-zen-text-primary">Unlock Premium</h2>
                <p className="text-zen-text-secondary mt-2 text-sm">
                  <span className="text-zen-primary font-semibold">{upgradeFeature}</span> is a Premium feature
                </p>
              </div>
            </div>
            
            {/* Benefits */}
            <div className="px-5 py-6 space-y-4">
              <h3 className="text-[10px] font-bold text-zen-text-disabled uppercase tracking-widest">What you get with Premium</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                  <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs shrink-0 mt-0.5">?</span>
                  <div>
                    <span className="text-zen-text-primary text-sm font-medium">AI Quiz Generator</span>
                    <p className="text-zen-text-disabled text-xs mt-0.5">Up to 50 questions, all difficulties & types</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                  <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs shrink-0 mt-0.5">?</span>
                  <div>
                    <span className="text-zen-text-primary text-sm font-medium">Zen AI Assistant</span>
                    <p className="text-zen-text-disabled text-xs mt-0.5">30 fast/day, 10 deep/day, 300/month, no cooldown</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                  <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs shrink-0 mt-0.5">?</span>
                  <div>
                    <span className="text-zen-text-primary text-sm font-medium">Unlimited Library</span>
                    <p className="text-zen-text-disabled text-xs mt-0.5">Unlimited PDFs, folders & 15MB file size</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                  <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs shrink-0 mt-0.5">?</span>
                  <div>
                    <span className="text-zen-text-primary text-sm font-medium">10 AI Reviewers</span>
                    <p className="text-zen-text-disabled text-xs mt-0.5">Create more quizzes from your PDFs</p>
                  </div>
                </li>
              </ul>
            </div>
            
            {/* Actions */}
            <div className="px-5 pb-6 pt-2 space-y-3 safe-area-bottom">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  window.location.href = '/?page=settings';
                }}
                className="w-full py-4 bg-gradient-to-r from-zen-primary via-emerald-400 to-zen-primary text-zen-bg rounded-2xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/30 hover:shadow-zen-primary/50 active:scale-95 transition-all"
              >
                View Plans
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-3 text-zen-text-disabled hover:text-zen-text-secondary transition-colors text-xs"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Review;

