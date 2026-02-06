
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { IconX, IconBot, IconPaperclip, IconFileText, IconChevronRight, IconFolder, IconCheck, IconTrash } from '../components/Icons';
import { useZen } from '../context/ZenContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { apiFetch } from '../utils/api';
import { getPdfSignedUrl } from '../utils/pdfStorage';
import { PdfAttachment, AIChatMessage, AIAnalysisSummary } from '../types';

// ============================================================================
// TYPES
// ============================================================================

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

interface ConversationThread {
    id: string;
    title: string;
    messages: AIChatMessage[];
    createdAt: string;
    updatedAt: string;
}

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

// ============================================================================
// CONSTANTS
// ============================================================================

const ANALYSIS_SUMMARY_OPEN = '<analysis_summary>';
const ANALYSIS_SUMMARY_CLOSE = '</analysis_summary>';

// ============================================================================
// HELPERS
// ============================================================================

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

// ============================================================================
// FORMATTED AI RESPONSE - Clean markdown rendering
// ============================================================================

const FormattedAIResponse: React.FC<{ 
    text: string; 
    onCitationClick?: (citation: CitationPayload) => void;
}> = ({ text, onCitationClick }) => {
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    const parseContent = () => {
        const elements: React.ReactNode[] = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let codeBlockIndex = 0;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                const beforeText = text.slice(lastIndex, match.index);
                elements.push(...parseNonCodeText(beforeText, elements.length));
            }

            const language = match[1] || 'text';
            const code = match[2].trim();
            const blockId = `code-${codeBlockIndex}`;

            // Code block with horizontal scroll only - no page scroll
            elements.push(
                <div key={blockId} className="my-3 sm:my-4">
                    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-white/5">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-white/5">
                            <span className="text-[10px] sm:text-xs text-gray-400 font-mono">{language}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(code);
                                    setCopiedIndex(blockId);
                                    setTimeout(() => setCopiedIndex(null), 2000);
                                }}
                                className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-400 hover:text-white transition-colors min-h-[44px] px-2 -mr-2"
                                aria-label={copiedIndex === blockId ? 'Copied' : 'Copy code'}
                            >
                                {copiedIndex === blockId ? (
                                    <IconCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                                ) : (
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                                <span className="hidden sm:inline">{copiedIndex === blockId ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>
                        
                        {/* Code content with internal horizontal scroll */}
                        <div className="overflow-x-auto">
                            <pre className="p-3 sm:p-4 min-w-0">
                                <code className="text-xs sm:text-sm text-gray-300 font-mono leading-relaxed whitespace-pre">
                                    {code}
                                </code>
                            </pre>
                        </div>
                    </div>
                </div>
            );

            lastIndex = match.index + match[0].length;
            codeBlockIndex++;
        }

        if (lastIndex < text.length) {
            const afterText = text.slice(lastIndex);
            elements.push(...parseNonCodeText(afterText, elements.length));
        }

        return elements;
    };

    const parseNonCodeText = (content: string, startKey: number) => {
        const lines = content.split('\n');
        const elements: React.ReactNode[] = [];
        
        lines.forEach((line, i) => {
            const trimmed = line.trim();
            const key = `text-${startKey}-${i}`;
            
            // Headers (check most specific first: #### before ### before ## before #)
            if (trimmed.startsWith('#### ')) {
                elements.push(
                    <h4 key={key} className="text-sm sm:text-base font-semibold text-emerald-400 mt-3 sm:mt-5 mb-1.5 flex items-center gap-2">
                        <div className="w-1 h-3.5 sm:h-4 bg-emerald-500/20 rounded-full flex-shrink-0" />
                        <span className="break-words">{processInlines(trimmed.slice(5), onCitationClick)}</span>
                    </h4>
                );
                return;
            }
            if (trimmed.startsWith('### ')) {
                elements.push(
                    <h3 key={key} className="text-sm sm:text-base font-semibold text-emerald-400 mt-4 sm:mt-6 mb-2 flex items-center gap-2">
                        <div className="w-1 h-4 sm:h-5 bg-emerald-500/30 rounded-full flex-shrink-0" />
                        <span className="break-words">{processInlines(trimmed.slice(4), onCitationClick)}</span>
                    </h3>
                );
                return;
            }
            if (trimmed.startsWith('## ')) {
                elements.push(
                    <h2 key={key} className="text-base sm:text-lg font-bold text-emerald-400 mt-6 sm:mt-8 mb-3 sm:mb-4 border-b border-emerald-500/10 pb-2 break-words">
                        {processInlines(trimmed.slice(3), onCitationClick)}
                    </h2>
                );
                return;
            }
            if (trimmed.startsWith('# ')) {
                elements.push(
                    <h1 key={key} className="text-lg sm:text-xl font-bold text-emerald-400 mt-6 sm:mt-8 mb-3 sm:mb-4 border-b border-emerald-500/20 pb-2 break-words">
                        {processInlines(trimmed.slice(2), onCitationClick)}
                    </h1>
                );
                return;
            }
            // Standalone bold line as sub-header (e.g., **Section Title**)
            const standaloneBold = trimmed.match(/^\*\*(.+)\*\*$/);
            if (standaloneBold) {
                elements.push(
                    <div key={key} className="text-sm sm:text-base font-semibold text-emerald-400 mt-3 sm:mt-5 mb-1.5">
                        {processInlines(standaloneBold[1], onCitationClick)}
                    </div>
                );
                return;
            }
            
            // Labels
            if (/^[A-Z][a-z]+\s+it:$/i.test(trimmed) || trimmed === 'Call it:' || trimmed === 'Example usage:' || trimmed === 'Usage:') {
                elements.push(
                    <div key={key} className="text-xs sm:text-sm font-semibold text-white/90 mt-3 sm:mt-4 mb-1 sm:mb-2">
                        {trimmed}
                    </div>
                );
                return;
            }
            
            // Bullet points
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const bulletContent = trimmed.substring(2);
                elements.push(
                    <div key={key} className="flex gap-2 sm:gap-3 ml-1 sm:ml-2 py-0.5">
                        <span className="mt-[0.6em] h-1.5 w-1.5 rounded-full bg-emerald-500/80 flex-shrink-0" />
                        <span className="leading-relaxed text-white/80 break-words min-w-0">{processInlines(bulletContent, onCitationClick)}</span>
                    </div>
                );
                return;
            }

            // Numbered lists
            if (/^\d+\.\s/.test(trimmed)) {
                const match = trimmed.match(/^(\d+\.)\s(.*)/);
                elements.push(
                    <div key={key} className="flex gap-2 sm:gap-3 ml-2 sm:ml-4 py-0.5">
                        <span className="text-emerald-400 font-mono text-xs mt-0.5 flex-shrink-0">{match?.[1]}</span>
                        <span className="leading-relaxed text-white/80 break-words min-w-0">{processInlines(match?.[2] || "", onCitationClick)}</span>
                    </div>
                );
                return;
            }

            // Dividers
            if (trimmed.startsWith('---')) {
                elements.push(<hr key={key} className="border-white/10 my-4 sm:my-6" />);
                return;
            }

            // Empty lines
            if (trimmed === '') {
                elements.push(<div key={key} className="h-1.5 sm:h-2" />);
                return;
            }

            // Regular paragraphs
            elements.push(
                <p key={key} className="leading-relaxed text-white/80 break-words">
                    {processInlines(trimmed, onCitationClick)}
                </p>
            );
        });

        return elements;
    };
    
    return (
        <div className="space-y-2 sm:space-y-3 text-zen-text-primary text-sm sm:text-base min-w-0 overflow-hidden">
            {parseContent()}
        </div>
    );
};

// Inline markdown processing
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

        // Italic *text* (single asterisk, not double)
        const italicMatch = remaining.match(/^\*([^*]+)\*/);
        if (italicMatch) {
            parts.push(
                <em key={key++} className="text-white/90 italic">
                    {italicMatch[1]}
                </em>
            );
            remaining = remaining.slice(italicMatch[0].length);
            continue;
        }

        // Inline code `code`
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
            parts.push(
                <code key={key++} className="bg-white/10 text-emerald-300 px-1 sm:px-1.5 py-0.5 rounded text-[0.85em] font-mono break-all">
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
                   className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 break-all">
                    {linkMatch[1]}
                </a>
            );
            remaining = remaining.slice(linkMatch[0].length);
            continue;
        }

        // Citation 【Document p.X】
        const citationMatch = remaining.match(/^【([^】]+)】/);
        if (citationMatch) {
            const rawLabel = citationMatch[1].trim();
            const pageMatch = rawLabel.match(/p\.?\s*(\d+)/i);
            const page = pageMatch ? Number(pageMatch[1]) : undefined;
            const doc = rawLabel.replace(/\s*p\.?\s*\d+.*$/i, '').trim() || rawLabel;
            const citationPayload = { raw: rawLabel, doc, page };
            const chip = (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs rounded-full border border-emerald-500/30 whitespace-nowrap">
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{rawLabel}</span>
                </span>
            );

            parts.push(
                onCitationClick ? (
                    <button
                        key={key++}
                        type="button"
                        onClick={() => onCitationClick(citationPayload)}
                        title={`Open ${rawLabel}`}
                        className="inline-flex min-h-[44px] items-center -my-3"
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

        parts.push(remaining[0]);
        remaining = remaining.slice(1);
    }

    if (parts.length === 1 && typeof parts[0] === 'string') {
        return parts[0];
    }

    return <>{parts}</>;
};

// ============================================================================
// MESSAGE ACTIONS - Desktop hover, Mobile overflow menu
// ============================================================================

interface MessageActionsProps {
    messageText: string;
    messageIdx: number;
    onRegenerate: () => void;
    onContinue: () => void;
    onRewrite: (style: 'shorter' | 'simpler') => void;
    isMobile: boolean;
}

const MessageActions: React.FC<MessageActionsProps> = ({ 
    messageText, 
    onRegenerate, 
    onContinue, 
    onRewrite,
    isMobile
}) => {
    const [copied, setCopied] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(messageText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [messageText]);

    // Close menu on outside click
    useEffect(() => {
        if (!showMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const actions = useMemo(() => [
        { icon: '↻', label: 'Regenerate', onClick: onRegenerate },
        { icon: '→', label: 'Continue', onClick: onContinue },
        { icon: '−', label: 'Shorter', onClick: () => onRewrite('shorter') },
        { icon: '◯', label: 'Simpler', onClick: () => onRewrite('simpler') },
        { icon: copied ? '✓' : '⎘', label: copied ? 'Copied!' : 'Copy', onClick: handleCopy },
    ], [onRegenerate, onContinue, onRewrite, copied, handleCopy]);

    // Mobile: overflow menu with 44px min tap targets
    if (isMobile) {
        return (
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 active:text-white transition-colors rounded-lg"
                    aria-label="Message options"
                    aria-expanded={showMenu}
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
                        <div className="absolute right-0 bottom-full mb-2 bg-[#1C2128] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px] animate-scale-in">
                            {actions.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        action.onClick();
                                        if (action.label !== 'Copy' && action.label !== 'Copied!') setShowMenu(false);
                                    }}
                                    className="w-full min-h-[48px] px-4 text-left text-sm text-gray-300 hover:bg-white/5 active:bg-white/10 flex items-center gap-3 transition-colors"
                                >
                                    <span className="text-base w-5 text-center">{action.icon}</span>
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Desktop: hover toolbar
    return (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {actions.map((action, i) => (
                <button
                    key={i}
                    onClick={action.onClick}
                    className="min-h-[36px] px-2.5 py-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all text-xs flex items-center gap-1.5"
                    title={action.label}
                >
                    <span>{action.icon}</span>
                    <span className="hidden lg:inline">{action.label}</span>
                </button>
            ))}
        </div>
    );
};

// ============================================================================
// MODE TOGGLE
// ============================================================================

const ModeToggle: React.FC<{
    mode: 'fast' | 'deep';
    onChange: (mode: 'fast' | 'deep') => void;
}> = ({ mode, onChange }) => {
    return (
        <button
            type="button"
            onClick={() => onChange(mode === 'fast' ? 'deep' : 'fast')}
            className={`h-9 sm:h-10 px-3 sm:px-4 rounded-xl border text-[10px] sm:text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 min-w-[70px] sm:min-w-[80px] justify-center ${
                mode === 'deep'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : 'border-white/10 text-gray-400 bg-white/5 hover:text-white hover:bg-white/10 active:bg-white/15'
            }`}
            aria-label={`Switch to ${mode === 'fast' ? 'deep' : 'fast'} mode`}
        >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mode === 'deep' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
            <span>{mode === 'deep' ? 'Deep' : 'Fast'}</span>
        </button>
    );
};

// ============================================================================
// COLLAPSIBLE THINKING PANEL
// ============================================================================

interface ThinkingPanelProps {
    text: string;
    isStreaming?: boolean;
    isOpen: boolean;
    onToggle: () => void;
}

const ThinkingPanel: React.FC<ThinkingPanelProps> = ({ text, isStreaming, isOpen, onToggle }) => {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isStreaming && isOpen && panelRef.current) {
            panelRef.current.scrollTop = panelRef.current.scrollHeight;
        }
    }, [text, isStreaming, isOpen]);

    return (
        <div className="mb-2">
            <button
                type="button"
                onClick={onToggle}
                className="flex items-center gap-2 text-xs text-emerald-400/80 hover:text-emerald-400 transition-colors min-h-[44px] -ml-1 px-1"
                aria-expanded={isOpen}
            >
                <IconChevronRight className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                <span className="flex items-center gap-1.5">
                    {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                    {isStreaming ? 'Thinking...' : 'Thought process'}
                </span>
            </button>
            
            {isOpen && (
                <div 
                    ref={panelRef}
                    className="mt-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[13px] text-gray-400 leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words"
                >
                    {text}
                    {isStreaming && <span className="inline-block w-1.5 h-3 bg-emerald-400/60 animate-pulse ml-0.5 align-middle" aria-hidden="true" />}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ZenAI: React.FC<ZenAIProps> = ({ onClose }) => {
    const { state, updateTask, updateFolder, setAIChat, clearAIChat, isHydrated } = useZen();
    const { user } = useAuth();
    
    // Core state
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRefs, setSelectedRefs] = useState<SelectedRef[]>([]);
    const [showSelector, setShowSelector] = useState(false);
    const [selectorTab, setSelectorTab] = useState<'library' | 'tasks'>('library');
    
    // Billing
    const [isPremium, setIsPremium] = useState(false);
    const [billingChecked, setBillingChecked] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    
    // Streaming
    const [thinkingContext, setThinkingContext] = useState('Formulating response...');
    const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('fast');
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [streamingThinking, setStreamingThinking] = useState('');
    
    // Scroll behavior
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);
    const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
    
    // Threads
    const [threads, setThreads] = useState<ConversationThread[]>([]);
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [showThreadsSidebar, setShowThreadsSidebar] = useState(false);
    
    // Thinking panels
    const [openThinkingPanels, setOpenThinkingPanels] = useState<Record<string, boolean>>({});
    
    // Responsive
    const [isMobile, setIsMobile] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const hasShownUpgradeOnceRef = useRef(false);
    const pdfTextCacheRef = useRef<Map<string, PdfExtractResult>>(new Map());
    const hasLoadedChatRef = useRef(false);
    const hasAppliedRemoteChatRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastScrollTopRef = useRef(0);

    // Constants
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
    const SCROLL_THRESHOLD = 100; // px from bottom to consider "at bottom"

    // ========================================================================
    // RESPONSIVE DETECTION
    // ========================================================================

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setWindowWidth(width);
            setIsMobile(width < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ========================================================================
    // CHATGPT-STYLE SCROLL BEHAVIOR
    // ========================================================================

    const isNearBottom = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        const { scrollTop, scrollHeight, clientHeight } = container;
        return scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
    }, []);

    const scrollToBottom = useCallback((force = false) => {
        const container = messagesContainerRef.current;
        if (!container) return;
        
        // Only auto-scroll if user hasn't scrolled up OR force is true
        if (force || (!userHasScrolledUp && isNearBottom())) {
            container.scrollTo({ 
                top: container.scrollHeight, 
                behavior: force ? 'smooth' : 'auto' 
            });
            setUserHasScrolledUp(false);
            setShowJumpToLatest(false);
        }
    }, [userHasScrolledUp, isNearBottom]);

    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const currentScrollTop = container.scrollTop;
        const isAtBottom = isNearBottom();
        
        // Detect if user scrolled UP
        if (currentScrollTop < lastScrollTopRef.current && !isAtBottom) {
            setUserHasScrolledUp(true);
        }
        
        // If user scrolled back to bottom, reset
        if (isAtBottom) {
            setUserHasScrolledUp(false);
        }
        
        // Show jump button only when scrolled up during streaming/loading
        setShowJumpToLatest(!isAtBottom && (isStreaming || isLoading));
        
        lastScrollTopRef.current = currentScrollTop;
    }, [isStreaming, isLoading, isNearBottom]);

    // Auto-scroll on new messages (only if at bottom)
    useEffect(() => {
        if (!userHasScrolledUp) {
            scrollToBottom();
        }
    }, [messages.length, scrollToBottom, userHasScrolledUp]);

    // Auto-scroll during streaming (only if at bottom)
    useEffect(() => {
        if (isStreaming && !userHasScrolledUp) {
            scrollToBottom();
        }
    }, [streamingText, isStreaming, scrollToBottom, userHasScrolledUp]);

    // ========================================================================
    // PERSISTENCE
    // ========================================================================

    const isSameChat = (a: AIChatMessage[], b: AIChatMessage[]) => {
        if (a === b) return true;
        if (a.length !== b.length) return false;
        if (a.length === 0) return true;
        const lastA = a[a.length - 1];
        const lastB = b[b.length - 1];
        if (!lastA || !lastB) return false;
        return lastA.role === lastB.role && lastA.text === lastB.text && lastA.createdAt === lastB.createdAt;
    };

    // Load chat from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(CHAT_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setMessages(parsed);
                }
            }
        } catch (_) {}
        hasLoadedChatRef.current = true;
    }, []);

    // Sync with remote
    useEffect(() => {
        if (!hasLoadedChatRef.current || !isHydrated || !user?.emailVerified || hasAppliedRemoteChatRef.current) return;
        if (Array.isArray(state.aiChat) && state.aiChat.length > 0) {
            setMessages(state.aiChat);
        } else if (messages.length > 0) {
            setAIChat(messages);
        }
        hasAppliedRemoteChatRef.current = true;
    }, [isHydrated, user?.emailVerified, state.aiChat, messages, setAIChat]);

    // Save to localStorage and remote
    useEffect(() => {
        if (!hasLoadedChatRef.current) return;
        const trimmed = messages.slice(-MAX_SAVED_MESSAGES);
        try {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
        } catch (_) {}

        if (!isHydrated || !user?.emailVerified || !hasAppliedRemoteChatRef.current) return;
        if (!isSameChat(trimmed, state.aiChat || [])) {
            setAIChat(trimmed);
        }
    }, [messages, isHydrated, user?.emailVerified, state.aiChat, setAIChat]);

    // Load analysis mode
    useEffect(() => {
        try {
            const saved = localStorage.getItem(ANALYSIS_MODE_KEY);
            if (saved === 'deep' || saved === 'fast') setAnalysisMode(saved);
        } catch (_) {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(ANALYSIS_MODE_KEY, analysisMode);
        } catch (_) {}
    }, [analysisMode]);

    // Load threads
    useEffect(() => {
        try {
            const saved = localStorage.getItem(THREADS_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) setThreads(parsed);
            }
        } catch (_) {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads.slice(0, 20)));
        } catch (_) {}
    }, [threads]);

    // ========================================================================
    // BILLING
    // ========================================================================

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
    }, [allowFreeAI]);

    const aiLocked = allowFreeAI ? false : (billingChecked ? !isPremium : true);

    useEffect(() => {
        if (allowFreeAI || !billingChecked || !aiLocked || hasShownUpgradeOnceRef.current) return;
        hasShownUpgradeOnceRef.current = true;
        setShowUpgradeModal(true);
    }, [allowFreeAI, billingChecked, aiLocked]);

    // ========================================================================
    // TEXTAREA AUTO-RESIZE
    // ========================================================================

    useEffect(() => {
        if (!textareaRef.current) return;
        textareaRef.current.style.height = '0px';
        const next = Math.min(textareaRef.current.scrollHeight, 160);
        textareaRef.current.style.height = `${Math.max(next, 44)}px`;
    }, [input]);

    // ========================================================================
    // HELPERS
    // ========================================================================

    const openBilling = () => {
        onClose();
        window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'plans' } }));
    };

    const clearChat = () => {
        setMessages([]);
        setInput('');
        setSelectedRefs([]);
        setUserHasScrolledUp(false);
        try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch (_) {}
        clearAIChat();
    };

    const toggleRef = (ref: SelectedRef) => {
        setSelectedRefs(prev => 
            prev.find(r => r.id === ref.id && r.source === ref.source && r.folderId === ref.folderId) 
                ? prev.filter(r => !(r.id === ref.id && r.source === ref.source && r.folderId === ref.folderId))
                : [...prev, ref]
        );
    };

    const toggleThinkingPanel = useCallback((key: string) => {
        setOpenThinkingPanels(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // ========================================================================
    // PDF EXTRACTION
    // ========================================================================

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

            // OCR fallback
            const Tesseract = (window as any).Tesseract;
            if (!Tesseract) return emptyResult;

            const ocrPreset = analysisMode === 'deep'
                ? { pages: MAX_OCR_PAGES, scale: OCR_SCALE, maxChars: MAX_OCR_TEXT_CHARS }
                : { pages: 2, scale: 1.5, maxChars: 4000 };

            setThinkingContext('No text found, running OCR...');
            const ocrPages = Math.min(totalPages, ocrPreset.pages);
            plainText = '';
            markedText = '';
            pagesRead = 0;

            for (let pageNum = 1; pageNum <= ocrPages; pageNum += 1) {
                pagesRead += 1;
                setThinkingContext(`OCR page ${pageNum}/${ocrPages}...`);
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
            if (!task?.pdfAttachment) return;
            updateTask({
                ...task,
                pdfAttachment: { ...task.pdfAttachment, text, textUpdatedAt: updatedAt },
            });
            return;
        }
        if (ref.source === 'library' && ref.folderId) {
            const folder = state.folders.find(f => f.id === ref.folderId);
            if (!folder) return;
            const updatedItems = folder.items.map(item => {
                if (item.id !== ref.id || !item.file) return item;
                return { ...item, file: { ...item.file, text, textUpdatedAt: updatedAt } };
            });
            updateFolder({ ...folder, items: updatedItems });
        }
    };

    // ========================================================================
    // CITATION HANDLING
    // ========================================================================

    const citationTargets = useMemo(() => {
        const targets: { title: string; file?: PdfAttachment; dataUrl?: string }[] = [];
        state.folders.forEach(folder => {
            folder.items.forEach(item => {
                if (item.type !== 'pdf') return;
                const legacyData = item.content?.startsWith('data:') ? item.content : undefined;
                targets.push({ title: item.title, file: item.file, dataUrl: legacyData });
            });
        });
        state.tasks.forEach(task => {
            if (!task.pdfAttachment) return;
            const legacyData = (task.pdfAttachment as any)?.data;
            const dataUrl = legacyData?.startsWith('data:') ? legacyData : undefined;
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
            try { await navigator.clipboard.writeText(`【${rawLabel}】`); } catch (_) {}
        };

        if (!target) {
            await copyFallback();
            return;
        }

        try {
            let url = target.file?.url;
            if (!url && target.file?.key) url = await getPdfSignedUrl(target.file.key);
            if (!url && target.dataUrl) url = target.dataUrl;
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

    // ========================================================================
    // INPUT HANDLING
    // ========================================================================

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!input.trim() || isLoading) return;
            formRef.current?.requestSubmit();
        }
    };

    // ========================================================================
    // MESSAGE ACTIONS
    // ========================================================================

    const handleRegenerate = useCallback((messageIdx: number) => {
        const userMessages = messages.slice(0, messageIdx).filter(m => m.role === 'user');
        const lastUserMsg = userMessages[userMessages.length - 1];
        if (lastUserMsg) {
            setMessages(prev => prev.slice(0, messageIdx));
            setInput(lastUserMsg.text);
            setTimeout(() => formRef.current?.requestSubmit(), 100);
        }
    }, [messages]);

    const handleContinue = useCallback(() => {
        setInput('Continue from where you left off.');
        setTimeout(() => formRef.current?.requestSubmit(), 100);
    }, []);

    const handleRewrite = useCallback((messageIdx: number, style: 'shorter' | 'simpler') => {
        const aiMsg = messages[messageIdx];
        if (!aiMsg || aiMsg.role !== 'ai') return;
        const prompt = style === 'shorter' 
            ? `Please rewrite this more concisely:\n\n${aiMsg.text}`
            : `Please rewrite this in simpler terms:\n\n${aiMsg.text}`;
        setInput(prompt);
        setTimeout(() => formRef.current?.requestSubmit(), 100);
    }, [messages]);

    const stopStreaming = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    // ========================================================================
    // SEND MESSAGE
    // ========================================================================

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const trimmedInput = input.trim();
        
        // Reset scroll state when sending
        setUserHasScrolledUp(false);

        // Special handlers
        const isCreatorQuestion = /\b(who made you|who created you|who built you|your creator|who is your creator)\b/i.test(trimmedInput);
        const isTechStackQuestion = /\b(tech stack|technology stack|stack used|built with|built using)\b/i.test(trimmedInput);

        // Coupon handling
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data?.error || 'Invalid coupon');
                if (data?.direct && data?.billing) {
                    setMessages(prev => [...prev, { role: 'ai', text: '### Coupon accepted\nPremium is now active.', createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
                    window.dispatchEvent(new CustomEvent('billing-updated', { detail: { plan: 'premium', billing: data.billing } }));
                    return;
                }
                if (!data?.checkoutUrl) throw new Error('Invalid coupon');
                setMessages(prev => [...prev, { role: 'ai', text: '### Coupon accepted\nRedirecting...', createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
                window.location.href = data.checkoutUrl;
            } catch (_) {
                setMessages(prev => [...prev, { role: 'ai', text: '### Invalid coupon\nThis password is not valid.', createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
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
        setThinkingContext(currentRefs.length > 0 ? 'Reading documents...' : 'Thinking...');
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
            // Detect task types
            const isAcademicTask = currentRefs.some(ref => {
                const combined = `${ref.title.toLowerCase()} ${(ref.content || '').slice(0, 3000).toLowerCase()}`;
                const taskSignals = [
                    /\b(answer the following|questions?|activities?|instructions|procedure|requirements|rubric)\b/i,
                    /\b(task\s*\d+|activity\s*\d+|exercise\s*\d+)\b/i,
                    /\b(write a program|implement|create a function)\b/i,
                ];
                return taskSignals.reduce((acc, re) => acc + (re.test(combined) ? 1 : 0), 0) >= 2;
            });

            const isProgrammingTask = currentRefs.some(ref => {
                const combined = `${ref.title.toLowerCase()} ${(ref.content || '').slice(0, 3000).toLowerCase()} ${userQuery.toLowerCase()}`;
                const keywords = ['function', 'program', 'code', 'implement', 'algorithm', 'syntax', 'method', 'class', 'loop'];
                return keywords.some(k => combined.includes(k));
            });

            const isAnswerRequest = /^(answer|solve|do|complete|finish|work on)\b/i.test(userQuery.trim());
            const isSummaryIntent = /\b(summarize|summary|analyze|analysis|key points|overview|explain)\b/i.test(userQuery);
            let useStudentMode = isAcademicTask && isAnswerRequest && !isSummaryIntent;

            // Build system prompt
            let systemPrompt = '';
            const FORMATTING_RULES = `
FORMATTING RULES (strictly follow):
- Use ## for major section headings.
- Use ### for sub-section headings.
- Use #### for smaller sub-headings.
- NEVER use **bold** as a heading. Always use ## / ### / #### instead.
- Use **bold** ONLY for inline emphasis within a sentence.
- Use - for bullet points. Keep each bullet on ONE line.
- For numbered lists, keep the number and text on the SAME line (e.g., "1. Content here").
- Use --- between major sections to create visual separation.
- Do NOT output raw markdown symbols that won't render (no stray # or * at line starts unless they are proper headers or bullets).
- Never truncate mid-sentence. If running long, finish the current section cleanly.
- At the end of every response, add a brief helpful tip, suggestion, or recommendation related to the topic.`;

            if (useStudentMode && isProgrammingTask) {
                systemPrompt = `You are Zen, an AI academic assistant in PROGRAMMING ANSWER MODE.
Output submission-ready code. No explanations inside code blocks.
${FORMATTING_RULES}
If asked who made you: "Sean John Camara from STI College Fairview, BSCS."
If asked tech stack: "MERN Stack."`;
            } else if (useStudentMode) {
                systemPrompt = `You are Zen, an AI academic assistant in STUDENT ANSWER MODE.
Produce submission-ready work. No restating requirements. Be concrete.
${FORMATTING_RULES}
If asked who made you: "Sean John Camara from STI College Fairview, BSCS."
If asked tech stack: "MERN Stack."`;
            } else {
                systemPrompt = `You are Zen, an educational AI. Be direct, minimal, accurate.
Lead with the answer. Use plain language.
${FORMATTING_RULES}
If asked who made you: "Sean John Camara from STI College Fairview, BSCS."
If asked tech stack: "MERN Stack."`;
            }

            const redact = (value: string) => value
                .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***')
                .replace(/mongodb\+srv:\/\/[^@\s]+@/g, 'mongodb+srv://***@');

            // Build task/calendar context so AI knows about user's tasks
            const now = new Date();
            const taskContextLines: string[] = [];
            const tasksWithPdfs: string[] = [];
            if (state.tasks.length > 0) {
                state.tasks.forEach(task => {
                    const subjectName = task.subjectId ? state.subjects.find(s => s.id === task.subjectId)?.name : null;
                    const dueDate = new Date(task.dueDate);
                    const isPastDue = !task.completed && dueDate < now;
                    const status = task.completed ? 'Completed' : isPastDue ? 'Past Due' : 'Pending';
                    let line = `- "${task.title}" | Subject: ${subjectName || 'None'} | Due: ${dueDate.toLocaleString()} | Status: ${status}`;
                    if (task.notes) line += ` | Notes: ${task.notes}`;
                    if (task.pdfAttachment?.name) {
                        line += ` | PDF Attached: "${task.pdfAttachment.name}"`;
                        tasksWithPdfs.push(task.title);
                    }
                    taskContextLines.push(line);
                });
            }

            const taskContext = taskContextLines.length > 0
                ? `\nUSER'S TASKS/CALENDAR (current date: ${now.toLocaleDateString()}):\n${taskContextLines.join('\n')}\n`
                : `\nUSER'S TASKS/CALENDAR: The user has no tasks.\n`;

            // Add PDF instruction to system prompt if any tasks have PDFs
            if (tasksWithPdfs.length > 0) {
                systemPrompt += `\n\nIMPORTANT: Some tasks have PDF attachments. You can see which tasks have PDFs in the task list above. However, you CANNOT read or scan PDF contents on your own. If the user asks about a PDF's contents, tell them: "To read that PDF, tap the 📎 attach button below, select the PDF from your Library or Tasks, and I'll be able to read its contents." Do NOT claim you can scan or read the PDF without the user attaching it first. Do NOT repeatedly ask "Would you like me to scan it?" — you cannot initiate scans.`;
            }

            let userMessage = '';
            let resolvedRefs: ResolvedRef[] = [];

            if (currentRefs.length > 0) {
                userMessage += `CITATION RULES:\n- Cite document claims with 【Document Name p.X】\n- Place citations at the END of the bullet point or paragraph, never mid-sentence.\n- After the first mention, use the short form 【p.X】 instead of repeating the full document name.\n\n`;
            }

            if (currentRefs.length > 0) {
                resolvedRefs = await Promise.all(currentRefs.map(async (ref) => {
                    if (ref.type !== 'pdf') {
                        const content = (ref.content || '').trim();
                        return { ...ref, markedContent: content, meta: { pagesRead: 0, totalPages: 0, usedOCR: false, extractedChars: content.length } };
                    }

                    let extraction: PdfExtractResult | null = null;
                    if (ref.file?.key) {
                        try {
                            const url = ref.file.url || await getPdfSignedUrl(ref.file.key);
                            extraction = await extractPdfText(url, ref.file.key || ref.id);
                        } catch (_) {}
                    } else if (ref.legacyData?.startsWith('data:')) {
                        extraction = await extractPdfText(ref.legacyData, ref.id);
                    } else if (ref.content?.startsWith('data:')) {
                        extraction = await extractPdfText(ref.content, ref.id);
                    }

                    if (!extraction && ref.file?.text) {
                        const plain = ref.file.text.trim();
                        extraction = { plainText: plain, markedText: plain, pagesRead: 0, totalPages: 0, usedOCR: false, extractedChars: plain.length };
                    }

                    const content = extraction?.plainText || '';
                    const markedContent = extraction?.markedText || content;
                    const meta = {
                        pagesRead: extraction?.pagesRead || 0,
                        totalPages: extraction?.totalPages || 0,
                        usedOCR: extraction?.usedOCR || false,
                        extractedChars: extraction?.extractedChars || content.length,
                    };

                    if (content) persistPdfText(ref, content);
                    return { ...ref, content, markedContent, meta };
                }));

                const perDocLimit = Math.max(MIN_CONTEXT_CHARS_PER_DOC, Math.floor(MAX_CONTEXT_CHARS / Math.max(resolvedRefs.length, 1)));
                userMessage += `CONTEXT:\n\n`;
                
                resolvedRefs.forEach(ref => {
                    let content = (ref.markedContent || ref.content || '').trim();
                    if (ref.type === 'pdf' && !content) {
                        content = "No readable text extracted from this PDF.";
                    }
                    if (content.length > perDocLimit) {
                        content = `${content.slice(0, perDocLimit)}... [truncated]`;
                    }
                    userMessage += `[Document: ${redact(ref.title)}]\n${redact(content)}\n---\n\n`;
                });
            }

            const baseSummary: AnalysisInfo = { mode: analysisMode, documents: [], totalChars: 0, pagesReadTotal: 0, ocrUsed: false };
            let contextSummary: AnalysisInfo = baseSummary;
            
            if (resolvedRefs.length > 0) {
                const documents = resolvedRefs.map(ref => ({
                    name: ref.title,
                    pages: ref.meta.pagesRead,
                    chars: ref.meta.extractedChars,
                    usedOCR: ref.meta.usedOCR,
                }));
                contextSummary = {
                    mode: analysisMode,
                    documents,
                    totalChars: documents.reduce((sum, doc) => sum + doc.chars, 0),
                    pagesReadTotal: documents.reduce((sum, doc) => sum + doc.pages, 0),
                    ocrUsed: documents.some(doc => doc.usedOCR),
                };
            }
            
            setThinkingContext('Connecting...');
            userMessage += taskContext;
            userMessage += `\nQUESTION:\n${redact(userQuery)}`;
            const prompt = `${systemPrompt}\n\n${userMessage}`;
            const recentHistory = messages.slice(-12).map(msg => ({ role: msg.role, text: msg.text }));

            setIsStreaming(true);
            setStreamingText('');
            setStreamingThinking('');
            setOpenThinkingPanels(prev => ({ ...prev, 'thinking-streaming': true }));
            abortControllerRef.current = new AbortController();

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
                        contextInfo: resolvedRefs.length > 0 ? {
                            documents: contextSummary.documents,
                            totalChars: contextSummary.totalChars,
                            pagesReadTotal: contextSummary.pagesReadTotal,
                            ocrUsed: contextSummary.ocrUsed,
                        } : null,
                    }),
                    signal: abortControllerRef.current.signal,
                });

                if (!streamResponse.ok) throw new Error(`Stream failed: ${streamResponse.status}`);

                const reader = streamResponse.body?.getReader();
                if (!reader) throw new Error('No response body');

                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';
                let fullThinking = '';
                let responseTimeMs = 0;

                setThinkingContext('');

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const sseMessages = buffer.split('\n\n');
                    buffer = sseMessages.pop() || '';

                    for (const message of sseMessages) {
                        if (!message.trim()) continue;
                        
                        const lines = message.split('\n');
                        let eventType = '';
                        let eventData = '';
                        
                        for (const line of lines) {
                            if (line.startsWith('event:')) eventType = line.slice(6).trim();
                            else if (line.startsWith('data:')) eventData = line.slice(5).trim();
                        }
                        
                        if (!eventType || !eventData) continue;
                        
                        try {
                            const data = JSON.parse(eventData);
                            
                            switch (eventType) {
                                case 'meta':
                                    setThinkingContext('');
                                    break;
                                case 'thinking':
                                    if (data.text) {
                                        fullThinking += data.text;
                                        setStreamingThinking(fullThinking);
                                    }
                                    break;
                                case 'delta':
                                    if (data.text) {
                                        fullText += data.text;
                                        setStreamingText(fullText);
                                    }
                                    break;
                                case 'done':
                                    responseTimeMs = data.responseTimeMs || 0;
                                    break;
                                case 'error':
                                    throw new Error(data.message || 'Stream error');
                            }
                        } catch (parseErr) {
                            console.warn('SSE parse error:', parseErr);
                        }
                    }
                }

                if (fullText) {
                    const cleanedText = stripAnalysisSummaryBlock(fullText);
                    setMessages(prev => [...prev, { 
                        role: 'ai', 
                        text: cleanedText || fullText, 
                        createdAt: new Date().toISOString(),
                        id: crypto.randomUUID(),
                        thinking: fullThinking || undefined,
                    }]);
                } else {
                    throw new Error('No response received');
                }

            } catch (streamErr: any) {
                if (streamErr.name === 'AbortError') {
                    if (streamingText) {
                        const cleanedText = stripAnalysisSummaryBlock(streamingText);
                        setMessages(prev => [...prev, { 
                            role: 'ai', 
                            text: (cleanedText || streamingText) + '\n\n*[Stopped]*', 
                            createdAt: new Date().toISOString(),
                            id: crypto.randomUUID(),
                        }]);
                    }
                    return;
                }
                throw streamErr;
            }
        } catch (error: any) {
            console.error("Zen AI Error:", error);
            let errorMessage = `### Error\n${error.message || 'Unknown error'}`;
            if (error.message?.includes('401')) errorMessage = "### Sign In Required\nPlease sign in again.";
            else if (error.message?.includes('402')) errorMessage = "### Premium Required\nUpgrade to use Zen AI.";
            else if (error.message?.includes('429')) errorMessage = "### Rate Limited\nPlease wait and try again.";
            setMessages(prev => [...prev, { role: 'ai', text: errorMessage, createdAt: new Date().toISOString(), id: crypto.randomUUID() }]);
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setStreamingText('');
            abortControllerRef.current = null;
        }
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div 
            className="fixed inset-0 bg-[#0A0C0F] z-[110] flex flex-col overflow-hidden font-sans"
            role="dialog"
            aria-label="Zen AI Chat"
        >
            {/* ================================================================
                HEADER - Fixed, responsive
            ================================================================ */}
            <header className="flex-shrink-0 px-3 sm:px-4 pt-4 pb-3 border-b border-white/5 bg-[#0A0C0F]/95 backdrop-blur-xl sticky top-0 z-20 safe-area-top">
                <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {/* Sidebar toggle - 44px min touch */}
                        <button
                            onClick={() => setShowThreadsSidebar(!showThreadsSidebar)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/50 hover:text-emerald-400 transition-colors"
                            aria-label="Toggle conversations"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                        </button>
                        
                        {/* Logo */}
                        <div className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                            <IconBot className="w-5 h-5" />
                        </div>
                        
                        {/* Title - hidden on very small screens */}
                        <div className="hidden xs:block min-w-0">
                            <h1 className="text-base sm:text-lg font-medium text-white truncate">Zen AI</h1>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-500/80 font-semibold">Active</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* New chat */}
                        <button
                            onClick={() => {
                                if (messages.length > 0) {
                                    const newThread: ConversationThread = {
                                        id: Date.now().toString(),
                                        title: messages[0]?.text.slice(0, 50) + (messages[0]?.text.length > 50 ? '...' : '') || 'New Chat',
                                        messages,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString()
                                    };
                                    setThreads(prev => [newThread, ...prev.slice(0, 19)]);
                                }
                                clearChat();
                            }}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-emerald-500/10 active:bg-emerald-500/20 text-white/50 hover:text-emerald-400 transition-colors"
                            aria-label="New chat"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        
                        {/* Clear */}
                        <button
                            onClick={clearChat}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/50 hover:text-white transition-colors"
                            aria-label="Clear chat"
                        >
                            <IconTrash className="w-5 h-5" />
                        </button>
                        
                        {/* Close */}
                        <button 
                            onClick={onClose} 
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/10 active:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
                            aria-label="Close"
                        >
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ================================================================
                THREADS SIDEBAR - Mobile drawer
            ================================================================ */}
            {showThreadsSidebar && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" 
                        onClick={() => setShowThreadsSidebar(false)} 
                        aria-hidden="true"
                    />
                    <aside 
                        className="fixed left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-[#0D1117] border-r border-white/10 z-40 flex flex-col animate-slide-in-left"
                        role="navigation"
                        aria-label="Conversation history"
                    >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between safe-area-top pt-4">
                            <h2 className="text-sm font-semibold text-white">Conversations</h2>
                            <button
                                onClick={() => setShowThreadsSidebar(false)}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                                aria-label="Close sidebar"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 overscroll-contain">
                            {threads.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-xs">
                                    <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    No saved conversations
                                </div>
                            ) : (
                                threads.map((thread) => (
                                    <button
                                        key={thread.id}
                                        onClick={() => {
                                            setMessages(thread.messages);
                                            setCurrentThreadId(thread.id);
                                            setShowThreadsSidebar(false);
                                            setUserHasScrolledUp(false);
                                        }}
                                        className={`w-full text-left p-3 rounded-xl mb-1 transition-all group min-h-[60px] ${
                                            currentThreadId === thread.id
                                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                : 'bg-white/5 hover:bg-white/10 active:bg-white/15 border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white truncate">{thread.title}</p>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    {thread.messages.length} msgs • {new Date(thread.updatedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setThreads(prev => prev.filter(t => t.id !== thread.id));
                                                    if (currentThreadId === thread.id) setCurrentThreadId(null);
                                                }}
                                                className="min-h-[44px] min-w-[44px] flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-all -mr-2"
                                                aria-label="Delete conversation"
                                            >
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>
                </>
            )}

            {/* ================================================================
                UPGRADE MODAL
            ================================================================ */}
            {showUpgradeModal && aiLocked && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
                    <div className="relative w-full sm:max-w-md bg-[#0D1117] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-up sm:animate-scale-in safe-area-bottom">
                        <div className="p-5 sm:p-6 border-b border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                    <IconBot className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">Premium</p>
                                    <h3 className="text-lg text-white font-medium">Unlock Zen AI</h3>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400">Get deep document analysis and AI-powered features.</p>
                        </div>
                        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-xl bg-white/5 text-center">
                                    <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Monthly</p>
                                    <p className="text-xl text-white font-medium">₱149</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 text-center">
                                    <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Yearly</p>
                                    <p className="text-xl text-white font-medium">₱1490</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 pt-2">
                                <button 
                                    onClick={openBilling} 
                                    className="min-h-[48px] w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#091510] font-bold text-sm uppercase tracking-wider rounded-xl transition-colors"
                                >
                                    Upgrade Now
                                </button>
                                <button 
                                    onClick={() => setShowUpgradeModal(false)} 
                                    className="min-h-[48px] w-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-gray-400 hover:text-white font-medium text-sm rounded-xl transition-colors"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================
                MESSAGES AREA - Full width, proper scroll
            ================================================================ */}
            <main 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar"
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
            >
                <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                    
                    {/* Billing check */}
                    {!billingChecked && (
                        <div className="py-2 px-3 rounded-lg bg-white/5 text-center text-xs text-gray-500 animate-pulse">
                            Checking subscription...
                        </div>
                    )}
                    
                    {/* ============================================================
                        EMPTY STATE
                    ============================================================ */}
                    {messages.length === 0 && !isLoading && (
                        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-8">
                            <div className="mb-6 sm:mb-8">
                                <IconBot className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                            </div>
                            
                            <h2 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-3 sm:mb-4">
                                How can I help?
                            </h2>
                            <p className="text-sm sm:text-base text-gray-400 max-w-md mb-8 sm:mb-12">
                                Attach documents or ask any question.
                            </p>
                            
                            {/* Suggestion cards - stack on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
                                <button
                                    disabled={aiLocked}
                                    onClick={() => setInput("What tasks are due this week and how should I prioritize them?")}
                                    className={`p-4 sm:p-5 rounded-xl border text-left transition-all ${
                                        aiLocked ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 active:bg-emerald-500/10'
                                    }`}
                                >
                                    <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider mb-2">Plan</p>
                                    <p className="text-sm sm:text-base text-white">"What's due this week and how should I prioritize?"</p>
                                </button>

                                <button
                                    disabled={aiLocked}
                                    onClick={() => setInput("Help me break down my upcoming tasks into smaller steps")}
                                    className={`p-4 sm:p-5 rounded-xl border text-left transition-all ${
                                        aiLocked ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5 active:bg-purple-500/10'
                                    }`}
                                >
                                    <p className="text-[10px] text-purple-400 uppercase font-bold tracking-wider mb-2">Organize</p>
                                    <p className="text-sm sm:text-base text-white">"Break down my tasks into smaller steps"</p>
                                </button>

                                <button
                                    disabled={aiLocked}
                                    onClick={() => setInput("Create a study schedule for my past due and upcoming deadlines")}
                                    className={`p-4 sm:p-5 rounded-xl border text-left transition-all ${
                                        aiLocked ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 active:bg-amber-500/10'
                                    }`}
                                >
                                    <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider mb-2">Schedule</p>
                                    <p className="text-sm sm:text-base text-white">"Create a study schedule for my deadlines"</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ============================================================
                        MESSAGE LIST
                    ============================================================ */}
                    {messages.map((msg, idx) => {
                        const messageKey = msg.id || `${idx}-${msg.createdAt || ''}`;
                        const displayText = msg.role === 'ai' ? stripAnalysisSummaryBlock(msg.text) : msg.text;
                        const isUser = msg.role === 'user';
                        
                        return (
                            <div 
                                key={messageKey} 
                                className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                            >
                                {/* Document refs */}
                                {msg.refs && msg.refs.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2 max-w-full">
                                        {msg.refs.map((r, i) => (
                                            <span key={i} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 truncate max-w-[150px] sm:max-w-[200px]">
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Thinking panel (AI messages only) */}
                                {!isUser && msg.thinking && (
                                    <ThinkingPanel
                                        text={msg.thinking}
                                        isOpen={Boolean(openThinkingPanels[`thinking-${messageKey}`])}
                                        onToggle={() => toggleThinkingPanel(`thinking-${messageKey}`)}
                                    />
                                )}
                                
                                {/* Message bubble - readable width, full mobile */}
                                <div 
                                    className={`p-3 sm:p-4 rounded-2xl text-sm sm:text-base leading-relaxed min-w-0 ${
                                        isUser 
                                            ? 'max-w-[85%] sm:max-w-[75%] bg-white/10 text-white rounded-br-md' 
                                            : 'w-full sm:max-w-[85%] lg:max-w-[75%] bg-gradient-to-br from-white/5 to-transparent border border-white/5 text-gray-200 rounded-bl-md'
                                    }`}
                                >
                                    {isUser ? (
                                        <p className="whitespace-pre-wrap break-words">{displayText}</p>
                                    ) : (
                                        <FormattedAIResponse text={displayText} onCitationClick={handleCitationClick} />
                                    )}
                                    
                                    {/* Message actions */}
                                    {!isUser && !isStreaming && (
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

                    {/* ============================================================
                        STREAMING RESPONSE
                    ============================================================ */}
                    {isStreaming && (
                        <div className="flex flex-col items-start">
                            {/* Live thinking stream */}
                            {streamingThinking && (
                                <ThinkingPanel
                                    text={streamingThinking}
                                    isStreaming
                                    isOpen={Boolean(openThinkingPanels['thinking-streaming'])}
                                    onToggle={() => toggleThinkingPanel('thinking-streaming')}
                                />
                            )}
                            
                            {streamingText ? (
                                <div className="w-full sm:max-w-[85%] lg:max-w-[75%] p-3 sm:p-4 rounded-2xl rounded-bl-md text-sm sm:text-base leading-relaxed bg-gradient-to-br from-white/5 to-transparent border border-white/5 text-gray-200 min-w-0">
                                    <FormattedAIResponse text={stripAnalysisSummaryBlock(streamingText)} onCitationClick={handleCitationClick} />
                                    <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" aria-hidden="true" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                                    </div>
                                    <span className="text-xs text-emerald-500 font-medium">{thinkingContext || 'Generating...'}</span>
                                </div>
                            )}
                            
                            {/* Stop button */}
                            <button
                                onClick={stopStreaming}
                                className="mt-3 min-h-[44px] px-4 text-xs text-gray-400 hover:text-white active:text-white bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-xl border border-white/10 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                                Stop
                            </button>
                        </div>
                    )}

                    {/* Loading indicator (non-streaming) */}
                    {isLoading && !isStreaming && (
                        <div className="flex justify-start">
                            <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                                </div>
                                <span className="text-xs text-emerald-500 font-medium">{thinkingContext || 'Thinking...'}</span>
                            </div>
                        </div>
                    )}

                    {/* Spacer for input area */}
                    <div ref={messagesEndRef} className="h-4" aria-hidden="true" />
                </div>
            </main>

            {/* ================================================================
                JUMP TO LATEST BUTTON
            ================================================================ */}
            {showJumpToLatest && (
                <button
                    onClick={() => {
                        scrollToBottom(true);
                        setUserHasScrolledUp(false);
                    }}
                    className="fixed bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 min-h-[44px] px-4 bg-emerald-500 text-black text-xs font-semibold rounded-full shadow-lg hover:bg-emerald-400 active:bg-emerald-600 transition-colors z-20 flex items-center gap-2"
                    aria-label="Jump to latest message"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    Jump to latest
                </button>
            )}

            {/* ================================================================
                CONTEXT SELECTOR MODAL
            ================================================================ */}
            {showSelector && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" 
                    onClick={() => setShowSelector(false)}
                >
                    <div 
                        className="bg-[#0D1117] w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 overflow-hidden animate-slide-up sm:animate-scale-in safe-area-bottom" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-white/5 flex justify-between items-center bg-[#161B22]">
                            <div>
                                <h3 className="text-base sm:text-lg font-medium text-white">Attach Documents</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Select context for your question</p>
                            </div>
                            <button 
                                onClick={() => setShowSelector(false)} 
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                aria-label="Close"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex-shrink-0 flex px-4 sm:px-6 border-b border-white/5 bg-[#0D1117]">
                            <button 
                                onClick={() => setSelectorTab('library')} 
                                className={`min-h-[48px] px-1 text-xs uppercase font-bold tracking-wider transition-all relative ${
                                    selectorTab === 'library' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                Library
                                {selectorTab === 'library' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full" />}
                            </button>
                            <button 
                                onClick={() => setSelectorTab('tasks')} 
                                className={`min-h-[48px] px-1 ml-6 text-xs uppercase font-bold tracking-wider transition-all relative ${
                                    selectorTab === 'tasks' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                Tasks
                                {selectorTab === 'tasks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full" />}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain custom-scrollbar">
                           {selectorTab === 'library' ? (
                                state.folders.filter(f => f.items.length > 0).map(folder => (
                                    <div key={folder.id} className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <IconFolder className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider truncate">{folder.name}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {folder.items.map(item => {
                                                const isSelected = !!selectedRefs.find(r => r.id === item.id);
                                                const legacyData = item.type === 'pdf' && item.content?.startsWith('data:') ? item.content : undefined;
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
                                                        className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all min-h-[56px] ${
                                                            isSelected 
                                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                                : 'bg-[#161B22] border-white/5 text-gray-400 hover:border-white/10 hover:bg-[#1C2128] active:bg-[#1C2128]'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                                                                isSelected ? 'bg-emerald-500/20' : 'bg-black/20'
                                                            }`}>
                                                                {item.type === 'pdf' ? <IconPaperclip className="w-4 h-4 sm:w-5 sm:h-5" /> : <IconFileText className="w-4 h-4 sm:w-5 sm:h-5" />}
                                                            </div>
                                                            <div className="text-left min-w-0">
                                                                <span className="text-sm font-medium block truncate max-w-[180px] sm:max-w-[280px]">{item.title}</span>
                                                                <span className="text-[9px] uppercase opacity-60 font-bold tracking-wider">{item.type === 'pdf' ? 'PDF' : 'Note'}</span>
                                                            </div>
                                                        </div>
                                                        {isSelected ? (
                                                            <div className="w-6 h-6 bg-emerald-500 text-black rounded-full flex items-center justify-center flex-shrink-0">
                                                                <IconCheck className="w-4 h-4" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 border-2 border-white/10 rounded-full flex-shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                           ) : (
                                <div className="space-y-2">
                                    {state.tasks.filter(t => t.pdfAttachment).map(task => {
                                        const isSelected = !!selectedRefs.find(r => r.id === task.id);
                                        const legacyData = (task.pdfAttachment as any)?.data;
                                        const subjectName = task.subjectId ? state.subjects.find(s => s.id === task.subjectId)?.name : null;
                                        const refPayload: SelectedRef = {
                                            id: task.id,
                                            title: task.pdfAttachment!.name,
                                            type: 'pdf',
                                            content: task.pdfAttachment!.text || '',
                                            source: 'task',
                                            file: task.pdfAttachment!,
                                            legacyData: legacyData?.startsWith('data:') ? legacyData : undefined,
                                        };
                                        return (
                                            <button 
                                                key={task.id}
                                                onClick={() => toggleRef(refPayload)}
                                                className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all min-h-[56px] ${
                                                    isSelected 
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                        : 'bg-[#161B22] border-white/5 text-gray-400 hover:border-white/10 hover:bg-[#1C2128] active:bg-[#1C2128]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                                                        isSelected ? 'bg-emerald-500/20' : 'bg-black/20'
                                                    }`}>
                                                        <IconPaperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </div>
                                                    <div className="text-left min-w-0">
                                                        <span className="text-sm font-medium block truncate max-w-[180px] sm:max-w-[280px]">{task.pdfAttachment!.name}</span>
                                                        {subjectName && (
                                                            <span className="text-[9px] uppercase opacity-60 font-bold tracking-wider truncate block max-w-[180px]">From: {subjectName}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isSelected ? (
                                                    <div className="w-6 h-6 bg-emerald-500 text-black rounded-full flex items-center justify-center flex-shrink-0">
                                                        <IconCheck className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 border-2 border-white/10 rounded-full flex-shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                           )}
                           
                           {/* Empty state */}
                           {((selectorTab === 'library' && state.folders.every(f => f.items.length === 0)) || (selectorTab === 'tasks' && state.tasks.filter(t => t.pdfAttachment).length === 0)) && (
                                <div className="py-12 text-center">
                                    <IconFileText className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                                    <p className="text-sm text-gray-500">No documents found</p>
                                </div>
                           )}
                        </div>
                        
                        {/* Footer */}
                        <div className="flex-shrink-0 p-4 sm:p-6 bg-[#161B22] border-t border-white/5">
                            <button 
                                onClick={() => setShowSelector(false)} 
                                className="w-full min-h-[48px] bg-emerald-500 text-[#091510] font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-400 active:bg-emerald-600 transition-colors text-sm"
                            >
                                {selectedRefs.length > 0 ? `Attach ${selectedRefs.length} Document${selectedRefs.length > 1 ? 's' : ''}` : 'Done'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================
                INPUT BAR - Fixed bottom, safe area padding
            ================================================================ */}
            <footer className="flex-shrink-0 p-3 sm:p-4 bg-[#0A0C0F]/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom z-10">
                <div className="max-w-3xl mx-auto space-y-3">
                    
                    {/* Selected refs chips */}
                    {selectedRefs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {selectedRefs.map(ref => (
                                <div key={ref.id} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg pl-2 sm:pl-3 pr-1 py-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 truncate max-w-[80px] sm:max-w-[120px]">{ref.title}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => toggleRef(ref)} 
                                        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors"
                                        aria-label={`Remove ${ref.title}`}
                                    >
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={() => setSelectedRefs([])} 
                                className="min-h-[36px] px-2 text-[10px] uppercase font-bold text-gray-500 hover:text-red-400 active:text-red-500 transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    {/* Input form */}
                    <form ref={formRef} onSubmit={handleSend} className="relative">
                        <div className="bg-[#161B22]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 focus-within:border-emerald-500/30 transition-colors">
                            
                            {/* Textarea */}
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => {
                                    setInput(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                                }}
                                onKeyDown={handleInputKeyDown}
                                placeholder={selectedRefs.length > 0 ? "Ask about the docs..." : "Ask anything..."}
                                disabled={isLoading || aiLocked}
                                rows={1}
                                className="w-full bg-transparent border-none text-sm sm:text-base text-white focus:outline-none focus:ring-0 placeholder:text-gray-500 resize-none leading-relaxed min-h-[44px] max-h-[160px] py-0"
                                aria-label="Message input"
                            />

                            {/* Toolbar */}
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    {/* Attach button */}
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
                                        className={`min-h-[44px] min-w-[44px] rounded-xl transition-all flex items-center justify-center border ${
                                            aiLocked
                                                ? 'bg-white/5 border-white/5 text-gray-600'
                                                : selectedRefs.length > 0
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15'
                                        }`}
                                        title="Attach documents"
                                        aria-label="Attach documents"
                                    >
                                        <IconPaperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>

                                    {/* Mode toggle */}
                                    <ModeToggle mode={analysisMode} onChange={setAnalysisMode} />
                                </div>

                                {/* Send button */}
                                <button 
                                    type="submit"
                                    disabled={!input.trim() || isLoading || aiLocked} 
                                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-all ${
                                        !input.trim() || isLoading || aiLocked 
                                            ? 'bg-white/5 text-gray-600' 
                                            : 'bg-emerald-500 text-[#091510] hover:bg-emerald-400 active:bg-emerald-600'
                                    }`}
                                    aria-label="Send message"
                                >
                                    {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <IconChevronRight className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </footer>
        </div>
    );
};

export default ZenAI;
