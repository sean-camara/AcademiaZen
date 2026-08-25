import React, { useState } from 'react';
import { IconX, IconPlus } from './Icons';
import { CustomSelect } from './ui/CustomSelect';
import { CustomDatePicker } from './ui/CustomDatePicker';
import { CustomTimePicker } from './ui/CustomTimePicker';
import { Subject, Task } from '../types';

type ScheduleCategory = NonNullable<Task['category']>;

const CATEGORY_OPTIONS: Array<{ value: ScheduleCategory; label: string }> = [
    { value: 'task', label: 'Task' },
    { value: 'exam', label: 'Exam' },
    { value: 'project', label: 'Project' },
    { value: 'study', label: 'Study session' },
    { value: 'event', label: 'School event' },
];

const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toLocalIsoString = (date: string, time: string) => {
    const value = new Date(`${date}T${time}:00`);
    const offset = -value.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    return `${date}T${time}:00${sign}${hours}:${minutes}`;
};

export interface PlanModalProps {
    isOpen?: boolean;
    selectedDate?: Date;
    subjects?: Subject[];
    onClose: () => void;
    onSave: (plan: { title: string; dueDate: string; category: ScheduleCategory; subjectId?: string; notes?: string }) => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({ 
    isOpen = true,
    selectedDate = new Date(), 
    subjects = [], 
    onClose, 
    onSave 
}) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<ScheduleCategory>('task');
    const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
    const [date, setDate] = useState(formatDateInput(selectedDate));
    const [time, setTime] = useState('09:00');
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    const subjectOptions = [
        { value: '', label: 'No subject' },
        ...subjects.map(s => ({ value: s.id, label: s.name })),
    ];

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        onSave({
            title: title.trim(),
            dueDate: toLocalIsoString(date, time),
            category,
            ...(subjectId ? { subjectId } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-6">
            <button type="button" aria-label="Close planner" className="absolute inset-0 h-full w-full bg-black/75 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-zen-bg shadow-2xl sm:max-w-2xl sm:rounded-[2rem] transform-gpu">
                {/* Header */}
                <div className="relative shrink-0 overflow-hidden border-b border-white/[0.06] p-6 sm:p-8">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-zen-primary/10 blur-2xl pointer-events-none" aria-hidden="true" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zen-primary">Calendar planner</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Schedule your next move</h2>
                            <p className="mt-2 text-sm text-zen-text-secondary">Plan an exam, project, study session, event, or regular task.</p>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close planner" className="rounded-xl bg-white/[0.04] p-2.5 text-zen-text-secondary transition-colors hover:bg-white/[0.08] hover:text-white">
                            <IconX className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Form Wrapper */}
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {/* Scrollable Form Body */}
                    <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-6 sm:p-8">
                        <div className="space-y-2">
                            <label htmlFor="plan-title" className="text-[10px] font-bold uppercase tracking-[0.18em] text-zen-text-disabled">Title</label>
                            <input id="plan-title" autoFocus required value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g., Midterm exam or Submit capstone" className="w-full rounded-xl border border-white/[0.07] bg-zen-surface/40 px-4 py-3.5 text-base text-white outline-none transition-colors placeholder:text-zen-text-disabled/50 focus:border-zen-primary/50" />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="plan-category" className="text-[10px] font-bold uppercase tracking-[0.18em] text-zen-text-disabled">Plan type</label>
                                <CustomSelect id="plan-category" value={category} options={CATEGORY_OPTIONS} onChange={val => setCategory(val as ScheduleCategory)} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="plan-subject" className="text-[10px] font-bold uppercase tracking-[0.18em] text-zen-text-disabled">Subject</label>
                                <CustomSelect id="plan-subject" value={subjectId} options={subjectOptions} onChange={val => setSubjectId(val)} />
                            </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="plan-date" className="text-[10px] font-bold uppercase tracking-[0.18em] text-zen-text-disabled">Date</label>
                                <CustomDatePicker id="plan-date" value={date} onChange={setDate} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="plan-time" className="text-[10px] font-bold uppercase tracking-[0.18em] text-zen-text-disabled">Time</label>
                                <CustomTimePicker id="plan-time" value={time} onChange={setTime} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="plan-notes" className="text-[10px] font-bold uppercase tracking-[0.18em] text-zen-text-disabled">Notes <span className="normal-case tracking-normal">(optional)</span></label>
                            <textarea id="plan-notes" rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Room, coverage, preparation steps, or reminders…" className="w-full resize-none rounded-xl border border-white/[0.07] bg-zen-surface/40 px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-zen-text-disabled/50 focus:border-zen-primary/50" />
                        </div>
                    </div>

                    {/* Fixed Action Footer */}
                    <div className="shrink-0 flex flex-col-reverse gap-3 border-t border-white/[0.06] bg-[#0c1017] px-6 py-4 sm:flex-row sm:justify-end sm:px-8 sm:py-5">
                        <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-5 text-xs font-bold uppercase tracking-wider text-zen-text-secondary transition-colors hover:bg-white/[0.04] hover:text-white">Cancel</button>
                        <button type="submit" disabled={!title.trim()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zen-primary px-6 text-xs font-bold uppercase tracking-wider text-zen-bg transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">
                            <IconPlus className="h-4 w-4" />
                            Add to schedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PlanModal;
