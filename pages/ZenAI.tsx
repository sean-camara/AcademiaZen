
import React, { useState, useRef, useEffect } from 'react';
import { IconX, IconBot, IconPaperclip, IconFileText, IconChevronRight, IconFolder, IconCheck } from '../components/Icons';
import { useZen } from '../context/ZenContext';
import { apiFetch } from '../utils/api';

// AI model handled by backend

interface SelectedRef {
    id: string;
    title: string;
    type: 'note' | 'pdf';
    content: string;
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
                            <span className="text-zen-primary font-bold">•</span>
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
    const { state } = useZen();
    const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string, refs?: string[]}[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRefs, setSelectedRefs] = useState<SelectedRef[]>([]);
    const [showSelector, setShowSelector] = useState(false);
    const [selectorTab, setSelectorTab] = useState<'library' | 'tasks'>('library');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        if (!textareaRef.current) return;
        textareaRef.current.style.height = '0px';
        const next = Math.min(textareaRef.current.scrollHeight, 160);
        textareaRef.current.style.height = `${Math.max(next, 44)}px`;
    }, [input]);

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

        const userQuery = input;
        const currentRefs = [...selectedRefs];
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
                userMessage += "CONTEXT PROVIDED BY STUDENT:\n\n";
                currentRefs.forEach(ref => {
                    userMessage += `[Document Title: ${ref.title}]\nCONTENT:\n${ref.content}\n--- End of Document ---\n\n`;
                });
            }
            
            userMessage += `\nSTUDENT'S QUESTION:\n${userQuery}`;

            const prompt = `${systemPrompt}\n\n${userMessage}`;

            const response = await apiFetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
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
            prev.find(r => r.id === ref.id) 
                ? prev.filter(r => r.id !== ref.id)
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
                <button onClick={onClose} className="p-2 md:p-3 bg-zen-surface/50 rounded-2xl text-zen-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-90">
                    <IconX className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 md:space-y-12 no-scrollbar relative z-[115]">
                
                {/* Empty State / Splash */}
                {messages.length === 0 && !isLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 animate-reveal py-10 md:py-20">
                        <div className="relative">
                            <div className="absolute inset-0 bg-zen-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                            <IconBot className="w-16 h-16 md:w-20 md:h-20 text-zen-primary relative z-10" />
                        </div>
                        <div className="space-y-3 md:space-y-4 max-w-lg px-4">
                            <h3 className="text-2xl md:text-4xl font-extralight text-zen-text-primary tracking-tight">How can I assist your discovery?</h3>
                            <p className="text-sm md:text-lg text-zen-text-secondary font-light">
                                Reference your archive documents or ask any academic question. I am here to synthesize knowledge.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl mt-8 md:mt-12 px-4">
                            <button onClick={() => setInput("Explain the core concepts from my recent notes.")} className="p-4 md:p-6 bg-zen-card border border-zen-surface rounded-[1.5rem] md:rounded-[2rem] text-left hover:border-zen-primary/30 hover:bg-zen-surface/30 transition-all group">
                                <p className="text-[9px] md:text-[10px] text-zen-primary uppercase font-bold tracking-widest mb-1 md:mb-2">Synthesis</p>
                                <p className="text-xs md:text-sm text-zen-text-primary font-medium group-hover:text-zen-primary">"Summarize the key themes in my library..."</p>
                            </button>
                            <button onClick={() => setInput("Generate 5 complex practice questions based on these materials.")} className="p-4 md:p-6 bg-zen-card border border-zen-surface rounded-[1.5rem] md:rounded-[2rem] text-left hover:border-zen-primary/30 hover:bg-zen-surface/30 transition-all group">
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
                        <div className={`max-w-[95%] sm:max-w-[80%] p-6 sm:p-10 rounded-[2.5rem] text-lg leading-relaxed shadow-2xl relative ${
                            msg.role === 'user' 
                                ? 'bg-white text-black font-medium rounded-tr-none' 
                                : 'bg-zen-card/80 backdrop-blur-md text-zen-text-primary border border-white/5 rounded-tl-none'
                        }`}>
                            {msg.role === 'ai' ? <FormattedAIResponse text={msg.text} /> : msg.text}
                            
                            {/* Accent indicator for AI messages */}
                            {msg.role === 'ai' && (
                                <div className="absolute top-0 left-0 -translate-x-1/2 translate-y-8 w-1 h-8 bg-zen-primary rounded-full blur-[2px] opacity-50" />
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-reveal">
                        <div className="bg-zen-card/80 backdrop-blur-sm p-8 rounded-[2.5rem] rounded-tl-none border border-zen-surface shadow-2xl space-y-4 min-w-[300px]">
                            <div className="flex gap-2.5 items-center">
                                <div className="w-2.5 h-2.5 bg-zen-primary rounded-full animate-bounce" />
                                <div className="w-2.5 h-2.5 bg-zen-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-2.5 h-2.5 bg-zen-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] text-zen-primary uppercase font-black tracking-[0.4em] animate-pulse">Scanning Archive</p>
                                <div className="h-1 bg-zen-surface rounded-full overflow-hidden w-full">
                                    <div className="h-full bg-zen-primary/40 animate-progress" />
                                </div>
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
                                                return (
                                                    <button 
                                                        key={item.id}
                                                        onClick={() => toggleRef({ id: item.id, title: item.title, type: item.type, content: item.content || '' })}
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
                                        return (
                                            <button 
                                                key={task.id}
                                                onClick={() => toggleRef({ id: task.id, title: task.pdfAttachment!.name, type: 'pdf', content: task.pdfAttachment!.data })}
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
            <div className="p-4 md:p-10 border-t border-white/5 bg-zen-bg/95 backdrop-blur-2xl relative z-[130] safe-area-bottom">
                <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
                    
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
                        <div className="absolute inset-0 bg-zen-primary/5 blur-xl group-focus-within:bg-zen-primary/10 transition-colors rounded-full" />
                        <div className="relative flex items-end gap-2 md:gap-4 bg-zen-card/80 border border-zen-surface rounded-[2rem] md:rounded-[2.5rem] p-2 md:p-3 pl-3 md:pl-4 pr-2 md:pr-3 focus-within:border-zen-primary/50 transition-all shadow-2xl">
                            <button 
                                type="button"
                                onClick={() => setShowSelector(true)}
                                className={`w-10 h-10 md:w-14 md:h-14 rounded-[1.2rem] md:rounded-[1.8rem] transition-all flex items-center justify-center border ${selectedRefs.length > 0 ? 'bg-zen-primary border-zen-primary text-zen-bg shadow-lg' : 'bg-zen-surface/50 border-zen-surface text-zen-text-secondary hover:text-zen-primary hover:bg-zen-primary/5'}`}
                            >
                                <IconPaperclip className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder={selectedRefs.length > 0 ? "Ask about the documents..." : "Ask your assistant anything..."}
                                disabled={isLoading}
                                rows={1}
                                className="flex-1 bg-transparent border-none text-base md:text-xl text-zen-text-primary focus:outline-none focus:ring-0 placeholder:text-zen-text-disabled/30 font-light min-w-0 resize-none leading-relaxed py-2 md:py-3 max-h-40"
                            />

                            <button 
                                type="submit"
                                disabled={!input.trim() || isLoading} 
                                className="h-10 md:h-14 px-4 md:px-8 bg-white text-black rounded-[1.2rem] md:rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-[10px] disabled:opacity-5 shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="hidden md:inline">Transmit</span>
                                        <IconChevronRight className="w-4 h-4 md:ml-1" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                    
                    <p className="text-center text-[8px] md:text-[9px] uppercase font-black tracking-[0.4em] text-zen-text-disabled opacity-30 select-none pb-2 md:pb-0">
                        Zen Synthetic Intelligence &bull; Adaptive Learning Context
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ZenAI;
