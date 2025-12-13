import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Card } from '../components/UI';

export default function Calendar({ controller }) {
  const { subjects, darkMode } = controller;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Helper to get tasks for a specific day
  const tasksForDate = (day) => {
    // Construct date for the specific grid cell
    const checkDate = new Date(year, month, day).toDateString();
    
    // Search all subjects for tasks matching this date
    let tasks = [];
    subjects.forEach(s => s.tasks.forEach(t => {
       if(new Date(t.date).toDateString() === checkDate && !t.completed) tasks.push({...t, subject: s.name});
    }));
    return tasks;
  };

  // Get tasks for the currently selected date to display in the list below
  const selectedTasks = tasksForDate(selectedDate.getDate());

  // Navigation handlers
  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      {/* Calendar Card */}
      <Card className={`p-6 mb-6 border-none shadow-md ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
        
        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-stone-700 rounded-full text-slate-600 dark:text-stone-300">
            <ChevronLeft size={20}/>
          </button>
          <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            {monthNames[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-stone-700 rounded-full text-slate-600 dark:text-stone-300">
            <ChevronRight size={20}/>
          </button>
        </div>
        
        {/* Days Header (S M T W T F S) */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-xs font-bold text-slate-400 py-2">{d}</div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty slots for start of month */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          
          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const tasks = tasksForDate(day);
            const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
            const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

            return (
              <button 
                key={day}
                onClick={() => setSelectedDate(new Date(year, month, day))}
                className={`
                  h-10 w-10 mx-auto rounded-full flex items-center justify-center relative text-sm font-medium transition-all
                  ${isSelected ? 'bg-[#4a7a7d] text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-300'}
                  ${isToday && !isSelected ? 'text-[#4a7a7d] font-bold border-2 border-[#4a7a7d]' : ''}
                `}
              >
                {day}
                {/* Dot indicator for tasks */}
                {tasks.length > 0 && !isSelected && (
                  <div className="absolute bottom-1 w-1.5 h-1.5 bg-[#4a7a7d] rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected Day's Tasks */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
          {selectedDate.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}
        </h3>
        
        {selectedTasks.length === 0 ? (
          <div className={`p-8 text-center border-2 border-dashed rounded-2xl ${darkMode ? 'border-stone-700 bg-stone-800/30' : 'border-slate-300 bg-white/50'}`}>
            <p className="text-slate-500 text-sm font-medium">No tasks due this day.</p>
          </div>
        ) : (
          selectedTasks.map((t, idx) => (
            <Card key={idx} className={`p-4 flex items-center gap-4 animate-in slide-in-from-bottom-2 ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
              <div className="w-1 h-12 rounded-full bg-[#4a7a7d]"></div>
              <div>
                <p className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t.title}</p>
                <div className="flex items-center gap-2 mt-1">
                   <p className="text-xs text-slate-500 font-medium">{t.subject}</p>
                   <span className="text-slate-300">•</span>
                   <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                     <Clock size={10} /> {new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                   </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}