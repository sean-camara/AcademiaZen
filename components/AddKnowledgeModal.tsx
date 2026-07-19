import React, { useState, useRef, useEffect } from 'react';
import { IconX, IconPaperclip, IconFileText } from './Icons';
import { PdfAttachment } from '../types';
import { uploadPdfToR2 } from '../utils/pdfStorage';
import { apiFetch } from '../utils/api';

interface AddKnowledgeModalProps {
  onClose: () => void;
  onSave: (title: string, type: 'note' | 'pdf', content: string, pdf?: PdfAttachment) => void;
  folderName?: string;
  maxFileSizeMB?: number; // Will be passed from Library based on premium status
}

const AddKnowledgeModal: React.FC<AddKnowledgeModalProps> = ({ onClose, onSave, folderName, maxFileSizeMB = 15 }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'note' | 'pdf'>('note');
  const [content, setContent] = useState('');
  const [pdf, setPdf] = useState<PdfAttachment | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (!title.trim()) return;
    if (type === 'pdf' && !pdf) return;

    onSave(title, type, content, pdf);
    onClose();
  };
  
    const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave(e as any);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSizeMB) {
      setError(`File too large. Maximum size is ${maxFileSizeMB}MB. Upgrade to Premium for 15MB.`);
      return;
    }
    
    try {
      setIsUploading(true);
      const uploaded = await uploadPdfToR2(file);
      setPdf(uploaded);
      if (!title) setTitle(file.name.replace('.pdf', ''));
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
       <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity animate-in fade-in duration-500" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full sm:max-w-xl bg-zen-bg/95 backdrop-blur-3xl rounded-t-[2.5rem] sm:rounded-[3rem] border border-white/5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-500 zoom-in-95">
        
         {/* Decorative Ambient Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-zen-primary/5 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-zen-secondary/5 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="flex justify-between items-center p-8 sm:p-10 border-b border-white/5">
             <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-zen-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zen-primary">Knowledge Node</span>
                </div>
                <h2 className="text-3xl font-extralight text-zen-text-primary tracking-tight">
                    Add Knowledge
                </h2>
                {folderName && (
                  <p className="text-xs text-zen-text-secondary font-light">
                    Saving to <span className="text-zen-text-primary">{folderName}</span>
                  </p>
                )}
            </div>
            <button 
              onClick={onClose} 
              className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-zen-text-secondary hover:text-white transition-all active:scale-90"
            >
                <IconX className="w-6 h-6" />
            </button>
        </div>

        <form onSubmit={handleSave} className="p-8 sm:p-10 space-y-8 overflow-y-auto custom-scrollbar" onKeyDown={handleKeyDown}>
             {/* Type Selection */}
             <div className="flex bg-zen-surface/30 p-1 rounded-2xl">
                <button
                    type="button"
                    onClick={() => setType('note')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'note' ? 'bg-zen-primary text-zen-bg shadow-lg' : 'text-zen-text-secondary hover:text-zen-text-primary'}`}
                >
                    Text Note
                </button>
                <button
                    type="button"
                    onClick={() => setType('pdf')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'pdf' ? 'bg-zen-primary text-zen-bg shadow-lg' : 'text-zen-text-secondary hover:text-zen-text-primary'}`}
                >
                    PDF Archive
                </button>
             </div>

             <div className="space-y-3">
                <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Document Title</label>
                <input 
                    autoFocus
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Modern Physics Summary"
                    className="w-full bg-zen-surface/30 border border-white/5 rounded-2xl px-6 py-4 text-zen-text-primary text-xl font-light focus:outline-none focus:border-zen-primary/50 transition-all placeholder-zen-text-disabled/30"
                />
            </div>

            {type === 'note' ? (
                <div className="space-y-3">
                    <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Notes Content</label>
                    <textarea 
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Type your knowledge here..."
                        rows={6}
                        className="w-full bg-zen-surface/30 border border-white/5 rounded-2xl px-6 py-4 text-zen-text-primary focus:outline-none focus:border-zen-primary/50 transition-all resize-none placeholder-zen-text-disabled/30 text-sm font-light"
                    />
                </div>
            ) : (
                <div className="space-y-3">
                     <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Archive File</label>
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="application/pdf,.pdf" 
                        className="hidden" 
                     />
                    {isUploading ? (
                        <div className="w-full bg-zen-primary/5 border border-zen-primary/20 rounded-2xl p-8 flex items-center justify-center gap-4 animate-reveal">
                            <div className="w-5 h-5 border-2 border-zen-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zen-primary">Encrypting & Storing...</span>
                        </div>
                    ) : !pdf ? (
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-zen-text-secondary hover:text-zen-primary hover:border-zen-primary/50 hover:bg-zen-primary/5 transition-all group active:scale-[0.98]"
                        >
                            <IconPaperclip className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-medium">Click to upload PDF</span>
                        </button>
                    ) : (
                        <div className="w-full bg-zen-surface/30 border border-white/5 rounded-2xl p-4 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-zen-primary/10 flex items-center justify-center text-zen-primary">
                                    <IconFileText className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-zen-text-primary font-medium line-clamp-1">{pdf.name}</span>
                                    <span className="text-[10px] text-zen-text-secondary uppercase tracking-wider">Ready to archive</span>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setPdf(undefined)}
                                className="p-2 text-zen-text-disabled hover:text-red-400 transition-colors"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {error && <p className="text-xs text-red-400 mt-2 ml-1">{error}</p>}
                </div>
            )}
             
            <div className="pt-4">
                <button 
                    type="submit" 
                    disabled={!title.trim() || (type === 'pdf' && !pdf)}
                    className="w-full bg-zen-primary text-zen-bg rounded-2xl py-4 font-bold uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zen-primary/20"
                >
                    Save to Archive
                </button>
            </div>
            
        </form>

      </div>
    </div>
  );
};

export default AddKnowledgeModal;
