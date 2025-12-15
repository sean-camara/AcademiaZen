import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Music2, Trees, CloudRain, Waves, ListTodo, Pencil, Upload, Volume2, Headphones } from 'lucide-react';
import { Card, Button } from '../components/UI';

export default function Focus({ controller }) {
  const { subjects, darkMode, toggleTaskComplete } = controller;
  
  // --- STATE ---
  const [isActive, setIsActive] = useState(false);
  const [duration, setDuration] = useState(25 * 60); 
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Sound State
  const [activeSound, setActiveSound] = useState(null); // 'rain', 'forest', 'lofi', 'custom'
  const [customTrackName, setCustomTrackName] = useState(null);

  // Timer Edit State
  const [isEditingTimer, setIsEditingTimer] = useState(false);
  const [timerInput, setTimerInput] = useState("25");

  // File Input Ref
  const fileInputRef = useRef(null);

  // Audio Refs (Initialized once)
  const audioRefs = useRef({
    rain: new Audio('/rain.mp3'),
    forest: new Audio('/forest.mp3'), 
    lofi: new Audio('/lofi.mp3'), // Updated to Lofi
    custom: null 
  });

  // --- INITIAL SETUP (Volume & Loop) ---
  useEffect(() => {
      Object.values(audioRefs.current).forEach(audio => {
          if (audio) {
            audio.volume = 0.2; // 20% volume
            audio.loop = true;  // Ensure looping
          }
      });
  }, []);

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      // Stop audio when timer ends
      Object.values(audioRefs.current).forEach(a => a && a.pause());
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // --- AUDIO SWITCHING LOGIC (Robust) ---
  useEffect(() => {
    // 1. Always pause ALL sounds first
    Object.values(audioRefs.current).forEach(audio => {
        if (audio) audio.pause();
    });

    // 2. If Timer is Active AND a sound is selected -> Play it
    if (isActive && activeSound) {
        const soundToPlay = audioRefs.current[activeSound];
        if (soundToPlay) {
            // Reset logic: 
            // If we are switching sounds, we generally want to start fresh or continue? 
            // Usually for ambience, starting fresh or continuing doesn't matter much, 
            // but ensuring it plays is key.
            // We do NOT reset .currentTime here to allow pausing/resuming, 
            // BUT if you switched sounds, it naturally starts the new one.
            
            soundToPlay.play().catch(e => console.log("Audio play failed:", e));
        }
    }
  }, [isActive, activeSound]); // Runs whenever timer state OR selected sound changes

  // --- HANDLERS ---
  
  const handleUploadSound = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newAudio = new Audio(url);
      newAudio.loop = true;
      newAudio.volume = 0.2;
      
      audioRefs.current.custom = newAudio;
      setCustomTrackName(file.name);
      setActiveSound('custom'); // Auto-select the uploaded sound
    }
  };

  const toggleSound = () => {
      if(!activeSound) setActiveSound('rain');
      else if(activeSound === 'rain') setActiveSound('forest');
      else if(activeSound === 'forest') setActiveSound('lofi');
      else if(activeSound === 'lofi' && audioRefs.current.custom) setActiveSound('custom');
      else setActiveSound(null);
  };

  const getSoundLabel = () => {
      if (!activeSound) return "No Sound";
      if (activeSound === 'rain') return "Rainy Day";
      if (activeSound === 'forest') return "Forest Walk";
      if (activeSound === 'lofi') return "Lofi Beats";
      if (activeSound === 'custom') return customTrackName || "Custom Track";
      return "";
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = ((duration - timeLeft) / duration) * 100;
  
  const pendingTasks = [];
  subjects.forEach(s => s.tasks.forEach(t => {
      if (!t.completed) pendingTasks.push({ ...t, subjectName: s.name, subjectId: s.id });
  }));

  // --- TIMER CUSTOMIZATION ---
  const handleTimerClick = () => {
      if (!isActive) {
          setIsEditingTimer(true);
          setTimerInput(Math.floor(duration / 60).toString());
      }
  };

  const handleTimerSave = () => {
      let minutes = parseInt(timerInput);
      if (isNaN(minutes) || minutes < 1) minutes = 25;
      if (minutes > 180) minutes = 180;
      
      const newSeconds = minutes * 60;
      setDuration(newSeconds);
      setTimeLeft(newSeconds);
      setIsEditingTimer(false);
  };

  const handleTimerKeyDown = (e) => {
      if (e.key === 'Enter') handleTimerSave();
  };

  // Custom Scrollbar Style
  const scrollbarStyles = `
    .custom-scroll::-webkit-scrollbar {
        height: 6px; 
        width: 6px; 
    }
    .custom-scroll::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scroll::-webkit-scrollbar-thumb {
        background-color: ${darkMode ? '#4b5563' : '#cbd5e1'};
        border-radius: 10px;
    }
    .custom-scroll::-webkit-scrollbar-thumb:hover {
        background-color: #4a7a7d;
    }
  `;

  return (
    <div className={`h-full flex flex-col transition-all duration-700 ${isActive ? 'justify-center' : 'pt-4'}`}>
      
      <style>{scrollbarStyles}</style>

      {/* --- HEADER --- */}
      {!isActive && (
        <div className="mb-8 text-center animate-in slide-in-from-top-4 duration-500">
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Deep Focus</h2>
            <p className="text-slate-400 text-sm">Select a task and start your flow.</p>
        </div>
      )}

      {/* --- MAIN TIMER CIRCLE --- */}
      <div className="relative flex flex-col items-center justify-center mb-8">
          <div className="relative w-64 h-64 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="128" cy="128" r="120"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className={`${darkMode ? 'text-stone-800' : 'text-slate-200'}`}
                  />
                  <circle
                    cx="128" cy="128" r="120"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 120}
                    strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
                    strokeLinecap="round"
                    className={`transition-all duration-1000 ease-linear ${isActive ? 'text-[#4a7a7d]' : 'text-slate-300'}`}
                  />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isEditingTimer ? (
                      <div className="flex items-center justify-center">
                          <input 
                            autoFocus
                            type="number" 
                            value={timerInput} 
                            onChange={(e) => setTimerInput(e.target.value)}
                            onBlur={handleTimerSave}
                            onKeyDown={handleTimerKeyDown}
                            className={`w-24 text-center text-5xl font-mono font-bold bg-transparent outline-none border-b-2 ${darkMode ? 'text-white border-white' : 'text-slate-800 border-slate-800'}`}
                          />
                      </div>
                  ) : (
                      <div 
                        onClick={handleTimerClick}
                        className={`group flex items-center justify-center relative cursor-pointer gap-3 transition-transform active:scale-95`}
                        title="Click to edit duration"
                      >
                          <span className={`text-6xl font-mono font-bold tracking-tighter transition-colors duration-300 ${isActive ? 'text-[#4a7a7d]' : (darkMode ? 'text-white' : 'text-slate-800')}`}>
                              {formatTime(timeLeft)}
                          </span>
                          
                          {!isActive && (
                              <div className={`p-2 rounded-full shadow-sm ${darkMode ? 'bg-stone-800 text-[#4a7a7d]' : 'bg-slate-100 text-[#4a7a7d]'}`}>
                                  <Pencil size={18} strokeWidth={2.5} />
                              </div>
                          )}
                      </div>
                  )}
                  
                  <span className={`text-xs uppercase tracking-[0.2em] mt-2 font-bold ${isActive ? 'animate-pulse text-[#4a7a7d]' : 'text-slate-400'}`}>
                      {isActive ? 'Focusing...' : (isEditingTimer ? 'Set Minutes' : 'Ready')}
                  </span>
              </div>
          </div>
      </div>

      {/* --- SOUND INDICATOR --- */}
      {/* Visual Feedback for Sound Selection */}
      <div className={`text-center mb-6 h-6 transition-opacity duration-300 ${activeSound ? 'opacity-100' : 'opacity-0'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4a7a7d]/10 text-[#4a7a7d] text-xs font-bold uppercase tracking-wide">
              <Volume2 size={12} className={isActive ? 'animate-pulse' : ''} />
              {getSoundLabel()}
          </div>
      </div>

      {/* --- CONTROLS ROW --- */}
      <div className="flex items-center justify-center gap-6 mb-6">
          <button 
            onClick={() => {
                setIsActive(false);
                setTimeLeft(duration);
            }}
            className={`p-4 rounded-full transition-all duration-300 ${darkMode ? 'bg-stone-800 text-stone-400 hover:bg-stone-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
          >
              <RotateCcw size={24} />
          </button>

          <button 
            onClick={() => { if(!isEditingTimer) setIsActive(!isActive); }}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 ${isActive ? 'bg-rose-500 shadow-rose-500/30' : 'bg-[#4a7a7d] shadow-[#4a7a7d]/30'}`}
          >
              {isActive ? <Pause size={32} className="text-white fill-current" /> : <Play size={32} className="text-white fill-current ml-1" />}
          </button>
          
          {/* Sound Toggle Button */}
          <button 
            onClick={toggleSound}
            className={`p-4 rounded-full transition-all duration-300 relative ${activeSound ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : (darkMode ? 'bg-stone-800 text-stone-400' : 'bg-slate-100 text-slate-400')}`}
          >
              {activeSound === 'rain' && <CloudRain size={24} />}
              {activeSound === 'forest' && <Trees size={24} />}
              {activeSound === 'lofi' && <Headphones size={24} />}
              {activeSound === 'custom' && <Music2 size={24} />}
              {!activeSound && <Music2 size={24} className="opacity-50" />}
          </button>
      </div>

      {/* --- CUSTOM SOUND UPLOAD CARD --- */}
      <div className="px-6 mb-8 max-w-sm mx-auto w-full">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUploadSound} 
            accept="audio/*" 
            className="hidden" 
          />
          <div 
            onClick={() => fileInputRef.current.click()}
            className={`
                flex items-center justify-between p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300
                ${activeSound === 'custom' 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                    : (darkMode ? 'border-stone-700 hover:border-stone-600 bg-stone-800/30' : 'border-slate-200 hover:border-slate-300 bg-slate-50')}
            `}
          >
              <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-2 rounded-full flex-shrink-0 ${activeSound === 'custom' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-stone-700'}`}>
                      <Upload size={18} />
                  </div>
                  <div className="text-left min-w-0">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>
                          Custom Sound
                      </p>
                      <p className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                          {customTrackName || "Tap to upload MP3..."}
                      </p>
                  </div>
              </div>
              {activeSound === 'custom' && isActive && (
                  <div className="flex gap-0.5 items-end h-4 pb-1">
                      <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite] h-2"></div>
                      <div className="w-1 bg-indigo-500 animate-[bounce_1.2s_infinite] h-3"></div>
                      <div className="w-1 bg-indigo-500 animate-[bounce_0.8s_infinite] h-2"></div>
                  </div>
              )}
          </div>
      </div>

      {/* --- TASK SELECTOR --- */}
      <div className={`transition-all duration-500 px-4 ${isActive ? 'opacity-50 blur-sm hover:opacity-100 hover:blur-0' : 'opacity-100'}`}>
          <div className={`p-4 rounded-2xl border-2 border-dashed ${darkMode ? 'border-stone-700 bg-stone-800/30' : 'border-slate-200 bg-slate-50'}`}>
              
              {!selectedTask ? (
                  <div className="text-center py-2">
                      <p className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Select a Goal</p>
                      {pendingTasks.length > 0 ? (
                          <div className="flex gap-2 overflow-x-auto pb-4 custom-scroll snap-x">
                              {pendingTasks.map(t => (
                                  <button 
                                    key={t.id}
                                    onClick={() => setSelectedTask(t)}
                                    className={`snap-center shrink-0 px-4 py-3 rounded-xl text-left min-w-[200px] border transition-all ${darkMode ? 'bg-[#2c333e] border-stone-600 hover:border-[#4a7a7d]' : 'bg-white border-slate-200 hover:border-[#4a7a7d]'} shadow-sm`}
                                  >
                                      <p className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t.title}</p>
                                      <p className="text-xs text-slate-400 truncate">{t.subjectName}</p>
                                  </button>
                              ))}
                          </div>
                      ) : (
                          <p className="text-slate-400 text-sm">No pending tasks! <span className="text-[#4a7a7d]">Free flow mode.</span></p>
                      )}
                  </div>
              ) : (
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`p-2 rounded-lg ${darkMode ? 'bg-[#4a7a7d]/20 text-[#4a7a7d]' : 'bg-teal-50 text-[#4a7a7d]'}`}>
                              <ListTodo size={20} />
                          </div>
                          <div className="min-w-0">
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Working On</p>
                              <p className={`font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{selectedTask.title}</p>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                                toggleTaskComplete(selectedTask.subjectId, selectedTask.id);
                                setSelectedTask(null);
                                setIsActive(false);
                                setTimeLeft(duration);
                            }}
                            className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-full transition-colors"
                            title="Complete Task"
                          >
                              <CheckCircle2 size={24} />
                          </button>
                          <button 
                            onClick={() => setSelectedTask(null)}
                            className="text-xs text-slate-400 hover:text-slate-600 underline px-2"
                          >
                              Change
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>

    </div>
  );
}