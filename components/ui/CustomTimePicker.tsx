import React, { useState, useRef, useEffect } from 'react';

interface CustomTimePickerProps {
  id?: string;
  value: string; // 'HH:mm' format e.g. '09:00' or '14:30'
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const HOURS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const parse24To12 = (time24: string) => {
  if (!time24) return { hour12: '09', minute: '00', period: 'AM' as const };
  const parts = time24.split(':');
  const hStr = parts[0];
  const mStr = parts[1];
  let h = parseInt(hStr || '9', 10);
  if (isNaN(h)) h = 9;
  let mNum = parseInt(mStr || '0', 10);
  if (isNaN(mNum)) mNum = 0;

  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const hour12 = String(h).padStart(2, '0');
  const minute = String(mNum).padStart(2, '0');
  return { hour12, minute, period };
};

const format12To24 = (hour12: string, minute: string, period: 'AM' | 'PM') => {
  let h = parseInt(hour12, 10);
  if (isNaN(h)) h = 9;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const h24 = String(h).padStart(2, '0');
  const m24 = String(parseInt(minute, 10) || 0).padStart(2, '0');
  return `${h24}:${m24}`;
};

const formatDisplayTime = (time24: string) => {
  const { hour12, minute, period } = parse24To12(time24);
  return `${hour12}:${minute} ${period}`;
};

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  id,
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { hour12, minute, period } = parse24To12(value);

  // Click outside detection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHourSelect = (newHour: string) => {
    const newTime24 = format12To24(newHour, minute, period);
    onChange(newTime24);
  };

  const handleMinuteSelect = (newMinute: string) => {
    const newTime24 = format12To24(hour12, newMinute, period);
    onChange(newTime24);
  };

  const handlePeriodSelect = (newPeriod: 'AM' | 'PM') => {
    const newTime24 = format12To24(hour12, minute, newPeriod);
    onChange(newTime24);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-zen-surface/40 px-4 py-3.5 text-left text-sm text-white outline-none transition-all hover:border-white/20 focus:border-zen-primary/60 focus:ring-1 focus:ring-zen-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? 'border-zen-primary/60 ring-1 ring-zen-primary/40 shadow-lg shadow-black/40' : ''
        }`}
      >
        <span className="truncate font-medium">{formatDisplayTime(value)}</span>
        <svg
          className="h-4 w-4 shrink-0 text-zen-text-secondary transition-colors group-hover:text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Time Picker Popover */}
      {isOpen && (
        <div className="absolute left-0 z-[160] mt-1.5 w-64 rounded-2xl border border-white/10 bg-[#121722] p-3.5 shadow-2xl shadow-black/90 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Header Preview */}
          <div className="mb-3 text-center border-b border-white/[0.08] pb-2">
            <span className="text-xs uppercase font-bold tracking-widest text-zen-text-disabled">Select Time</span>
            <div className="text-xl font-bold text-zen-primary mt-0.5">{formatDisplayTime(value)}</div>
          </div>

          {/* 3 Column Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Hours Column */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zen-text-disabled text-center">Hour</span>
              <div className="max-h-44 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                {HOURS_12.map(h => {
                  const isSelected = h === hour12;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourSelect(h)}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-zen-primary text-zen-bg shadow-sm font-bold'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Column */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zen-text-disabled text-center">Minute</span>
              <div className="max-h-44 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                {MINUTES.map(m => {
                  const isSelected = m === minute || (parseInt(m, 10) === Math.floor(parseInt(minute, 10) / 5) * 5);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteSelect(m)}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-zen-primary text-zen-bg shadow-sm font-bold'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period Column */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zen-text-disabled text-center">Period</span>
              <div className="space-y-1.5">
                {(['AM', 'PM'] as const).map(p => {
                  const isSelected = p === period;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePeriodSelect(p)}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all ${
                        isSelected
                          ? 'bg-zen-primary text-zen-bg shadow-sm'
                          : 'text-white/80 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Done button */}
          <div className="mt-3 border-t border-white/[0.08] pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
