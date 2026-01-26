import React from 'react';
import { IconX } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDangerous = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-zen-card/95 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-300">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-zen-primary/5 blur-[50px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-zen-secondary/5 blur-[50px] pointer-events-none rounded-full" />

        <div className="space-y-4 text-center">
            {isDangerous && (
                 <div className="w-12 h-12 rounded-full bg-zen-destructive/10 text-zen-destructive mx-auto flex items-center justify-center border border-zen-destructive/20 mb-2">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
            )}
            
            <h3 className="text-xl font-medium text-zen-text-primary">{title}</h3>
            <p className="text-sm text-zen-text-secondary leading-relaxed">
                {message}
            </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-8">
            <button 
                onClick={onClose}
                className="py-3 rounded-xl border border-white/5 bg-white/[0.02] text-zen-text-secondary text-xs uppercase font-bold tracking-wider hover:bg-white/5 transition-all"
            >
                {cancelText}
            </button>
            <button 
                onClick={() => {
                    onConfirm();
                    onClose();
                }}
                className={`py-3 rounded-xl text-xs uppercase font-bold tracking-wider shadow-lg transition-all ${
                    isDangerous 
                    ? 'bg-zen-destructive text-white hover:bg-zen-destructive/90' 
                    : 'bg-zen-primary text-black hover:bg-zen-primary/90'
                }`}
            >
                {confirmText}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;