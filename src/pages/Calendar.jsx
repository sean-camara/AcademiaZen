import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, ArrowRight, FileText, X, Eye, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/UI';

export default function Calendar({ controller, openModal }) {
  const { subjects, darkMode } = controller;
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // --- NEW: State for the "Choice Modal" ---
  const [choiceTask, setChoiceTask] = useState(null);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Helper to get tasks for a specific day
  const tasksForDate = (day) => {
    const checkDate = new Date(year, month, day).toDateString();
    let tasks = [];
    subjects.forEach(s => s.tasks.forEach(t => {
       if(new Date(t.date).toDateString() === checkDate && !t.completed) {
           // We need subjectId for navigation
           tasks.push({...t, subject: s.name, subjectId: s.id}); 
       }
    }));
    return tasks;
  };

  const selectedTasks = tasksForDate(selectedDate.getDate());

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));

  const getPriorityColor = (p) => {
    if (p === 'High') return 'bg-rose-500';
    if (p === 'Medium') return 'bg-amber-500';
    return 'bg-[#4a7a7d]';
  };

  // --- ACTIONS ---

  const handleTaskClick = (task) => {
      // If it has a PDF, ask the user what to do
      if (task.pdfFile) {
          setChoiceTask(task);
      } else {
          // If no PDF, go straight to subject
          navigate(`/subject/${task.subjectId}`);
      }
  };

  const handleViewPdf = () => {
      if (!choiceTask?.pdfFile) return;
      try {
        // Blob Logic to avoid black screen on mobile
        const base64 = choiceTask.pdfFile;
        const byteCharacters = atob(base64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            alert("Please allow popups to view this file.");
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (e) {
          console.error("PDF Open Error:", e);
          alert("Could not open PDF.");
      }
      setChoiceTask(null);
  };

  const handleGoToSubject = () => {
      if (choiceTask) {
          navigate(`/subject/${choiceTask.subjectId}`);
          setChoiceTask(null);
      }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-24 relative">
      
      {/* --- CHOICE MODAL (Only shows when a task with PDF is clicked) --- */}
      {choiceTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setChoiceTask(null)}></div>
              <div className={`relative w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
                  <button onClick={() => setChoiceTask(null)} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
                  
                  <div className="text-center mb-6">
                      <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                          <FileText size={24} />
                      </div>
                      <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Task Options</h3>
                      <p className="text-xs text-slate-400 mt-1">"{choiceTask.title}" has an attachment.</p>
                  </div>

                  <div className="space-y-3">
                      <Button onClick={handleViewPdf} className="w-full gap-2 py-3 bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20">
                          <Eye size={18}/> View PDF Document
                      </Button>
                      
                      <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-slate-200 dark:border-stone-700"></div>
                          <span className="flex-shrink-0 mx-2 text-[10px] text-slate-400 uppercase font-bold">Or</span>
                          <div className="flex-grow border-t border-slate-200 dark:border-stone-700"></div>
                      </div>

                      <Button onClick={handleGoToSubject} variant="secondary" className="w-full gap-2 py-3 border border-slate-200 dark:border-stone-700">
                          <FolderOpen size={18}/> Go to {choiceTask.subject}
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* --- ELEGANT CALENDAR WIDGET --- */}
      <div className={`p-6 mb-8 rounded-3xl shadow-xl transition-all duration-300 ${darkMode ? 'bg-[#2c333e] shadow-black/20' : 'bg-white shadow-slate-200'}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={prevMonth} className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-white/10 text-stone-300' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ChevronLeft size={20}/>
          </button>
          <h2 className={`text-lg font-bold tracking-wide ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            {monthNames[month]} {year}
          </h2>
          <button onClick={nextMonth} className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-white/10 text-stone-300' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ChevronRight size={20}/>
          </button>
        </div>
        
        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-3">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-2">{d}</div>
          ))}
        </div>
        
        {/* Grid */}
        <div className="grid grid-cols-7 gap-y-2">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const tasks = tasksForDate(day);
            const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
            const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

            return (
              <div key={day} className="flex justify-center relative">
                <button 
                  onClick={() => setSelectedDate(new Date(year, month, day))}
                  className={`
                    h-9 w-9 rounded-full flex items-center justify-center relative text-sm font-medium transition-all duration-300
                    ${isSelected 
                      ? 'bg-[#4a7a7d] text-white shadow-lg shadow-[#4a7a7d]/40 scale-110' 
                      : isToday 
                        ? (darkMode ? 'bg-stone-700 text-[#4a7a7d] font-bold ring-1 ring-[#4a7a7d]' : 'bg-slate-100 text-[#4a7a7d] font-bold') 
                        : (darkMode ? 'text-stone-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100')
                    }
                  `}
                >
                  {day}
                  {/* Dot indicator */}
                  {tasks.length > 0 && !isSelected && (
                    <div className="absolute bottom-1.5 w-1 h-1 bg-[#4a7a7d] rounded-full"></div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- TASK LIST --- */}
      <div className="space-y-4 px-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          {selectedDate.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}
        </h3>
        
        {selectedTasks.length === 0 ? (
          <div className="py-12 text-center opacity-50 flex flex-col items-center">
            <CalendarIcon size={40} className="mb-3 text-slate-300 stroke-1" />
            <p className="text-sm font-medium text-slate-400">No tasks for this day.</p>
          </div>
        ) : (
          selectedTasks.map((t, idx) => (
            <div 
              key={idx}
              // SMART CLICK ACTION
              onClick={() => handleTaskClick(t)}
              className="animate-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className={`
                group relative p-4 rounded-xl border cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-95
                ${darkMode ? 'bg-[#2c333e] border-stone-700 hover:border-stone-600' : 'bg-white border-slate-200 hover:border-[#4a7a7d]/50 shadow-sm hover:shadow-md'}
              `}>
                
                {/* Priority Color Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getPriorityColor(t.priority)}`}></div>

                <div className="pl-3 flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <h4 className={`font-bold text-[15px] leading-tight flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                      {t.title}
                      {/* PDF Indicator Icon */}
                      {t.pdfFile && <FileText size={14} className="text-rose-500" />}
                    </h4>
                    {/* Arrow hint that appears on hover */}
                    <ArrowRight size={16} className="text-[#4a7a7d] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="font-semibold text-[#4a7a7d] bg-[#4a7a7d]/10 px-2 py-0.5 rounded-md">
                      {t.subject}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}