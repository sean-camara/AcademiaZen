import React, { useState, useEffect, useRef } from 'react';
import { useZen } from '../context/ZenContext';
import { getGreeting, formatDateFull, generateId } from '../utils/helpers';
import { IconCheck, IconPlus, IconChevronLeft, IconPaperclip, IconX, IconEye, IconChevronRight, IconRefresh, IconExternalLink } from '../components/Icons';
import { Subject, Task } from '../types';
import AddTaskModal from '../components/AddTaskModal';

// PDF Viewer Modal Component
const PDFViewer: React.FC<{ name: string; data: string; onClose: () => void }> = ({ name, data, onClose }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to open the full PDF in a new tab
  const viewAll = () => {
    try {
      const base64Data = data.split(',')[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error opening PDF in new tab:', err);
      alert('Could not open full document. Please try again.');
    }
  };

  // Initialize PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsRendering(true);
        // Base64 to Uint8Array
        const base64Parts = data.split(',');
        const base64Data = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        renderPage(1, pdf);
      } catch (err: any) {
        console.error('PDF Load Error:', err);
        setError('Failed to load study material.');
        setIsRendering(false);
      }
    };

    loadPdf();
  }, [data]);

  const renderPage = async (num: number, doc = pdfDoc) => {
    if (!doc || !canvasRef.current) return;
    setIsRendering(true);

    try {
      const page = await doc.getPage(num);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate scale to fit container width
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth || 600;
      const scale = (containerWidth - 40) / viewport.width; // 40px padding
      const scaledViewport = page.getViewport({ scale: Math.min(scale, 2) }); // Cap at 2x for quality

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      await page.render(renderContext).promise;
      setPageNum(num);
    } catch (err) {
      console.error('Render Error:', err);
      setError('Error rendering page.');
    } finally {
      setIsRendering(false);
    }
  };

  const handlePrevPage = () => {
    if (pageNum <= 1 || isRendering) return;
    renderPage(pageNum - 1);
  };

  const handleNextPage = () => {
    if (pageNum >= totalPages || isRendering) return;
    renderPage(pageNum + 1);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[70] flex flex-col animate-reveal overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-zen-surface bg-zen-bg/80 shrink-0">
        <div className="flex-1 min-w-0 pr-4">
           <h3 className="text-sm font-medium text-zen-text-primary truncate">{name}</h3>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={viewAll}
                className="p-2 text-zen-primary hover:bg-zen-primary/10 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95"
                title="View Full Document"
            >
                <IconExternalLink className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">View All</span>
            </button>
            <button onClick={onClose} className="p-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors active:scale-95">
                <IconX className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* Content Area - Page-based only, no scrolling */}
      <div 
        ref={containerRef}
        className="flex-1 w-full bg-[#1e1e1e] relative flex items-center justify-center p-4 overflow-hidden"
      >
        {error ? (
          <div className="text-center space-y-4 animate-reveal">
            <div className="w-16 h-16 bg-zen-destructive/10 text-zen-destructive rounded-full flex items-center justify-center mx-auto">
              <IconX className="w-8 h-8" />
            </div>
            <p className="text-zen-text-secondary">{error}</p>
            <button onClick={onClose} className="text-zen-primary text-sm font-medium">Close</button>
          </div>
        ) : (
          <div className="relative group max-h-full">
            {isRendering && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                <div className="w-8 h-8 border-2 border-zen-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              id="pdf-canvas"
              className={`transition-opacity duration-300 ${isRendering ? 'opacity-50' : 'opacity-100'}`}
            />
          </div>
        )}
      </div>

      {/* Footer Page Indicator & Navigation */}
      <div className="bg-zen-bg/95 border-t border-zen-surface p-4 pb-8 flex justify-center items-center gap-8 shrink-0">
          <button 
            onClick={handlePrevPage}
            disabled={pageNum <= 1 || isRendering}
            className={`p-2 rounded-lg transition-all ${pageNum <= 1 ? 'text-zen-text-disabled cursor-not-allowed' : 'text-zen-primary hover:bg-zen-primary/10 active:scale-90'}`}
          >
              <IconChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2 px-4 py-1.5 bg-zen-surface rounded-full shadow-inner">
              <span className="text-[10px] text-zen-text-disabled uppercase tracking-widest font-bold">Page</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg text-zen-primary font-mono font-bold leading-none">{pageNum}</span>
                <span className="text-xs text-zen-text-disabled leading-none">/ {totalPages || '...'}</span>
              </div>
          </div>

          <button 
            onClick={handleNextPage}
            disabled={pageNum >= totalPages || isRendering}
            className={`p-2 rounded-lg transition-all ${pageNum >= totalPages ? 'text-zen-text-disabled cursor-not-allowed' : 'text-zen-primary hover:bg-zen-primary/10 active:scale-90'}`}
          >
              <IconChevronRight className="w-6 h-6" />
          </button>
      </div>
    </div>
  );
};

// Task Action Choice Modal
const TaskActionModal: React.FC<{ 
    task: Task; 
    onClose: () => void; 
    onViewPdf: () => void; 
    onToggleDone: () => void; 
}> = ({ task, onClose, onViewPdf, onToggleDone }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[65] flex items-center justify-center p-6 animate-reveal" onClick={onClose}>
            <div 
                className="bg-zen-card w-full max-w-xs rounded-3xl border border-zen-surface shadow-2xl p-6 space-y-4 animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center pb-2">
                    <h3 className="text-lg font-medium text-zen-text-primary mb-1">{task.title}</h3>
                    <p className="text-xs text-zen-text-secondary">What would you like to do?</p>
                </div>

                <div className="space-y-3">
                    {task.pdfAttachment && (
                        <button 
                            onClick={onViewPdf}
                            className="w-full py-4 bg-zen-primary text-zen-bg rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <IconEye className="w-5 h-5" />
                            View Study Material
                        </button>
                    )}
                    <button 
                        onClick={onToggleDone}
                        className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                            task.completed 
                            ? 'bg-zen-surface border-zen-surface text-zen-text-primary' 
                            : 'bg-zen-secondary text-white border-zen-secondary shadow-lg shadow-zen-secondary/10'
                        }`}
                    >
                        {task.completed ? (
                            <>
                                <IconRefresh className="w-5 h-5" />
                                Mark as Pending
                            </>
                        ) : (
                            <>
                                <IconCheck className="w-3 h-3 text-zen-bg" />
                                Mark as Done
                            </>
                        )}
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full py-3 text-zen-text-secondary text-sm font-medium hover:text-zen-text-primary transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

const Home: React.FC = () => {
  const { state, toggleTask, addTask, addSubject } = useZen();
  const { profile, tasks, subjects } = state;
  
  // Dashboard States
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  
  // Detail View States
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [loadingSubjectId, setLoadingSubjectId] = useState<string | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<{ name: string; data: string } | null>(null);
  const [activeActionTask, setActiveActionTask] = useState<Task | null>(null);

  const selectedSubject = subjects.find(s => s.id === (selectedSubjectId || loadingSubjectId));

  // Filtering Logic
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.filter(t => !t.completed).length;
  
  // Up Next Logic
  const now = new Date();
  const next72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const upNextTasks = tasks.filter(t => {
    if (t.completed) return false;
    const due = new Date(t.dueDate);
    return due >= now && due <= next72h;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Handlers
  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const colors = ['bg-zen-primary', 'bg-zen-secondary', 'bg-blue-400', 'bg-rose-400', 'bg-amber-400'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    addSubject({
      id: generateId(),
      name: newSubjectName,
      color: randomColor
    });
    setNewSubjectName('');
    setShowAddSubject(false);
  };

  const handleSubjectClick = (id: string) => {
    setLoadingSubjectId(id);
    setTimeout(() => {
        setSelectedSubjectId(id);
        setLoadingSubjectId(null);
    }, 600);
  };

  const handleCreateTask = (title: string, date: string, notes: string, pdf?: { name: string; data: string }) => {
    if (!selectedSubjectId) return;
    
    const newTask: Task = {
      id: generateId(),
      title,
      dueDate: date,
      completed: false,
      subjectId: selectedSubjectId,
      notes: notes || undefined,
      pdfAttachment: pdf
    };
    
    addTask(newTask);
  };

  // --- SUBJECT DETAIL VIEW ---
  if (selectedSubjectId && selectedSubject) {
    const subjectTasks = tasks.filter(t => t.subjectId === selectedSubject.id);
    const pendingSubjectTasks = subjectTasks.filter(t => !t.completed);
    const completedSubjectTasks = subjectTasks.filter(t => t.completed);

    return (
      <div className="h-full flex flex-col relative bg-zen-bg animate-reveal">
        {/* Header */}
        <div className="p-6 pb-2 sticky top-0 bg-zen-bg/95 backdrop-blur z-10">
          <button 
            onClick={() => setSelectedSubjectId(null)}
            className="flex items-center gap-2 text-zen-text-secondary hover:text-zen-text-primary transition-all mb-4 group active:scale-95"
          >
            <IconChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>
          
          <div className="flex items-center gap-3">
             <div className={`w-4 h-4 rounded-full ${selectedSubject.color.startsWith('#') ? '' : selectedSubject.color}`} style={selectedSubject.color.startsWith('#') ? {backgroundColor: selectedSubject.color} : {}} />
             <h2 className="text-3xl font-light text-zen-text-primary">{selectedSubject.name}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 pb-24 space-y-8 no-scrollbar">
            {/* Stats */}
            <div className="flex gap-4">
                 <div className="bg-zen-card px-4 py-3 rounded-xl border border-zen-surface flex items-center gap-2 animate-reveal stagger-1">
                     <span className="text-lg font-medium text-zen-primary">{pendingSubjectTasks.length}</span>
                     <span className="text-xs text-zen-text-secondary uppercase tracking-wide">Pending</span>
                 </div>
                 <div className="bg-zen-card px-4 py-3 rounded-xl border border-zen-surface flex items-center gap-2 animate-reveal stagger-2">
                     <span className="text-lg font-medium text-zen-text-disabled">{completedSubjectTasks.length}</span>
                     <span className="text-xs text-zen-text-secondary uppercase tracking-wide">Done</span>
                 </div>
            </div>

            {/* Task List */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-zen-text-primary border-b border-zen-surface pb-2">Tasks</h3>
                
                {subjectTasks.length > 0 ? (
                  <ul className="space-y-3">
                    {subjectTasks.map((task, idx) => (
                      <li 
                        key={task.id} 
                        onClick={() => setActiveActionTask(task)}
                        className={`group bg-zen-card p-4 rounded-xl border border-zen-surface/50 hover:border-zen-surface transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] animate-reveal stagger-${Math.min(idx + 1, 5)}`}
                      >
                         <div className="flex items-start gap-3">
                            <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTask(task.id);
                              }}
                              className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${task.completed ? 'bg-zen-primary border-zen-primary scale-110' : 'border-zen-text-secondary hover:border-zen-primary'}`}
                            >
                              {task.completed && <IconCheck className="w-3 h-3 text-zen-bg" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <h4 className={`text-base font-medium truncate transition-all ${task.completed ? 'text-zen-text-disabled line-through opacity-60' : 'text-zen-text-primary'}`}>
                                    {task.title}
                                </h4>
                                <div className="flex items-center gap-3 mt-1 text-xs text-zen-text-secondary">
                                    <span>{new Date(task.dueDate).toLocaleDateString()} &bull; {new Date(task.dueDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    {task.pdfAttachment && (
                                        <span className="flex items-center gap-1 text-zen-primary bg-zen-primary/10 px-2 py-0.5 rounded transition-all">
                                            <IconPaperclip className="w-3 h-3" />
                                            <span>PDF</span>
                                        </span>
                                    )}
                                </div>
                                {task.notes && (
                                    <p className="mt-2 text-xs text-zen-text-secondary line-clamp-2 leading-relaxed bg-zen-surface/30 p-2 rounded-lg">
                                        {task.notes}
                                    </p>
                                )}
                            </div>
                         </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-12 text-center opacity-60 animate-reveal">
                      <p className="text-zen-text-disabled">No tasks yet. Clear mind.</p>
                  </div>
                )}
            </div>
        </div>

        {/* Floating Action Button */}
        <div className="absolute bottom-6 right-6 z-20">
            <button 
                onClick={() => setShowAddTaskModal(true)}
                className="w-14 h-14 bg-zen-primary text-zen-bg rounded-full shadow-lg shadow-zen-primary/20 flex items-center justify-center hover:scale-110 transition-transform active:scale-90"
            >
                <IconPlus className="w-8 h-8" />
            </button>
        </div>

        {/* Modals */}
        {showAddTaskModal && (
            <AddTaskModal 
                subjectName={selectedSubject.name}
                onClose={() => setShowAddTaskModal(false)}
                onSave={handleCreateTask}
            />
        )}

        {activeActionTask && (
            <TaskActionModal 
                task={activeActionTask}
                onClose={() => setActiveActionTask(null)}
                onToggleDone={() => {
                    toggleTask(activeActionTask.id);
                    setActiveActionTask(null);
                }}
                onViewPdf={() => {
                    if (activeActionTask.pdfAttachment) {
                        setViewingPdf(activeActionTask.pdfAttachment);
                    }
                    setActiveActionTask(null);
                }}
            />
        )}

        {viewingPdf && (
            <PDFViewer 
                name={viewingPdf.name} 
                data={viewingPdf.data} 
                onClose={() => setViewingPdf(null)} 
            />
        )}
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div className="px-6 py-4 space-y-8 animate-reveal pb-20 relative min-h-full no-scrollbar overflow-y-auto">
      
      {/* Loading Overlay */}
      {loadingSubjectId && (
          <div className="fixed inset-0 bg-zen-bg/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-fade-in">
              <div className="w-16 h-16 border-2 border-zen-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-zen-primary font-medium tracking-widest uppercase text-xs animate-pulse">Focusing on {selectedSubject?.name}...</p>
          </div>
      )}

      {/* Greeting Section */}
      <section className="space-y-1">
        <h2 className="text-3xl font-light text-zen-text-primary">
          {getGreeting(profile.name)}
        </h2>
        <p className="text-zen-text-secondary font-light text-sm">
          {formatDateFull(new Date())}
        </p>
      </section>

      {/* Up Next Card */}
      <section className="animate-reveal stagger-1">
        <div className="flex justify-between items-baseline mb-3">
           <h3 className="text-lg font-medium text-zen-text-primary">Up Next</h3>
        </div>
        <div className="bg-zen-card rounded-2xl p-5 shadow-lg border border-zen-surface/30">
          {upNextTasks.length > 0 ? (
            <ul className="space-y-4">
              {upNextTasks.slice(0, 3).map((task, idx) => (
                <li key={task.id} className={`flex items-center gap-3 group animate-reveal stagger-${idx + 1}`}>
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className="w-5 h-5 rounded-full border border-zen-text-secondary flex items-center justify-center hover:border-zen-primary transition-all active:scale-90"
                  >
                    {task.completed && <div className="w-3.5 h-3.5 bg-zen-primary rounded-full animate-scale-in" />}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-zen-text-primary group-hover:text-white transition-colors">
                      {task.title}
                    </p>
                    <p className="text-xs text-zen-text-disabled">
                       {new Date(task.dueDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center">
              <p className="text-zen-text-secondary text-sm">No urgent tasks. Enjoy your peace.</p>
            </div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-2 gap-4 animate-reveal stagger-2">
        <div className="bg-zen-card p-4 rounded-2xl border border-zen-surface/30 flex flex-col items-center justify-center space-y-1 hover:border-zen-primary/30 transition-colors">
          <span className="text-2xl font-light text-zen-primary">{completedCount}</span>
          <span className="text-xs text-zen-text-disabled uppercase tracking-wider">Completed</span>
        </div>
        <div className="bg-zen-card p-4 rounded-2xl border border-zen-surface/30 flex flex-col items-center justify-center space-y-1 hover:border-zen-secondary/30 transition-colors">
          <span className="text-2xl font-light text-zen-text-secondary">{pendingCount}</span>
          <span className="text-xs text-zen-text-disabled uppercase tracking-wider">Pending</span>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="animate-reveal stagger-3">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-zen-text-primary">Subjects</h3>
          <button 
            onClick={() => setShowAddSubject(true)}
            className="text-zen-primary text-sm hover:underline active:scale-95 transition-transform"
          >
            + Add
          </button>
        </div>

        {showAddSubject && (
            <form onSubmit={handleCreateSubject} className="mb-4 bg-zen-card p-4 rounded-xl animate-reveal">
                <input 
                    autoFocus
                    type="text" 
                    placeholder="Subject Name..."
                    className="w-full bg-transparent border-b border-zen-surface p-2 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-colors"
                    value={newSubjectName}
                    onChange={e => setNewSubjectName(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-3">
                    <button type="button" onClick={() => setShowAddSubject(false)} className="text-xs text-zen-text-secondary px-3 py-2">Cancel</button>
                    <button type="submit" className="text-xs bg-zen-surface text-zen-primary px-3 py-2 rounded-lg">Create</button>
                </div>
            </form>
        )}

        <div className="flex flex-col gap-4">
          {subjects.map((subject, idx) => {
            const subjectTasks = tasks.filter(t => t.subjectId === subject.id);
            const total = subjectTasks.length;
            const completed = subjectTasks.filter(t => t.completed).length;
            const progress = total === 0 ? 0 : (completed / total) * 100;
            const isTarget = loadingSubjectId === subject.id;

            return (
              <button 
                key={subject.id} 
                onClick={() => handleSubjectClick(subject.id)}
                className={`bg-zen-card p-5 rounded-2xl border border-zen-surface/30 hover:border-zen-primary/50 transition-all text-left group hover:scale-[1.02] active:scale-[0.98] animate-reveal stagger-${Math.min(idx + 1, 5)} ${isTarget ? 'animate-bounce-subtle ring-1 ring-zen-primary' : ''}`}
              >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${subject.color.startsWith('#') ? '' : subject.color}`} style={subject.color.startsWith('#') ? {backgroundColor: subject.color} : {}} />
                        <h4 className="font-medium text-zen-text-primary truncate group-hover:text-zen-primary transition-colors text-lg">{subject.name}</h4>
                    </div>
                    <p className="text-xs text-zen-text-disabled font-medium">
                        {completed}/{total} Done
                    </p>
                </div>
                
                {/* Progress Bar Container */}
                <div className="w-full h-1.5 bg-zen-surface rounded-full overflow-hidden mb-1">
                    <div 
                        className={`h-full transition-all duration-700 ease-out ${subject.color.startsWith('#') ? '' : subject.color}`}
                        style={{ 
                            width: `${progress}%`,
                            backgroundColor: subject.color.startsWith('#') ? subject.color : undefined 
                        }} 
                    />
                </div>
                <p className="text-[10px] text-zen-text-disabled uppercase tracking-widest font-bold">
                    {Math.round(progress)}% Mastery
                </p>
              </button>
            );
          })}
          
          {subjects.length === 0 && !showAddSubject && (
             <div className="py-12 text-center border border-dashed border-zen-surface rounded-2xl animate-reveal">
                 <p className="text-sm text-zen-text-disabled">No subjects yet</p>
             </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;