import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { CustomSelectProps } from './types';

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectId = useRef(`cs-${Math.random().toString(36).slice(2, 8)}`).current;

  const selectedOption = options.find((o) => o.value === value) || options[0];
  const selectedIndex = options.findIndex((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const option = listRef.current.children[focusedIndex] as HTMLElement;
      option?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [focusedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
      case 'Home':
        e.preventDefault();
        if (isOpen) setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        if (isOpen) setFocusedIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0 && options[focusedIndex]) {
          onChange(options[focusedIndex].value);
          setIsOpen(false);
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        if (isOpen) setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${selectId}-list`}
        aria-activedescendant={isOpen && focusedIndex >= 0 ? `${selectId}-opt-${focusedIndex}` : undefined}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="w-full px-3.5 py-2 rounded-lg bg-[#0e1626] border border-slate-700/60 hover:border-slate-500 text-xs font-medium text-slate-200 flex items-center justify-between gap-3 transition-all focus:outline-none focus:border-emerald-400/80 focus:ring-1 focus:ring-emerald-400/40 shadow-inner"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <span className="text-slate-400">{selectedOption.icon}</span>}
          <span>{selectedOption?.label}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          id={`${selectId}-list`}
          role="listbox"
          aria-label="Select option"
          className="absolute left-0 right-0 mt-1.5 z-50 py-1 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in duration-100 font-sans min-w-[170px] max-h-64 overflow-y-auto"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            return (
              <div
                key={opt.value}
                id={`${selectId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected ? 'bg-emerald-500/10 text-emerald-300 font-semibold' : isFocused ? 'bg-slate-800/80 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  {opt.icon && <span className={isSelected ? 'text-emerald-400' : 'text-slate-400'}>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
