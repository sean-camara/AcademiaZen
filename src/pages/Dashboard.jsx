import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, PackageOpen, Plus, Tag, Pencil, Trash2 } from 'lucide-react';
import { Card, Button, ProgressBar } from '../components/UI';

export default function Dashboard({ controller, openModal }) {
  const { subjects, darkMode, deleteSubject } = controller;
  const navigate = useNavigate();

  // Performance optimized urgency check
  const urgentTasks = useMemo(() => {
    let all = [];
    subjects.forEach(s => s.tasks.forEach(t => !t.completed && all.push({...t, subject: s.name})));
    return all.sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
  }, [subjects]);

  const getUrgency = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Overdue", bg: "bg-rose-100", text: "text-rose-600" };
    if (days === 0) return { label: "Today", bg: "bg-amber-100", text: "text-amber-600" };
    return { label: `${days}d left`, bg: "bg-[#4a7a7d]/10", text: "text-[#4a7a7d]" };
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Urgent Tasks Section */}
      {urgentTasks.length > 0 ? (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Zap size={16} className="text-amber-500 fill-amber-500" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Up Next</h3>
          </div>
          <div className="space-y-3">
            {urgentTasks.map((task, idx) => {
                const urgency = getUrgency(task.date);
                return (
                  <Card key={idx} className={`p-4 flex items-center justify-between border-l-4 border-l-amber-500 ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
                    <div>
                      <p className={`font-bold text-sm ${darkMode ? 'text-stone-100' : 'text-slate-800'}`}>{task.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-slate-400 text-xs flex items-center gap-1"><Tag size={12}/> {task.type}</span>
                        <span className="text-slate-300">•</span>
                        <p className="text-xs text-slate-500">{task.subject}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold ${urgency.bg} ${urgency.text}`}>
                      {urgency.label}
                    </div>
                  </Card>
                )
            })}
          </div>
        </div>
      ) : (
        // All Caught Up State
        <div className="mb-8">
          <Card className="p-8 bg-gradient-to-br from-[#4a7a7d] to-[#3b6366] text-white border-none shadow-lg text-center">
            <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
            <p className="text-stone-100 opacity-90 text-sm mb-6">You have no pending tasks.</p>
            <Button variant="contrast" onClick={() => openModal('subject')} className="w-full text-[#4a7a7d]">
              <Plus size={18} className="mr-2" /> Start New Module
            </Button>
          </Card>
        </div>
      )}

      {/* Modules Header */}
      <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Modules</h3>
          <button onClick={() => openModal('subject')} className="text-[#4a7a7d] text-xs font-bold flex items-center gap-1 hover:underline">
            <Plus size={14} /> New Module
          </button>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 gap-4">
          {/* IMPROVED EMPTY STATE: Button is now directly clickable */}
          {subjects.length === 0 && (
            <div 
              className={`py-16 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-colors ${darkMode ? 'border-stone-700 bg-stone-800/30' : 'border-slate-300 bg-white/50'}`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm ${darkMode ? 'bg-stone-700 text-stone-400' : 'bg-white text-slate-400'}`}>
                <PackageOpen size={32} />
              </div>
              <p className={`font-bold text-sm mb-1 ${darkMode ? 'text-stone-300' : 'text-slate-700'}`}>No modules found</p>
              <p className={`text-xs mb-6 ${darkMode ? 'text-stone-500' : 'text-slate-500'}`}>Get started by creating one</p>
              
              <Button variant="primary" onClick={() => openModal('subject')} className="shadow-lg px-6">
                <Plus size={18} className="mr-2" /> Create First Module
              </Button>
            </div>
          )}

          {subjects.map(subject => {
            const completed = subject.tasks.filter(t => t.completed).length;
            const pending = subject.tasks.length - completed;
            const progress = subject.tasks.length === 0 ? 0 : Math.round((completed / subject.tasks.length) * 100);

            return (
              <Card 
                key={subject.id} 
                onClick={() => navigate(`/subject/${subject.id}`)}
                className={`p-5 cursor-pointer hover:border-[#4a7a7d] hover:shadow-md group relative overflow-hidden ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h2 className={`font-bold text-lg group-hover:text-[#4a7a7d] transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>{subject.name}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">{completed}/{subject.tasks.length} Tasks Completed</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`rounded-full px-2 py-0.5 flex items-center justify-center text-[10px] font-bold ${darkMode ? 'bg-stone-800 text-slate-500' : 'bg-slate-100 text-slate-600'}`}>
                      {pending} Pending
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openModal('edit-subject', subject); }} 
                        className="text-slate-400 hover:text-[#4a7a7d] transition-colors p-1"
                      >
                        <Pencil size={16}/>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if(confirm("Delete module?")) deleteSubject(subject.id); }} 
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <ProgressBar total={subject.tasks.length} completed={completed} />
              </Card>
            )
          })}
      </div>
    </div>
  );
}