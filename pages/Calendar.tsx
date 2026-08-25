import React, { useState, useEffect } from 'react';
import { useZen } from '../context/ZenContext';
import { IconChevronLeft, IconChevronRight, IconCheck, IconTrash, IconPlus, IconX } from '../components/Icons';
import { generateId, isSameDay } from '../utils/helpers';
import { EmptyState } from '../components/ui/EmptyState';
import { PlanModal } from '../components/PlanModal';
import { Subject, Task } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type ScheduleCategory = NonNullable<Task['category']>;

const Calendar: React.FC = () => {
    const { state, addTask, toggleTask, deleteTask, setHideNavbar } = useZen();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isPlanning, setIsPlanning] = useState(false);

    // Initial load: ensure selected date syncs if needed, or keep today
    useEffect(() => {
        setHideNavbar(isPlanning);
        return () => setHideNavbar(false);
    }, [isPlanning, setHideNavbar]);

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

    const handleSavePlan = (plan: { title: string; dueDate: string; category: ScheduleCategory; subjectId?: string; notes?: string }) => {
        addTask({
            id: generateId(),
            title: plan.title,
            dueDate: plan.dueDate,
            completed: false,
            category: plan.category,
            ...(plan.subjectId ? { subjectId: plan.subjectId } : {}),
            ...(plan.notes ? { notes: plan.notes } : {}),
        });
        const scheduledDate = new Date(plan.dueDate);
        setSelectedDate(scheduledDate);
        setCurrentDate(new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), 1));
        setIsPlanning(false);
    };

  return (
    <div className="workspace-page desktop-scroll-area no-scrollbar">
        <div className="workspace-page-inner flex min-h-full flex-col">
            
            {/* Header / Month Navigation */}
            <div className="workspace-page-hero flex shrink-0 flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                   <p className="workspace-eyebrow">Schedule command center</p>
                   <h2 className="workspace-title">
                       {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                   </h2>
                   <p className="workspace-subtitle">
                       See deadlines in context and protect space for the work that matters. {monthlyCompletion}% completed this month.
                   </p>
                </div>
                
                <div className="flex items-center gap-2 self-end sm:self-auto">
                   <button onClick={() => setIsPlanning(true)} className="flex min-h-11 items-center gap-2 rounded-xl bg-zen-primary px-4 text-xs font-bold uppercase tracking-wider text-zen-bg transition-all hover:-translate-y-0.5">
                       <IconPlus className="h-4 w-4" /> Plan
                   </button>
                   <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1">
                   <button onClick={prevMonth} aria-label="Previous month" className="p-2 hover:bg-zen-surface rounded-full text-zen-text-secondary hover:text-zen-primary transition-colors"><IconChevronLeft className="w-5 h-5" /></button>
                   <button onClick={() => setCurrentDate(new Date())} className="text-xs font-medium px-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors">Today</button>
                   <button onClick={nextMonth} aria-label="Next month" className="p-2 hover:bg-zen-surface rounded-full text-zen-text-secondary hover:text-zen-primary transition-colors"><IconChevronRight className="w-5 h-5" /></button>
                   </div>
                </div>
            </div>

            <div className="flex flex-col gap-6 lg:grid lg:h-full lg:grid-cols-12 lg:overflow-hidden">
                
                {/* --- CALENDAR GRID (Left) --- */}
                <div className="workspace-panel flex min-h-[360px] flex-col overflow-hidden p-4 md:min-h-[400px] md:p-6 lg:col-span-8 lg:p-8">
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
                                    aria-label={`${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${dayTasks.length ? `, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : ', no tasks'}`}
                                    aria-pressed={isSelected}
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
                    <div className="workspace-panel relative flex h-full flex-col overflow-hidden p-4 md:p-6">
                        
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

                        {/* Task List */}
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 -mr-2 pr-2">
                            {selectedTasks.length > 0 ? (
                                selectedTasks.map((task, idx) => (
                                    <div 
                                        key={task.id} 
                                        className="group relative flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-black/15 p-4 transition-colors hover:border-zen-primary/25"
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        {/* Subject at top */}
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-zen-text-disabled font-bold">
                                            {task.category || 'task'} · {(state.subjects.find(subject => subject.id === task.subjectId)?.name || 'Unassigned')}
                                        </span>
                                        
                                        {/* Title and Checkbox Row */}
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => toggleTask(task.id)}
                                                aria-label={`${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${task.completed ? 'bg-zen-primary border-zen-primary' : 'border-zen-text-secondary hover:border-zen-primary'}`}
                                            >
                                                {task.completed && <IconCheck className="w-3.5 h-3.5 text-zen-bg" />}
                                            </button>
                                            
                                            <span className={`text-sm block truncate transition-colors flex-1 ${task.completed ? 'text-zen-text-disabled line-through opacity-60' : 'text-zen-text-primary'}`}>
                                                {task.title}
                                            </span>

                                            <button 
                                                onClick={() => {
                                                    if (confirmDelete === task.id) {
                                                        deleteTask(task.id);
                                                        setConfirmDelete(null);
                                                    } else {
                                                        setConfirmDelete(task.id);
                                                        setTimeout(() => setConfirmDelete(null), 3000);
                                                    }
                                                }}
                                                aria-label={confirmDelete === task.id ? `Confirm delete ${task.title}` : `Delete ${task.title}`}
                                                className={`p-1.5 rounded-lg transition-colors shrink-0 ${confirmDelete === task.id ? 'bg-red-500 text-white' : 'text-zen-text-secondary hover:text-red-400 hover:bg-zen-surface opacity-0 group-hover:opacity-100'}`}
                                            >
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Date at bottom */}
                                        <span className="text-[10px] text-zen-text-secondary">
                                            {new Date(task.dueDate).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })} at {new Date(task.dueDate).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <EmptyState
                                  compact
                                  icon={<span className="text-2xl" aria-hidden="true">🌱</span>}
                                  title="Nothing planned yet"
                                  description="Schedule an exam, project, study session, event, or task for this day."
                                  actionLabel="Plan a task"
                                  onAction={() => setIsPlanning(true)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {isPlanning && (
            <PlanModal
                selectedDate={selectedDate}
                subjects={state.subjects}
                onClose={() => setIsPlanning(false)}
                onSave={handleSavePlan}
            />
        )}
    </div>
  );
};

export default Calendar;
