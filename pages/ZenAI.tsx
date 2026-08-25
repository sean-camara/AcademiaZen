
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    IconX,
    IconBot,
    IconPaperclip,
    IconFileText,
    IconChevronRight,
    IconChevronDown,
    IconFolder,
    IconCheck,
    IconTrash,
    IconHome,
    IconMenu,
    IconMoreVertical,
    IconPlus,
    IconSend,
    IconZap,
} from '../components/Icons';
import { ZenAIWelcome } from '../components/ZenAIWelcome';
import { useZen } from '../context/ZenContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { apiFetch } from '../utils/api';
import { getPdfSignedUrl } from '../utils/pdfStorage';
import { openSettings } from '../utils/appNavigation';
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
    contextLabel?: string;
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
        const payload = match[1];
        if (payload === undefined) return null;
        const parsed = JSON.parse(payload);
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
// FORMATTED AI RESPONSE - Clean markdown rendering & syntax highlighting
// ============================================================================

const SyntaxHighlightedCode: React.FC<{ code: string; language: string }> = ({ code, language }) => {
    const lang = (language || 'text').toLowerCase();
    const lines = code.split('\n');

    return (
        <div className="table w-full border-collapse font-mono text-xs sm:text-sm leading-relaxed">
            {lines.map((line, lineIdx) => {
                const tokens: { type: 'comment' | 'string' | 'keyword' | 'number' | 'function' | 'operator' | 'property' | 'text'; text: string }[] = [];
                let i = 0;

                while (i < line.length) {
                    const rest = line.slice(i);

                    // 1. Comments
                    if (rest.startsWith('//') || (lang === 'python' && line[i] === '#') || (lang === 'bash' && line[i] === '#') || (lang === 'sh' && line[i] === '#')) {
                        tokens.push({ type: 'comment', text: rest });
                        break;
                    }

                    // 2. Strings
                    const char = line[i];
                    if (char === '"' || char === "'" || char === '`') {
                        const quote = char;
                        let end = i + 1;
                        while (end < line.length && line[end] !== quote) {
                            if (line[end] === '\\') end++;
                            end++;
                        }
                        if (end < line.length) end++;
                        tokens.push({ type: 'string', text: line.slice(i, end) });
                        i = end;
                        continue;
                    }

                    // 3. Numbers
                    const numMatch = rest.match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)/);
                    if (numMatch) {
                        tokens.push({ type: 'number', text: numMatch[0] });
                        i += numMatch[0].length;
                        continue;
                    }

                    // 4. Identifiers & Keywords
                    const identMatch = rest.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
                    if (identMatch) {
                        const word = identMatch[0];
                        const isKeyword = /^(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|default|class|import|export|from|async|await|try|catch|finally|throw|new|this|typeof|instanceof|void|yield|def|lambda|elif|print|public|private|protected|static|final|abstract|interface|extends|implements|package|struct|enum|union|typedef|include|using|namespace|true|false|null|undefined|None|True|False|boolean|string|number|any|object)$/.test(word);
                        
                        const afterIdent = rest.slice(word.length);
                        const isFuncCall = !isKeyword && /^\s*\(/.test(afterIdent);
                        const isProp = !isKeyword && line[i - 1] === '.';

                        if (isKeyword) {
                            tokens.push({ type: 'keyword', text: word });
                        } else if (isFuncCall) {
                            tokens.push({ type: 'function', text: word });
                        } else if (isProp) {
                            tokens.push({ type: 'property', text: word });
                        } else {
                            tokens.push({ type: 'text', text: word });
                        }
                        i += word.length;
                        continue;
                    }

                    // 5. Operators
                    const opMatch = rest.match(/^(=>|===|==|!==|!=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|<=|>=|=>|\+|-|\*|\/|%|=|<|>|!|\?|:)/);
                    if (opMatch) {
                        tokens.push({ type: 'operator', text: opMatch[0] });
                        i += opMatch[0].length;
                        continue;
                    }

                    // Whitespace or punctuation
                    tokens.push({ type: 'text', text: line[i] || '' });
                    i++;
                }

                return (
                    <div key={lineIdx} className="table-row hover:bg-white/[0.03]">
                        <span className="table-cell select-none pr-3.5 text-right text-[11px] text-gray-500 font-mono opacity-40 w-7 align-top py-0.5">
                            {lineIdx + 1}
                        </span>
                        <span className="table-cell whitespace-pre align-top py-0.5">
                            {tokens.map((token, tIdx) => {
                                switch (token.type) {
                                    case 'comment':
                                        return <span key={tIdx} className="text-gray-400 italic font-mono">{token.text}</span>;
                                    case 'string':
                                        return <span key={tIdx} className="text-emerald-400 font-mono">{token.text}</span>;
                                    case 'keyword':
                                        return <span key={tIdx} className="text-purple-400 font-semibold font-mono">{token.text}</span>;
                                    case 'number':
                                        return <span key={tIdx} className="text-amber-400 font-mono">{token.text}</span>;
                                    case 'function':
                                        return <span key={tIdx} className="text-cyan-400 font-mono">{token.text}</span>;
                                    case 'property':
                                        return <span key={tIdx} className="text-sky-300 font-mono">{token.text}</span>;
                                    case 'operator':
                                        return <span key={tIdx} className="text-pink-400 font-mono">{token.text}</span>;
                                    default:
                                        return <span key={tIdx} className="text-gray-200 font-mono">{token.text}</span>;
                                }
                            })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

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
            const code = (match[2] ?? '').trim();
            const blockId = `code-${codeBlockIndex}`;

            // Code block container with VS Code / GitHub dark theme
            elements.push(
                <div key={blockId} className="my-3 sm:my-4 rounded-xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-xl">
                    <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-white/10">
                        <span className="text-xs text-emerald-400 font-mono font-semibold tracking-wide uppercase">{language}</span>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(code);
                                setCopiedIndex(blockId);
                                setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors min-h-[32px] px-2.5 rounded-lg hover:bg-white/10"
                            aria-label={copiedIndex === blockId ? 'Copied' : 'Copy code'}
                        >
                            {copiedIndex === blockId ? (
                                <>
                                    <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400 font-medium">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                    </div>
                    
                    {/* Code content with internal horizontal scroll & rich syntax highlighting */}
                    <div className="overflow-x-auto p-3 sm:p-4 custom-scrollbar">
                        <SyntaxHighlightedCode code={code} language={language} />
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
                        {processInlines(standaloneBold[1] ?? trimmed, onCitationClick)}
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
            const rawLabel = (citationMatch[1] ?? '').trim();
            const pageMatch = rawLabel.match(/p\.?\s*(\d+)/i);
            const page = pageMatch?.[1] ? Number(pageMatch[1]) : undefined;
            const doc = rawLabel.replace(/\s*p\.?\s*\d+.*$/i, '').trim() || rawLabel;
            const citationPayload: CitationPayload = {
                raw: rawLabel,
                doc,
                ...(page !== undefined ? { page } : {}),
            };
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
}

const MessageActions: React.FC<MessageActionsProps> = ({ 
    messageText, 
    onRegenerate, 
    onContinue, 
    onRewrite,
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

    return (
        <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 relative" ref={menuRef}>
            {/* Copy Button */}
            <button
                onClick={handleCopy}
                title={copied ? "Copied to clipboard!" : "Copy message"}
                aria-label={copied ? "Copied to clipboard!" : "Copy message"}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
                {copied ? (
                    <IconCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                )}
            </button>

            {/* Regenerate Button */}
            <button
                onClick={onRegenerate}
                title="Regenerate response"
                aria-label="Regenerate response"
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>

            {/* 3 Dots Overflow Button */}
            <div className="relative">
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    title="More actions"
                    aria-label="More actions"
                    aria-expanded={showMenu}
                    className={`p-1.5 rounded-lg transition-colors ${showMenu ? 'text-white bg-white/10' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                    <div className="absolute left-0 bottom-full mb-2 bg-[#161B22] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[150px] animate-scale-in py-1">
                        <button
                            onClick={() => { onContinue(); setShowMenu(false); }}
                            className="w-full px-3.5 py-2 text-left text-xs text-gray-300 hover:bg-white/5 active:bg-white/10 flex items-center gap-2.5 transition-colors"
                        >
                            <span className="text-emerald-400 font-bold">→</span> Continue response
                        </button>
                        <button
                            onClick={() => { onRewrite('shorter'); setShowMenu(false); }}
                            className="w-full px-3.5 py-2 text-left text-xs text-gray-300 hover:bg-white/5 active:bg-white/10 flex items-center gap-2.5 transition-colors"
                        >
                            <span className="font-bold">−</span> Make shorter
                        </button>
                        <button
                            onClick={() => { onRewrite('simpler'); setShowMenu(false); }}
                            className="w-full px-3.5 py-2 text-left text-xs text-gray-300 hover:bg-white/5 active:bg-white/10 flex items-center gap-2.5 transition-colors"
                        >
                            <span className="font-bold">◯</span> Make simpler
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MODE TOGGLE
// ============================================================================

const ModeToggle: React.FC<{
    mode: 'fast' | 'deep';
    onChange: (mode: 'fast' | 'deep') => void;
    quota?: { fastLeft: number; fastCap: number; deepLeft: number; deepCap: number } | null;
}> = ({ mode, onChange, quota }) => {
    const [hovered, setHovered] = useState(false);

    const currentLeft = mode === 'deep' ? quota?.deepLeft : quota?.fastLeft;
    const currentCap = mode === 'deep' ? quota?.deepCap : quota?.fastCap;

    return (
        <div
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
        >
            <button
                type="button"
                onClick={() => onChange(mode === 'fast' ? 'deep' : 'fast')}
                className={`flex min-h-[44px] min-w-[88px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-primary/70 ${
                    mode === 'deep'
                        ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200 hover:bg-emerald-400/[0.11]'
                        : 'border-white/10 bg-white/[0.035] text-slate-200 hover:bg-white/[0.07]'
                }`}
                aria-label={`Switch to ${mode === 'fast' ? 'deep' : 'fast'} mode`}
            >
                <IconZap className={`h-4 w-4 ${mode === 'deep' ? 'text-emerald-300' : 'text-slate-300'}`} aria-hidden="true" />
                <span>{mode === 'deep' ? 'Deep' : 'Fast'}</span>
                <IconChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            </button>

            {/* Hover tooltip showing remaining quota */}
            {hovered && quota && (
                <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 animate-in fade-in duration-150">
                    <div className="min-w-[148px] rounded-xl border border-white/10 bg-[#111a27] px-3 py-2.5 shadow-2xl">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Fast</span>
                                <span className={`text-[11px] font-semibold ${(quota.fastLeft ?? 0) === 0 ? 'text-red-400' : 'text-gray-200'}`}>
                                    {quota.fastLeft}/{quota.fastCap}
                                </span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${(quota.fastLeft ?? 0) === 0 ? 'bg-red-500' : 'bg-blue-400'}`}
                                    style={{ width: `${quota.fastCap ? (quota.fastLeft / quota.fastCap) * 100 : 0}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-3 mt-0.5">
                                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Deep</span>
                                <span className={`text-[11px] font-semibold ${(quota.deepLeft ?? 0) === 0 ? 'text-red-400' : 'text-gray-200'}`}>
                                    {quota.deepLeft}/{quota.deepCap}
                                </span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${(quota.deepLeft ?? 0) === 0 ? 'bg-red-500' : 'bg-emerald-400'}`}
                                    style={{ width: `${quota.deepCap ? (quota.deepLeft / quota.deepCap) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white/10" />
                    </div>
                </div>
            )}
        </div>
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
                    className="mt-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[13px] text-gray-400 leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words"
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

const ZenAI: React.FC<ZenAIProps> = ({ onClose, contextLabel = 'Workspace' }) => {
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
    const [modeQuota, setModeQuota] = useState<{ fastLeft: number; fastCap: number; deepLeft: number; deepCap: number } | null>(null);
    
    // Quota exhausted modal
    const [quotaExhausted, setQuotaExhausted] = useState<{ type: 'daily' | 'monthly' | 'deep_daily' | 'deep_monthly'; message: string } | null>(null);
    const [forceFreeModel, setForceFreeModel] = useState(false);
    
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
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    
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
    const headerMenuRef = useRef<HTMLDivElement>(null);
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

    useEffect(() => {
        if (!showHeaderMenu) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!headerMenuRef.current?.contains(event.target as Node)) {
                setShowHeaderMenu(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowHeaderMenu(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showHeaderMenu]);

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
                if (data?.aiUsage) {
                    const u = data.aiUsage;
                    setModeQuota({
                        fastLeft: u.dailyRemaining ?? 0,
                        fastCap: u.dailyCap ?? 0,
                        deepLeft: u.deepDailyRemaining ?? 0,
                        deepCap: u.deepDailyCap ?? 0,
                    });
                }
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
        openSettings('billing');
    };

    const clearChat = () => {
        setMessages([]);
        setInput('');
        setSelectedRefs([]);
        setUserHasScrolledUp(false);
        try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch (_) {}
        clearAIChat();
    };

    const startNewChat = () => {
        if (messages.length > 0) {
            const firstMessage = messages[0];
            const newThread: ConversationThread = {
                id: Date.now().toString(),
                title: firstMessage ? `${firstMessage.text.slice(0, 50)}${firstMessage.text.length > 50 ? '...' : ''}` : 'New Chat',
                messages,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            setThreads(prev => [newThread, ...prev.slice(0, 19)]);
        }
        setShowHeaderMenu(false);
        clearChat();
    };

    const selectStarterPrompt = useCallback((prompt: string) => {
        setInput(prompt);
        window.requestAnimationFrame(() => textareaRef.current?.focus());
    }, []);

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
                targets.push({
                    title: item.title,
                    ...(item.file ? { file: item.file } : {}),
                    ...(legacyData ? { dataUrl: legacyData } : {}),
                });
            });
        });
        state.tasks.forEach(task => {
            if (!task.pdfAttachment) return;
            const legacyData = (task.pdfAttachment as any)?.data;
            const dataUrl = legacyData?.startsWith('data:') ? legacyData : undefined;
            targets.push({
                title: task.pdfAttachment.name,
                file: task.pdfAttachment,
                ...(dataUrl ? { dataUrl } : {}),
            });
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

            // Clean, intelligent system prompt — acting just like ChatGPT, Gemini, and Claude
            const systemPrompt = `You are Zen, an intelligent AI study assistant.
Be direct, helpful, clear, and conversational (just like ChatGPT, Gemini, and Claude).
Answer questions naturally using your own knowledge first.
If a user asks for a study plan, schedule, or recommendation, and you need more details (like their specific subjects, target exam dates, or study hours), answer with a clear, helpful template or guide using your knowledge, and politely ask them to provide any specific details or attach relevant notes/files using the 📎 button if needed.
If asked who created you: "Sean John Camara from STI College Fairview, BSCS."
If asked tech stack: "MERN Stack."`;

            const redact = (value: string) => value
                .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***')
                .replace(/mongodb\+srv:\/\/[^@\s]+@/g, 'mongodb+srv://***@');

            let userMessage = '';
            let resolvedRefs: ResolvedRef[] = [];

            if (currentRefs.length > 0) {
                userMessage += `CITATION RULES:\n- Cite document claims with 【Document Name p.X】\n- Place citations at the END of the bullet point or paragraph.\n\n`;
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
                userMessage += `ATTACHED DOCUMENTS:\n\n`;
                
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
            userMessage += redact(userQuery);
            let prompt = `${systemPrompt}\n\n${userMessage}`;

            const safeMaxPromptLength = isPremium ? 60000 : 30000;
            if (prompt.length > safeMaxPromptLength) {
                prompt = prompt.slice(0, safeMaxPromptLength - 100) + '\n\n[Context truncated to fit AI capacity]';
            }

            const recentHistory = messages.slice(-12).map(msg => ({ role: msg.role, text: msg.text }));

            setIsStreaming(true);
            setStreamingText('');
            setStreamingThinking('');
            setOpenThinkingPanels(prev => ({ ...prev, 'thinking-streaming': true }));
            abortControllerRef.current = new AbortController();

            try {
                const streamResponse = await apiFetch('/api/ai/chat/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                    },
                    body: JSON.stringify({
                        prompt,
                        mode: analysisMode,
                        history: recentHistory,
                        forceFreeModel: forceFreeModel || undefined,
                        contextInfo: resolvedRefs.length > 0 ? {
                            documents: contextSummary.documents,
                            totalChars: contextSummary.totalChars,
                            pagesReadTotal: contextSummary.pagesReadTotal,
                            ocrUsed: contextSummary.ocrUsed,
                        } : null,
                    }),
                    signal: abortControllerRef.current.signal,
                });

                if (!streamResponse.ok) {
                    // Try to parse error body for cooldown details
                    let errorBody: any = null;
                    try { errorBody = await streamResponse.json(); } catch (_) {}
                    if (streamResponse.status === 429 && errorBody?.error === 'free_cooldown') {
                        const remainMs = errorBody.remainingMs || 0;
                        const hours = Math.floor(remainMs / (1000 * 60 * 60));
                        const minutes = Math.ceil((remainMs % (1000 * 60 * 60)) / (1000 * 60));
                        throw new Error(`COOLDOWN:${hours}h ${minutes}m`);
                    }
                    if (streamResponse.status === 429 && errorBody?.error === 'daily_quota_exceeded') {
                        throw new Error('DAILY_LIMIT');
                    }
                    if (streamResponse.status === 429 && errorBody?.error === 'monthly_quota_exceeded') {
                        throw new Error('MONTHLY_LIMIT');
                    }
                    if (streamResponse.status === 429 && errorBody?.error === 'deep_quota_exceeded') {
                        throw new Error('DEEP_LIMIT:' + (errorBody?.message || ''));
                    }
                    if (streamResponse.status === 429 && errorBody?.error === 'deep_monthly_quota_exceeded') {
                        throw new Error('DEEP_MONTHLY_LIMIT:' + (errorBody?.message || ''));
                    }
                    throw new Error(`Stream failed: ${streamResponse.status}`);
                }

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
                        
                        let data: { text?: string; responseTimeMs?: number; message?: string };
                        try {
                            data = JSON.parse(eventData);
                        } catch (parseErr) {
                            console.warn('SSE parse error:', parseErr);
                            continue;
                        }

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
                    }
                }

                if (fullText) {
                    const cleanedText = stripAnalysisSummaryBlock(fullText);
                    setMessages(prev => [...prev, {
                        role: 'ai', 
                        text: cleanedText || fullText, 
                        createdAt: new Date().toISOString(),
                        id: crypto.randomUUID(),
                        ...(fullThinking ? { thinking: fullThinking } : {}),
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
            else if (error.message?.startsWith('COOLDOWN:')) {
                const timeLeft = error.message.replace('COOLDOWN:', '');
                errorMessage = `### Free Limit Reached\nYou've reached the configured free usage window. Upgrade to **Premium** for higher limits, or wait **${timeLeft}** for access to reset.`;
            }
            else if (error.message === 'DAILY_LIMIT') {
                setQuotaExhausted({ type: 'daily', message: 'You\'ve used all 30 AI requests for today.' });
                errorMessage = "### Daily Limit Reached\nYou've used all your AI requests for today. Your limit resets at midnight.";
            }
            else if (error.message === 'MONTHLY_LIMIT') {
                setQuotaExhausted({ type: 'monthly', message: 'You\'ve reached your 300 monthly request limit.' });
                errorMessage = "### Monthly Limit Reached\nYou've reached your monthly AI request limit.";
            }
            else if (error.message?.startsWith('DEEP_LIMIT:')) {
                setQuotaExhausted({ type: 'deep_daily', message: 'You\'ve used all 10 deep reasoning requests for today.' });
                errorMessage = "### Deep Reasoning Limit\nYou've used all your deep reasoning requests for today.";
            }
            else if (error.message?.startsWith('DEEP_MONTHLY_LIMIT:')) {
                setQuotaExhausted({ type: 'deep_monthly', message: 'You\'ve used all 40 deep reasoning requests this month.' });
                errorMessage = "### Deep Reasoning Monthly Limit\nYou've used all your deep reasoning requests for this month.";
            }
            else if (error.message?.includes('429')) {
                errorMessage = "### Rate Limited\nToo many requests. Please wait a moment and try again.";
            }
            else if (error.message?.includes('Prompt is too long') || error.message?.includes('PROMPT_TOO_LONG') || error.message?.includes('413') || error.message?.includes('too long')) {
                const hasAttachedDocs = currentRefs.length > 0;
                if (hasAttachedDocs) {
                    errorMessage = "### Document Context Too Large\nThe attached document is too large to process at once. Try removing the file or using a shorter PDF, and I'll be happy to help!";
                } else {
                    errorMessage = "### Question Too Long\nYour question contains too much detail for one request. Try asking a slightly more specific question, and I'll be happy to help!";
                }
            }
            else if (error instanceof TypeError && error.message?.toLowerCase().includes('fetch')) {
                errorMessage = "### Connection Issue\nZen AI couldn't reach the service. Check your connection and try again.";
            }
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
        <aside
            id="zen-ai-panel"
            className="ai-workspace fixed inset-y-0 right-0 z-[110] flex w-full flex-col overflow-hidden font-sans sm:w-[min(520px,100vw)] min-[1180px]:relative min-[1180px]:inset-auto min-[1180px]:z-30 min-[1180px]:h-full min-[1180px]:w-[420px] min-[1180px]:shrink-0 xl:w-[440px] 2xl:w-[480px]"
            aria-label="Zen AI assistant"
        >
            {/* ================================================================
                HEADER - Fixed, responsive
            ================================================================ */}
            <header className="ai-header sticky top-0 z-20 flex-shrink-0 px-3 pb-3 backdrop-blur-xl sm:px-4">
                <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowThreadsSidebar(!showThreadsSidebar)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/[0.055] hover:text-white active:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-primary/70"
                            aria-label="Toggle conversations"
                            aria-expanded={showThreadsSidebar}
                        >
                            <IconMenu className="h-[22px] w-[22px]" />
                        </button>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.11] bg-white/[0.04] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                            <IconBot className="h-5 w-5" />
                        </div>

                        <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.025em] text-white sm:text-lg">Zen AI</h1>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={startNewChat}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[14px] border border-white/[0.09] bg-white/[0.025] text-slate-300 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white active:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-primary/70"
                            aria-label="New chat"
                        >
                            <IconPlus className="h-[22px] w-[22px]" />
                        </button>

                        <div ref={headerMenuRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setShowHeaderMenu(current => !current)}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/[0.055] hover:text-white active:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-primary/70"
                                aria-label="More Zen AI options"
                                aria-haspopup="menu"
                                aria-expanded={showHeaderMenu}
                            >
                                <IconMoreVertical className="h-[22px] w-[22px]" />
                            </button>

                            {showHeaderMenu && (
                                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#111a27] p-1.5 shadow-2xl" role="menu" aria-label="Zen AI options">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            clearChat();
                                            setShowHeaderMenu(false);
                                        }}
                                        className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zen-primary/70"
                                        role="menuitem"
                                    >
                                        <IconTrash className="h-4 w-4 text-slate-500" />
                                        Clear conversation
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            onClose();
                                        }}
                                        className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zen-primary/70"
                                        role="menuitem"
                                    >
                                        <IconX className="h-4 w-4 text-slate-500" />
                                        Close Zen AI
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mx-auto mt-3 flex min-h-[48px] w-full max-w-4xl items-center gap-3 rounded-full border border-white/[0.09] bg-white/[0.025] px-4 text-sm text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
                    <IconHome className="h-[18px] w-[18px] shrink-0 text-emerald-300" aria-hidden="true" />
                    <span className="truncate">Working with <strong className="font-semibold text-slate-100">{contextLabel}</strong></span>
                </div>
            </header>

            {/* ================================================================
                THREADS SIDEBAR - Mobile drawer
            ================================================================ */}
            {showThreadsSidebar && (
                <>
                    <div 
                        className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowThreadsSidebar(false)} 
                        aria-hidden="true"
                    />
                    <aside 
                        className="absolute bottom-0 left-0 top-0 z-40 flex w-[280px] max-w-[85%] flex-col border-r border-white/10 bg-[#0D1117] animate-slide-in-left"
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
                        <div className="flex-1 overflow-y-auto p-2 overscroll-contain custom-scrollbar">
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
                <div className="absolute inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
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
                        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-xl bg-white/5 text-center">
                                    <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Weekly</p>
                                    <p className="text-xl text-white font-medium">₱149</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 text-center">
                                    <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Monthly</p>
                                    <p className="text-xl text-white font-medium">₱500</p>
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
                QUOTA EXHAUSTED MODAL
            ================================================================ */}
            {quotaExhausted && (
                <div className="absolute inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setQuotaExhausted(null)} />
                    <div className="relative w-full sm:max-w-md bg-[#0D1117] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-up sm:animate-scale-in safe-area-bottom max-h-[85vh] flex flex-col">
                        <div className="p-4 sm:p-6 border-b border-white/5 flex-shrink-0">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-amber-500 font-bold">Limit Reached</p>
                                    <h3 className="text-lg text-white font-medium">
                                        {quotaExhausted.type === 'daily' && 'Daily Limit Reached'}
                                        {quotaExhausted.type === 'monthly' && 'Monthly Limit Reached'}
                                        {quotaExhausted.type === 'deep_daily' && 'Deep Reasoning Daily Limit'}
                                        {quotaExhausted.type === 'deep_monthly' && 'Deep Reasoning Monthly Limit'}
                                    </h3>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400 pl-12 sm:pl-[52px]">{quotaExhausted.message}</p>
                        </div>
                        <div className="p-4 sm:p-6 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                            {/* Switch to Fast mode (for deep limits) */}
                            {(quotaExhausted.type === 'deep_daily' || quotaExhausted.type === 'deep_monthly') && (
                                <button 
                                    onClick={() => {
                                        setAnalysisMode('fast');
                                        setQuotaExhausted(null);
                                    }}
                                    className="min-h-[44px] w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-colors border border-purple-500/20"
                                >
                                    Switch to Fast Mode
                                </button>
                            )}
                            
                            {/* Use Free Model */}
                            {isPremium && (
                                <button 
                                    onClick={() => {
                                        setForceFreeModel(true);
                                        setQuotaExhausted(null);
                                    }}
                                    className="min-h-[44px] w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-colors border border-blue-500/20"
                                >
                                    Continue with Free Model
                                </button>
                            )}
                            
                            {/* Go to Settings to renew */}
                            <button 
                                onClick={() => {
                                    setQuotaExhausted(null);
                                    onClose();
                                    openSettings('billing');
                                }}
                                className="min-h-[44px] w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#091510] font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-colors"
                            >
                                Manage Subscription
                            </button>
                            
                            <button 
                                onClick={() => setQuotaExhausted(null)} 
                                className="min-h-[44px] w-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-medium text-xs sm:text-sm rounded-xl transition-colors"
                            >
                                Dismiss
                            </button>
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
                className="ai-message-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
            >
                <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col space-y-4 px-3 py-3 sm:space-y-5 sm:px-4 sm:py-4">
                    
                    {/* Free Model Mode Banner */}
                    {forceFreeModel && (
                        <div className="py-2 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center text-xs text-blue-400 flex items-center justify-between">
                            <span>Using free model — responses may be shorter</span>
                            <button onClick={() => setForceFreeModel(false)} className="text-blue-300 hover:text-white font-bold ml-2">✕</button>
                        </div>
                    )}
                    
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
                        <ZenAIWelcome disabled={aiLocked} onSelectPrompt={selectStarterPrompt} />
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
                                className={`group flex flex-col ${isUser ? 'items-end' : 'items-start w-full'}`}
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
                                
                                {/* Message bubble - full width for AI, right bubble for user */}
                                <div 
                                    className={`p-3 sm:p-4 rounded-2xl text-sm sm:text-base leading-relaxed min-w-0 ${
                                        isUser 
                                            ? 'max-w-[85%] sm:max-w-[75%] bg-white/10 text-white rounded-br-md ml-auto'
                                            : 'w-full bg-gradient-to-br from-white/5 to-transparent border border-white/5 text-gray-200 rounded-bl-md'
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
                                        />
                                    )}
                                </div>
                                
                                {/* Prominent Continue button for truncated responses */}
                                {!isUser && !isStreaming && idx === messages.length - 1 && /shall\s+I\s+continue\s*\??/i.test(displayText) && (
                                    <button
                                        onClick={handleContinue}
                                        className="mt-2 min-h-[44px] px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-sm uppercase tracking-wider rounded-xl transition-colors border border-emerald-500/20 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                                        Continue
                                    </button>
                                )}
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
                                <div className="w-full p-3 sm:p-4 rounded-2xl rounded-bl-md text-sm sm:text-base leading-relaxed bg-gradient-to-br from-white/5 to-transparent border border-white/5 text-gray-200 min-w-0">
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
                    className="absolute bottom-28 left-1/2 z-20 flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500 px-4 text-xs font-semibold text-black shadow-lg transition-colors hover:bg-emerald-400 active:bg-emerald-600 sm:bottom-32"
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
                    className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
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
                                                    ...(item.type === 'pdf' && item.file ? { file: item.file } : {}),
                                                    ...(legacyData ? { legacyData } : {}),
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
            <footer className="ai-composer-footer z-10 flex-shrink-0 border-t border-white/[0.06] px-3 pt-2 backdrop-blur-xl sm:px-4 sm:pt-3">
                <div className="mx-auto max-w-3xl space-y-3">
                    
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
                        <div className="ai-composer rounded-[26px] border border-white/[0.11] p-2.5 transition-[border-color,box-shadow] focus-within:border-emerald-300/25 focus-within:shadow-[0_0_0_1px_rgba(110,231,183,0.04)] sm:p-3">
                            <div className="flex items-start gap-2.5">
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
                                    className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-primary/70 ${
                                        aiLocked
                                            ? 'border-white/5 bg-white/[0.025] text-slate-600'
                                            : selectedRefs.length > 0
                                                ? 'border-emerald-400/25 bg-emerald-400/[0.09] text-emerald-300'
                                                : 'border-white/[0.09] bg-white/[0.025] text-slate-400 hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-white active:bg-white/[0.08]'
                                    }`}
                                    title="Attach documents"
                                    aria-label="Attach documents"
                                >
                                    <IconPaperclip className="h-5 w-5" />
                                </button>

                                <div className="ai-composer-field min-w-0 flex-1 rounded-[20px] border border-white/[0.085] p-2.5 sm:p-3">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={e => {
                                            setInput(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                                        }}
                                        onKeyDown={handleInputKeyDown}
                                        placeholder={selectedRefs.length > 0 ? 'Ask about your documents…' : 'Ask Zen anything…'}
                                        disabled={isLoading || aiLocked}
                                        rows={1}
                                        className="custom-scrollbar min-h-[44px] max-h-[160px] w-full resize-none border-none bg-transparent px-1 py-1 text-[15px] leading-6 text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                                        aria-label="Message input"
                                    />

                                    <div className="mt-2 flex items-end justify-between gap-2">
                                        <ModeToggle mode={analysisMode} onChange={setAnalysisMode} quota={modeQuota} />

                                        {isLoading || isStreaming ? (
                                            <button
                                                type="button"
                                                onClick={stopStreaming}
                                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-slate-200 transition-[background-color,border-color,color,transform] hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111a27] active:scale-95"
                                                aria-label="Stop generation"
                                                title="Stop generation"
                                            >
                                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                                </svg>
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={!input.trim() || aiLocked}
                                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111a27] active:scale-95 ${
                                                    !input.trim() || aiLocked
                                                        ? 'bg-white/[0.055] text-slate-600'
                                                        : 'bg-emerald-300 text-[#07110e] hover:bg-emerald-200'
                                                }`}
                                                aria-label="Send message"
                                            >
                                                <IconSend className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </footer>
        </aside>
    );
};

export default ZenAI;
