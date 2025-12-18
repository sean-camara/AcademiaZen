import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, PackageOpen, Plus, Tag, Pencil, Trash2, Bell, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, Button, ProgressBar } from '../components/UI';
import { useAuth } from '../context/AuthContext';

export default function Dashboard({ controller, openModal }) {
  const { subjects, darkMode, enableNotifications, deleteSubject, userProfile } = controller;
  const navigate = useNavigate();

  const showNotifButton = "Notification" in window && Notification.permission === "default";
  const displayName = userProfile?.displayName || "Scholar";
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const urgentTasks = subjects
    .flatMap(s => (s.tasks || []).map(t => ({...t, subject: s.name})))
    .filter(t => !t.completed && t.date)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3); // Max 3 items

  const getUrgency = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Overdue", bg: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" };
    if (days === 0) return { label: "Today", bg: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" };
    return { label: `${days}d left`, bg: "bg-[#4a7a7d]/10 text-[#4a7a7d]", text: "text-[#4a7a7d]" };
  };

  const completedTasksCount = subjects.reduce((acc, sub) => acc + (sub.tasks || []).filter(t => t.completed).length, 0);

  return (
    <div className={`pb-24 pt-4 animate-in fade-in duration-500 max-w-lg mx-auto px-4 ${darkMode ? 'text-stone-200' : 'text-slate-800'}`}>
      
      {/* Custom Scrollbar Styles for horizontal lists */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      {/* --- HEADER --- */}
      <div className="mb-8 mt-2">
         <div className="flex justify-between items-center mb-6">
             <div>
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${darkMode ? 'text-stone-400' : 'text-slate-400'}`}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h1 className={`text-3xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {getGreeting()}, <br/>
                    <span className="text-[#4a7a7d]">{displayName}</span>
                </h1>
             </div>
             
             <div onClick={() => navigate('/settings')} className={`cursor-pointer w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4a7a7d] to-[#2d5c5e] flex items-center justify-center text-white font-bold text-xl shadow-xl border-2 overflow-hidden hover:scale-105 transition-transform ${darkMode ? 'border-stone-800' : 'border-white'}`}>
                 {userProfile?.photo ? (
                     <img src={userProfile.photo} alt="Profile" className="w-full h-full object-cover" />
                 ) : (
                     <span>{displayName[0]?.toUpperCase()}</span>
                 )}
             </div>
         </div>
         
         {/* Quick Stats Row (Horizontal Scroll) */}
         <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x">
             <div className={`snap-center flex-shrink-0 w-32 px-5 py-4 rounded-3xl border flex flex-col justify-center ${darkMode ? 'bg-[#2c333e] border-stone-700 shadow-lg' : 'bg-white border-slate-100 shadow-md shadow-slate-200/40'}`}>
                 <span className={`text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-stone-400' : 'text-slate-400'}`}>Modules</span>
                 <span className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{subjects.length}</span>
             </div>
             <div className={`snap-center flex-shrink-0 w-32 px-5 py-4 rounded-3xl border flex flex-col justify-center ${darkMode ? 'bg-[#2c333e] border-stone-700 shadow-lg' : 'bg-white border-slate-100 shadow-md shadow-slate-200/40'}`}>
                 <span className={`text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-stone-400' : 'text-slate-400'}`}>Due Soon</span>
                 <span className="text-3xl font-black text-amber-500">{urgentTasks.length}</span>
             </div>
             <div className={`snap-center flex-shrink-0 w-32 px-5 py-4 rounded-3xl border flex flex-col justify-center ${darkMode ? 'bg-[#2c333e] border-stone-700 shadow-lg' : 'bg-white border-slate-100 shadow-md shadow-slate-200/40'}`}>
                 <span className={`text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-stone-400' : 'text-slate-400'}`}>Done</span>
                 <span className="text-3xl font-black text-emerald-500">{completedTasksCount}</span>
             </div>
         </div>
      </div>

      {/* --- NOTIFICATION BANNER --- */}
      {showNotifButton && (
          <div className="mb-10 p-5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl text-white flex items-center justify-between shadow-xl shadow-indigo-500/20 relative overflow-hidden" onClick={enableNotifications}>
              <div className="relative z-10">
                  <h3 className="font-bold text-sm mb-0.5">Stay Updated</h3>
                  <p className="text-xs text-indigo-100 opacity-90">Enable push reminders.</p>
              </div>
              <button className="relative z-10 bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-transform shadow-sm">
                  <Bell size={16} /> Turn On
              </button>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          </div>
      )}

      {/* --- URGENT TASKS --- */}
      <div className="mb-10">
          {urgentTasks.length > 0 ? (
            <>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'}`}>
                            <Zap size={14} className="text-amber-500 fill-amber-500" />
                        </div>
                        <h3 className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>Up Next</h3>
                    </div>
                    <button onClick={() => navigate('/calendar')} className="text-xs text-[#4a7a7d] font-bold">See All</button>
                </div>
                
                <div className="space-y-3">
                    {urgentTasks.map((task, idx) => {
                        const urgency = getUrgency(task.date);
                        return (
                        <Card key={idx} className={`p-4 flex items-center justify-between border-l-[6px] border-l-amber-500 ${darkMode ? 'bg-[#2c333e]' : 'bg-white shadow-sm'}`}>
                            <div className="overflow-hidden mr-3">
                                <p className={`font-bold text-sm truncate ${darkMode ? 'text-stone-100' : 'text-slate-800'}`}>{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium truncate max-w-[100px] ${darkMode ? 'bg-stone-800 text-stone-400' : 'bg-slate-100 text-slate-500'}`}>{task.subject}</span>
                                    <span className={`text-xs flex items-center gap-1 ${darkMode ? 'text-stone-500' : 'text-slate-400'}`}><Tag size={12}/> {task.type}</span>
                                </div>
                            </div>
                            <div className={`flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${urgency.bg}`}>
                                {urgency.label}
                            </div>
                        </Card>
                        )
                    })}
                </div>
            </>
          ) : (
            // All Caught Up
            <Card className="p-8 bg-gradient-to-br from-[#4a7a7d] to-[#3b6366] text-white border-none shadow-lg text-center relative overflow-hidden">
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm border border-white/30">
                        <CheckCircle2 size={28} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold mb-1">All Caught Up!</h2>
                    <p className="text-stone-100 opacity-90 text-sm mb-6">No urgent deadlines pending.</p>
                    <Button variant="contrast" onClick={() => openModal('subject')} className="w-full text-[#4a7a7d] font-bold shadow-lg">
                        <Plus size={18} className="mr-2" /> New Module
                    </Button>
                </div>
                 <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            </Card>
          )}
      </div>

      {/* --- MODULES LIST --- */}
      <div>
          <div className="flex items-center justify-between mb-4 px-1">
              <h3 className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>Your Modules</h3>
              <button 
                onClick={() => openModal('subject')} 
                className="w-8 h-8 rounded-full bg-[#4a7a7d]/10 text-[#4a7a7d] flex items-center justify-center"
              >
                  <Plus size={18} />
              </button>
          </div>

          <div className="space-y-4">
              {subjects.length === 0 && (
                <div className={`py-12 px-6 text-center border-2 border-dashed rounded-3xl ${darkMode ? 'border-stone-700 bg-stone-800/30' : 'border-slate-300 bg-white/50'}`}>
                  <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${darkMode ? 'bg-stone-700 text-stone-400' : 'bg-white text-slate-400'}`}>
                    <PackageOpen size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className={`font-bold text-lg mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>No modules yet</h3>
                  <p className={`text-xs mb-6 ${darkMode ? 'text-stone-500' : 'text-slate-500'}`}>Create a module to organize your work.</p>
                  <Button variant="primary" onClick={() => openModal('subject')} className="w-full shadow-lg">
                    <Plus size={18} className="mr-2" /> Create First Module
                  </Button>
                </div>
              )}

              {subjects.map(subject => {
                const total = (subject.tasks || []).length;
                const completed = (subject.tasks || []).filter(t => t.completed).length;
                const pending = total - completed;
                const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

                return (
                  <Card 
                    key={subject.id} 
                    onClick={() => navigate(`/subject/${subject.id}`)}
                    className={`p-5 cursor-pointer border hover:border-[#4a7a7d] transition-colors ${darkMode ? 'bg-[#2c333e] border-stone-700' : 'bg-white border-slate-100 shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0 pr-3">
                          <h2 className={`font-bold text-xl truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{subject.name}</h2>
                          <div className="flex items-center gap-1 mt-1">
                              <p className={`text-xs font-medium ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>{completed}/{total} Tasks</p>
                          </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {pending > 0 ? (
                             <div className={`rounded-lg px-2 py-0.5 text-[10px] font-bold tracking-wide ${darkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-100 text-amber-600'}`}>
                               {pending} PENDING
                             </div>
                        ) : (
                            <div className={`rounded-lg px-2 py-0.5 text-[10px] font-bold tracking-wide ${darkMode ? 'bg-emerald-900/30 text-emerald-500' : 'bg-emerald-100 text-emerald-600'}`}>
                               DONE
                             </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-dashed border-gray-500/20">
                        <div className="flex-1">
                            <ProgressBar total={total} completed={completed} />
                        </div>
                        <span className={`text-xs font-bold ${darkMode ? 'text-stone-500' : 'text-slate-400'}`}>{progress}%</span>
                    </div>
                    
                    {/* Action Row - Visible always on mobile for ease */}
                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={(e) => { e.stopPropagation(); openModal('edit-subject', subject); }} className={`text-xs font-medium flex items-center gap-1 ${darkMode ? 'text-stone-400' : 'text-slate-400'}`}>
                            <Pencil size={12}/> Edit
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); if(confirm("Delete module?")) deleteSubject(subject.id); }} className="text-xs font-medium flex items-center gap-1 text-rose-500">
                            <Trash2 size={12}/> Delete
                        </button>
                    </div>
                  </Card>
                )
              })}
          </div>
      </div>
    </div>
  );
}