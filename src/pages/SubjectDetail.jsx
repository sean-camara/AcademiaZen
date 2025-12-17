import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Target, Pause, Play, RotateCcw, Plus, Link as LinkIcon, Trash2, Save, Check, Clock, Pencil, FileText, X, Download } from 'lucide-react';
import { Card, Button } from '../components/UI';

export default function SubjectDetail({ controller, openModal }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subjects, updateGrade, deleteResource, updateNote, deleteSubject, toggleTaskComplete, darkMode, setActiveSubjectId, deleteTask } = controller;
  
  const activeSubject = subjects.find(s => s.id === id);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [localNote, setLocalNote] = useState("");
  
  // --- TIMER EDIT STATE ---
  const [isEditingTimer, setIsEditingTimer] = useState(false);
  const [timerInput, setTimerInput] = useState("25");

  // State for viewing PDF (Task Object)
  const [viewingTaskPdf, setViewingTaskPdf] = useState(null);

  useEffect(() => {
    if (id) setActiveSubjectId(id);
  }, [id, setActiveSubjectId]);

  useEffect(() => {
    if(activeSubject) setLocalNote(activeSubject.note || "");
  }, [activeSubject]);

  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) interval = setInterval(() => setTimeLeft(p => p - 1), 1000);
    else if (timeLeft === 0) {
        setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // --- TIMER CUSTOMIZATION LOGIC ---
  const handleTimerClick = () => {
      // Only allow edit if timer is paused
      if (!timerActive) {
          setIsEditingTimer(true);
          setTimerInput(Math.floor(timeLeft / 60).toString());
      }
  };

  const handleTimerSave = () => {
      let minutes = parseInt(timerInput);
      // Validation: Must be a number > 0. Default to 25. Max 180 mins.
      if (isNaN(minutes) || minutes < 1) minutes = 25; 
      if (minutes > 180) minutes = 180;
      
      setTimeLeft(minutes * 60);
      setIsEditingTimer(false);
  };

  const handleTimerKeyDown = (e) => {
      if (e.key === 'Enter') handleTimerSave();
  };

  // --- DOWNLOAD PDF LOGIC (Reliable Mobile Method) ---
  const downloadPdf = () => {
    if (!viewingTaskPdf?.pdfFile) return;

    try {
        const base64 = viewingTaskPdf.pdfFile;
        const byteCharacters = atob(base64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Force Download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = viewingTaskPdf.pdfName || "document.pdf"; // This forces the OS to handle it
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup memory
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    } catch(e) { 
        console.error("PDF Download Error:", e);
        alert("Could not download PDF."); 
    }
  };

  const handleTaskClick = (task) => {
      // If task has PDF, show View/Complete Modal
      if (task.pdfFile) {
          setViewingTaskPdf(task);
      } else {
          // If no PDF, just toggle complete directly
          toggleTaskComplete(activeSubject.id, task.id);
      }
  };

  const handleCompleteFromModal = () => {
      if (viewingTaskPdf) {
          toggleTaskComplete(activeSubject.id, viewingTaskPdf.id);
          setViewingTaskPdf(null);
      }
  };

  if (!activeSubject) return <div className="p-8 text-center">Module not found.</div>;

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  const getUrgency = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Overdue", bg: "bg-rose-100", text: "text-rose-600" };
    if (days === 0) return { label: "Today", bg: "bg-amber-100", text: "text-amber-600" };
    return { label: `${days}d left`, bg: "bg-[#4a7a7d]/10", text: "text-[#4a7a7d]" };
  };

  return (
    <div className="animate-in slide-in-from-right-8 duration-300 pb-24 relative">
      
      {/* --- PDF ACTION MODAL --- */}
      {viewingTaskPdf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingTaskPdf(null)}></div>
              <div className={`relative w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
                  <button onClick={() => setViewingTaskPdf(null)} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                          <FileText size={40} />
                      </div>
                      <h3 className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>{viewingTaskPdf.pdfName || "Attached PDF"}</h3>
                      <p className="text-xs text-slate-400 max-w-[200px]">Review the attached material before marking this task as complete.</p>
                  </div>
                  <div className="space-y-3">
                      <Button onClick={downloadPdf} variant="secondary" className="w-full gap-2 py-3 shadow-sm border border-slate-200 dark:border-stone-700">
                          <Download size={18}/> Download / Open
                      </Button>
                      <Button onClick={handleCompleteFromModal} className="w-full gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:shadow-none shadow-lg">
                          <Check size={18}/> Mark as Done
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* Grade Tracker */}
      <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between ${darkMode ? 'bg-[#2c333e]' : 'bg-white'} shadow-sm`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4a7a7d]/10 rounded-full text-[#4a7a7d]"><Target size={20}/></div>
          <div><p className="text-xs font-bold text-slate-400 uppercase">Grades</p><p className={`font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Track goals</p></div>
        </div>
        <div className="flex gap-4">
          {['target', 'current'].map(type => (
            <div key={type} className="text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">{type}</p>
              <input type="number" value={activeSubject.grades?.[type] || ""} onChange={(e) => updateGrade(activeSubject.id, type, e.target.value)} placeholder="%" className={`w-12 text-center font-bold bg-transparent border-b-2 outline-none ${darkMode ? 'border-stone-600 text-white' : 'border-slate-200 text-slate-800'} focus:border-[#4a7a7d]`}/>
            </div>
          ))}
        </div>
      </div>

      {/* --- CUSTOMIZABLE TIMER SECTION --- */}
      <Card className="p-4 mb-6 flex items-center justify-between bg-gradient-to-r from-[#4a7a7d] to-[#3b6366] text-white border-none shadow-lg">
         <div>
             <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Focus Timer</p>
             {isEditingTimer ? (
                 <div className="flex items-center">
                     <input 
                        autoFocus
                        type="number" 
                        value={timerInput} 
                        onChange={(e) => setTimerInput(e.target.value)}
                        onBlur={handleTimerSave}
                        onKeyDown={handleTimerKeyDown}
                        className="w-16 text-3xl font-mono font-bold bg-white/20 text-white rounded px-1 outline-none border-b-2 border-white"
                     />
                     <span className="ml-2 text-sm opacity-80">min</span>
                 </div>
             ) : (
                 <div 
                    onClick={handleTimerClick}
                    className={`flex items-center gap-3 ${!timerActive ? 'cursor-pointer' : 'cursor-default'}`}
                    title="Click to edit timer duration"
                 >
                    <p className="text-3xl font-mono font-bold tracking-wider">{formatTime(timeLeft)}</p>
                    {/* Visual Indicator: Clearly visible edit button */}
                    {!timerActive && (
                        <div className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors shadow-sm">
                            <Pencil size={16} fill="currentColor" className="text-white" />
                        </div>
                    )}
                 </div>
             )}
         </div>
         <div className="flex gap-2">
           <button onClick={() => { if(!isEditingTimer) setTimerActive(!timerActive); }} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-all">{timerActive ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}</button>
           <button onClick={() => { setTimerActive(false); setTimeLeft(25*60); }} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm transition-all"><RotateCcw size={16} /></button>
         </div>
      </Card>

      {/* Resources */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2 px-1">
           <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Resources</h3>
           <button onClick={() => openModal('resource')} className="text-[#4a7a7d] hover:text-[#3b6366] p-1"><Plus size={16}/></button>
        </div>
        <div className="grid gap-2">
          {(activeSubject.resources || []).length === 0 && <p className="text-xs text-slate-400 italic px-1">No links added.</p>}
          {(activeSubject.resources || []).map((res) => (
            <Card key={res.id} className={`p-3 flex justify-between items-center ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
              <a href={res.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm font-medium hover:text-[#4a7a7d] truncate flex-1">
                <div className="p-1.5 bg-slate-100 dark:bg-stone-800 rounded-lg text-slate-500"><LinkIcon size={14}/></div>
                <span className={darkMode ? 'text-stone-200' : 'text-slate-700'}>{res.title}</span>
              </a>
              <button onClick={() => deleteResource(activeSubject.id, res.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button>
            </Card>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2 px-1">
           <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Quick Notes</h3>
           <button onClick={() => updateNote(activeSubject.id, localNote)} className="text-[#4a7a7d] hover:text-[#3b6366] p-1"><Save size={16}/></button>
        </div>
        <textarea value={localNote} onChange={(e) => setLocalNote(e.target.value)} onBlur={() => updateNote(activeSubject.id, localNote)} placeholder="Reminders..." className={`w-full p-4 rounded-xl text-sm min-h-[80px] shadow-sm outline-none focus:ring-2 focus:ring-[#4a7a7d]/20 transition-all ${darkMode ? 'bg-[#2c333e] text-white placeholder:text-slate-500' : 'bg-white text-slate-700 placeholder:text-slate-300'}`}/>
      </div>

      {/* Tasks List */}
      <div className="flex justify-between items-center mb-4">
         <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Tasks List</h3>
         <button onClick={() => { if(confirm("Delete module?")) { deleteSubject(activeSubject.id); navigate('/'); }}} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={18} /></button>
      </div>
      <div className="space-y-3 pb-20">
        {activeSubject.tasks.length === 0 && <div className="text-center py-8 opacity-60"><p className="text-sm text-slate-400">No tasks added yet.</p></div>}
        {activeSubject.tasks.map(task => {
          const urgency = getUrgency(task.date);
          const priorityColor = task.priority==='High'?'bg-rose-100 text-rose-600':task.priority==='Low'?'bg-blue-100 text-blue-600':'bg-amber-100 text-amber-600';
          
          return (
            <Card key={task.id} onClick={() => handleTaskClick(task)} className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-stone-700/50 transition-all ${task.completed ? 'opacity-40 grayscale' : ''} ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
              
              {/* Checkbox Icon */}
              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-[#4a7a7d] border-[#4a7a7d] text-white' : 'border-slate-300 dark:border-stone-600'}`}>{task.completed && <Check size={14} strokeWidth={3} />}</div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityColor}`}>{task.priority || "Medium"}</span>
                  {task.type && <span className="text-[10px] text-slate-400 font-medium">{task.type}</span>}
                  
                  {/* PDF Badge */}
                  {task.pdfFile && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded">
                          <FileText size={10} /> PDF
                      </span>
                  )}
                </div>
                <p className={`font-bold text-sm truncate ${task.completed ? 'line-through' : ''} ${darkMode ? 'text-stone-200' : 'text-slate-800'}`}>{task.title}</p>
                {!task.completed && <div className="flex items-center gap-2 mt-1"><div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${urgency.bg} ${urgency.text}`}><Clock size={10} /> {urgency.label}</div></div>}
              </div>
              
              {/* Task Actions: Edit AND Delete */}
              <div className="flex gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); openModal('edit-task', task); }} 
                  className="p-2 text-slate-300 hover:text-[#4a7a7d] transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); if(confirm("Delete this task?")) deleteTask(activeSubject.id, task.id); }} 
                  className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="fixed bottom-24 right-6 z-40">
        <button onClick={() => openModal('task')} className="w-14 h-14 bg-[#4a7a7d] text-white rounded-full shadow-lg shadow-[#4a7a7d]/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><Plus size={28} /></button>
      </div>
    </div>
  );
}