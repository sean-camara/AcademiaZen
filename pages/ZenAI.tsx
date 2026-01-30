
import React, { useState, useRef, useEffect } from 'react';
import { IconX, IconBot, IconPaperclip, IconFileText, IconChevronRight, IconFolder, IconCheck, IconTrash } from '../components/Icons';
import { useZen } from '../context/ZenContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { getPdfSignedUrl } from '../utils/pdfStorage';
import { PdfAttachment, AIChatMessage } from '../types';

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
                        {processInlines(trimmed)}
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
                        <span className="leading-relaxed opacity-90 text-white/80">{processInlines(content)}</span>
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
                        <span className="leading-relaxed opacity-90 text-white/80">{processInlines(match?.[2] || "")}</span>
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
                    {processInlines(trimmed)}
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
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const upgradeCtaRef = useRef<HTMLButtonElement>(null);
    const hasShownUpgradeOnceRef = useRef(false);
    const pdfTextCacheRef = useRef<Map<string, string>>(new Map());
    const hasLoadedChatRef = useRef(false);
    const hasAppliedRemoteChatRef = useRef(false);

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
        return lastA.role === lastB.role && lastA.text === lastB.text && lastA.createdAt === lastB.createdAt;
    };

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
        clearAIChat();
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
            // Detect academic task keywords in document titles and content
            const isAcademicTask = currentRefs.some(ref => {
                const titleLower = ref.title.toLowerCase();
                const contentLower = (ref.content || '').toLowerCase();
                const combined = `${titleLower} ${contentLower.slice(0, 2000)}`;
                
                const taskKeywords = [
                    'laboratory', 'lab exercise', 'lab activity', 'lab ', 'assignment',
                    'task', 'exercise', 'activity', 'homework', 'exam', 'quiz',
                    'problem set', 'worksheet', 'practical', 'assessment',
                    'instructions:', 'procedure:', 'requirements:', 'deliverables:',
                    'objective:', 'objectives:', 'submit', 'submission', 'answer the following',
                    'complete the', 'perform the', 'write a program', 'implement',
                    'create a', 'develop a', 'design a'
                ];
                
                return taskKeywords.some(keyword => combined.includes(keyword));
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
                    'coding', 'programming', 'script', 'compile', 'execute', 'debug',
                    'java', 'python', 'javascript', 'c++', 'c#', 'php', 'ruby',
                    'html', 'css', 'sql', 'react', 'node', 'typescript'
                ];
                
                return programmingKeywords.some(keyword => combined.includes(keyword));
            });

            // Detect ambiguous "do the work" prompts
            const isAnswerRequest = /^(answer|solve|do|complete|finish|work on|help with)(\s+the|\s+this|\s+my)?\s*(pdf|document|task|assignment|lab|exercise|activity|homework)?$/i.test(userQuery.trim());

            // Activate STUDENT ANSWER MODE if academic task detected or ambiguous answer request
            const useStudentMode = isAcademicTask || (isAnswerRequest && currentRefs.length > 0);

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
                systemPrompt = `You are Zen, a world-class educational AI specialized in document analysis and study assistance.

FORMATTING RULES:
1. Use '### ' for section headers.
2. Use bullet points (- ) for lists.
3. Use **bold** for key terms and concepts.
4. Use '---' for horizontal dividers between major sections.
5. Keep paragraphs concise with generous spacing.

TONE:
Maintain a calm, minimalist, and encouraging persona. Focus heavily on synthesis between different documents if multiple are provided.`;
            }

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

                const contextLabel = useStudentMode ? "ACADEMIC TASK DOCUMENT:" : "CONTEXT PROVIDED BY STUDENT:";
                userMessage += `${contextLabel}\n\n`;
                
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
            
            if (useStudentMode) {
                userMessage += `\nSTUDENT REQUEST: Complete all tasks/requirements from the document above. Produce submission-ready work.\n`;
                if (userQuery.trim().length > 0 && !isAnswerRequest) {
                    userMessage += `Additional context: ${userQuery}`;
                }
            } else {
                userMessage += `\nSTUDENT'S QUESTION:\n${userQuery}`;
            }

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
        <div className="fixed inset-0 bg-[#0A0C0F] z-[110] flex flex-col animate-fade-in overflow-hidden font-sans">
            
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse [animation-duration:8s]" />
                <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[30%] bg-purple-500/5 blur-[100px] rounded-full animate-pulse [animation-duration:6s]" />
            </div>

            {/* Header */}
            <header className="px-5 py-4 border-b border-white/5 bg-[#0A0C0F]/80 backdrop-blur-xl sticky top-0 z-[120] flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                        <IconBot className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-medium text-white tracking-tight">Zen Intelligence</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-500 font-bold">Context Engine Active</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={clearChat}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-95"
                        aria-label="Clear chat"
                    >
                        <IconTrash className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/10 flex items-center justify-center text-white/40 hover:text-red-400 transition-all active:scale-95 border border-transparent hover:border-red-500/20" 
                        aria-label="Close"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Upgrade Modal */}
            {showUpgradeModal && aiLocked && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowUpgradeModal(false)} />
                    <div className="relative w-full max-w-lg bg-[#0D1117] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-8 pb-6 border-b border-white/5">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                    <IconBot className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-500 font-black mb-1">Premium</p>
                                    <h3 className="text-2xl text-white font-medium">Unlock Intelligence</h3>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Get deep document analysis, synthesis across your library, and guided study workflows.
                            </p>
                        </div>
                        <div className="p-8 pt-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Monthly</p>
                                    <p className="text-xl text-white font-medium">₱149</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Yearly</p>
                                    <p className="text-xl text-white font-medium">₱1490</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <button onClick={openBilling} className="py-4 bg-emerald-500 hover:bg-emerald-400 text-[#091510] font-bold text-xs uppercase tracking-widest rounded-xl transition-colors">
                                    Upgrade Now
                                </button>
                                <button onClick={() => setShowUpgradeModal(false)} className="py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors">
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 md:p-8 lg:p-12 space-y-6 md:space-y-8 relative z-[115] w-full max-w-4xl mx-auto custom-scrollbar">
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

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-reveal'}`}>
                        {msg.refs && msg.refs.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 mr-2">
                                {msg.refs.map((r, i) => (
                                    <span key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 font-medium">
                                        {r}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] p-4 md:p-6 lg:p-7 rounded-2xl md:rounded-3xl text-sm md:text-base leading-relaxed md:leading-7 relative ${
                            msg.role === 'user' 
                                ? 'bg-white/10 text-white rounded-br-sm' 
                                : 'bg-gradient-to-br from-white/5 to-transparent border border-white/5 text-gray-200 rounded-bl-sm backdrop-blur-md'
                        }`}>
                            {msg.role === 'ai' ? <FormattedAIResponse text={msg.text} /> : msg.text}
                            
                            {msg.role === 'ai' && (
                                <div className="absolute top-6 -left-3 w-1 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-reveal pl-4">
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                            </div>
                            <span className="text-xs text-emerald-500 font-medium tracking-wide">Thinking...</span>
                        </div>
                    </div>
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
            <div className="p-4 md:p-6 lg:p-8 pb-6 md:pb-8 bg-[#0A0C0F]/95 backdrop-blur-2xl relative z-[130] border-t border-white/5">
                <div className="max-w-4xl mx-auto space-y-4">
                    
                    {/* Active Context Tokens */}
                    {selectedRefs.length > 0 && (
                        <div className="flex flex-wrap gap-2 md:gap-3 animate-reveal">
                            {selectedRefs.map(ref => (
                                <div key={ref.id} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg pl-3 pr-2 py-2 shadow-sm">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 truncate max-w-[150px]">{ref.title}</span>
                                    <button type="button" onClick={() => toggleRef(ref)} className="p-0.5 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors">
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => setSelectedRefs([])} className="px-3 text-[9px] uppercase font-black text-gray-500 hover:text-red-400 transition-colors">Clear Engine</button>
                        </div>
                    )}

                    <form ref={formRef} onSubmit={handleSend} className="relative group">
                        <div className="absolute inset-0 bg-emerald-500/5 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                        
                        {/* Unified Prompt Terminal Container */}
                        <div className="relative bg-[#161B22]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 focus-within:border-emerald-500/30 ring-1 ring-white/0 focus-within:ring-emerald-500/20 transition-all duration-300">
                            
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
                                placeholder={selectedRefs.length > 0 ? "Ask about the documents..." : "Ask your assistant anything..."}
                                disabled={isLoading || aiLocked}
                                rows={1}
                                className="w-full bg-transparent border-none text-base text-white focus:outline-none focus:ring-0 placeholder:text-gray-600 font-light resize-none leading-relaxed min-h-[44px] max-h-[160px] py-0 px-1"
                            />

                            {/* Bottom: Toolbar Actions */}
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-3">
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
                                        className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center border ${
                                            aiLocked
                                                ? 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                                                : selectedRefs.length > 0
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                        title="Attach context"
                                    >
                                        <IconPaperclip className="w-4 h-4" />
                                    </button>

                                    {/* Integrated Mode Selector Pill */}
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisMode(prev => (prev === 'deep' ? 'fast' : 'deep'))}
                                        className={`h-9 px-4 rounded-xl border text-[10px] uppercase font-black tracking-wider transition-all flex items-center gap-2 ${
                                            analysisMode === 'deep'
                                                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                                : 'border-white/10 text-gray-400 bg-white/5 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${analysisMode === 'deep' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-500'}`} />
                                        <span>{analysisMode === 'deep' ? 'Deep' : 'Fast'}</span>
                                    </button>
                                </div>

                                {/* Send Button */}
                                <button 
                                    type="submit"
                                    disabled={!input.trim() || isLoading || aiLocked} 
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                        !input.trim() || isLoading || aiLocked 
                                         ? 'bg-white/5 text-gray-600 cursor-not-allowed' 
                                         : 'bg-emerald-500 text-[#091510] hover:bg-emerald-400 hover:scale-105 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                                    }`}
                                >
                                    {isLoading ? (
                                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <IconChevronRight className="w-5 h-5" />
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
