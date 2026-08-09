import React, { useState, useRef, useEffect } from 'react';

interface CustomDatePickerProps {
  id?: string;
  value: string; // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const parseDateStr = (str: string): Date => {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined || isNaN(year) || isNaN(month) || isNaN(day)) {
    return new Date();
  }
  return new Date(year, month - 1, day);
};

const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (str: string): string => {
  if (!str) return 'Select date';
  const parts = str.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return str;
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${m}/${d}/${year}`;
};

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  id,
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDateObj = parseDateStr(value);
  const [viewDate, setViewDate] = useState<Date>(selectedDateObj);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync viewDate when opening popover or when value changes
  useEffect(() => {
    if (isOpen) {
      setViewDate(parseDateStr(value));
    }
  }, [isOpen, value]);

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

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Generate calendar grid days
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const todayStr = formatDateStr(new Date());

  const daysGrid: Array<{
    day: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
  }> = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = formatDateStr(prevDate);
    daysGrid.push({
      day: d,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === value,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const currDate = new Date(year, month, d);
    const dateStr = formatDateStr(currDate);
    daysGrid.push({
      day: d,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === value,
    });
  }

  // Next month leading days to complete 6-row grid (42 cells)
  const remaining = 42 - daysGrid.length;
  for (let d = 1; d <= remaining; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = formatDateStr(nextDate);
    daysGrid.push({
      day: d,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === value,
    });
  }

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleTodayClick = () => {
    const today = formatDateStr(new Date());
    onChange(today);
    setViewDate(new Date());
    setIsOpen(false);
  };

  const handleClearClick = () => {
    const today = formatDateStr(new Date());
    onChange(today);
    setIsOpen(false);
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
        <span className="truncate font-medium">{formatDisplayDate(value)}</span>
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
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Popover Calendar */}
      {isOpen && (
        <div className="absolute left-0 z-[160] mt-1.5 w-72 rounded-2xl border border-white/10 bg-[#121722] p-4 shadow-2xl shadow-black/90 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-3">
            <span className="text-sm font-bold text-white">{monthName}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous Month"
                className="rounded-lg p-1.5 text-zen-text-secondary transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next Month"
                className="rounded-lg p-1.5 text-zen-text-secondary transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-1 text-center">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-1 text-[11px] font-bold text-zen-text-disabled uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {daysGrid.map((item, idx) => {
              return (
                <button
                  key={`${item.dateStr}-${idx}`}
                  type="button"
                  onClick={() => handleSelectDay(item.dateStr)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    item.isSelected
                      ? 'bg-zen-primary text-zen-bg font-bold shadow-md shadow-zen-primary/20 scale-105'
                      : item.isToday
                      ? 'border border-zen-primary/60 text-zen-primary font-bold hover:bg-zen-primary/10'
                      : item.isCurrentMonth
                      ? 'text-white/90 hover:bg-white/10 hover:text-white'
                      : 'text-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Footer Bar */}
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-2.5 px-1 text-xs">
            <button
              type="button"
              onClick={handleClearClick}
              className="text-zen-primary/80 font-medium transition-colors hover:text-zen-primary"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleTodayClick}
              className="text-zen-primary/80 font-medium transition-colors hover:text-zen-primary"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
