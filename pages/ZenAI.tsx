
import React, { useState, useRef, useEffect } from 'react';
import { IconX, IconBot, IconPaperclip, IconFileText, IconChevronRight, IconFolder, IconCheck, IconTrash } from '../components/Icons';
import { useZen } from '../context/ZenContext';
import { apiFetch } from '../utils/api';
import { getPdfSignedUrl } from '../utils/pdfStorage';
import { PdfAttachment } from '../types';

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

interface ZenAIProps {
    onClose: () => void;
}

// Helper Component: Renders structured AI text with academic formatting
const FormattedAIResponse: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    
    return (
        <div className="space-y-4 text-zen-text-primary text-sm md:text-base">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                
                // Headers
                if (trimmed.startsWith('### ')) {
                    return (
                        <h3 key={i} className="text-base md:text-lg font-semibold text-zen-primary mt-6 mb-2 flex items-center gap-2">
                            <div className="w-1 h-5 bg-zen-primary/30 rounded-full" />
                            {trimmed.replace('### ', '')}
                        </h3>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <h2 key={i} className="text-lg md:text-xl font-bold text-zen-primary mt-8 mb-4 border-b border-zen-primary/10 pb-2">
                            {trimmed.replace('## ', '')}
                        </h2>
                    );
                }
                
                // Bullet points
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    const content = trimmed.substring(2);
                    return (
                        <div key={i} className="flex gap-3 ml-2 md:ml-4 py-0.5">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zen-primary/80 shrink-0" />
                            <span className="leading-relaxed opacity-90">{processInlines(content)}</span>
                        </div>
                    );
                }

                // Numbered lists
                if (/^\d+\.\s/.test(trimmed)) {
                    const match = trimmed.match(/^(\d+\.)\s(.*)/);
                    return (
                        <div key={i} className="flex gap-3 ml-4 py-0.5">
                            <span className="text-zen-secondary font-mono text-xs mt-1">{match?.[1]}</span>
                            <span className="leading-relaxed opacity-90">{processInlines(match?.[2] || "")}</span>
                        </div>
                    );
                }

                // Dividers
                if (trimmed.startsWith('---')) {
                    return <hr key={i} className="border-zen-surface my-6 opacity-50" />;
                }

                // Empty lines for spacing
                if (trimmed === '') return <div key={i} className="h-2" />;

                // Regular paragraphs
                return (
                    <p key={i} className="leading-relaxed opacity-90 font-light">
                        {processInlines(trimmed)}
                    </p>
                );
            })}
        </div>
    );
};

// Helper: Handles bolding within lines
const processInlines = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={idx} className="text-zen-primary font-semibold">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return part;
    });
};

const ZenAI: React.FC<ZenAIProps> = ({ onClose }) => {
    const { state, updateTask, updateFolder } = useZen();
    const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string, refs?: string[]}[]>([]);
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
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const upgradeCtaRef = useRef<HTMLButtonElement>(null);
    const hasShownUpgradeOnceRef = useRef(false);
    const pdfTextCacheRef = useRef<Map<string, string>>(new Map());
    const hasLoadedChatRef = useRef(false);

    const allowFreeAI = (import.meta as any).env?.VITE_AI_FREE_MODE === 'true';
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

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

    useEffect(() => {
        if (!hasLoadedChatRef.current) return;
        const trimmed = messages.slice(-MAX_SAVED_MESSAGES);
        try {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
        } catch (_) {
            // Storage may be full; skip caching in that case.
        }
    }, [messages]);

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
        if (allowFreeAI) {
            setIsPremium(true);
            setBillingChecked(true);
            return;
        }
        let active = true;
        apiFetch('/api/billing/status')
            .then(async (res) => {
                if (!res.ok) return null;
                return await res.json();
            })
            .then((data) => {
                if (!active) return;
                const plan = data?.billing?.effectivePlan || 'free';
                setIsPremium(plan === 'premium');
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
        window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'billing' } }));
    };

    const clearChat = () => {
        setMessages([]);
        setInput('');
        setSelectedRefs([]);
        try {
            localStorage.removeItem(CHAT_STORAGE_KEY);
        } catch (_) {
            // Ignore storage errors
        }
    };

    const extractPdfText = async (source: string, cacheKey: string) => {
        if (pdfTextCacheRef.current.has(cacheKey)) {
            return pdfTextCacheRef.current.get(cacheKey) || '';
        }
        try {
            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) return '';
            let loadingTask;
            if (String(source).startsWith('data:')) {
                const base64 = source.split(',')[1] || '';
                if (!base64) return '';
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
            const totalPages = Math.min(pdf.numPages || 0, MAX_PDF_PAGES);
            let fullText = '';
            for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = (textContent.items || [])
                    .map((item: any) => item?.str || '')
                    .join(' ');
                fullText += `${pageText}\n`;
                if (fullText.length >= MAX_PDF_TEXT_CHARS) {
                    fullText = fullText.slice(0, MAX_PDF_TEXT_CHARS);
                    break;
                }
            }
            let cleaned = fullText.replace(/\s+/g, ' ').trim();
            if (cleaned) {
                pdfTextCacheRef.current.set(cacheKey, cleaned);
                return cleaned;
            }

            const Tesseract = (window as any).Tesseract;
            if (!Tesseract) return '';

            const ocrPreset = analysisMode === 'deep'
                ? { pages: MAX_OCR_PAGES, scale: OCR_SCALE, maxChars: MAX_OCR_TEXT_CHARS }
                : { pages: 2, scale: 1.5, maxChars: 4000 };

            setThinkingContext('No text found, running OCR on scanned pages...');
            const ocrPages = Math.min(pdf.numPages || 0, ocrPreset.pages);
            let ocrText = '';
            for (let pageNum = 1; pageNum <= ocrPages; pageNum += 1) {
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
                ocrText += `${result?.data?.text || ''}\n`;
                if (ocrText.length >= ocrPreset.maxChars) {
                    ocrText = ocrText.slice(0, ocrPreset.maxChars);
                    break;
                }
            }

            cleaned = ocrText.replace(/\s+/g, ' ').trim();
            if (cleaned) {
                pdfTextCacheRef.current.set(cacheKey, cleaned);
            }
            return cleaned;
        } catch (err) {
            return '';
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
        if (aiLocked) {
            setShowUpgradeModal(true);
            return;
        }
        if (!input.trim() || isLoading) return;

        const userQuery = input;
        const currentRefs = [...selectedRefs];
        setThinkingContext(currentRefs.length > 0 ? 'Reviewing selected documents...' : 'Formulating response...');
        setMessages(prev => [...prev, { 
            role: 'user', 
            text: userQuery, 
            refs: currentRefs.map(r => r.title) 
        }]);
        
        setInput('');
        setSelectedRefs([]);
        setIsLoading(true);

        try {
            const systemPrompt = `You are Zen, a world-class educational AI specialized in document analysis and study assistance.

FORMATTING RULES:
1. Use '### ' for section headers.
2. Use bullet points (- ) for lists.
3. Use **bold** for key terms and concepts.
4. Use '---' for horizontal dividers between major sections.
5. Keep paragraphs concise with generous spacing.

TONE:
Maintain a calm, minimalist, and encouraging persona. Focus heavily on synthesis between different documents if multiple are provided.`;

            let userMessage = '';

            if (currentRefs.length > 0) {
                const resolvedRefs = await Promise.all(currentRefs.map(async (ref) => {
                    if (ref.type !== 'pdf') return ref;
                    if (ref.content && ref.content.trim().length > 0) return ref;

                    let extracted = '';
                    if (ref.file?.text) {
                        extracted = ref.file.text;
                    } else if (ref.file?.key) {
                        try {
                            const url = ref.file.url || await getPdfSignedUrl(ref.file.key);
                            extracted = await extractPdfText(url, ref.file.key || ref.id);
                        } catch (_) {
                            extracted = '';
                        }
                    } else if (ref.legacyData && ref.legacyData.startsWith('data:')) {
                        extracted = await extractPdfText(ref.legacyData, ref.id);
                    } else if (ref.content && ref.content.startsWith('data:')) {
                        extracted = await extractPdfText(ref.content, ref.id);
                    }

                    if (extracted) {
                        persistPdfText(ref, extracted);
                    }

                    return { ...ref, content: extracted };
                }));

                const perDocLimit = Math.max(
                    MIN_CONTEXT_CHARS_PER_DOC,
                    Math.floor(MAX_CONTEXT_CHARS / Math.max(resolvedRefs.length, 1))
                );

                userMessage += "CONTEXT PROVIDED BY STUDENT:\n\n";
                resolvedRefs.forEach(ref => {
                    let content = (ref.content || '').trim();

                    if (ref.type === 'pdf') {
                        if (!content) {
                            content = "No readable text could be extracted from this PDF (including OCR). If this is a scanned document, try an OCR-exported PDF or paste key sections so I can help.";
                        }
                    }

                    if (content.length > perDocLimit) {
                        content = `${content.slice(0, perDocLimit)}... [truncated]`;
                    }

                    userMessage += `[Document Title: ${ref.title}]\nTYPE: ${ref.type.toUpperCase()}\nCONTENT:\n${content}\n--- End of Document ---\n\n`;
                });
            }
            
            setThinkingContext('Formulating response...');
            userMessage += `\nSTUDENT'S QUESTION:\n${userQuery}`;

            const prompt = `${systemPrompt}\n\n${userMessage}`;

            const response = await apiFetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, mode: analysisMode }),
            });

            if (!response.ok) {
                throw new Error(`AI request failed (${response.status})`);
            }

            const data = await response.json();
            const aiText = data.text || 'No response from AI.';
            
            setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
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
            setMessages(prev => [...prev, { role: 'ai', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleRef = (ref: SelectedRef) => {
        setSelectedRefs(prev => 
            prev.find(r => r.id === ref.id && r.source === ref.source && r.folderId === ref.folderId) 
                ? prev.filter(r => !(r.id === ref.id && r.source === ref.source && r.folderId === ref.folderId))
                : [...prev, ref]
        );
    };

    return (
        <div className="fixed inset-0 bg-zen-bg z-[110] flex flex-col animate-fade-in overflow-hidden">
            
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-zen-primary/10 blur-[120px] rounded-full animate-float" />
                <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-zen-secondary/5 blur-[100px] rounded-full animate-float [animation-delay:2s]" />
            </div>

            {/* Header */}
            <header className="px-4 py-4 md:px-6 md:py-6 border-b border-zen-surface bg-zen-bg/80 backdrop-blur-xl sticky top-0 z-[120] flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-zen-card border border-zen-surface rounded-2xl flex items-center justify-center text-zen-primary shadow-lg ring-1 ring-zen-primary/10">
                        <IconBot className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h2 className="text-base md:text-lg font-medium text-zen-text-primary leading-tight">Zen Intelligence</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-zen-primary animate-pulse" />
                            <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-zen-primary font-black">Context Engine Active</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={clearChat}
                        className="p-2 md:p-3 bg-zen-surface/50 rounded-2xl text-zen-text-secondary hover:text-zen-primary hover:bg-zen-primary/10 transition-all active:scale-90"
                        aria-label="Clear chat"
                    >
                        <IconTrash className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button onClick={onClose} className="p-2 md:p-3 bg-zen-surface/50 rounded-2xl text-zen-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-90" aria-label="Close">
                        <IconX className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>
            </header>

            {showUpgradeModal && aiLocked && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-2xl animate-fade-in"
                        onClick={() => setShowUpgradeModal(false)}
                    />

                    {/* Modal */}
                    <div
                        className="relative w-full max-w-sm sm:max-w-xl bg-zen-card/95 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-[2.5rem] animate-slide-up max-h-[90svh] overflow-hidden pb-[env(safe-area-inset-bottom)] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Upgrade to Premium"
                    >
                        {/* Glow accents */}
                        <div className="absolute -top-10 -right-10 w-48 h-48 bg-zen-primary/10 blur-[80px] rounded-full pointer-events-none" />
                        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-zen-secondary/10 blur-[80px] rounded-full pointer-events-none" />

                        <button
                            onClick={() => setShowUpgradeModal(false)}
                            className="absolute top-5 right-5 z-10 p-2 rounded-full bg-zen-surface/70 text-zen-text-secondary hover:text-zen-text-primary transition-all active:scale-90"
                            aria-label="Close"
                        >
                            <IconX className="w-5 h-5" />
                        </button>

                        <div className="px-6 sm:px-10 pt-5 sm:pt-8 pb-4 border-b border-white/5 flex-none">

                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-zen-primary/15 text-zen-primary flex items-center justify-center border border-zen-primary/20">
                                    <IconBot className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-black">
                                        Premium Feature
                                    </p>
                                    <h3 className="text-[22px] sm:text-3xl font-light text-zen-text-primary tracking-tight">
                                        Unlock Zen AI
                                    </h3>
                                </div>
                            </div>

                            <p className="mt-3 text-[13px] sm:text-base text-zen-text-secondary leading-relaxed">
                                Upgrade to get deep document analysis, synthesis across your library, and guided study workflows.
                            </p>
                        </div>

                        <div className="px-6 sm:px-10 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-2xl bg-zen-surface/50 border border-white/5">
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-zen-text-disabled font-black">Monthly</p>
                                    <p className="mt-1.5 text-lg font-light text-zen-text-primary">PHP 149</p>
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-zen-text-disabled font-black mt-0.5">per month</p>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-zen-surface/50 border border-white/5">
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-zen-text-disabled font-black">Yearly</p>
                                    <p className="mt-1.5 text-lg font-light text-zen-text-primary">PHP 1490</p>
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-zen-text-disabled font-black mt-0.5">per year</p>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {[
                                    'Analyze notes and PDFs with context',
                                    'Summarize and compare across documents',
                                    'Generate practice questions and review plans',
                                ].map((item) => (
                                    <div key={item} className="flex items-start gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zen-primary/80 shrink-0" />
                                        <p className="text-[13px] text-zen-text-primary leading-relaxed">{item}</p>
                                    </div>
                                ))}
                            </div>

                            <p className="text-center text-[9px] uppercase font-black tracking-[0.35em] text-zen-text-disabled opacity-60">
                                Payments via GCash or bank available in Billing
                            </p>
                        </div>

                        <div className="px-6 sm:px-10 py-5 border-t border-white/5 bg-zen-card/60 backdrop-blur-2xl flex-none">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    ref={upgradeCtaRef}
                                    onClick={openBilling}
                                    className="py-3.5 rounded-2xl bg-zen-primary text-zen-bg text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-zen-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all"
                                >
                                    Upgrade to Premium
                                </button>
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    className="py-3.5 rounded-2xl bg-zen-surface/70 text-zen-text-secondary text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] border border-white/5 hover:border-zen-primary/30 transition-all"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 no-scrollbar relative z-[115] w-full max-w-4xl mx-auto">
                {!billingChecked && (
                    <div className="p-4 md:p-5 rounded-2xl md:rounded-[2rem] bg-zen-surface/60 border border-zen-surface text-zen-text-secondary text-xs md:text-sm font-medium">
                        Checking your plan...
                    </div>
                )}
                
                {/* Empty State / Splash */}
                {messages.length === 0 && !isLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 md:space-y-6 animate-reveal py-8 md:py-16">
                        <div className="relative">
                            <div className="absolute inset-0 bg-zen-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                            <IconBot className="w-12 h-12 md:w-16 md:h-16 text-zen-primary relative z-10" />
                        </div>
                        <div className="space-y-2 md:space-y-3 max-w-lg px-4">
                            <h3 className="text-xl md:text-3xl font-extralight text-zen-text-primary tracking-tight">How can I assist your discovery?</h3>
                            <p className="text-xs md:text-base text-zen-text-secondary font-light">
                                Reference your archive documents or ask any academic question. I am here to synthesize knowledge.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl mt-6 md:mt-10 px-4">
                            <button
                                disabled={aiLocked}
                                onClick={() => setInput("Explain the core concepts from my recent notes.")}
                                className={`p-4 md:p-6 border rounded-[1.5rem] md:rounded-[2rem] text-left transition-all group ${
                                    aiLocked ? 'bg-zen-surface/40 border-zen-surface text-zen-text-disabled cursor-not-allowed opacity-60' : 'bg-zen-card border-zen-surface hover:border-zen-primary/30 hover:bg-zen-surface/30'
                                }`}
                            >
                                <p className="text-[9px] md:text-[10px] text-zen-primary uppercase font-bold tracking-widest mb-1 md:mb-2">Synthesis</p>
                                <p className="text-xs md:text-sm text-zen-text-primary font-medium group-hover:text-zen-primary">"Summarize the key themes in my library..."</p>
                            </button>
                            <button
                                disabled={aiLocked}
                                onClick={() => setInput("Generate 5 complex practice questions based on these materials.")}
                                className={`p-4 md:p-6 border rounded-[1.5rem] md:rounded-[2rem] text-left transition-all group ${
                                    aiLocked ? 'bg-zen-surface/40 border-zen-surface text-zen-text-disabled cursor-not-allowed opacity-60' : 'bg-zen-card border-zen-surface hover:border-zen-primary/30 hover:bg-zen-surface/30'
                                }`}
                            >
                                <p className="text-[9px] md:text-[10px] text-zen-secondary uppercase font-bold tracking-widest mb-1 md:mb-2">Practice</p>
                                <p className="text-xs md:text-sm text-zen-text-primary font-medium group-hover:text-zen-secondary">"Create a quick quiz for my active recall..."</p>
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-reveal'}`}>
                        {msg.refs && msg.refs.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 mr-4">
                                {msg.refs.map((r, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-gradient-to-r from-zen-surface to-transparent px-4 py-2 rounded-full border border-zen-primary/10">
                                        <IconFileText className="w-3 h-3 text-zen-primary" />
                                        <span className="text-[10px] text-zen-text-secondary font-bold truncate max-w-[150px]">{r}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className={`max-w-[88%] sm:max-w-[72%] lg:max-w-[62%] p-3 sm:p-4 md:p-5 rounded-2xl text-sm md:text-base leading-relaxed shadow-xl relative ${
                            msg.role === 'user' 
                                ? 'bg-white text-black font-medium rounded-tr-md' 
                                : 'bg-zen-card/80 backdrop-blur-md text-zen-text-primary border border-white/5 rounded-tl-md'
                        }`}>
                            {msg.role === 'ai' ? <FormattedAIResponse text={msg.text} /> : msg.text}
                            
                            {/* Accent indicator for AI messages */}
                            {msg.role === 'ai' && (
                                <div className="absolute top-0 left-0 -translate-x-1/2 translate-y-6 w-0.5 h-6 bg-zen-primary rounded-full blur-[1px] opacity-50" />
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-reveal">
                        <div className="bg-zen-card/80 backdrop-blur-sm p-4 rounded-2xl rounded-tl-md border border-zen-surface shadow-xl space-y-2 min-w-[220px]">
                            <div className="flex gap-2.5 items-center">
                                <div className="w-2.5 h-2.5 bg-zen-primary rounded-full animate-bounce" />
                                <div className="w-2.5 h-2.5 bg-zen-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-2.5 h-2.5 bg-zen-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                            <div>
                                <p className="text-[10px] text-zen-primary uppercase font-black tracking-[0.3em]">
                                    Thinking
                                    <span className="inline-flex ml-1">
                                        <span className="animate-pulse">.</span>
                                        <span className="animate-pulse [animation-delay:0.2s]">.</span>
                                        <span className="animate-pulse [animation-delay:0.4s]">.</span>
                                    </span>
                                </p>
                                <p className="text-[11px] text-zen-text-secondary mt-1">{thinkingContext}</p>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-32" />
            </div>

            {/* Context Selector Portal */}
            {showSelector && (
                <div className="fixed inset-0 bg-zen-bg/60 backdrop-blur-xl z-[150] flex items-end sm:items-center justify-center p-0 md:p-6 animate-fade-in" onClick={() => setShowSelector(false)}>
                    <div className="bg-zen-card w-full max-w-2xl h-[85vh] sm:h-auto sm:max-h-[80vh] flex flex-col animate-slide-up shadow-2xl rounded-t-[3rem] text-sm sm:rounded-[3rem] border border-zen-surface" onClick={e => e.stopPropagation()}>
                        <div className="p-6 md:p-10 border-b border-zen-surface flex justify-between items-center bg-zen-card/50">
                            <div>
                                <h3 className="text-xl md:text-2xl font-light text-zen-text-primary">Source Material</h3>
                                <p className="text-xs md:text-sm text-zen-text-secondary mt-1">Select context for the Intelligence Engine.</p>
                            </div>
                            <button onClick={() => setShowSelector(false)} className="p-3 md:p-4 bg-zen-surface/50 rounded-2xl text-zen-text-secondary hover:text-zen-text-primary transition-all">
                                <IconX className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>
                        
                        <div className="flex px-6 md:px-10 pt-4 md:pt-6 gap-6 md:gap-8 border-b border-zen-surface/30 overflow-x-auto no-scrollbar">
                            <button onClick={() => setSelectorTab('library')} className={`pb-3 md:pb-4 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] transition-all relative shrink-0 ${selectorTab === 'library' ? 'text-zen-primary' : 'text-zen-text-disabled'}`}>
                                Library Archive
                                {selectorTab === 'library' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zen-primary rounded-full" />}
                            </button>
                            <button onClick={() => setSelectorTab('tasks')} className={`pb-3 md:pb-4 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] transition-all relative shrink-0 ${selectorTab === 'tasks' ? 'text-zen-primary' : 'text-zen-text-disabled'}`}>
                                Task Assets
                                {selectorTab === 'tasks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zen-primary rounded-full" />}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 no-scrollbar">
                           {/* ... keep selection content logic same but ensure premium styles ... */}
                           {selectorTab === 'library' ? (
                                state.folders.filter(f => f.items.length > 0).map(folder => (
                                    <div key={folder.id} className="space-y-3 md:space-y-4">
                                        <div className="flex items-center gap-3 text-zen-text-disabled px-2">
                                            <IconFolder className="w-4 h-4" />
                                            <span className="text-[10px] uppercase font-black tracking-[0.3em]">{folder.name}</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 md:gap-3">
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
                                                        className={`w-full flex items-center justify-between p-4 md:p-5 rounded-2xl border transition-all ${isSelected ? 'bg-zen-primary/10 border-zen-primary/40 text-zen-primary ring-1 ring-zen-primary/20' : 'bg-zen-surface/30 border-zen-surface text-zen-text-secondary hover:border-zen-surface-brighter'}`}
                                                    >
                                                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-zen-primary/20' : 'bg-zen-surface'}`}>
                                                                {item.type === 'pdf' ? <IconPaperclip className="w-4 h-4 md:w-5 md:h-5" /> : <IconFileText className="w-4 h-4 md:w-5 md:h-5" />}
                                                            </div>
                                                            <div className="text-left overflow-hidden">
                                                                <span className="text-xs md:text-sm font-medium block truncate max-w-[200px] md:max-w-[250px]">{item.title}</span>
                                                                <span className="text-[9px] uppercase opacity-50 font-black tracking-widest">{item.type === 'pdf' ? 'Archived PDF' : 'Text Knowledge'}</span>
                                                            </div>
                                                        </div>
                                                        {isSelected ? <div className="w-5 h-5 md:w-6 md:h-6 bg-zen-primary text-zen-bg rounded-full flex items-center justify-center shrink-0"><IconCheck className="w-3 h-3 md:w-4 md:h-4" /></div> : <div className="w-5 h-5 md:w-6 md:h-6 border border-zen-surface rounded-full shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                           ) : (
                                <div className="grid grid-cols-1 gap-2 md:gap-3">
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
                                                className={`w-full flex items-center justify-between p-4 md:p-5 rounded-2xl border transition-all ${isSelected ? 'bg-zen-primary/10 border-zen-primary/40 text-zen-primary shadow-inner ring-1 ring-zen-primary/20' : 'bg-zen-surface/30 border-zen-surface text-zen-text-secondary hover:border-zen-surface-brighter'}`}
                                            >
                                                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-zen-primary/20' : 'bg-zen-surface'}`}>
                                                        <IconPaperclip className="w-4 h-4 md:w-5 md:h-5" />
                                                    </div>
                                                    <div className="text-left overflow-hidden">
                                                        <span className="text-xs md:text-sm font-medium block truncate max-w-[200px] md:max-w-[250px]">{task.pdfAttachment!.name}</span>
                                                        <span className="text-[9px] uppercase opacity-50 font-black tracking-widest">Source: {task.title}</span>
                                                    </div>
                                                </div>
                                                {isSelected ? <div className="w-5 h-5 md:w-6 md:h-6 bg-zen-primary text-zen-bg rounded-full flex items-center justify-center shrink-0"><IconCheck className="w-3 h-3 md:w-4 md:h-4" /></div> : <div className="w-5 h-5 md:w-6 md:h-6 border border-zen-surface rounded-full shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                           )}
                           
                           {/* Empty state for selector */}
                           {((selectorTab === 'library' && state.folders.every(f => f.items.length === 0)) || (selectorTab === 'tasks' && state.tasks.filter(t => t.pdfAttachment).length === 0)) && (
                                <div className="py-20 text-center opacity-30">
                                    <IconFileText className="w-12 h-12 mx-auto mb-4" />
                                    <p className="text-lg font-light">No source material found.</p>
                                </div>
                           )}
                        </div>
                        
                        <div className="p-6 md:p-10 pt-2 bg-zen-card/50 rounded-b-[3rem]">
                            <button onClick={() => setShowSelector(false)} className="w-full py-4 md:py-5 bg-zen-primary text-zen-bg font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-xl shadow-zen-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all text-xs md:text-sm">
                                Integrate Selected Context
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Input Bar Section */}
            <div className="p-3 md:p-6 border-t border-white/5 bg-zen-bg/95 backdrop-blur-2xl relative z-[130] safe-area-bottom">
                <div className="max-w-3xl mx-auto space-y-3 md:space-y-4">
                    
                    {/* Active Context Tokens */}
                    {selectedRefs.length > 0 && (
                        <div className="flex flex-wrap gap-2 animate-reveal">
                            {selectedRefs.map(ref => (
                                <div key={ref.id} className="flex items-center gap-2 bg-zen-primary/10 border border-zen-primary/30 rounded-xl pl-3 pr-1.5 py-1.5 md:py-2 shadow-inner">
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-zen-primary truncate max-w-[120px] md:max-w-[150px]">{ref.title}</span>
                                    <button type="button" onClick={() => toggleRef(ref)} className="p-1 rounded-lg hover:bg-zen-primary/20 text-zen-primary transition-colors">
                                        <IconX className="w-3 h-3 md:w-4 md:h-4" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => setSelectedRefs([])} className="px-3 text-[9px] uppercase font-black text-zen-text-disabled hover:text-red-400 transition-colors">Clear Engine</button>
                        </div>
                    )}

                    <form ref={formRef} onSubmit={handleSend} className="relative group">
                        <div className="absolute inset-0 bg-zen-primary/5 blur-xl group-focus-within:bg-zen-primary/10 transition-colors rounded-2xl" />
                        <div className="relative flex items-end gap-2 md:gap-3 bg-zen-card/80 border border-zen-surface rounded-2xl p-2 md:p-2.5 pl-3 md:pl-3.5 pr-2 md:pr-2.5 focus-within:border-zen-primary/50 transition-all shadow-xl">
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
                                className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl transition-all flex items-center justify-center border ${
                                    aiLocked
                                        ? 'bg-zen-surface/40 border-zen-surface text-zen-text-disabled cursor-not-allowed opacity-60'
                                        : selectedRefs.length > 0
                                            ? 'bg-zen-primary border-zen-primary text-zen-bg shadow-lg'
                                            : 'bg-zen-surface/50 border-zen-surface text-zen-text-secondary hover:text-zen-primary hover:bg-zen-primary/5'
                                }`}
                            >
                                <IconPaperclip className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                            
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder={selectedRefs.length > 0 ? "Ask about the documents..." : "Ask your assistant anything..."}
                                disabled={isLoading || aiLocked}
                                rows={1}
                                className="flex-1 bg-transparent border-none text-sm md:text-base text-zen-text-primary focus:outline-none focus:ring-0 placeholder:text-zen-text-disabled/30 font-light min-w-0 resize-none leading-relaxed py-1.5 md:py-2 max-h-32"
                            />

                            <button 
                                type="submit"
                                disabled={!input.trim() || isLoading || aiLocked} 
                                className="h-9 md:h-12 px-3 md:px-6 bg-white text-black rounded-xl md:rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] disabled:opacity-5 shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 md:w-4 md:h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="hidden md:inline">Transmit</span>
                                        <IconChevronRight className="w-4 h-4 md:ml-1" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                    
                    <div className="flex items-center justify-center gap-3 text-[8px] md:text-[9px] uppercase font-black tracking-[0.35em] text-zen-text-disabled opacity-40 select-none pb-2 md:pb-0">
                        <button
                            type="button"
                            onClick={() => setAnalysisMode(prev => (prev === 'deep' ? 'fast' : 'deep'))}
                            className={`px-3 py-1 rounded-full border transition-all ${
                                analysisMode === 'deep'
                                    ? 'border-zen-primary/50 text-zen-primary bg-zen-primary/10'
                                    : 'border-zen-surface text-zen-text-disabled hover:text-zen-text-primary'
                            }`}
                            aria-label="Toggle deep analysis"
                        >
                            {analysisMode === 'deep' ? 'Deep analysis' : 'Fast mode'}
                        </button>
                        <span>Zen Synthetic Intelligence &bull; Adaptive Learning Context</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ZenAI;
