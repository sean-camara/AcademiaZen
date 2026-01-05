
import React from 'react';
import { useZen } from '../context/ZenContext';
import { FOCUS_DURATIONS, AMBIENCE_OPTIONS } from '../constants';
import { IconFocus } from '../components/Icons';

const Focus: React.FC = () => {
  const { focusSession, startTimer, pauseTimer, resetTimer, setAmbience, state } = useZen();
  const { isActive, isPaused, timeLeft } = focusSession;
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = isActive 
    ? ((state.settings.focusDuration * 60 - timeLeft) / (state.settings.focusDuration * 60)) * 100 
    : 0;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 relative overflow-hidden animate-reveal">
        
        {/* Background glow effect based on timer state */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-zen-primary/10 blur-[120px] rounded-full transition-all duration-1000 ${isActive && !isPaused ? 'scale-150 opacity-50 animate-float' : 'scale-100 opacity-20'}`} />

        {/* Timer Display */}
        <div className="relative z-10 mb-12">
            <div className={`w-64 h-64 rounded-full border-4 border-zen-surface flex items-center justify-center relative transition-all duration-700 ${isActive ? 'scale-105 border-zen-primary/20 shadow-[0_0_50px_rgba(100,255,218,0.05)]' : 'scale-100'}`}>
                {/* SVG Circle Progress */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                        cx="128"
                        cy="128"
                        r="124"
                        fill="none"
                        stroke="#64FFDA"
                        strokeWidth="4"
                        strokeDasharray="779" // 2 * pi * r
                        strokeDashoffset={779 - (779 * progress) / 100}
                        className={`transition-all duration-1000 ease-linear ${!isActive ? 'opacity-0' : 'opacity-100'}`}
                        strokeLinecap="round"
                    />
                </svg>
                
                <div className="text-center">
                    <span className="text-6xl font-light font-mono tracking-tighter text-zen-text-primary block transition-all">
                        {formatTime(timeLeft)}
                    </span>
                    <span className="text-sm text-zen-text-secondary mt-2 uppercase tracking-widest block font-medium">
                        {isActive ? (isPaused ? 'Paused' : 'Focusing') : 'Ready'}
                    </span>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-8 w-full max-w-sm z-10">
            
            {/* Duration Selector (Only when not active) */}
            {!isActive && (
                <div className="flex gap-4 animate-reveal">
                    {FOCUS_DURATIONS.map((dur, idx) => (
                        <button
                            key={dur}
                            onClick={() => resetTimer(dur)}
                            className={`px-4 py-2 rounded-lg text-sm transition-all animate-reveal stagger-${idx + 1} ${state.settings.focusDuration === dur ? 'bg-zen-surface text-zen-primary border border-zen-primary/30 shadow-lg' : 'text-zen-text-secondary hover:text-zen-text-primary hover:bg-zen-surface/50'}`}
                        >
                            {dur} min
                        </button>
                    ))}
                </div>
            )}

            {/* Play/Pause Buttons */}
            <div className="flex items-center gap-6">
                {!isActive ? (
                    <button 
                        onClick={startTimer}
                        className="w-16 h-16 bg-zen-primary rounded-full flex items-center justify-center text-zen-bg hover:scale-110 active:scale-90 transition-all shadow-[0_0_20px_rgba(100,255,218,0.2)] animate-scale-in"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-1"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={isPaused ? startTimer : pauseTimer}
                            className="w-16 h-16 bg-zen-card border border-zen-surface rounded-full flex items-center justify-center text-zen-text-primary hover:border-zen-primary transition-all active:scale-90 shadow-xl"
                        >
                            {isPaused ? (
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-1 animate-reveal"><path d="M8 5v14l11-7z"/></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 animate-reveal"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            )}
                        </button>
                        <button 
                            onClick={() => resetTimer()}
                            className="w-12 h-12 bg-transparent text-zen-destructive rounded-full flex items-center justify-center hover:bg-zen-destructive/10 transition-all active:scale-90"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                        </button>
                    </>
                )}
            </div>

            {/* Ambience Selector */}
            <div className="w-full bg-zen-card rounded-2xl p-2 flex justify-between items-center border border-zen-surface/50 mt-4 shadow-xl">
                {AMBIENCE_OPTIONS.map(opt => {
                    const isSelected = state.settings.ambience === opt.id;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => setAmbience(opt.id as any)}
                            className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${isSelected ? 'bg-zen-surface text-zen-primary shadow-sm scale-105' : 'text-zen-text-secondary opacity-60 hover:opacity-100 hover:scale-105'}`}
                        >
                            <span className={`text-lg ${isSelected && opt.id !== 'silent' ? 'animate-pulse' : ''}`}>{opt.icon}</span>
                            <span className="text-[10px] font-medium uppercase tracking-wide">{opt.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
  );
};

export default Focus;
