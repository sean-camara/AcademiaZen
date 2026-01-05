import React, { useState, useRef } from 'react';
import { IconX, IconPaperclip, IconTrash } from './Icons';

interface AddTaskModalProps {
  onClose: () => void;
  onSave: (title: string, date: string, notes: string, pdf?: { name: string; data: string }) => void;
  subjectName?: string;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ onClose, onSave, subjectName }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('12:00');
  const [notes, setNotes] = useState('');
  const [pdf, setPdf] = useState<{ name: string; data: string } | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    const combinedDate = new Date(`${date}T${time}:00`);
    onSave(title, combinedDate.toISOString(), notes, pdf);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPdf({
            name: file.name,
            data: event.target.result as string
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-fade-in p-0 sm:p-4">
      <div className="bg-zen-bg w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-zen-surface shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-zen-surface">
            <div>
                <h2 className="text-xl font-medium text-zen-text-primary">New Task</h2>
                {subjectName && <p className="text-sm text-zen-text-secondary">for {subjectName}</p>}
            </div>
            <button onClick={onClose} className="p-2 text-zen-text-secondary hover:text-zen-text-primary">
                <IconX className="w-6 h-6" />
            </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
            {/* Title */}
            <div className="space-y-2">
                <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-medium">Task Name</label>
                <input 
                    autoFocus
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Read Chapter 4"
                    className="w-full bg-zen-card border border-zen-surface rounded-xl px-4 py-3 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-colors placeholder-zen-text-disabled"
                />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-medium">Due Date</label>
                    <input 
                        type="date" 
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full bg-zen-card border border-zen-surface rounded-xl px-4 py-3 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-colors [color-scheme:dark]"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-medium">Time</label>
                    <input 
                        type="time" 
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        className="w-full bg-zen-card border border-zen-surface rounded-xl px-4 py-3 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-colors [color-scheme:dark]"
                    />
                </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
                <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-medium">Notes <span className="text-zen-text-disabled lowercase font-normal">(optional)</span></label>
                <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add details..."
                    rows={3}
                    className="w-full bg-zen-card border border-zen-surface rounded-xl px-4 py-3 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-colors resize-none placeholder-zen-text-disabled"
                />
            </div>

            {/* PDF Attachment */}
            <div className="space-y-2">
                <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-medium">Attachment <span className="text-zen-text-disabled lowercase font-normal">(optional)</span></label>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                {!pdf ? (
                    <button 
                        type="button"
                        onClick={triggerFileInput}
                        className="w-full bg-zen-card border border-dashed border-zen-surface rounded-xl p-4 flex items-center justify-center gap-2 text-zen-text-secondary hover:text-zen-primary hover:border-zen-primary/50 transition-all group"
                    >
                        <IconPaperclip className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-sm">Attach PDF</span>
                    </button>
                ) : (
                    <div className="w-full bg-zen-surface/50 border border-zen-surface rounded-xl p-3 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 bg-zen-primary/20 text-zen-primary rounded-lg flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold">PDF</span>
                            </div>
                            <span className="text-sm text-zen-text-primary truncate">{pdf.name}</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setPdf(undefined)}
                            className="p-2 text-zen-text-secondary hover:text-zen-destructive transition-colors"
                        >
                            <IconTrash className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-3">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="flex-1 py-3.5 rounded-xl text-zen-text-secondary font-medium hover:bg-zen-surface transition-colors"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    className="flex-1 py-3.5 rounded-xl bg-zen-primary text-zen-bg font-semibold hover:opacity-90 transition-opacity"
                >
                    Create Task
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AddTaskModal;