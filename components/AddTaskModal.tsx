import React, { useState, useRef } from 'react';
import { IconX, IconPaperclip, IconTrash, IconChevronRight } from './Icons';
import { PdfAttachment } from '../types';
import { uploadPdfToR2 } from '../utils/pdfStorage';

interface AddTaskModalProps {
  onClose: () => void;
  onSave: (title: string, date: string, notes: string, pdf?: PdfAttachment) => void;
  subjectName?: string;
  editMode?: boolean;
  initialData?: {
    title: string;
    date: string;
    notes: string;
    pdf?: PdfAttachment;
  };
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ onClose, onSave, subjectName, editMode = false, initialData }) => {
  const getInitialDate = () => {
    if (initialData?.date) {
      const d = new Date(initialData.date);
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };
  
  const getInitialTime = () => {
    if (initialData?.date) {
      const d = new Date(initialData.date);
      return d.toTimeString().slice(0, 5);
    }
    return '12:00';
  };

  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(getInitialDate());
  const [time, setTime] = useState(getInitialTime());
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [pdf, setPdf] = useState<PdfAttachment | undefined>(initialData?.pdf);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingPdf) {
      setUploadError('Upload in progress. Please wait.');
      return;
    }
    if (!title.trim()) return;
    
    const combinedDate = new Date(`${date}T${time}:00`);
    onSave(title, combinedDate.toISOString(), notes, pdf);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave(e as any);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Please select a PDF file');
      return;
    }
    try {
      setIsUploadingPdf(true);
      const uploaded = await uploadPdfToR2(file);
      setPdf(uploaded);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploadingPdf(false);
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
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zen-primary">Task Node</span>
                </div>
                <h2 className="text-3xl font-extralight text-zen-text-primary tracking-tight">
                    {editMode ? 'Refine Objective' : 'New Objective'}
                </h2>
                {subjectName && (
                  <p className="text-xs text-zen-text-secondary font-light">
                    Allocated to <span className="text-zen-text-primary">{subjectName}</span>
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-8 sm:p-10 space-y-8 overflow-y-auto" onKeyDown={handleKeyDown}>
            {/* Objective Identifier */}
            <div className="space-y-3">
                <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Objective Title</label>
                <input 
                    autoFocus
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Enter task definition..."
                    className="w-full bg-zen-surface/30 border border-white/5 rounded-2xl px-6 py-4 text-zen-text-primary text-xl font-light focus:outline-none focus:border-zen-primary/50 transition-all placeholder-zen-text-disabled/30"
                />
            </div>

            {/* Scheduling Hub */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Deadline Date</label>
                    <div className="relative group">
                        <input 
                            type="date" 
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full bg-zen-surface/30 border border-white/5 rounded-2xl px-6 py-4 text-zen-text-primary focus:outline-none focus:border-zen-primary/50 transition-all [color-scheme:dark]"
                        />
                    </div>
                </div>
                <div className="space-y-3">
                    <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Target Time</label>
                    <input 
                        type="time" 
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        className="w-full bg-zen-surface/30 border border-white/5 rounded-2xl px-6 py-4 text-zen-text-primary focus:outline-none focus:border-zen-primary/50 transition-all [color-scheme:dark]"
                    />
                </div>
            </div>

            {/* Information Layer */}
            <div className="space-y-3">
                <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Contextual Notes</label>
                <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Provide additional parameters..."
                    rows={4}
                    className="w-full bg-zen-surface/30 border border-white/5 rounded-2xl px-6 py-4 text-zen-text-primary focus:outline-none focus:border-zen-primary/50 transition-all resize-none placeholder-zen-text-disabled/30 text-sm font-light"
                />
            </div>

            {/* Knowledge Vault Integration */}
            <div className="space-y-3">
                <label className="text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Knowledge Link (PDF)</label>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="application/pdf,.pdf" 
                  className="hidden" 
                />
                
                {isUploadingPdf ? (
                    <div className="w-full bg-zen-primary/5 border border-zen-primary/20 rounded-2xl p-6 flex items-center justify-center gap-4 animate-reveal">
                        <div className="w-5 h-5 border-2 border-zen-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zen-primary">Encrypting & Storing...</span>
                    </div>
                ) : !pdf ? (
                    <button 
                        type="button"
                        onClick={triggerFileInput}
                        className="w-full bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-6 flex items-center justify-center gap-3 text-zen-text-secondary hover:text-zen-primary hover:border-zen-primary/50 hover:bg-zen-primary/5 transition-all group active:scale-[0.98]"
                    >
                        <IconPaperclip className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Link Knowledge Source</span>
                    </button>
                ) : (
                    <div className="w-full bg-zen-primary/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group animate-reveal">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 bg-zen-primary/20 text-zen-primary rounded-xl flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-black">PDF</span>
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm text-zen-text-primary truncate font-medium">{pdf.name}</span>
                                <span className="text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">Verified Source</span>
                            </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setPdf(undefined)}
                          className="p-3 hover:bg-zen-destructive/10 text-zen-text-disabled hover:text-zen-destructive rounded-xl transition-all"
                        >
                            <IconTrash className="w-5 h-5" />
                        </button>
                    </div>
                )}
                {uploadError && (
                  <p className="text-zen-destructive text-[10px] font-black uppercase tracking-wider mt-2 ml-1 animate-reveal">{uploadError}</p>
                )}
            </div>
        </form>

        {/* Action Bar */}
        <div className="p-8 sm:p-10 border-t border-white/5 flex gap-4">
            <button 
                onClick={onClose}
                className="flex-1 py-5 rounded-[2rem] text-zen-text-secondary font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white/5 transition-all"
            >
                Abort
            </button>
            <button 
                onClick={handleSave}
                disabled={isUploadingPdf || !title.trim()}
                className="flex-[2] py-5 rounded-[2rem] bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group shadow-2xl shadow-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {editMode ? 'Update Objective' : 'Commit to Sync'}
                <IconChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddTaskModal;
