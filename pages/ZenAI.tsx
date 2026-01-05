
import React, { useState, useRef, useEffect } from 'react';
import { IconX, IconBot, IconPaperclip, IconFileText, IconChevronRight, IconFolder, IconCheck } from '../components/Icons';
import { GoogleGenAI } from "@google/genai";
import { useZen } from '../context/ZenContext';

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
        <div className="space-y-4 text-zen-text-primary">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                
                // Headers
                if (trimmed.startsWith('### ')) {
                    return (
                        <h3 key={i} className="text-lg font-semibold text-zen-primary mt-6 mb-2 flex items-center gap-2">
                            <div className="w-1 h-5 bg-zen-primary/30 rounded-full" />
                            {trimmed.replace('### ', '')}
                        </h3>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <h2 key={i} className="text-xl font-bold text-zen-primary mt-8 mb-4 border-b border-zen-primary/10 pb-2">
                            {trimmed.replace('## ', '')}
                        </h2>
                    );
                }
                
                // Bullet points
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    const content = trimmed.substring(2);
                    return (
                        <div key={i} className="flex gap-3 ml-4 py-0.5">
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
    const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string, refs?: string[]}[]>([
        { role: 'ai', text: "Hello. I'm Zen, your study assistant. You can reference your library documents or task attachments by clicking the paperclip icon. How can I assist your learning today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRefs, setSelectedRefs] = useState<SelectedRef[]>([]);
    const [showSelector, setShowSelector] = useState(false);
    const [selectorTab, setSelectorTab] = useState<'library' | 'tasks'>('library');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

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
            const apiKey = process.env.API_KEY;
            console.log('API Key present:', !!apiKey, apiKey?.substring(0, 10) + '...');
            
            if (!apiKey || apiKey === 'your_gemini_api_key_here') {
                throw new Error('API key not configured');
            }
            
            const ai = new GoogleGenAI({ apiKey });
            
            // Build the prompt with system instructions
            let fullPrompt = `You are Zen, a world-class educational AI specialized in document analysis and study assistance.

FORMATTING RULES:
1. Use '### ' for section headers.
2. Use bullet points (- ) for lists.
3. Use **bold** for key terms and concepts.
4. Use '---' for horizontal dividers between major sections.
5. Keep paragraphs concise with generous spacing.

TONE:
Maintain a calm, minimalist, and encouraging persona. Focus heavily on synthesis between different documents if multiple are provided.

`;
            
            if (currentRefs.length > 0) {
                fullPrompt += "CONTEXT PROVIDED BY STUDENT:\n\n";
                currentRefs.forEach(ref => {
                    if (ref.type === 'note') {
                        fullPrompt += `[Document Title: ${ref.title}]\nCONTENT:\n${ref.content}\n--- End of Document ---\n\n`;
                    } else if (ref.type === 'pdf') {
                        fullPrompt += `[PDF File: ${ref.title} - Note: PDF binary content cannot be processed in this mode]\n`;
                    }
                });
            }
            
            fullPrompt += `\nSTUDENT'S QUESTION:\n${userQuery}`;

            console.log('Calling Gemini API...');
            
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: fullPrompt,
            });

            console.log('API Response:', response);
            const aiText = response.text || "I've analyzed the materials but couldn't generate a text summary.";
            setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
        } catch (error: any) {
            console.error("Zen AI Error:", error);
            let errorMessage: string;
            
            if (error.message?.includes('API key')) {
                errorMessage = "### Configuration Required\nThe AI service is not properly configured. Please ensure your **GEMINI_API_KEY** environment variable is set.\n\n**For local development:**\n- Create a `.env` file in the project root\n- Add: `GEMINI_API_KEY=your_api_key_here`\n\n**For Vercel deployment:**\n- Go to your project settings\n- Add the GEMINI_API_KEY in Environment Variables";
            } else if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "### Rate Limit Reached\nYou've exceeded the free tier quota for the Gemini API.\n\n**Options:**\n- **Wait a moment** - The API suggested waiting ~12 seconds\n- **Try again later** - Daily limits reset at midnight Pacific Time\n- **Enable billing** - Visit [Google AI Studio](https://aistudio.google.com) to upgrade your plan\n\nThe free tier has limited requests per minute and per day.";
            } else {
                errorMessage = "### Connection Issue\nI encountered a technical error while processing your request. \n\n**Possible reasons:**\n- API limit reached\n- Large PDF file size\n- Unstable connection\n- Invalid API key\n\nPlease try again with fewer attachments or check your API configuration.";
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
        <div className="fixed inset-0 bg-zen-bg z-50 flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-zen-surface bg-zen-bg/95 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zen-primary/10 rounded-xl flex items-center justify-center text-zen-primary">
                        <IconBot className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="font-semibold text-zen-text-primary block leading-none">Zen Intelligence</span>
                        <span className="text-[9px] uppercase tracking-widest text-zen-primary font-bold mt-1 block">Contextual Assistant</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 bg-zen-surface/50 rounded-2xl text-zen-text-secondary hover:text-white transition-all active:scale-90">
                    <IconX className="w-6 h-6" />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 no-scrollbar pb-32">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-reveal'}`}>
                        {msg.refs && msg.refs.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {msg.refs.map((r, i) => (
                                    <span key={i} className="text-[10px] bg-zen-surface/80 text-zen-primary px-3 py-1 rounded-full border border-zen-primary/20 backdrop-blur-sm">
                                        Ref: {r}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className={`max-w-[92%] sm:max-w-[85%] p-5 sm:p-7 rounded-[2rem] text-base leading-relaxed ${
                            msg.role === 'user' 
                                ? 'bg-zen-primary text-zen-bg font-medium rounded-tr-none shadow-xl shadow-zen-primary/10' 
                                : 'bg-zen-card/50 backdrop-blur-sm text-zen-text-primary border border-zen-surface rounded-tl-none shadow-2xl'
                        }`}>
                            {msg.role === 'ai' ? <FormattedAIResponse text={msg.text} /> : msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-zen-card p-6 rounded-3xl rounded-tl-none border border-zen-surface shadow-lg flex flex-col gap-3">
                            <div className="flex gap-2 items-center">
                                <div className="w-2 h-2 bg-zen-primary rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-zen-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-2 h-2 bg-zen-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                            <span className="text-[10px] text-zen-primary uppercase font-black tracking-[0.3em]">Synthesizing context</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Selector Overlay (Logic remains same, UI polished) */}
            {showSelector && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-end animate-fade-in" onClick={() => setShowSelector(false)}>
                    <div className="bg-zen-card w-full h-3/4 flex flex-col animate-slide-up shadow-2xl rounded-t-[3rem] border-t border-zen-surface" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-zen-surface flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-semibold text-zen-text-primary">Study Materials</h3>
                                <p className="text-xs text-zen-text-disabled mt-1">Select documents to feed into Zen AI</p>
                            </div>
                            <button onClick={() => setShowSelector(false)} className="p-3 bg-zen-surface/50 rounded-2xl text-zen-text-secondary"><IconX className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="flex px-8 pt-4 gap-6">
                            <button 
                                onClick={() => setSelectorTab('library')}
                                className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${selectorTab === 'library' ? 'border-zen-primary text-zen-primary' : 'border-transparent text-zen-text-disabled'}`}
                            >
                                Library
                            </button>
                            <button 
                                onClick={() => setSelectorTab('tasks')}
                                className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${selectorTab === 'tasks' ? 'border-zen-primary text-zen-primary' : 'border-transparent text-zen-text-disabled'}`}
                            >
                                Task Attachments
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                            {selectorTab === 'library' ? (
                                state.folders.map(folder => (
                                    <div key={folder.id} className="space-y-3">
                                        <div className="flex items-center gap-3 text-zen-text-disabled opacity-50 px-2">
                                            <IconFolder className="w-3.5 h-3.5" />
                                            <span className="text-[10px] uppercase font-black tracking-widest">{folder.name}</span>
                                        </div>
                                        {folder.items.map(item => {
                                            const isSelected = !!selectedRefs.find(r => r.id === item.id);
                                            return (
                                                <button 
                                                    key={item.id}
                                                    onClick={() => toggleRef({ id: item.id, title: item.title, type: item.type, content: item.content || '' })}
                                                    className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-95 ${isSelected ? 'bg-zen-primary/10 border-zen-primary/40 text-zen-primary' : 'bg-zen-bg border-zen-surface text-zen-text-secondary hover:border-zen-surface-brighter'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-zen-primary/20' : 'bg-zen-surface'}`}>
                                                            {item.type === 'pdf' ? <IconPaperclip className="w-5 h-5" /> : <IconFileText className="w-5 h-5" />}
                                                        </div>
                                                        <div className="text-left">
                                                            <span className="text-sm font-medium block truncate max-w-[200px]">{item.title}</span>
                                                            <span className="text-[9px] uppercase opacity-50 font-bold">{item.type}</span>
                                                        </div>
                                                    </div>
                                                    {isSelected ? <div className="w-6 h-6 bg-zen-primary text-zen-bg rounded-full flex items-center justify-center"><IconCheck className="w-4 h-4" /></div> : <div className="w-6 h-6 border border-zen-surface rounded-full" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))
                            ) : (
                                state.tasks.filter(t => t.pdfAttachment).map(task => {
                                    const isSelected = !!selectedRefs.find(r => r.id === task.id);
                                    return (
                                        <button 
                                            key={task.id}
                                            onClick={() => toggleRef({ id: task.id, title: task.pdfAttachment!.name, type: 'pdf', content: task.pdfAttachment!.data })}
                                            className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-95 ${isSelected ? 'bg-zen-primary/10 border-zen-primary/40 text-zen-primary' : 'bg-zen-bg border-zen-surface text-zen-text-secondary hover:border-zen-surface-brighter'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-zen-primary/20' : 'bg-zen-surface'}`}>
                                                    <IconPaperclip className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-sm font-medium block truncate max-w-[200px]">{task.pdfAttachment!.name}</span>
                                                    <span className="text-[9px] uppercase opacity-50 font-bold">From Task: {task.title}</span>
                                                </div>
                                            </div>
                                            {isSelected ? <div className="w-6 h-6 bg-zen-primary text-zen-bg rounded-full flex items-center justify-center"><IconCheck className="w-4 h-4" /></div> : <div className="w-6 h-6 border border-zen-surface rounded-full" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        
                        <div className="p-8 pt-2">
                            <button onClick={() => setShowSelector(false)} className="w-full py-5 bg-zen-primary text-zen-bg font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-zen shadow-zen-glow active:scale-95 transition-all">
                                Confirm Context
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 sm:p-6 border-t border-zen-surface bg-zen-bg relative safe-area-bottom">
                {selectedRefs.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 animate-reveal">
                        {selectedRefs.map(ref => (
                            <div key={ref.id} className="flex items-center gap-2 bg-zen-primary/10 border border-zen-primary/30 rounded-xl pl-3 pr-1.5 py-1.5 shadow-sm">
                                <span className="text-[10px] font-bold text-zen-primary truncate max-w-[120px]">{ref.title}</span>
                                <button type="button" onClick={() => toggleRef(ref)} className="p-1 rounded-lg hover:bg-zen-primary/20 text-zen-primary transition-colors">
                                    <IconX className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setSelectedRefs([])} className="text-[9px] uppercase font-black text-zen-text-disabled hover:text-zen-destructive transition-colors ml-2">Clear all</button>
                    </div>
                )}
                <div className="flex gap-3">
                    <button 
                        type="button"
                        onClick={() => setShowSelector(true)}
                        className={`p-4 rounded-2xl transition-all border flex items-center justify-center ${selectedRefs.length > 0 ? 'bg-zen-primary border-zen-primary text-zen-bg shadow-lg shadow-zen-primary/20' : 'bg-zen-surface border-zen-surface text-zen-text-secondary hover:text-zen-primary'}`}
                    >
                        <IconPaperclip className="w-6 h-6" />
                    </button>
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            value={input} 
                            onChange={e => setInput(e.target.value)}
                            placeholder={selectedRefs.length > 0 ? "Ask about selection..." : "Type your query..."}
                            disabled={isLoading}
                            className="w-full bg-zen-card border border-zen-surface rounded-2xl px-6 py-4 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-all disabled:opacity-50 shadow-inner"
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={!input.trim() || isLoading} 
                        className="bg-zen-primary text-zen-bg px-7 rounded-2xl font-black uppercase tracking-widest disabled:opacity-20 transition-all shadow-zen shadow-zen-glow active:scale-90"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-zen-bg border-t-transparent rounded-full animate-spin" />
                        ) : 'Ask'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ZenAI;
