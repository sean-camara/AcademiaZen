
import React, { useEffect, useState } from 'react';
import { useZen } from '../context/ZenContext';
import { FOCUS_DURATIONS, AMBIENCE_OPTIONS } from '../constants';
import { IconFocus } from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';

const Focus: React.FC = () => {
  const { focusSession, startTimer, pauseTimer, resetTimer, setAmbience, state, setHideNavbar } = useZen();
  const { isActive, isPaused, timeLeft } = focusSession;
  
  const [sessionGoal, setSessionGoal] = useState('');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = isActive 
    ? ((state.settings.focusDuration * 60 - timeLeft) / (state.settings.focusDuration * 60)) * 100 
    : 0;

  // Immersive mode: hide navbar during focus
  useEffect(() => {
    if (isActive && !isPaused) {
      setHideNavbar(true);
    } else {
      setHideNavbar(false);
    }
  }, [isActive, isPaused, setHideNavbar]);

  return (
    <div className="h-full flex flex-col items-center justify-between p-6 relative overflow-hidden bg-zen-bg">
        
        {/* Dynamic Background */}
        <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-tr from-zen-primary/5 via-transparent to-zen-secondary/5 blur-[100px] transition-all duration-[3000ms] ${isActive && !isPaused ? 'opacity-100 rotate-180 scale-110' : 'opacity-40 rotate-0 scale-100'}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,12,0.8)_100%)] opacity-80" />
        </div>

        {/* Desktop Title - Hidden on mobile to save space and prevent scrolling */}
        <div className="hidden md:flex absolute top-10 left-12 right-12 justify-between items-start z-30">
            <div>
                <h2 className="text-4xl font-extralight text-zen-text-primary tracking-tight">Focus Engine</h2>
                <p className="text-zen-text-secondary font-light mt-1">Design your flow state.</p>
            </div>
            {(!isActive || isPaused) && (
                <div className="bg-zen-card/80 backdrop-blur px-6 py-3 rounded-2xl border border-zen-surface flex items-center gap-3 shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-zen-primary animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zen-text-primary">System Ready</span>
                </div>
            )}
        </div>

        {/* Main Layout Container - Flex Column for vertical distribution without scroll */}
        <div className="w-full h-full max-w-lg md:max-w-4xl mx-auto flex flex-col items-center justify-evenly py-4 md:py-0 z-20">

            {/* 1. TOP SECTION: Goal & Timer (The Hero) */}
            <div className="flex flex-col items-center justify-center flex-grow-[2] w-full">
                
                {/* Active Goal Pill */}
                <div className="mb-6 h-8 flex items-center justify-center">
                    {sessionGoal ? (
                        <button onClick={() => !isActive && setIsGoalModalOpen(true)} className="px-5 py-2 bg-zen-surface/30 backdrop-blur rounded-full border border-zen-surface/50 text-zen-primary text-xs md:text-sm font-medium tracking-wide shadow-lg hover:bg-zen-surface/50 transition-all max-w-[80vw] truncate">
                            {sessionGoal}
                        </button>
                    ) : (
                        !isActive && (
                            <button onClick={() => setIsGoalModalOpen(true)} className="text-zen-text-disabled hover:text-zen-primary text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center gap-2">
                                <span>+ Set Intention</span>
                            </button>
                        )
                    )}
                </div>

                {/* THE TIMER */}
                <div className="relative group">
                    {/* Ring Container - Responsive sizing */}
                    <div className={`relative w-[65vw] h-[65vw] max-w-[280px] max-h-[280px] md:w-96 md:h-96 rounded-full flex items-center justify-center transition-all duration-[1500ms] ease-out ${isActive && !isPaused ? 'scale-105' : 'scale-100'}`}>
                        
                        {/* Decorative Rings */}
                        <div className="absolute inset-0 border-[0.5px] border-zen-surface/30 rounded-full" />
                        <div className="absolute inset-4 border-[0.5px] border-zen-surface/20 rounded-full" />
                        
                        {/* Progress Ring */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.01]">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="48%"
                                fill="none"
                                stroke="url(#timerGradient)"
                                strokeWidth="2"
                                strokeDasharray="100 100"
                                strokeDashoffset={100 - progress}
                                pathLength="100"
                                className="transition-all duration-1000 ease-linear"
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#64FFDA" />
                                    <stop offset="100%" stopColor="#7F5AF0" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Digital Time */}
                        <div className="text-center flex flex-col items-center z-10">
                             <span className={`text-[17vw] md:text-[6rem] leading-none font-extralight tracking-tighter tabular-nums transition-colors duration-500 ${isActive && !isPaused ? 'text-zen-primary drop-shadow-[0_0_15px_rgba(100,255,218,0.3)]' : 'text-zen-text-primary'}`}>
                                {formatTime(timeLeft)}
                            </span>
                            <span className="text-[10px] md:text-sm text-zen-text-disabled uppercase font-bold tracking-[0.3em] mt-2 md:mt-4 opacity-80">
                                {isActive ? (isPaused ? 'PAUSED' : 'FOCUSING') : 'READY'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. BOTTOM SECTION: Controls (Compact & Accessible) */}
            <div className="flex flex-col items-center w-full gap-6 md:gap-10 mt-auto flex-shrink-0">
                
                {/* Duration Picker - Only visible when not active */}
                {!isActive && (
                    <div className="flex gap-2 p-1.5 bg-zen-card/60 backdrop-blur rounded-2xl border border-zen-surface shadow-sm hover:bg-zen-card/80 transition-colors">
                        {FOCUS_DURATIONS.map((dur) => (
                            <button
                                key={dur}
                                onClick={() => resetTimer(dur)}
                                className={`h-8 px-4 md:h-10 md:px-6 rounded-xl text-[10px] md:text-xs font-bold transition-all ${state.settings.focusDuration === dur ? 'bg-zen-primary text-black shadow-md' : 'text-zen-text-secondary hover:text-zen-text-primary hover:bg-zen-surface'}`}
                            >
                                {dur}m
                            </button>
                        ))}
                    </div>
                )}

                {/* Primary Actions Row */}
                <div className="flex items-center gap-6 md:gap-8">
                    {/* Ambience Toggle (Left) */}
                    <div className="flex bg-zen-surface/10 rounded-full p-1 border border-zen-surface/30">
                        {AMBIENCE_OPTIONS.map(opt => (
                            <button 
                                key={opt.id}
                                onClick={() => setAmbience(opt.id as any)}
                                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${state.settings.ambience === opt.id ? 'bg-zen-surface text-zen-primary scale-110 shadow-lg border border-zen-primary/20' : 'text-zen-text-disabled hover:text-zen-text-primary'}`}
                            >
                                <span className="text-lg md:text-xl">{opt.icon}</span>
                            </button>
                        ))}
                    </div>

                    {/* MAIN START BUTTON */}
                    {!isActive ? (
                        <button 
                            onClick={startTimer}
                            className="w-16 h-16 md:w-20 md:h-20 bg-zen-primary rounded-full flex items-center justify-center text-black hover:scale-110 hover:shadow-[0_0_30px_rgba(100,255,218,0.4)] active:scale-95 transition-all shadow-xl z-20"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 md:w-8 md:h-8 ml-1"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                    ) : (
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={isPaused ? startTimer : pauseTimer}
                                className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all shadow-xl border ${isPaused ? 'bg-zen-primary text-black border-zen-primary' : 'bg-transparent text-zen-primary border-zen-primary'}`}
                            >
                                {isPaused ? (
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-1"><path d="M8 5v14l11-7z"/></svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                )}
                            </button>
                            
                            <button 
                                onClick={() => setShowEndConfirm(true)}
                                className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-red-400 bg-zen-surface/10 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 6h12v12H6z"/></svg>
                            </button>
                        </div>
                    )}
                </div>

                <ConfirmModal
                    isOpen={showEndConfirm}
                    onClose={() => setShowEndConfirm(false)}
                    onConfirm={() => resetTimer()}
                    title="End Session"
                    message="Stop current session? Progress will not be saved."
                    confirmText="End Session"
                    isDangerous
                />
            </div>

            {/* Goal Setting Modal */}
            {isGoalModalOpen && (
                 <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-fadeIn">
                    <div className="w-full max-w-md space-y-8 relative">
                         <button onClick={() => setIsGoalModalOpen(false)} className="absolute -top-12 right-0 text-zen-text-secondary hover:text-zen-text-primary p-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M18 6L6 18M6 6l12 12"/></svg>
                         </button>
                         <div className="text-center space-y-2">
                            <h3 className="text-3xl font-light text-zen-text-primary">Intention</h3>
                            <p className="text-zen-text-secondary text-sm">What are you focusing on?</p>
                         </div>
                         
                         <div className="space-y-6">
                            <input 
                                autoFocus
                                placeholder="e.g. Read Chapter 4"
                                className="w-full bg-transparent border-b border-zen-surface p-4 text-xl text-zen-text-primary text-center focus:outline-none focus:border-zen-primary transition-all font-light placeholder:text-zen-text-disabled/20"
                                value={sessionGoal}
                                onChange={e => setSessionGoal(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && setIsGoalModalOpen(false)}
                            />
                            
                            <div className="flex justify-center gap-4">
                                 {sessionGoal && (
                                     <button onClick={() => setSessionGoal('')} className="text-zen-text-disabled hover:text-red-400 text-[10px] font-bold uppercase tracking-widest px-4 py-2">Clear</button>
                                 )}
                                 <button onClick={() => setIsGoalModalOpen(false)} className="px-8 py-3 bg-zen-text-primary text-black rounded-full font-bold uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all">Set Goal</button>
                            </div>
                         </div>
                    </div>
                 </div>
            )}
        </div>
    </div>
  );
};

export default Focus;
