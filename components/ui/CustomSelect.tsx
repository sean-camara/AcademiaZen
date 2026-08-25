import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps<T extends string = string> {
  id?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect<T extends string = string>({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  className = '',
  disabled = false,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-zen-surface px-4 py-3.5 text-left text-sm text-white outline-none transition-all hover:border-white/20 focus:border-zen-primary/60 focus:ring-1 focus:ring-zen-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? 'border-zen-primary/60 ring-1 ring-zen-primary/40 shadow-lg shadow-black/40' : ''
        }`}
      >
        <span className="truncate font-medium">
          {selectedOption ? selectedOption.label : <span className="text-zen-text-disabled">{placeholder}</span>}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zen-text-secondary transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-zen-primary' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-[150] mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#121822] p-1.5 shadow-2xl shadow-black/80 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 custom-scrollbar"
        >
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3.5 py-2.5 text-sm transition-all ${
                  isSelected
                    ? 'bg-zen-primary/15 font-semibold text-zen-primary'
                    : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon && <span className="shrink-0">{option.icon}</span>}
                  <span className="truncate">{option.label}</span>
                </div>
                {isSelected && (
                  <svg
                    className="h-4 w-4 shrink-0 text-zen-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
