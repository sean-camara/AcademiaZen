import React, { useState, useEffect } from 'react';
import { useZen } from '../context/ZenContext';
import { IconChevronLeft, IconChevronRight, IconX, IconCheck } from '../components/Icons';
import { isSameDay, generateId } from '../utils/helpers';
import { Task } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Calendar: React.FC = () => {
  const { state, addTask, toggleTask, setHideNavbar } = useZen();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Hide navbar when date detail panel is open
  useEffect(() => {
    setHideNavbar(selectedDate !== null);
  }, [selectedDate, setHideNavbar]);

  // Calendar Grid Logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Padding for first week
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const days = getDaysInMonth(currentDate);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedDate) return;
    
    const task: Task = {
        id: generateId(),
        title: newTaskTitle,
        dueDate: selectedDate.toISOString(),
        completed: false
    };
    addTask(task);
    setNewTaskTitle('');
  };

  const getTasksForDate = (date: Date) => {
      return state.tasks.filter(t => isSameDay(new Date(t.dueDate), date));
  };

  return (
    <div className="h-full flex flex-col p-6 relative">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-light text-zen-text-primary">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-4">
           <button onClick={prevMonth} className="p-2 hover:bg-zen-surface rounded-full text-zen-text-secondary"><IconChevronLeft className="w-5 h-5" /></button>
           <button onClick={nextMonth} className="p-2 hover:bg-zen-surface rounded-full text-zen-text-secondary"><IconChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 mb-4">
        {DAYS.map(day => (
            <div key={day} className="text-center text-xs text-zen-text-disabled font-medium uppercase tracking-wide">
                {day}
            </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-7 gap-y-4 gap-x-2">
        {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            
            const isToday = isSameDay(day, new Date());
            const hasTasks = getTasksForDate(day).length > 0;
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
                <button
                    key={day.toString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                        aspect-square rounded-full flex flex-col items-center justify-center relative transition-all duration-200
                        ${isSelected ? 'bg-zen-primary text-zen-bg font-semibold' : 'text-zen-text-primary hover:bg-zen-surface'}
                        ${isToday && !isSelected ? 'border border-zen-primary text-zen-primary' : ''}
                    `}
                >
                    <span className="text-sm">{day.getDate()}</span>
                    {hasTasks && !isSelected && (
                        <div className="absolute bottom-2 w-1 h-1 bg-zen-secondary rounded-full" />
                    )}
                </button>
            );
        })}
      </div>

      {/* Selected Day Panel (Bottom Sheet Simulation) */}
      {selectedDate && (
        <div className="absolute inset-x-0 bottom-0 top-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col justify-end animate-fade-in" onClick={() => setSelectedDate(null)}>
            <div className="bg-zen-card rounded-t-3xl p-6 min-h-[50%] max-h-[85%] overflow-y-auto border-t border-zen-surface shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-medium text-zen-text-primary">
                            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric'})}
                        </h3>
                        <p className="text-xs text-zen-text-disabled mt-1">
                            {getTasksForDate(selectedDate).length} tasks scheduled
                        </p>
                    </div>
                    <button onClick={() => setSelectedDate(null)} className="p-2 text-zen-text-secondary hover:text-zen-text-primary">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>

                {/* Add Task Input */}
                <form onSubmit={handleAddTask} className="mb-6">
                    <input 
                        type="text" 
                        placeholder="Add a new task..."
                        className="w-full bg-zen-bg rounded-xl px-4 py-3 text-zen-text-primary focus:outline-none focus:ring-1 focus:ring-zen-primary transition-all placeholder-zen-text-disabled"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                    />
                </form>

                {/* Task List */}
                <ul className="space-y-3">
                    {getTasksForDate(selectedDate).map(task => (
                         <li key={task.id} className="flex items-center gap-3 p-3 bg-zen-bg rounded-xl border border-zen-surface/50">
                             <button 
                                onClick={() => toggleTask(task.id)}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${task.completed ? 'bg-zen-primary border-zen-primary' : 'border-zen-text-secondary'}`}
                             >
                                 {task.completed && <IconCheck className="w-3 h-3 text-zen-bg" />}
                             </button>
                             <span className={`text-sm ${task.completed ? 'text-zen-text-disabled line-through' : 'text-zen-text-primary'}`}>
                                 {task.title}
                             </span>
                         </li>
                    ))}
                    {getTasksForDate(selectedDate).length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-zen-text-disabled text-sm italic">Nothing planned for this day.</p>
                        </div>
                    )}
                </ul>
            </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;