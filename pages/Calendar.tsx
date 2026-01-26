import React, { useState, useEffect } from 'react';
import { useZen } from '../context/ZenContext';
import { IconChevronLeft, IconChevronRight, IconX, IconCheck, IconPlus, IconTrash } from '../components/Icons';
import { isSameDay, generateId } from '../utils/helpers';
import { Task } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Calendar: React.FC = () => {
    const { state, addTask, toggleTask, deleteTask, setHideNavbar } = useZen();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    // Initial load: ensure selected date syncs if needed, or keep today
    useEffect(() => {
        // Reset selected date to match current view if switched month drastically? 
        // Actually, keeping selected date independent is better UX usually.
    }, []);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        // Padding
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Days
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
        if (!newTaskTitle.trim()) return;

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

    const selectedTasks = getTasksForDate(selectedDate);
    
    // Calculate stats for the month
    const currentMonthTasks = state.tasks.filter(t => {
        const d = new Date(t.dueDate);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });
    const monthlyCompletion = currentMonthTasks.length > 0 
        ? Math.round((currentMonthTasks.filter(t => t.completed).length / currentMonthTasks.length) * 100) 
        : 0;

  return (
    <div className="h-full w-full overflow-hidden flex flex-col animate-reveal p-4 md:p-6 lg:p-10 pb-24 lg:pb-10 no-scrollbar desktop-scroll-area overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            
            {/* Header / Month Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 shrink-0 gap-4">
                <div>
                   <h2 className="text-2xl md:text-3xl font-light text-zen-text-primary">
                       {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                   </h2>
                   <p className="hidden lg:block text-sm text-zen-text-secondary mt-1">
                       {monthlyCompletion}% of monthly goals completed
                   </p>
                </div>
                
                <div className="flex items-center gap-2 bg-zen-card/50 rounded-full p-1 border border-zen-surface self-end sm:self-auto">
                   <button onClick={prevMonth} className="p-2 hover:bg-zen-surface rounded-full text-zen-text-secondary hover:text-zen-primary transition-colors"><IconChevronLeft className="w-5 h-5" /></button>
                   <button onClick={() => setCurrentDate(new Date())} className="text-xs font-medium px-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors">Today</button>
                   <button onClick={nextMonth} className="p-2 hover:bg-zen-surface rounded-full text-zen-text-secondary hover:text-zen-primary transition-colors"><IconChevronRight className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8 lg:h-full lg:overflow-hidden">
                
                {/* --- CALENDAR GRID (Left) --- */}
                <div className="lg:col-span-8 flex flex-col bg-zen-card/30 backdrop-blur-sm rounded-3xl border border-zen-surface/50 p-4 md:p-6 lg:p-8 shadow-xl overflow-hidden min-h-[360px] md:min-h-[400px]">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 mb-2 md:mb-4 shrink-0">
                        {DAYS.map(day => (
                            <div key={day} className="text-center text-[10px] md:text-xs text-zen-text-disabled font-bold uppercase tracking-widest py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 grid-rows-6 gap-1 md:gap-2 flex-1">
                        {days.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} className="p-1 md:p-2" />;
                            
                            const isToday = isSameDay(day, new Date());
                            const dayTasks = getTasksForDate(day);
                            const hasTasks = dayTasks.length > 0;
                            const isSelected = isSameDay(day, selectedDate);
                            const percent = dayTasks.length > 0 ? (dayTasks.filter(t => t.completed).length / dayTasks.length) : 0;
                            
                            // Determine dot color based on completion
                            const dotColor = percent === 1 ? 'bg-zen-primary' : percent > 0.5 ? 'bg-yellow-400' : 'bg-zen-secondary';

                            return (
                                <button
                                    key={day.toString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        relative w-full h-full min-h-[44px] md:min-h-[50px] rounded-lg md:rounded-xl flex flex-col items-center justify-start py-1 md:py-2 lg:py-3 transition-all duration-200 group
                                        ${isSelected 
                                            ? 'bg-zen-primary text-zen-bg shadow-lg shadow-zen-primary/20 scale-105 z-10' 
                                            : 'hover:bg-zen-surface/60 text-zen-text-primary hover:scale-[1.02]'
                                        }
                                        ${isToday && !isSelected ? 'ring-1 ring-zen-primary/50 text-zen-primary bg-zen-primary/5' : ''}
                                    `}
                                >
                                    <span className={`text-xs md:text-sm lg:text-base font-medium ${isSelected ? 'font-bold' : ''}`}>
                                        {day.getDate()}
                                    </span>
                                    
                                    {/* Task Indicators */}
                                    <div className="flex gap-0.5 md:gap-1 mt-0.5 md:mt-1 lg:mt-2 px-1 flex-wrap justify-center max-w-full">
                                        {hasTasks && !isSelected && (
                                            <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${dotColor}`} />
                                        )}
                                        {isSelected && dayTasks.length > 0 && (
                                             <span className="text-[8px] md:text-[10px] font-bold opacity-80">{dayTasks.filter(t => t.completed).length}/{dayTasks.length}</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* --- AGENDA SIDEBAR (Right) --- */}
                <div className="lg:col-span-4 flex flex-col h-full min-h-[400px] lg:min-h-0 lg:overflow-hidden animate-slide-up lg:animate-none">
                    <div className="bg-zen-bg rounded-3xl border border-zen-surface p-4 md:p-6 h-full flex flex-col relative overflow-hidden">
                        
                        <div className="mb-6 shrink-0">
                            <h3 className="text-xl font-medium text-zen-text-primary flex items-center gap-2">
                                {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                <span className="text-zen-text-disabled text-sm font-normal px-2 py-0.5 rounded-full border border-zen-surface">
                                    {selectedDate.getDate()}
                                </span>
                            </h3>
                            <p className="text-sm text-zen-text-secondary mt-1">
                                {selectedTasks.length} tasks scheduled
                            </p>
                        </div>

                        {/* Add Task Input */}
                        <form onSubmit={handleAddTask} className="mb-4 relative shrink-0">
                            <input 
                                type="text" 
                                placeholder="Add task..."
                                className="w-full bg-zen-surface/30 border border-zen-surface rounded-xl pl-4 pr-10 py-3 text-sm text-zen-text-primary focus:outline-none focus:border-zen-primary/50 transition-colors placeholder-zen-text-disabled"
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                            />
                            <button 
                                type="submit"
                                disabled={!newTaskTitle.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-zen-surface rounded-lg text-zen-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zen-primary hover:text-zen-bg transition-colors"
                            >
                                <IconPlus className="w-4 h-4" />
                            </button>
                        </form>

                        {/* Task List */}
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 -mr-2 pr-2">
                            {selectedTasks.length > 0 ? (
                                selectedTasks.map((task, idx) => (
                                    <div 
                                        key={task.id} 
                                        className="group flex items-center gap-3 p-3 bg-zen-card/50 rounded-xl border border-zen-surface/50 hover:border-zen-primary/30 transition-all animate-reveal"
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        <button 
                                            onClick={() => toggleTask(task.id)}
                                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${task.completed ? 'bg-zen-primary border-zen-primary' : 'border-zen-text-secondary hover:border-zen-primary'}`}
                                        >
                                            {task.completed && <IconCheck className="w-3.5 h-3.5 text-zen-bg" />}
                                        </button>
                                        
                                        <span className={`text-sm flex-1 truncate transition-colors ${task.completed ? 'text-zen-text-disabled line-through opacity-60' : 'text-zen-text-primary'}`}>
                                            {task.title}
                                        </span>

                                        <button 
                                            onClick={() => {
                                                if (confirmDelete === task.id) {
                                                    deleteTask(task.id);
                                                    setConfirmDelete(null);
                                                } else {
                                                    setConfirmDelete(task.id);
                                                    setTimeout(() => setConfirmDelete(null), 3000); // clear confirm after 3s
                                                }
                                            }}
                                            className={`p-1.5 rounded-lg transition-colors ${confirmDelete === task.id ? 'bg-red-500 text-white' : 'text-zen-text-secondary hover:text-red-400 hover:bg-zen-surface opacity-0 group-hover:opacity-100'}`}
                                        >
                                            <IconTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-4">
                                    <div className="w-16 h-16 border-2 border-dashed border-zen-text-disabled rounded-full flex items-center justify-center mb-3">
                                        <span className="text-2xl">🌱</span>
                                    </div>
                                    <p className="text-sm text-zen-text-secondary font-medium">Free Day</p>
                                    <p className="text-xs text-zen-text-disabled mt-1">Enjoy your time off or plan ahead.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Calendar;