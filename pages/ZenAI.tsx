
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { IconX, IconBot, IconPaperclip, IconFileText, IconChevronRight, IconFolder, IconCheck, IconTrash } from '../components/Icons';
import { useZen } from '../context/ZenContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { apiFetch } from '../utils/api';
import { getPdfSignedUrl } from '../utils/pdfStorage';
import { PdfAttachment, AIChatMessage, AIAnalysisSummary } from '../types';

// Streaming analysis info type
interface AnalysisInfo {
    mode: 'fast' | 'deep';
    documents: { name: string; pages: number; chars: number; usedOCR: boolean }[];
    totalChars: number;
    pagesReadTotal: number;
    ocrUsed: boolean;
    planSummary?: string;
    confidence?: AIAnalysisSummary['confidence'];
    responseTimeMs?: number;
}

// Conversation thread type
interface ConversationThread {
    id: string;
    title: string;
    messages: AIChatMessage[];
    createdAt: string;
    updatedAt: string;
}

// AI model handled by backend

interface SelectedRef {
    id: string;
    title: string;
    type: 'note' | 'pdf';
    content: string;
    source: 'task' | 'library';
    folderId?: string;
    file?: PdfAttachment;
    legacyData?: string;
}

interface ResolvedRef extends SelectedRef {
    markedContent: string;
    meta: { pagesRead: number; totalPages: number; usedOCR: boolean; extractedChars: number };
}

interface ZenAIProps {
    onClose: () => void;
}

interface PdfExtractResult {
    plainText: string;
    markedText: string;
    pagesRead: number;
    totalPages: number;
    usedOCR: boolean;
    extractedChars: number;
}

interface CitationPayload {
    raw: string;
    doc: string;
    page?: number;
}

const ANALYSIS_SUMMARY_OPEN = '<analysis_summary>';
const ANALYSIS_SUMMARY_CLOSE = '</analysis_summary>';

const stripAnalysisSummaryBlock = (text: string) => {
    if (!text) return '';
    let cleaned = text.replace(/<analysis_summary>[\s\S]*?<\/analysis_summary>/g, '');
    const openIndex = cleaned.indexOf(ANALYSIS_SUMMARY_OPEN);
    if (openIndex !== -1) {
        cleaned = cleaned.slice(0, openIndex);
    }
    return cleaned.trim();
};

const parseAnalysisSummaryBlock = (text: string): { plan_summary?: string; confidence?: AIAnalysisSummary['confidence'] } | null => {
    if (!text) return null;
    const match = text.match(/<analysis_summary>([\s\S]*?)<\/analysis_summary>/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1]);
        const confidenceRaw = typeof parsed?.confidence === 'string' ? parsed.confidence.toLowerCase() : '';
        const confidence: AIAnalysisSummary['confidence'] =
            confidenceRaw === 'low' || confidenceRaw === 'medium' || confidenceRaw === 'high'
                ? confidenceRaw
                : 'unknown';
        return {
            plan_summary: typeof parsed?.plan_summary === 'string' ? parsed.plan_summary.trim() : undefined,
            confidence,
        };
    } catch (_) {
        return null;
    }
};

const getCitationKeys = (title: string) => {
    const trimmed = title.trim();
    const lower = trimmed.toLowerCase();
    const withoutExt = lower.replace(/\.pdf$/i, '').trim();
    return Array.from(new Set([lower, withoutExt].filter(Boolean)));
};

// Helper Component: Renders structured AI text with academic formatting
const FormattedAIResponse: React.FC<{ 
    text: string; 
    onCitationClick?: (citation: CitationPayload) => void;
}> = ({ text, onCitationClick }) => {
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    // Parse the text to extract code blocks and structure
    const parseContent = () => {
        const elements: React.ReactNode[] = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let codeBlockIndex = 0;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Add text before code block
            if (match.index > lastIndex) {
                const beforeText = text.slice(lastIndex, match.index);
                elements.push(...parseNonCodeText(beforeText, elements.length));
            }

            const language = match[1] || 'text';
            const code = match[2].trim();
            const blockId = `code-${codeBlockIndex}`;

            // Render code block with UI matching screenshot
            elements.push(
                <div key={blockId} className="my-4">
                    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-white/5">
                        {/* Header with language and copy button */}
                        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/5">
                            <span className="text-xs text-gray-400 font-mono">{language}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(code);
                                    setCopiedIndex(blockId);
                                    setTimeout(() => setCopiedIndex(null), 2000);
                                }}
                                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {copiedIndex === blockId ? 'Copied!' : 'Copy code'}
                            </button>
                        </div>
                        
                        {/* Code content */}
                        <pre className="p-4 overflow-x-auto">
                            <code className="text-sm text-gray-300 font-mono leading-relaxed">
                                {code}
                            </code>
                        </pre>
                    </div>
                </div>
            );

            lastIndex = match.index + match[0].length;
            codeBlockIndex++;
        }

        // Add remaining text after last code block
        if (lastIndex < text.length) {
            const afterText = text.slice(lastIndex);
            elements.push(...parseNonCodeText(afterText, elements.length));
        }

        return elements;
    };

    // Parse non-code text with markdown formatting
    const parseNonCodeText = (content: string, startKey: number) => {
        const lines = content.split('\n');
        const elements: React.ReactNode[] = [];
        
        lines.forEach((line, i) => {
            const trimmed = line.trim();
            const key = `text-${startKey}-${i}`;
            
            // Headers
            if (trimmed.startsWith('### ')) {
                elements.push(
                    <h3 key={key} className="text-base md:text-lg font-semibold text-emerald-400 mt-6 mb-2 flex items-center gap-2">
                        <div className="w-1 h-5 bg-emerald-500/30 rounded-full" />
                        {trimmed.replace('### ', '')}
                    </h3>
                );
                return;
            }
            if (trimmed.startsWith('## ')) {
                elements.push(
                    <h2 key={key} className="text-lg md:text-xl font-bold text-emerald-400 mt-8 mb-4 border-b border-emerald-500/10 pb-2">
                        {trimmed.replace('## ', '')}
                    </h2>
                );
                return;
            }
            
            // Special labels like "Call it:"
            if (/^[A-Z][a-z]+\s+it:$/i.test(trimmed) || trimmed === 'Call it:' || trimmed === 'Example usage:' || trimmed === 'Usage:') {
                elements.push(
                    <div key={key} className="text-sm font-semibold text-white/90 mt-4 mb-2">
                        {trimmed}
                    </div>
                );
                return;
            }
            
            // Title (optional) pattern
            if (trimmed && !trimmed.startsWith('-') && !trimmed.startsWith('*') && !/^\d+\./.test(trimmed) && trimmed.length < 100 && i === 0) {
                elements.push(
                    <div key={key} className="text-sm text-white/70 mb-2 font-normal">
                        {processInlines(trimmed, onCitationClick)}
                    </div>
                );
                return;
            }
            
            // Bullet points
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const content = trimmed.substring(2);
                elements.push(
                    <div key={key} className="flex gap-3 ml-2 md:ml-4 py-0.5">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500/80 shrink-0" />
                        <span className="leading-relaxed opacity-90 text-white/80">{processInlines(content, onCitationClick)}</span>
                    </div>
                );
                return;
            }

            // Numbered lists
            if (/^\d+\.\s/.test(trimmed)) {
                const match = trimmed.match(/^(\d+\.)\s(.*)/);
                elements.push(
                    <div key={key} className="flex gap-3 ml-4 py-0.5">
                        <span className="text-emerald-400 font-mono text-xs mt-1">{match?.[1]}</span>
                        <span className="leading-relaxed opacity-90 text-white/80">{processInlines(match?.[2] || "", onCitationClick)}</span>
                    </div>
                );
                return;
            }

            // Dividers
            if (trimmed.startsWith('---')) {
                elements.push(<hr key={key} className="border-white/10 my-6" />);
                return;
            }

            // Empty lines for spacing
            if (trimmed === '') {
                elements.push(<div key={key} className="h-2" />);
                return;
            }

            // Regular paragraphs
                elements.push(
                    <p key={key} className="leading-relaxed opacity-90 font-light text-white/80">
                        {processInlines(trimmed, onCitationClick)}
                    </p>
                );
            });

        return elements;
    };
    
    return (
        <div className="space-y-3 text-zen-text-primary text-sm md:text-base">
            {parseContent()}
        </div>
    );
};

// Helper: Handles inline markdown (bold, code, links, citations)
const processInlines = (text: string, onCitationClick?: (citation: CitationPayload) => void): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Bold **text**
        const boldMatch = remaining.match(/^\*\*(.*?)\*\*/);
        if (boldMatch) {
            parts.push(
                <strong key={key++} className="text-emerald-400 font-semibold">
                    {boldMatch[1]}
                </strong>
            );
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }

        // Inline code `code`
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
            parts.push(
                <code key={key++} className="bg-white/10 text-emerald-300 px-1.5 py-0.5 rounded text-[0.9em] font-mono">
                    {codeMatch[1]}
                </code>
            );
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }

        // Links [text](url)
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            parts.push(
                <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" 
                   className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                    {linkMatch[1]}
                </a>
            );
            remaining = remaining.slice(linkMatch[0].length);
            continue;
        }

        // Citation pattern 【Document p.X】
        const citationMatch = remaining.match(/^【([^】]+)】/);
        if (citationMatch) {
            const rawLabel = citationMatch[1].trim();
            const pageMatch = rawLabel.match(/p\.?\s*(\d+)/i);
            const page = pageMatch ? Number(pageMatch[1]) : undefined;
            const doc = rawLabel.replace(/\s*p\.?\s*\d+.*$/i, '').trim() || rawLabel;
            const citationPayload = { raw: rawLabel, doc, page };
            const chip = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {rawLabel}
                </span>
            );

            parts.push(
                onCitationClick ? (
                    <button
                        key={key++}
                        type="button"
                        onClick={() => onCitationClick(citationPayload)}
                        title={`Open ${rawLabel}`}
                        className="inline-flex"
                    >
                        {chip}
                    </button>
                ) : (
                    <span key={key++}>{chip}</span>
                )
            );
            remaining = remaining.slice(citationMatch[0].length);
            continue;
        }

        // Regular character
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
    }

    // If it's just a plain string, return as-is
    if (parts.length === 1 && typeof parts[0] === 'string') {
        return parts[0];
    }

    return <>{parts}</>;
};

// Message Actions Toolbar Component
interface MessageActionsProps {
    messageText: string;
    messageIdx: number;
    onRegenerate: () => void;
    onContinue: () => void;
    onRewrite: (style: 'shorter' | 'simpler') => void;
    isMobile?: boolean;
}

const MessageActions: React.FC<MessageActionsProps> = ({ 
    messageText, 
    messageIdx,
    onRegenerate, 
    onContinue, 
    onRewrite,
    isMobile = false
}) => {
    const [copied, setCopied] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(messageText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [messageText]);

    const actions = useMemo(() => [
        { icon: '↻', label: 'Regenerate', onClick: onRegenerate },
        { icon: '→', label: 'Continue', onClick: onContinue },
        { icon: '−', label: 'Shorter', onClick: () => onRewrite('shorter') },
        { icon: '○', label: 'Simpler', onClick: () => onRewrite('simpler') },
        { icon: copied ? '✓' : '⎘', label: copied ? 'Copied!' : 'Copy', onClick: handleCopy },
    ], [onRegenerate, onContinue, onRewrite, copied, handleCopy]);

    if (isMobile) {
        return (
            <div className="relative">
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-gray-500 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                    </svg>
                </button>
                {showMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                        <div className="absolute right-0 bottom-full mb-2 bg-[#1C2128] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
                            {actions.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        action.onClick();
                                        if (action.label !== 'Copy' && action.label !== 'Copied!') setShowMenu(false);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                                >
                                    <span className="text-base">{action.icon}</span>
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
            {actions.map((action, i) => (
                <button
                    key={i}
                    onClick={action.onClick}
                    className="px-2.5 py-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all text-xs flex items-center gap-1.5"
                    title={action.label}
                >
                    <span>{action.icon}</span>
                    <span className="hidden lg:inline">{action.label}</span>
                </button>
            ))}
        </div>
    );
};

// Mode Toggle with Tooltip Component
const ModeToggle: React.FC<{
    mode: 'fast' | 'deep';
    onChange: (mode: 'fast' | 'deep') => void;
}> = ({ mode, onChange }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => onChange(mode === 'fast' ? 'deep' : 'fast')}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl border text-[9px] sm:text-[10px] uppercase font-black tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 ${
                    mode === 'deep'
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 text-gray-400 bg-white/5 hover:text-white hover:bg-white/10'
                }`}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${mode === 'deep' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-500'}`} />
                <span>{mode === 'deep' ? 'Deep' : 'Fast'}</span>
            </button>

            {showTooltip && (
                <div className="absolute bottom-full left-0 mb-2 p-3 bg-[#1C2128] border border-white/10 rounded-xl shadow-2xl z-50 w-56 text-xs animate-fade-in hidden sm:block">
                    <div className="font-semibold text-white mb-2">
                        {mode === 'fast' ? '⚡ Fast Mode' : '🔬 Deep Mode'}
                    </div>
                    {mode === 'fast' ? (
                        <ul className="text-gray-400 space-y-1.5">
                            <li className="flex items-center gap-2"><span className="text-blue-400">•</span> Quick, concise responses</li>
                            <li className="flex items-center gap-2"><span className="text-blue-400">•</span> Standard context window</li>
                            <li className="flex items-center gap-2"><span className="text-blue-400">•</span> Best for simple questions</li>
                        </ul>
                    ) : (
                        <ul className="text-gray-400 space-y-1.5">
                            <li className="flex items-center gap-2"><span className="text-emerald-400">•</span> Thorough analysis</li>
                            <li className="flex items-center gap-2"><span className="text-emerald-400">•</span> Full OCR on scanned PDFs</li>
                            <li className="flex items-center gap-2"><span className="text-emerald-400">•</span> Best for complex tasks</li>
                        </ul>
                    )}
                    <div className="mt-2 pt-2 border-t border-white/10 text-gray-500 text-[10px]">
                        Click to switch modes
                    </div>
                </div>
            )}
        </div>
    );
};

const ZenAI: React.FC<ZenAIProps> = ({ onClose }) => {
    const { state, updateTask, updateFolder, setAIChat, clearAIChat, isHydrated } = useZen();
    const { user } = useAuth();
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRefs, setSelectedRefs] = useState<SelectedRef[]>([]);
    const [showSelector, setShowSelector] = useState(false);
    const [selectorTab, setSelectorTab] = useState<'library' | 'tasks'>('library');
    const [isPremium, setIsPremium] = useState(false);
    const [billingChecked, setBillingChecked] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [thinkingContext, setThinkingContext] = useState('Formulating response...');
    const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('fast');
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisInfo | null>(null);
    const [lastContextSummary, setLastContextSummary] = useState<AnalysisInfo | null>(null);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);
    const [threads, setThreads] = useState<ConversationThread[]>([]);
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [showThreadsSidebar, setShowThreadsSidebar] = useState(false);
    const [openAnalysisPanels, setOpenAnalysisPanels] = useState<Record<string, boolean>>({});
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const upgradeCtaRef = useRef<HTMLButtonElement>(null);
    const hasShownUpgradeOnceRef = useRef(false);
    const pdfTextCacheRef = useRef<Map<string, { plainText: string; markedText: string; pagesRead: number; totalPages: number; usedOCR: boolean; extractedChars: number }>>(new Map());
    const hasLoadedChatRef = useRef(false);
    const hasAppliedRemoteChatRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isAtBottomRef = useRef(true);

    const allowFreeAI = ((import.meta as any).env?.VITE_AI_FREE_MODE ?? 'true') === 'true';
    const MAX_PDF_PAGES = 8;
    const MAX_PDF_TEXT_CHARS = 8000;
    const MAX_CONTEXT_CHARS = 9000;
    const MIN_CONTEXT_CHARS_PER_DOC = 1200;
    const MAX_OCR_PAGES = 4;
    const MAX_OCR_TEXT_CHARS = 8000;
    const OCR_SCALE = 2.0;
    const OCR_LANGUAGE = (import.meta as any).env?.VITE_OCR_LANG || 'eng';
    const CHAT_STORAGE_KEY = 'zen_ai_chat_v1';
    const MAX_SAVED_MESSAGES = 60;
    const ANALYSIS_MODE_KEY = 'zen_ai_analysis_mode_v1';
    const THREADS_STORAGE_KEY = 'zen_ai_threads_v1';
    const AUTO_SCROLL_THRESHOLD = 20;

    const isSameChat = (a: AIChatMessage[], b: AIChatMessage[]) => {
        if (a === b) return true;
        if (a.length !== b.length) return false;
        if (a.length === 0) return true;
        const lastA = a[a.length - 1];
        const lastB = b[b.length - 1];
        if (!lastA || !lastB) return false;
        const refsA = lastA.refs || [];
        const refsB = lastB.refs || [];
        if (refsA.length !== refsB.length) return false;
        for (let i = 0; i < refsA.length; i += 1) {
            if (refsA[i] !== refsB[i]) return false;
        }
        const analysisA = lastA.analysis ? JSON.stringify(lastA.analysis) : '';
        const analysisB = lastB.analysis ? JSON.stringify(lastB.analysis) : '';
        return lastA.role === lastB.role && lastA.text === lastB.text && lastA.createdAt === lastB.createdAt && analysisA === analysisB;
    };

    const updateScrollState = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop - clientHeight <= AUTO_SCROLL_THRESHOLD;
        isAtBottomRef.current = isAtBottom;
        setShowJumpToLatest(!isAtBottom && (isStreaming || isLoading));
    }, [AUTO_SCROLL_THRESHOLD, isStreaming, isLoading]);

    const scrollToBottom = useCallback((force = false) => {
        const container = messagesContainerRef.current;
        if (!container) return;
        if (force || isAtBottomRef.current) {
            container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        }
    }, []);

    const handleScroll = useCallback(() => {
        updateScrollState();
    }, [updateScrollState]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        if (isStreaming) {
            scrollToBottom();
        }
    }, [streamingText, isStreaming]);

    useEffect(() => {
        updateScrollState();
    }, [messages.length, isStreaming, isLoading, updateScrollState]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(CHAT_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setMessages(parsed);
                }
            }
        } catch (_) {
            // Ignore corrupted cache
        } finally {
            hasLoadedChatRef.current = true;
        }
    }, []);

    useEffect(() => {
        if (!hasLoadedChatRef.current) return;
        if (!isHydrated) return;
        if (!user?.emailVerified) return;
        if (hasAppliedRemoteChatRef.current) return;

        if (Array.isArray(state.aiChat) && state.aiChat.length > 0) {
            setMessages(state.aiChat);
            hasAppliedRemoteChatRef.current = true;
            return;
        }

        if (messages.length > 0) {
            setAIChat(messages);
        }

        hasAppliedRemoteChatRef.current = true;
    }, [isHydrated, user?.emailVerified, state.aiChat, messages, setAIChat]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(ANALYSIS_MODE_KEY);
            if (saved === 'deep' || saved === 'fast') {
                setAnalysisMode(saved);
            }
        } catch (_) {
            // Ignore
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(ANALYSIS_MODE_KEY, analysisMode);
        } catch (_) {
            // Ignore
        }
    }, [analysisMode]);

    // Load threads from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(THREADS_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setThreads(parsed);
                }
            }
        } catch (_) {
            // Ignore corrupted cache
        }
    }, []);

    // Save threads to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads.slice(0, 20)));
        } catch (_) {
            // Storage may be full
        }
    }, [threads]);

    useEffect(() => {
        if (!hasLoadedChatRef.current) return;
        const trimmed = messages.slice(-MAX_SAVED_MESSAGES);
        try {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
        } catch (_) {
            // Storage may be full; skip caching in that case.
        }

        if (!isHydrated || !user?.emailVerified || !hasAppliedRemoteChatRef.current) return;
        if (isSameChat(trimmed, state.aiChat || [])) return;
        setAIChat(trimmed);
    }, [messages, isHydrated, user?.emailVerified, state.aiChat, setAIChat]);

    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== CHAT_STORAGE_KEY) return;
            if (!event.newValue) {
                setMessages([]);
                return;
            }
            try {
                const parsed = JSON.parse(event.newValue);
                if (Array.isArray(parsed)) {
                    setMessages(parsed);
                }
            } catch (_) {
                // Ignore invalid payloads.
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        if (!textareaRef.current) return;
        textareaRef.current.style.height = '0px';
        const next = Math.min(textareaRef.current.scrollHeight, 160);
        textareaRef.current.style.height = `${Math.max(next, 44)}px`;
    }, [input]);

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
        return () => {
            active = false;
        };
    }, [allowFreeAI]);

    const aiLocked = allowFreeAI ? false : (billingChecked ? !isPremium : true);

    useEffect(() => {
        if (allowFreeAI) return;
        if (!billingChecked || !aiLocked) return;
        if (hasShownUpgradeOnceRef.current) return;
        hasShownUpgradeOnceRef.current = true;
        setShowUpgradeModal(true);
    }, [allowFreeAI, billingChecked, aiLocked]);

    const openBilling = () => {
        onClose();
        window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'plans' } }));
    };

    const clearChat = () => {
        setMessages([]);
        setInput('');
        setSelectedRefs([]);
        setLastContextSummary(null);
        try {
            localStorage.removeItem(CHAT_STORAGE_KEY);
        } catch (_) {
            // Ignore storage errors
        }
        clearAIChat();
    };

    const extractPdfText = async (source: string, cacheKey: string): Promise<PdfExtractResult> => {
        const cached = pdfTextCacheRef.current.get(cacheKey);
        if (cached) return cached;

        const emptyResult: PdfExtractResult = {
            plainText: '',
            markedText: '',
            pagesRead: 0,
            totalPages: 0,
            usedOCR: false,
            extractedChars: 0,
        };

        try {
            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) return emptyResult;
            let loadingTask;
            if (String(source).startsWith('data:')) {
                const base64 = source.split(',')[1] || '';
                if (!base64) return emptyResult;
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) {
                    bytes[i] = binary.charCodeAt(i);
                }
                loadingTask = pdfjsLib.getDocument({ data: bytes });
            } else {
                loadingTask = pdfjsLib.getDocument(source);
            }
            const pdf = await loadingTask.promise;
            const totalPages = pdf.numPages || 0;
            const maxPages = Math.min(totalPages, MAX_PDF_PAGES);
            let plainText = '';
            let markedText = '';
            let pagesRead = 0;

            for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
                pagesRead += 1;
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = (textContent.items || [])
                    .map((item: any) => item?.str || '')
                    .join(' ');
                const normalized = pageText.replace(/\s+/g, ' ').trim();
                if (normalized) {
                    const remaining = MAX_PDF_TEXT_CHARS - plainText.length;
                    if (remaining <= 0) break;
                    const slice = normalized.slice(0, remaining);
                    plainText += plainText ? `\n${slice}` : slice;
                    markedText += `${markedText ? '\n' : ''}[Page ${pageNum}]\n${slice}`;
                    if (slice.length < normalized.length) break;
                }
                if (plainText.length >= MAX_PDF_TEXT_CHARS) break;
            }

            if (plainText) {
                const cleaned = plainText.replace(/\s+/g, ' ').trim();
                const markedCleaned = markedText.replace(/\s+\n/g, '\n').trim();
                const result = {
                    plainText: cleaned,
                    markedText: markedCleaned,
                    pagesRead,
                    totalPages,
                    usedOCR: false,
                    extractedChars: cleaned.length,
                };
                pdfTextCacheRef.current.set(cacheKey, result);
                return result;
            }

            const Tesseract = (window as any).Tesseract;
            if (!Tesseract) return emptyResult;

            const ocrPreset = analysisMode === 'deep'
                ? { pages: MAX_OCR_PAGES, scale: OCR_SCALE, maxChars: MAX_OCR_TEXT_CHARS }
                : { pages: 2, scale: 1.5, maxChars: 4000 };

            setThinkingContext('No text found, running OCR on scanned pages...');
            const ocrPages = Math.min(totalPages, ocrPreset.pages);
            plainText = '';
            markedText = '';
            pagesRead = 0;

            for (let pageNum = 1; pageNum <= ocrPages; pageNum += 1) {
                pagesRead += 1;
                setThinkingContext(`Running OCR on page ${pageNum}/${ocrPages}...`);
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: ocrPreset.scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) continue;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: context, viewport }).promise;

                const dataUrl = canvas.toDataURL('image/png');
                const result = await Tesseract.recognize(dataUrl, OCR_LANGUAGE);
                const normalized = String(result?.data?.text || '').replace(/\s+/g, ' ').trim();
                if (normalized) {
                    const remaining = ocrPreset.maxChars - plainText.length;
                    if (remaining <= 0) break;
                    const slice = normalized.slice(0, remaining);
                    plainText += plainText ? `\n${slice}` : slice;
                    markedText += `${markedText ? '\n' : ''}[Page ${pageNum}]\n${slice}`;
                    if (slice.length < normalized.length) break;
                }
                if (plainText.length >= ocrPreset.maxChars) break;
            }

            const cleaned = plainText.replace(/\s+/g, ' ').trim();
            const markedCleaned = markedText.replace(/\s+\n/g, '\n').trim();
            const result = {
                plainText: cleaned,
                markedText: markedCleaned,
                pagesRead,
                totalPages,
                usedOCR: true,
                extractedChars: cleaned.length,
            };
            pdfTextCacheRef.current.set(cacheKey, result);
            return result;
        } catch (err) {
            return emptyResult;
        }
    };

    const persistPdfText = (ref: SelectedRef, text: string) => {
        const updatedAt = new Date().toISOString();
        if (ref.source === 'task') {
            const task = state.tasks.find(t => t.id === ref.id);
            if (!task || !task.pdfAttachment) return;
            updateTask({
                ...task,
                pdfAttachment: {
                    ...task.pdfAttachment,
                    text,
                    textUpdatedAt: updatedAt,
                },
            });
            return;
        }
        if (ref.source === 'library' && ref.folderId) {
            const folder = state.folders.find(f => f.id === ref.folderId);
            if (!folder) return;
            const updatedItems = folder.items.map(item => {
                if (item.id !== ref.id) return item;
                if (!item.file) return item;
                return {
                    ...item,
                    file: {
                        ...item.file,
                        text,
                        textUpdatedAt: updatedAt,
                    },
                };
            });
            updateFolder({ ...folder, items: updatedItems });
        }
    };

    useEffect(() => {
        if (!showUpgradeModal) return;

        const prevOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';

        // Make keyboard flows feel intentional (especially mobile + screen readers).
        setTimeout(() => upgradeCtaRef.current?.focus(), 0);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowUpgradeModal(false);
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.documentElement.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [showUpgradeModal]);

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!input.trim() || isLoading) return;
            formRef.current?.requestSubmit();
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const trimmedInput = input.trim();
        const isCreatorQuestion = /\b(who made you|who created you|who built you|your creator|who is your creator|who made u|who created u)\b/i.test(trimmedInput);
        const isTechStackQuestion = /\b(tech stack|technology stack|stack used|built with|built using|what stack|what tech stack)\b/i.test(trimmedInput);

        const couponMatch = /^password:\s*([A-Za-z0-9_-]{64})$/i.exec(trimmedInput);
        if (couponMatch) {
            const code = couponMatch[1];
            setInput('');
            setIsLoading(true);
            setThinkingContext('Validating coupon...');
            setMessages(prev => [...prev, { role: 'user', text: 'Password: [hidden]', createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
            try {
                const response = await apiFetch('/api/billing/secret-checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.error || 'Invalid coupon');
                }
                if (data?.direct && data?.billing) {
                    setMessages(prev => [...prev, { role: 'ai', text: '### Coupon accepted\nPremium is now active on your account.', createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
                    window.dispatchEvent(new CustomEvent('billing-updated', { detail: { plan: 'premium', billing: data.billing } }));
                    return;
                }
                if (!data?.checkoutUrl) {
                    throw new Error('Invalid coupon');
                }
                setMessages(prev => [...prev, { role: 'ai', text: '### Coupon accepted\nRedirecting to secure checkout...', createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
                window.location.href = data.checkoutUrl;
            } catch (_) {
                setMessages(prev => [...prev, { role: 'ai', text: '### Invalid coupon\nThis password is not valid or is no longer active.', createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        if (isCreatorQuestion) {
            setMessages(prev => [
                ...prev,
                { role: 'user', text: trimmedInput, createdAt: new Date().toISOString(), id: crypto.randomUUID() },
                { role: 'ai', text: 'Sean John Camara from STI College Fairview, Bachelor of Science in Computer Science.', createdAt: new Date().toISOString(), id: crypto.randomUUID() },
            ]);
            setInput('');
            return;
        }

        if (isTechStackQuestion) {
            setMessages(prev => [
                ...prev,
                { role: 'user', text: trimmedInput, createdAt: new Date().toISOString(), id: crypto.randomUUID() },
                { role: 'ai', text: 'MERN Stack: MongoDB, ExpressJS, ReactJS, NodeJS.', createdAt: new Date().toISOString(), id: crypto.randomUUID() },
            ]);
            setInput('');
            return;
        }

        if (aiLocked) {
            setShowUpgradeModal(true);
            return;
        }

        const userQuery = input;
        const currentRefs = [...selectedRefs];
        setThinkingContext(currentRefs.length > 0 ? 'Reviewing selected documents...' : 'Formulating response...');
        setMessages(prev => [...prev, { 
            role: 'user', 
            text: userQuery, 
            refs: currentRefs.map(r => r.title),
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
        }]);
        
        setInput('');
        setSelectedRefs([]);
        setIsLoading(true);

        try {
            // Detect academic task keywords in document titles and content
            const isAcademicTask = currentRefs.some(ref => {
                const titleLower = ref.title.toLowerCase();
                const contentLower = (ref.content || '').toLowerCase();
                const combined = `${titleLower} ${contentLower.slice(0, 3000)}`;

                const taskSignals = [
                    /\b(answer the following|questions?|activities?|instructions|procedure|requirements|rubric|points|score|deliverables|submit)\b/i,
                    /\b(task\s*\d+|activity\s*\d+|exercise\s*\d+|problem\s*set)\b/i,
                    /\b(write a program|implement|create a function|coding task)\b/i,
                ];

                const taskEvidence = taskSignals.reduce((acc, re) => acc + (re.test(combined) ? 1 : 0), 0);
                return taskEvidence >= 2;
            });

            // Detect programming-specific tasks
            const isProgrammingTask = currentRefs.some(ref => {
                const titleLower = ref.title.toLowerCase();
                const contentLower = (ref.content || '').toLowerCase();
                const queryLower = userQuery.toLowerCase();
                const combined = `${titleLower} ${contentLower.slice(0, 3000)} ${queryLower}`;
                
                const programmingKeywords = [
                    'function', 'program', 'code', 'write', 'implement', 'algorithm',
                    'syntax', 'method', 'class', 'loop', 'variable', 'array',
                    'create a function', 'write a program', 'implement a', 'develop a program',
                    'coding', 'programming', 'script', 'compile', 'execute', 'debug'
                ];
                
                return programmingKeywords.some(keyword => combined.includes(keyword));
            });

            // Detect ambiguous "do the work" prompts
            const isAnswerRequest = /^(answer|solve|do|complete|finish|work on)\b/i.test(userQuery.trim());

            const isSummaryIntent = /\b(summarize|summary|analyze|analysis|what did you learn|learned|key points|main points|overview|explain)\b/i
                .test(userQuery);

            // Activate STUDENT ANSWER MODE only if a task is detected AND user explicitly requests answers
            let useStudentMode = isAcademicTask && isAnswerRequest;
            if (isSummaryIntent) {
                useStudentMode = false;
            }

            let systemPrompt = '';
            
            if (useStudentMode && isProgrammingTask) {
                // PROGRAMMING ANSWER MODE - specialized for code tasks
                systemPrompt = `You are Zen, an AI academic assistant operating in PROGRAMMING ANSWER MODE.

CRITICAL DIRECTIVE: The student has uploaded a programming task (lab, assignment, exercise). Your role is to produce the ACTUAL COMPLETED CODE as if you are the student submitting it.

MANDATORY RULES:
1. NEVER restate, summarize, or explain the instructions/requirements inside code blocks.
2. NEVER provide outlines, templates, or "how to approach this" advice.
3. Output ONLY submission-ready code that directly fulfills each requirement.
4. ALL code must be in proper markdown code blocks with language specification.
5. Code must be clean, readable, and directly copy-pasteable - IDE quality.
6. NO comments inside code that explain the task or narrate requirements.
7. NO "Task 1 / Task 2" text inside code blocks.
8. Code blocks must contain ONLY executable code.
9. Keep responses tight and avoid extra narration; focus on the final correct output.

INCASE THE USER ASKS:
10. If the user ask about general knowledge that is not in here then answer it based on the web internet.
11. If the user ask who made you say the name of your creator "Sean John Camara" from STI College Fairview, Bachelor of Science in Computer Science.
12. If the user ask what Tech Stack is use to create you say MERN STACK or MongoDB, ExpressJS, ReactJS, NodeJS.

OUTPUT STRUCTURE:

STRICT OUTPUT FORMAT:
For each programming requirement, use this EXACT structure:

Title (optional)
\`\`\`language
// Only include code here - no task descriptions
actual code here
\`\`\`

Call it:
\`\`\`language
// usage example only
function call or usage code
\`\`\`

CODE FORMATTING RULES:
- Always use triple backticks with language: \`\`\`javascript, \`\`\`python, \`\`\`java, etc.
- Code block contains ONLY code - no natural language explanations.
- If showing function definition and usage, they must be in SEPARATE code blocks.
- Use the label "Call it:" (exact text) before usage examples.
- Explanations (if needed) go OUTSIDE code blocks, very brief.
- Follow ONLY what is described in the handout - no extra features.

EXAMPLE OUTPUT:
Basic function example

\`\`\`javascript
function add(a, b) {
    return a + b;
}
\`\`\`

Call it:
\`\`\`javascript
console.log(add(5, 3));
\`\`\`

Remember: Code must be textbook/IDE quality - clean, executable, copy-paste ready. No task narration inside code.`;
            } else if (useStudentMode) {
                // STANDARD STUDENT ANSWER MODE - for non-programming tasks
                systemPrompt = `You are Zen, an AI academic assistant operating in STUDENT ANSWER MODE.

CRITICAL DIRECTIVE: The student has uploaded an academic task (lab, assignment, exercise, or homework). Your role is to produce the ACTUAL COMPLETED WORK as if you are the student submitting it.

MANDATORY RULES:
1. NEVER restate, summarize, or explain the instructions/requirements.
2. NEVER provide outlines, templates, or "how to approach this" advice.
3. NEVER use placeholders like "[insert topic]" or "your answer here".
4. Produce ONLY submission-ready content that directly fulfills each requirement.
5. If a requirement cannot be generated (e.g., screenshots, diagrams), replace it with a descriptive placeholder:
   Example: "[Screenshot showing the main interface with toolbar at top and canvas in center]"
   Do NOT skip the requirement.
6. Keep the response concise, plain-language, and focused on the expected output.

FORMATTING:
- Use '### ' for section headers matching the task structure.
- Use bullet points (- ) and numbered lists (1. ) as appropriate.
- Use **bold** for emphasis.
- Maintain clear, academic writing style.

OUTPUT STRUCTURE:
- Begin directly with the first requirement's answer.
- Follow the exact sequence of tasks/questions from the document.
- Be concrete and specific - no abstract filler.

If the task has multiple parts, number them clearly. Produce complete, submission-quality work.`;
            } else {
                systemPrompt = `You are Zen, a world-class educational AI and problem solver.

TOP PRIORITY:
- Deliver the correct, useful answer the user expects.
- Be direct, minimal, and avoid unnecessary jargon or filler.
- If a short clarification is required to be correct, ask one concise question.
- Prefer practical, actionable guidance over theory.
- When the user needs code, provide clean, ready-to-run code first, then a brief explanation.
- If the question is about the provided documents, answer using ONLY those documents.
- If the user asks general knowledge not in the documents, answer normally from general knowledge.
- If a document is informational and contains no tasks, do NOT create assignments or code.
- If a document-based question is missing the answer, reply: "Not stated in the document."
- If the user asks who made you, reply: "Sean John Camara from STI College Fairview, Bachelor of Science in Computer Science."
- If the user asks what tech stack is used to create you, reply: "MERN Stack: MongoDB, ExpressJS, ReactJS, NodeJS."

QUALITY BAR:
- Be accurate and confident; state assumptions only if needed.
- Keep responses tight and focused on the user's goal.
- Use plain language and define any technical term you must use.

FORMAT:
- Lead with the answer.
- Use short paragraphs and bullet points only when they help clarity.
- Avoid long preambles.`;
            }

            const redact = (value: string) => value
                .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***REDACTED***')
                .replace(/mongodb\+srv:\/\/[^@\s]+@/g, 'mongodb+srv://***REDACTED***@');

            let userMessage = '';
            let resolvedRefs: ResolvedRef[] = [];

            if (currentRefs.length > 0) {
                userMessage += `CITATION RULES:\n`;
                userMessage += `- If you use the provided documents, cite every document-based claim with the format 【Document Name p.X】.\n`;
                userMessage += `- Use the page markers like [Page 1] inside the provided content to determine page numbers.\n\n`;
            }

            userMessage += `TRANSPARENCY SUMMARY (MANDATORY):\n`;
            userMessage += `- Append a hidden analysis block at the very end of your response in this exact format:\n`;
            userMessage += `${ANALYSIS_SUMMARY_OPEN}{"plan_summary":"...","confidence":"low|medium|high"}${ANALYSIS_SUMMARY_CLOSE}\n`;
            userMessage += `- The plan_summary must be brief, high-level, and contain no chain-of-thought and no citations.\n\n`;

            if (currentRefs.length > 0) {
                resolvedRefs = await Promise.all(currentRefs.map(async (ref) => {
                    if (ref.type !== 'pdf') {
                        const content = (ref.content || '').trim();
                        return {
                            ...ref,
                            content,
                            markedContent: content,
                            meta: { pagesRead: 0, totalPages: 0, usedOCR: false, extractedChars: content.length },
                        };
                    }

                    let extraction: PdfExtractResult | null = null;
                    if (ref.file?.key) {
                        try {
                            const url = ref.file.url || await getPdfSignedUrl(ref.file.key);
                            extraction = await extractPdfText(url, ref.file.key || ref.id);
                        } catch (_) {
                            extraction = null;
                        }
                    } else if (ref.legacyData && ref.legacyData.startsWith('data:')) {
                        extraction = await extractPdfText(ref.legacyData, ref.id);
                    } else if (ref.content && ref.content.startsWith('data:')) {
                        extraction = await extractPdfText(ref.content, ref.id);
                    }

                    if (!extraction && ref.file?.text) {
                        const plain = ref.file.text.trim();
                        extraction = {
                            plainText: plain,
                            markedText: plain,
                            pagesRead: 0,
                            totalPages: 0,
                            usedOCR: false,
                            extractedChars: plain.length,
                        };
                    }

                    const content = extraction?.plainText || '';
                    const markedContent = extraction?.markedText || content;
                    const meta = {
                        pagesRead: extraction?.pagesRead || 0,
                        totalPages: extraction?.totalPages || 0,
                        usedOCR: extraction?.usedOCR || false,
                        extractedChars: extraction?.extractedChars || content.length,
                    };

                    if (content) {
                        persistPdfText(ref, content);
                    }

                    return { ...ref, content, markedContent, meta };
                }));

                const perDocLimit = Math.max(
                    MIN_CONTEXT_CHARS_PER_DOC,
                    Math.floor(MAX_CONTEXT_CHARS / Math.max(resolvedRefs.length, 1))
                );

                const contextLabel = useStudentMode ? "ACADEMIC TASK DOCUMENT:" : "CONTEXT PROVIDED BY STUDENT:";
                userMessage += `${contextLabel}\n\n`;
                
                resolvedRefs.forEach(ref => {
                    let content = (ref.markedContent || ref.content || '').trim();

                    if (ref.type === 'pdf' && !content) {
                        content = "No readable text could be extracted from this PDF (including OCR). If this is a scanned document, try an OCR-exported PDF or paste key sections so I can help.";
                    }

                    if (content.length > perDocLimit) {
                        content = `${content.slice(0, perDocLimit)}... [truncated]`;
                    }

                    const safeTitle = redact(ref.title);
                    const safeContent = redact(content);
                    userMessage += `[Document Title: ${safeTitle}]\nTYPE: ${ref.type.toUpperCase()}\nCONTENT:\n${safeContent}\n--- End of Document ---\n\n`;
                });
            }

            const baseSummary: AnalysisInfo = {
                mode: analysisMode,
                documents: [],
                totalChars: 0,
                pagesReadTotal: 0,
                ocrUsed: false,
            };
            let contextSummary: AnalysisInfo = baseSummary;
            if (resolvedRefs.length > 0) {
                const documents = resolvedRefs.map(ref => ({
                    name: ref.title,
                    pages: ref.meta.pagesRead,
                    chars: ref.meta.extractedChars,
                    usedOCR: ref.meta.usedOCR,
                }));
                const totalChars = documents.reduce((sum, doc) => sum + doc.chars, 0);
                const pagesReadTotal = documents.reduce((sum, doc) => sum + doc.pages, 0);
                const ocrUsed = documents.some(doc => doc.usedOCR);
                contextSummary = {
                    mode: analysisMode,
                    documents,
                    totalChars,
                    pagesReadTotal,
                    ocrUsed,
                };
                setLastContextSummary(contextSummary);
            } else {
                setLastContextSummary(null);
            }
            
            setThinkingContext('Formulating response...');

            const safeQuery = redact(userQuery);
            userMessage += `\nSTUDENT'S QUESTION:\n${safeQuery}`;

            const prompt = `${systemPrompt}\n\n${userMessage}`;

            // Get recent chat history for memory (exclude the message we just added)
            const recentHistory = messages.slice(-12).map(msg => ({
                role: msg.role,
                text: msg.text,
            }));

            // Build context info for streaming metadata
            const contextInfo = resolvedRefs.length > 0 ? {
                documents: contextSummary.documents,
                totalChars: contextSummary.totalChars,
                pagesReadTotal: contextSummary.pagesReadTotal,
                ocrUsed: contextSummary.ocrUsed,
            } : null;

            setThinkingContext('Connecting to AI...');
            setIsStreaming(true);
            setStreamingText('');
            setCurrentAnalysis(contextSummary);
            abortControllerRef.current = new AbortController();

            // Try streaming endpoint first, fall back to regular if it fails
            const token = await auth.currentUser?.getIdToken();
            const apiUrl = (import.meta as any).env?.VITE_API_URL || '';

            try {
                const streamResponse = await fetch(`${apiUrl}/api/ai/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Authorization': token ? `Bearer ${token}` : '',
                    },
                    body: JSON.stringify({
                        prompt,
                        mode: analysisMode,
                        history: recentHistory,
                        contextInfo,
                    }),
                    signal: abortControllerRef.current.signal,
                });

                if (!streamResponse.ok) {
                    throw new Error(`Stream failed: ${streamResponse.status}`);
                }

                const reader = streamResponse.body?.getReader();
                if (!reader) throw new Error('No response body');

                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';
                let responseTimeMs = 0;

                setThinkingContext('');

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    
                    // Process complete SSE messages (separated by double newlines)
                    const messages = buffer.split('\n\n');
                    buffer = messages.pop() || ''; // Keep incomplete message in buffer

                    for (const message of messages) {
                        if (!message.trim()) continue;
                        
                        const lines = message.split('\n');
                        let eventType = '';
                        let eventData = '';
                        
                        for (const line of lines) {
                            if (line.startsWith('event:')) {
                                eventType = line.slice(6).trim();
                            } else if (line.startsWith('data:')) {
                                eventData = line.slice(5).trim();
                            }
                        }
                        
                        if (!eventType || !eventData) continue;
                        
                        try {
                            const data = JSON.parse(eventData);
                            
                            switch (eventType) {
                                case 'meta':
                                    setCurrentAnalysis(prev => {
                                        const metaContext = data.contextInfo || contextInfo || null;
                                        return {
                                            mode: data.mode || prev?.mode || analysisMode,
                                            documents: metaContext?.documents || prev?.documents || [],
                                            totalChars: metaContext?.totalChars || prev?.totalChars || 0,
                                            pagesReadTotal: metaContext?.pagesReadTotal || prev?.pagesReadTotal || 0,
                                            ocrUsed: typeof metaContext?.ocrUsed === 'boolean' ? metaContext.ocrUsed : (prev?.ocrUsed || false),
                                            planSummary: prev?.planSummary,
                                            confidence: prev?.confidence,
                                            responseTimeMs: prev?.responseTimeMs,
                                        };
                                    });
                                    setThinkingContext('');
                                    break;
                                case 'delta':
                                    if (data.text) {
                                        fullText += data.text;
                                        setStreamingText(fullText);
                                    }
                                    break;
                                case 'done':
                                    responseTimeMs = data.responseTimeMs || 0;
                                    setCurrentAnalysis(prev => prev ? { ...prev, responseTimeMs } : null);
                                    break;
                                case 'error':
                                    throw new Error(data.message || 'Stream error');
                            }
                        } catch (parseErr) {
                            // Skip malformed JSON but log it
                            console.warn('SSE parse error:', parseErr, eventData);
                        }
                    }
                }

                // Finalize - add complete message
                if (fullText) {
                    const cleanedText = stripAnalysisSummaryBlock(fullText);
                    const parsedSummary = parseAnalysisSummaryBlock(fullText);
                    const baseAnalysis: AnalysisInfo = contextSummary;
                    const planSummary = parsedSummary?.plan_summary || 'Not available';
                    const confidence = parsedSummary?.confidence || 'unknown';
                    const finalAnalysis: AIAnalysisSummary = {
                        mode: baseAnalysis.mode,
                        documents: baseAnalysis.documents,
                        totalChars: baseAnalysis.totalChars,
                        pagesReadTotal: baseAnalysis.pagesReadTotal,
                        ocrUsed: baseAnalysis.ocrUsed,
                        planSummary,
                        confidence,
                        responseTimeMs,
                    };
                    setCurrentAnalysis(prev => prev ? { ...prev, planSummary, confidence, responseTimeMs } : prev);
                    setLastContextSummary(prev => prev ? { ...prev, planSummary, confidence, responseTimeMs } : prev);
                    setMessages(prev => [...prev, { 
                        role: 'ai', 
                        text: cleanedText || fullText, 
                        createdAt: new Date().toISOString(),
                        id: crypto.randomUUID(),
                        analysis: finalAnalysis,
                    }]);
                } else {
                    throw new Error('No response received');
                }

            } catch (streamErr: any) {
                // Handle abort
                if (streamErr.name === 'AbortError') {
                    if (streamingText) {
                        const cleanedText = stripAnalysisSummaryBlock(streamingText);
                        setMessages(prev => [...prev, { 
                            role: 'ai', 
                            text: (cleanedText || streamingText) + '\n\n*[Response stopped]*', 
                            createdAt: new Date().toISOString(),
                            id: crypto.randomUUID(),
                        }]);
                    }
                    return;
                }

                // Surface streaming errors instead of falling back to non-streaming
                throw streamErr;
            }
        } catch (error: any) {
            console.error("Zen AI Error:", error);
            let errorMessage: string;
            
            if (error.message?.includes('401')) {
                errorMessage = "### Authentication Required\nPlease sign in again to continue using Zen AI.";
            } else if (error.message?.includes('402')) {
                errorMessage = "### Premium Required\nUpgrade to Premium to use Zen AI.";
            } else if (error.message?.includes('429') || error.message?.includes('rate')) {
                errorMessage = "### Rate Limit Reached\nToo many requests. Please wait a moment and try again.";
            } else {
                errorMessage = `### Connection Issue\nI encountered a technical error: ${error.message || 'Unknown error'}.`;
            }
            setMessages(prev => [...prev, { role: 'ai', text: errorMessage, createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setStreamingText('');
            abortControllerRef.current = null;
        }
    };

    // Stop streaming handler
    const stopStreaming = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    // Message action handlers
    const handleRegenerate = useCallback((messageIdx: number) => {
        // Find the last user message before this AI message
        const userMessages = messages.slice(0, messageIdx).filter(m => m.role === 'user');
        const lastUserMsg = userMessages[userMessages.length - 1];
        if (lastUserMsg) {
            // Remove the AI message and resend
            setMessages(prev => prev.slice(0, messageIdx));
            setInput(lastUserMsg.text);
            setTimeout(() => {
                formRef.current?.requestSubmit();
            }, 100);
        }
    }, [messages]);

    const handleContinue = useCallback(() => {
        setInput('Continue from where you left off.');
        setTimeout(() => {
            formRef.current?.requestSubmit();
        }, 100);
    }, []);

    const handleRewrite = useCallback((messageIdx: number, style: 'shorter' | 'simpler') => {
        const aiMsg = messages[messageIdx];
        if (!aiMsg || aiMsg.role !== 'ai') return;
        
        const prompt = style === 'shorter' 
            ? `Please rewrite this response more concisely, keeping only the essential information:\n\n${aiMsg.text}`
            : `Please rewrite this response in simpler terms that are easier to understand:\n\n${aiMsg.text}`;
        
        setInput(prompt);
        setTimeout(() => {
            formRef.current?.requestSubmit();
        }, 100);
    }, [messages]);

    // Responsive detection
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const renderAnalysisPanel = (analysis: AnalysisInfo | AIAnalysisSummary, panelKey: string, labelPrefix?: string) => {
        const isOpen = Boolean(openAnalysisPanels[panelKey]);
        const modeLabel = analysis.mode === 'deep' ? 'Deep' : 'Fast';
        const docsLabel = analysis.documents.length > 0
            ? analysis.documents.map(d => d.name).join(', ')
            : 'None';
        const planSummary = analysis.planSummary || 'Not available';
        const confidence = analysis.confidence || 'unknown';

        return (
            <div className="mb-2">
                <button
                    type="button"
                    onClick={() => toggleAnalysisPanel(panelKey)}
                    className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                    <span>{labelPrefix || 'View analysis'}</span>
                    <IconChevronRight className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                {isOpen && (
                    <div className="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-gray-400 space-y-1">
                        <div>Mode: <span className="text-gray-200">{modeLabel}</span></div>
                        <div>Documents used: <span className="text-gray-200">{docsLabel}</span></div>
                        <div>Pages read: <span className="text-gray-200">{analysis.pagesReadTotal || 0}</span></div>
                        <div>OCR used: <span className="text-gray-200">{analysis.ocrUsed ? 'Yes' : 'No'}</span></div>
                        <div>Extracted chars: <span className="text-gray-200">{analysis.totalChars.toLocaleString()}</span></div>
                        <div>Plan summary: <span className="text-gray-200">{planSummary}</span></div>
                        <div>Confidence: <span className="text-gray-200">{confidence}</span></div>
                        {analysis.responseTimeMs ? (
                            <div>Response time: <span className="text-gray-200">{(analysis.responseTimeMs / 1000).toFixed(1)}s</span></div>
                        ) : null}
                    </div>
                )}
            </div>
        );
    };

    const toggleRef = (ref: SelectedRef) => {
        setSelectedRefs(prev => 
            prev.find(r => r.id === ref.id && r.source === ref.source && r.folderId === ref.folderId) 
                ? prev.filter(r => !(r.id === ref.id && r.source === ref.source && r.folderId === ref.folderId))
                : [...prev, ref]
        );
    };

    const toggleAnalysisPanel = useCallback((key: string) => {
        setOpenAnalysisPanels(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const citationTargets = useMemo(() => {
        const targets: { title: string; file?: PdfAttachment; dataUrl?: string }[] = [];

        state.folders.forEach(folder => {
            folder.items.forEach(item => {
                if (item.type !== 'pdf') return;
                const legacyData = item.content && item.content.startsWith('data:') ? item.content : undefined;
                targets.push({ title: item.title, file: item.file, dataUrl: legacyData });
            });
        });

        state.tasks.forEach(task => {
            if (!task.pdfAttachment) return;
            const legacyData = (task.pdfAttachment as any)?.data;
            const dataUrl = legacyData && String(legacyData).startsWith('data:') ? legacyData : undefined;
            targets.push({ title: task.pdfAttachment.name, file: task.pdfAttachment, dataUrl });
        });

        return targets;
    }, [state.folders, state.tasks]);

    const citationIndex = useMemo(() => {
        const map = new Map<string, { title: string; file?: PdfAttachment; dataUrl?: string }>();
        citationTargets.forEach(target => {
            getCitationKeys(target.title).forEach(key => {
                if (!map.has(key)) map.set(key, target);
            });
        });
        return map;
    }, [citationTargets]);

    const handleCitationClick = useCallback(async (citation: CitationPayload) => {
        const rawLabel = citation.raw || citation.doc;
        const normalized = citation.doc.trim().toLowerCase();
        const target = citationIndex.get(normalized) || citationIndex.get(normalized.replace(/\.pdf$/i, '').trim());

        const copyFallback = async () => {
            try {
                await navigator.clipboard.writeText(`【${rawLabel}】`);
            } catch (_) {
                // Ignore clipboard failures
            }
        };

        if (!target) {
            await copyFallback();
            return;
        }

        try {
            let url = target.file?.url;
            if (!url && target.file?.key) {
                url = await getPdfSignedUrl(target.file.key);
            }
            if (!url && target.dataUrl) {
                url = target.dataUrl;
            }
            if (!url) {
                await copyFallback();
                return;
            }
            const finalUrl = citation.page ? `${url}#page=${citation.page}` : url;
            window.open(finalUrl, '_blank', 'noopener,noreferrer');
        } catch (_) {
            await copyFallback();
        }
    }, [citationIndex]);

    return (
        <div className="fixed inset-0 bg-[#0A0C0F] z-[110] flex flex-col animate-fade-in overflow-hidden font-sans">
            
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse [animation-duration:8s]" />
                <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[30%] bg-purple-500/5 blur-[100px] rounded-full animate-pulse [animation-duration:6s]" />
            </div>

            {/* Header */}
            <header className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5 bg-[#0A0C0F]/80 backdrop-blur-xl sticky top-0 z-[120] flex justify-between items-center">
                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Threads sidebar toggle */}
                    <button
                        onClick={() => setShowThreadsSidebar(!showThreadsSidebar)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-emerald-400 transition-all active:scale-95 border border-white/5"
                        aria-label="Toggle conversations"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                    </button>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                        <IconBot className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="hidden sm:block">
                        <h2 className="text-lg font-medium text-white tracking-tight">Zen Intelligence</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-500 font-bold">Context Engine Active</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                        onClick={() => {
                            // Save current thread if has messages
                            if (messages.length > 0) {
                                const newThread: ConversationThread = {
                                    id: Date.now().toString(),
                                    title: messages[0]?.text.slice(0, 50) + (messages[0]?.text.length > 50 ? '...' : '') || 'New Chat',
                                    messages: messages,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                };
                                setThreads(prev => [newThread, ...prev.slice(0, 19)]); // Keep max 20 threads
                            }
                            clearChat();
                        }}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-emerald-500/10 flex items-center justify-center text-white/40 hover:text-emerald-400 transition-all active:scale-95"
                        aria-label="New chat"
                        title="New chat"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    <button
                        onClick={clearChat}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-95"
                        aria-label="Clear chat"
                    >
                        <IconTrash className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-red-500/10 flex items-center justify-center text-white/40 hover:text-red-400 transition-all active:scale-95 border border-transparent hover:border-red-500/20" 
                        aria-label="Close"
                    >
                        <IconX className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </header>

            {/* Conversation Threads Sidebar */}
            {showThreadsSidebar && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/50 z-[118] sm:hidden" 
                        onClick={() => setShowThreadsSidebar(false)} 
                    />
                    <aside className="fixed left-0 top-0 bottom-0 w-[280px] sm:w-[300px] bg-[#0A0C0F] border-r border-white/10 z-[119] flex flex-col transform transition-transform duration-300 ease-out pt-[60px]">
                        <div className="p-4 border-b border-white/5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-white">Conversations</h3>
                                <button
                                    onClick={() => setShowThreadsSidebar(false)}
                                    className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                                >
                                    <IconX className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {threads.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-xs">
                                    <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    No saved conversations yet.<br />
                                    Click "+" to save the current chat.
                                </div>
                            ) : (
                                threads.map((thread) => (
                                    <button
                                        key={thread.id}
                                        onClick={() => {
                                            setMessages(thread.messages);
                                            setCurrentThreadId(thread.id);
                                            setShowThreadsSidebar(false);
                                        }}
                                        className={`w-full text-left p-3 rounded-xl mb-1 transition-all group ${
                                            currentThreadId === thread.id
                                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white truncate">{thread.title}</p>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    {thread.messages.length} messages • {new Date(thread.updatedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setThreads(prev => prev.filter(t => t.id !== thread.id));
                                                    if (currentThreadId === thread.id) {
                                                        setCurrentThreadId(null);
                                                    }
                                                }}
                                                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                                            >
                                                <IconTrash className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>
                </>
            )}

            {/* Upgrade Modal */}
            {showUpgradeModal && aiLocked && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowUpgradeModal(false)} />
                    <div className="relative w-full max-w-lg sm:max-w-lg md:max-w-xl bg-[#0D1117] border border-white/10 rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-5 sm:p-8 pb-4 sm:pb-6 border-b border-white/5">
                            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                    <IconBot className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div>
                                    <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-emerald-500 font-black mb-1">Premium</p>
                                    <h3 className="text-xl sm:text-2xl text-white font-medium">Unlock Intelligence</h3>
                                </div>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                                Get deep document analysis, synthesis across your library, and guided study workflows.
                            </p>
                        </div>
                        <div className="p-5 sm:p-8 pt-4 sm:pt-6 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
                            {/* Benefits List */}
                            <div className="flex flex-col gap-2 mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                    <span className="text-sm text-white font-medium">Unlimited PDF Storage</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                    <span className="text-sm text-white font-medium">15MB File Size</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                    <span className="text-sm text-white font-medium">Unlimited Folders</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                    <span className="text-sm text-white font-medium">AI-Powered Features</span>
                                </div>
                            </div>
                            {/* Pricing Grid */}
                            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Monthly</p>
                                    <p className="text-xl text-white font-medium">₱149</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Yearly</p>
                                    <p className="text-xl text-white font-medium">₱1490</p>
                                </div>
                            </div>
                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                                <button onClick={openBilling} className="py-4 w-full bg-emerald-500 hover:bg-emerald-400 text-[#091510] font-bold text-xs uppercase tracking-widest rounded-xl transition-colors">
                                    Upgrade Now
                                </button>
                                <button onClick={() => setShowUpgradeModal(false)} className="py-4 w-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors">
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-6 md:p-8 lg:p-12 space-y-6 md:space-y-8 relative z-[115] w-full max-w-4xl mx-auto custom-scrollbar"
            >
                                        {/* Custom scrollbar styles */}
                                        <style>{`
                                                .custom-scrollbar {
                                                    scrollbar-width: thin;
                                                    scrollbar-color: #34d399 #18181b;
                                                }
                                                .custom-scrollbar::-webkit-scrollbar {
                                                    width: 8px;
                                                    background: #18181b;
                                                }
                                                .custom-scrollbar::-webkit-scrollbar-thumb {
                                                    background: #34d399;
                                                    border-radius: 8px;
                                                }
                                                .custom-scrollbar::-webkit-scrollbar-track {
                                                    background: #18181b;
                                                }
                                        `}</style>
                {!billingChecked && (
                    <div className="py-2 px-4 rounded-lg bg-white/5 border border-white/5 text-center text-xs text-gray-500 animate-pulse">
                        Verifying subscription status...
                    </div>
                )}
                
                {/* Empty State / Splash */}
                {messages.length === 0 && !isLoading && (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-reveal">
                        <div className="mb-8 relative group cursor-default">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <IconBot className="w-20 h-20 text-emerald-500 relative z-10 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                        </div>
                        
                        <h3 className="text-3xl md:text-4xl font-light text-white tracking-tight mb-4">How can I assist your discovery?</h3>
                        <p className="text-sm md:text-base text-gray-400 font-light max-w-md mx-auto mb-12">
                            Reference your archive documents or ask any academic question. I am here to synthesize knowledge.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl px-4">
                            <button
                                disabled={aiLocked}
                                onClick={() => setInput("Summarize the key themes in my library...")}
                                className={`p-6 rounded-[2rem] border text-left transition-all group relative overflow-hidden ${
                                    aiLocked ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed' : 'bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-[#0A1A16]'
                                }`}
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <IconChevronRight className="w-4 h-4 text-emerald-500" />
                                </div>
                                <p className="text-[10px] text-emerald-500 uppercase font-black tracking-[0.2em] mb-3">Synthesis</p>
                                <p className="text-lg text-white font-medium pr-8">"Summarize the key themes in my library..."</p>
                            </button>

                            <button
                                disabled={aiLocked}
                                onClick={() => setInput("Create a quick quiz for my active recall...")}
                                className={`p-6 rounded-[2rem] border text-left transition-all group relative overflow-hidden ${
                                    aiLocked ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed' : 'bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-[#120A1A]'
                                }`}
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <IconChevronRight className="w-4 h-4 text-purple-500" />
                                </div>
                                <p className="text-[10px] text-purple-400 uppercase font-black tracking-[0.2em] mb-3">Practice</p>
                                <p className="text-lg text-white font-medium pr-8">"Create a quick quiz for my active recall..."</p>
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const messageKey = msg.id || `${idx}-${msg.createdAt || ''}`;
                    const displayText = msg.role === 'ai' ? stripAnalysisSummaryBlock(msg.text) : msg.text;
                    return (
                        <div key={messageKey} className={`group flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-reveal'}`}>
                            {msg.refs && msg.refs.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3 mr-2">
                                    {msg.refs.map((r, i) => (
                                        <span key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 font-medium">
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {msg.role === 'ai' && msg.analysis && renderAnalysisPanel(msg.analysis, `analysis-${messageKey}`)}
                            <div className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] p-4 md:p-6 lg:p-7 rounded-2xl md:rounded-3xl text-sm md:text-base leading-relaxed md:leading-7 relative ${
                                msg.role === 'user' 
                                    ? 'bg-white/10 text-white rounded-br-sm' 
                                    : 'bg-gradient-to-br from-white/5 to-transparent border border-white/5 text-gray-200 rounded-bl-sm backdrop-blur-md'
                            }`}>
                                {msg.role === 'ai' ? <FormattedAIResponse text={displayText} onCitationClick={handleCitationClick} /> : displayText}
                                
                                {msg.role === 'ai' && (
                                    <div className="absolute top-6 -left-3 w-1 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                )}
                                
                                {/* Message Action Toolbar */}
                                {msg.role === 'ai' && !isStreaming && (
                                    <MessageActions
                                        messageText={displayText}
                                        messageIdx={idx}
                                        onRegenerate={() => handleRegenerate(idx)}
                                        onContinue={handleContinue}
                                        onRewrite={(style) => handleRewrite(idx, style)}
                                        isMobile={isMobile}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Streaming Response with Analysis Panel */}
                {isStreaming && (
                    <div className="flex flex-col items-start animate-reveal">
                        {/* Analysis/Thinking Panel */}
                        {currentAnalysis && renderAnalysisPanel(currentAnalysis, 'analysis-streaming', 'Thinking… ▸ View analysis')}
                        
                        {/* Streaming Text */}
                        {streamingText ? (
                            <div className="max-w-[90%] md:max-w-[85%] lg:max-w-[75%] p-4 md:p-6 lg:p-7 rounded-2xl md:rounded-3xl text-sm md:text-base leading-relaxed md:leading-7 relative bg-gradient-to-br from-white/5 to-transparent border border-white/5 text-gray-200 rounded-bl-sm backdrop-blur-md">
                                <FormattedAIResponse text={stripAnalysisSummaryBlock(streamingText)} onCitationClick={handleCitationClick} />
                                <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5" />
                                <div className="absolute top-6 -left-3 w-1 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                                </div>
                                <span className="text-xs text-emerald-500 font-medium tracking-wide">{thinkingContext || 'Generating response...'}</span>
                            </div>
                        )}
                        
                        {/* Stop Button */}
                        <button
                            onClick={stopStreaming}
                            className="mt-3 ml-2 px-4 py-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                            Stop generating
                        </button>
                    </div>
                )}

                {isLoading && !isStreaming && (
                    <div className="flex justify-start animate-reveal pl-4">
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                            </div>
                            <span className="text-xs text-emerald-500 font-medium tracking-wide">{thinkingContext || 'Thinking...'}</span>
                        </div>
                    </div>
                )}

                {/* Jump to Latest Button */}
                {showJumpToLatest && (
                    <button
                        onClick={() => scrollToBottom(true)}
                        className="fixed bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-500 text-black text-xs font-semibold rounded-full shadow-lg hover:bg-emerald-400 transition-colors z-[125] flex items-center gap-2"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        Jump to latest
                    </button>
                )}
                <div ref={messagesEndRef} className="h-32" />
            </div>

            {/* Context Selector Portal */}
            {showSelector && (
                <div className="fixed inset-0 bg-[#000]/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowSelector(false)}>
                    <div className="bg-[#0D1117] w-full max-w-3xl h-[80vh] flex flex-col animate-scale-in shadow-2xl rounded-[2rem] border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-[#161B22]">
                            <div>
                                <h3 className="text-xl font-medium text-white">Source Material</h3>
                                <p className="text-xs text-gray-400 mt-1">Select context for the Intelligence Engine.</p>
                            </div>
                            <button onClick={() => setShowSelector(false)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                <IconX className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="flex px-8 border-b border-white/5">
                            <button onClick={() => setSelectorTab('library')} className={`py-4 px-2 text-[10px] uppercase font-bold tracking-[0.2em] transition-all relative ${selectorTab === 'library' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}>
                                Library Archive
                                {selectorTab === 'library' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full shadow-[0_-2px_10px_rgba(16,185,129,0.5)]" />}
                            </button>
                            <button onClick={() => setSelectorTab('tasks')} className={`py-4 px-2 text-[10px] uppercase font-bold tracking-[0.2em] transition-all relative ml-6 ${selectorTab === 'tasks' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}>
                                Task Assets
                                {selectorTab === 'tasks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full shadow-[0_-2px_10px_rgba(16,185,129,0.5)]" />}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-[#0D1117]">
                           {selectorTab === 'library' ? (
                                state.folders.filter(f => f.items.length > 0).map(folder => (
                                    <div key={folder.id} className="space-y-4">
                                        <div className="flex items-center gap-3 px-2">
                                            <IconFolder className="w-4 h-4 text-gray-500" />
                                            <span className="text-[10px] uppercase text-gray-500 font-black tracking-[0.3em]">{folder.name}</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {folder.items.map(item => {
                                                const isSelected = !!selectedRefs.find(r => r.id === item.id);
                                                const legacyData = item.type === 'pdf' && item.content && item.content.startsWith('data:')
                                                    ? item.content
                                                    : undefined;
                                                const refPayload: SelectedRef = {
                                                    id: item.id,
                                                    title: item.title,
                                                    type: item.type,
                                                    content: item.type === 'pdf' ? (item.file?.text || '') : (item.content || ''),
                                                    source: 'library',
                                                    folderId: folder.id,
                                                    file: item.type === 'pdf' ? item.file : undefined,
                                                    legacyData,
                                                };
                                                return (
                                                    <button 
                                                        key={item.id}
                                                        onClick={() => toggleRef(refPayload)}
                                                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#161B22] border-white/5 text-gray-400 hover:border-white/10 hover:bg-[#1C2128]'}`}
                                                    >
                                                        <div className="flex items-center gap-4 overflow-hidden">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-emerald-500/20' : 'bg-black/20'}`}>
                                                                {item.type === 'pdf' ? <IconPaperclip className="w-5 h-5" /> : <IconFileText className="w-5 h-5" />}
                                                            </div>
                                                            <div className="text-left overflow-hidden">
                                                                <span className="text-sm font-medium block truncate max-w-[240px] group-hover:text-white transition-colors">{item.title}</span>
                                                                <span className="text-[9px] uppercase opacity-60 font-black tracking-widest">{item.type === 'pdf' ? 'Archived PDF' : 'Text Knowledge'}</span>
                                                            </div>
                                                        </div>
                                                        {isSelected ? <div className="w-6 h-6 bg-emerald-500 text-black rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.4)]"><IconCheck className="w-4 h-4" /></div> : <div className="w-6 h-6 border-2 border-white/10 rounded-full shrink-0 group-hover:border-white/30 transition-colors" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                           ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {state.tasks.filter(t => t.pdfAttachment).map(task => {
                                        const isSelected = !!selectedRefs.find(r => r.id === task.id);
                                        const legacyData = (task.pdfAttachment as any)?.data;
                                        const refPayload: SelectedRef = {
                                            id: task.id,
                                            title: task.pdfAttachment!.name,
                                            type: 'pdf',
                                            content: task.pdfAttachment!.text || '',
                                            source: 'task',
                                            file: task.pdfAttachment!,
                                            legacyData: legacyData && String(legacyData).startsWith('data:') ? legacyData : undefined,
                                        };
                                        return (
                                            <button 
                                                key={task.id}
                                                onClick={() => toggleRef(refPayload)}
                                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#161B22] border-white/5 text-gray-400 hover:border-white/10 hover:bg-[#1C2128]'}`}
                                            >
                                                <div className="flex items-center gap-4 overflow-hidden">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-emerald-500/20' : 'bg-black/20'}`}>
                                                        <IconPaperclip className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-left overflow-hidden">
                                                        <span className="text-sm font-medium block truncate max-w-[240px] group-hover:text-white transition-colors">{task.pdfAttachment!.name}</span>
                                                        <span className="text-[9px] uppercase opacity-60 font-black tracking-widest">Source: {task.title}</span>
                                                    </div>
                                                </div>
                                                {isSelected ? <div className="w-6 h-6 bg-emerald-500 text-black rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.4)]"><IconCheck className="w-4 h-4" /></div> : <div className="w-6 h-6 border-2 border-white/10 rounded-full shrink-0 group-hover:border-white/30 transition-colors" />}
                                            </button>
                                        );
                                    })}
                                </div>
                           )}
                           
                           {/* Empty state for selector */}
                           {((selectorTab === 'library' && state.folders.every(f => f.items.length === 0)) || (selectorTab === 'tasks' && state.tasks.filter(t => t.pdfAttachment).length === 0)) && (
                                <div className="py-20 text-center opacity-30">
                                    <IconFileText className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                                    <p className="text-lg font-light text-gray-500">No source material found.</p>
                                </div>
                           )}
                        </div>
                        
                        <div className="p-8 pt-4 bg-[#161B22] border-t border-white/5">
                            <button onClick={() => setShowSelector(false)} className="w-full py-5 bg-emerald-500 text-[#091510] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-emerald-400 transition-all text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                Integrate Selected Context
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Input Bar Section */}
            <div className="p-2 sm:p-4 md:p-6 lg:p-8 pb-4 sm:pb-6 md:pb-8 bg-[#0A0C0F]/95 backdrop-blur-2xl relative z-[130] border-t border-white/5">
                <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
                    
                    {/* Active Context Tokens */}
                    {selectedRefs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3 animate-reveal">
                            {selectedRefs.map(ref => (
                                <div key={ref.id} className="flex items-center gap-1.5 sm:gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg pl-2 sm:pl-3 pr-1.5 sm:pr-2 py-1.5 sm:py-2 shadow-sm">
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-500 truncate max-w-[100px] sm:max-w-[150px]">{ref.title}</span>
                                    <button type="button" onClick={() => toggleRef(ref)} className="p-0.5 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors">
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => setSelectedRefs([])} className="px-2 sm:px-3 text-[8px] sm:text-[9px] uppercase font-black text-gray-500 hover:text-red-400 transition-colors">Clear</button>
                        </div>
                    )}

                    {lastContextSummary && lastContextSummary.documents.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
                            <div className="text-[10px] uppercase font-black tracking-[0.2em] text-emerald-400 mb-2">Context Summary</div>
                            <div>Documents: <span className="text-gray-200">{lastContextSummary.documents.map(d => d.name).join(', ')}</span></div>
                            <div>Pages read: <span className="text-gray-200">{lastContextSummary.pagesReadTotal || 0}</span></div>
                            <div>OCR used: <span className="text-gray-200">{lastContextSummary.ocrUsed ? 'Yes' : 'No'}</span></div>
                            <div>Extracted chars: <span className="text-gray-200">{lastContextSummary.totalChars.toLocaleString()}</span></div>
                            <div>Confidence: <span className="text-gray-200">{lastContextSummary.confidence || 'unknown'}</span></div>
                        </div>
                    )}

                    <form ref={formRef} onSubmit={handleSend} className="relative group">
                        <div className="absolute inset-0 bg-emerald-500/5 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                        
                        {/* Unified Prompt Terminal Container */}
                        <div className="relative bg-[#161B22]/80 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl flex flex-col gap-3 sm:gap-4 focus-within:border-emerald-500/30 ring-1 ring-white/0 focus-within:ring-emerald-500/20 transition-all duration-300">
                            
                            {/* Top: Auto-expanding Text Area */}
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => {
                                    setInput(e.target.value);
                                    // Auto-resize
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                                }}
                                onKeyDown={handleInputKeyDown}
                                placeholder={selectedRefs.length > 0 ? "Ask about the docs..." : "Ask anything..."}
                                disabled={isLoading || aiLocked}
                                rows={1}
                                className="w-full bg-transparent border-none text-sm sm:text-base text-white focus:outline-none focus:ring-0 placeholder:text-gray-600 font-light resize-none leading-relaxed min-h-[40px] sm:min-h-[44px] max-h-[160px] py-0 px-0.5 sm:px-1"
                            />

                            {/* Bottom: Toolbar Actions */}
                            <div className="flex items-center justify-between pt-0.5 sm:pt-1">
                                <div className="flex items-center gap-2 sm:gap-3">
                                     {/* Attachment Button */}
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (aiLocked) {
                                                setShowUpgradeModal(true);
                                                return;
                                            }
                                            setShowSelector(true);
                                        }}
                                        disabled={aiLocked}
                                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all flex items-center justify-center border ${
                                            aiLocked
                                                ? 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                                                : selectedRefs.length > 0
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                        title="Attach context"
                                    >
                                        <IconPaperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>

                                    {/* Integrated Mode Selector Pill with Tooltip */}
                                    <ModeToggle 
                                        mode={analysisMode} 
                                        onChange={setAnalysisMode}
                                    />
                                </div>

                                {/* Send Button */}
                                <button 
                                    type="submit"
                                    disabled={!input.trim() || isLoading || aiLocked} 
                                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all ${
                                        !input.trim() || isLoading || aiLocked 
                                         ? 'bg-white/5 text-gray-600 cursor-not-allowed' 
                                         : 'bg-emerald-500 text-[#091510] hover:bg-emerald-400 hover:scale-105 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                                    }`}
                                >
                                    {isLoading ? (
                                        <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <IconChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ZenAI;
