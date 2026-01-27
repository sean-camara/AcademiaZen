import React, { useState, useEffect, useRef } from 'react';
import { useZen } from '../context/ZenContext';
import { getGreeting, formatDateFull, generateId } from '../utils/helpers';
import { IconCheck, IconPlus, IconChevronLeft, IconPaperclip, IconX, IconEye, IconChevronRight, IconRefresh, IconExternalLink, IconEdit, IconTrash, IconMoreVertical } from '../components/Icons';
import { Subject, Task, PdfAttachment } from '../types';
import AddTaskModal from '../components/AddTaskModal';
import { getPdfSignedUrl } from '../utils/pdfStorage';

// PDF Viewer Modal Component
const PDFViewer: React.FC<{ attachment: PdfAttachment; onClose: () => void }> = ({ attachment, onClose }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewAll = () => {
    if (!sourceUrl) return;
    window.open(sourceUrl, '_blank');
  };

  const viewAllLegacy = () => {
    const legacyData = (attachment as any)?.data;
    if (!legacyData) return;
    try {
      const base64Data = String(legacyData).split(',')[1] || '';
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
      console.error('Error opening legacy PDF in new tab:', err);
      alert('Could not open full document. Please try again.');
    }
  };

  useEffect(() => {
    const loadPdf = async () => {
      try {
        if (!sourceUrl && attachment?.key) {
          const url = attachment.url || await getPdfSignedUrl(attachment.key);
          setSourceUrl(url);
          return;
        }
        setIsLoading(true);
        setIsRendering(true);
        
        if (!(window as any).pdfjsLib) {
          throw new Error('PDF library not loaded. Please refresh the page.');
        }
        
        const legacyData = (attachment as any)?.data;
        let loadingTask;
        if (sourceUrl) {
          loadingTask = (window as any).pdfjsLib.getDocument(sourceUrl);
        } else if (legacyData && String(legacyData).startsWith('data:')) {
          const base64Data = String(legacyData).split(',')[1] || '';
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
        } else {
          throw new Error('Failed to load PDF');
        }
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
        renderPage(1, pdf);
      } catch (err: any) {
        console.error('PDF Load Error:', err);
        setError(err.message || 'Failed to load study material. Try using "View All" to open in browser.');
        setIsRendering(false);
        setIsLoading(false);
      }
    };

    const timer = setTimeout(loadPdf, 100);
    return () => clearTimeout(timer);
  }, [attachment, sourceUrl]);

  const renderPage = async (num: number, doc = pdfDoc) => {
    if (!doc || !canvasRef.current) return;
    setIsRendering(true);

    try {
      const page = await doc.getPage(num);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth || 600;
      const scale = (containerWidth - 40) / viewport.width; 
      const scaledViewport = page.getViewport({ scale: Math.min(scale, 2) });

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
      <div className="flex justify-between items-center p-4 border-b border-zen-surface bg-zen-bg/80 shrink-0">
        <div className="flex-1 min-w-0 pr-4">
           <h3 className="text-sm font-medium text-zen-text-primary truncate">{attachment.name}</h3>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={sourceUrl ? viewAll : viewAllLegacy}
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

      <div 
        ref={containerRef}
        className="flex-1 w-full bg-[#1e1e1e] relative flex items-center justify-center p-4 overflow-hidden"
      >
        {isLoading && !error ? (
          <div className="text-center space-y-4 animate-reveal">
            <div className="w-12 h-12 border-2 border-zen-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zen-text-secondary text-sm">Loading PDF...</p>
          </div>
        ) : error ? (
          <div className="text-center space-y-4 animate-reveal px-4">
            <div className="w-16 h-16 bg-zen-destructive/10 text-zen-destructive rounded-full flex items-center justify-center mx-auto">
              <IconX className="w-8 h-8" />
            </div>
            <p className="text-zen-text-secondary text-sm">{error}</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={sourceUrl ? viewAll : viewAllLegacy} 
                className="bg-zen-primary text-zen-bg px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                Open in Browser
              </button>
              <button onClick={onClose} className="text-zen-text-secondary text-sm">Close</button>
            </div>
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
              className={`transition-opacity duration-300 max-w-full ${isRendering ? 'opacity-50' : 'opacity-100'}`}
            />
          </div>
        )}
      </div>

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

const TaskActionModal: React.FC<{ 
    task: Task; 
    onClose: () => void; 
    onViewPdf: () => void; 
    onToggleDone: () => void;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ task, onClose, onViewPdf, onToggleDone, onEdit, onDelete }) => {
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
                        onClick={onEdit}
                        className="w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 border border-zen-surface bg-zen-surface/50 text-zen-text-primary hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <IconEdit className="w-5 h-5" />
                        Edit Task
                    </button>
                    <button 
                        onClick={onDelete}
                        className="w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <IconTrash className="w-5 h-5" />
                        Delete Task
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

const ConfirmDeleteModal: React.FC<{
    type: 'subject' | 'task';
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ type, name, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6 animate-reveal" onClick={onCancel}>
            <div 
                className="bg-zen-card w-full max-w-xs rounded-3xl border border-zen-surface shadow-2xl p-6 space-y-4 animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IconTrash className="w-7 h-7 text-red-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zen-text-primary">Delete {type === 'subject' ? 'Subject' : 'Task'}?</h3>
                    <p className="text-sm text-zen-text-secondary">
                        Are you sure you want to delete "<span className="text-zen-text-primary font-medium">{name}</span>"?
                        {type === 'subject' && (
                            <span className="block mt-1 text-red-400 text-xs">This will also delete all tasks and flashcards in this subject.</span>
                        )}
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl font-medium border border-zen-surface text-zen-text-secondary hover:text-zen-text-primary transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="flex-1 py-3 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

const EditSubjectModal: React.FC<{
    subject: Subject;
    editName: string;
    setEditName: (name: string) => void;
    onSave: (e: React.FormEvent) => void;
    onCancel: () => void;
}> = ({ subject, editName, setEditName, onSave, onCancel }) => {
    const colors = ['bg-zen-primary', 'bg-zen-secondary', 'bg-blue-400', 'bg-rose-400', 'bg-amber-400', 'bg-purple-400', 'bg-cyan-400', 'bg-orange-400'];
    const [selectedColor, setSelectedColor] = useState(subject.color);
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6 animate-reveal" onClick={onCancel}>
            <div 
                className="bg-zen-card w-full max-w-sm rounded-3xl border border-zen-surface shadow-2xl p-6 space-y-5 animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <h3 className="text-lg font-medium text-zen-text-primary">Edit Subject</h3>
                </div>

                <form onSubmit={(e) => {
                    e.preventDefault();
                    onSave(e);
                }} className="space-y-4">
                    <div>
                        <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-bold mb-2 block">Subject Name</label>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="Subject Name..."
                            className="w-full bg-zen-surface border border-zen-surface rounded-xl p-3 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-colors"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-bold mb-2 block">Color</label>
                        <div className="flex flex-wrap gap-2">
                            {colors.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setSelectedColor(color)}
                                    className={`w-8 h-8 rounded-full ${color} transition-all ${selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zen-card scale-110' : 'hover:scale-105'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-3 rounded-xl font-medium border border-zen-surface text-zen-text-secondary hover:text-zen-text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 py-3 rounded-xl font-medium bg-zen-primary text-zen-bg hover:opacity-90 transition-opacity"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Home: React.FC = () => {
  const { state, toggleTask, addTask, addSubject, updateSubject, deleteSubject, updateTask, deleteTask, setHideNavbar } = useZen();
  const { profile, tasks, subjects } = state;
  
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [showSubjectActions, setShowSubjectActions] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [loadingSubjectId, setLoadingSubjectId] = useState<string | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<PdfAttachment | null>(null);
  const [activeActionTask, setActiveActionTask] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'subject' | 'task'; id: string; name: string } | null>(null);

  useEffect(() => {
    const hasModal = showAddTaskModal || viewingPdf !== null || confirmDelete !== null || editingSubject !== null || editingTask !== null;
    setHideNavbar(hasModal);
  }, [showAddTaskModal, viewingPdf, confirmDelete, editingSubject, editingTask, setHideNavbar]);

  const selectedSubject = subjects.find(s => s.id === (selectedSubjectId || loadingSubjectId));
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.filter(t => !t.completed).length;

  const handleClearCompleted = () => {
    const completedTasks = tasks.filter(t => t.completed);
    completedTasks.forEach(t => deleteTask(t.id));
  };
  
  const now = new Date();
  const next72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const upNextTasks = tasks.filter(t => {
    if (t.completed) return false;
    const due = new Date(t.dueDate);
    return due >= now && due <= next72h;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const colors = ['bg-zen-primary', 'bg-zen-secondary', 'bg-blue-400', 'bg-rose-400', 'bg-amber-400'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    addSubject({ id: generateId(), name: newSubjectName, color: randomColor });
    setNewSubjectName('');
    setShowAddSubject(false);
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setEditSubjectName(subject.name);
    setShowSubjectActions(null);
  };

  const handleDeleteSubject = (id: string) => {
    deleteSubject(id);
    setConfirmDelete(null);
    setShowSubjectActions(null);
    if (selectedSubjectId === id) setSelectedSubjectId(null);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setActiveActionTask(null);
  };

  const handleSaveTaskEdit = (title: string, date: string, notes: string, pdf?: { name: string; data: string }) => {
    if (!editingTask) return;
    updateTask({ ...editingTask, title, dueDate: date, notes: notes || undefined, pdfAttachment: pdf });
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(id);
    setConfirmDelete(null);
    setActiveActionTask(null);
  };

  const handleSubjectClick = (id: string) => {
    setLoadingSubjectId(id);
    setTimeout(() => {
        setSelectedSubjectId(id);
        setLoadingSubjectId(null);
    }, 400);
  };

  const handleCreateTask = (title: string, date: string, notes: string, pdf?: { name: string; data: string }) => {
    if (!selectedSubjectId) return;
    addTask({ id: generateId(), title, dueDate: date, completed: false, subjectId: selectedSubjectId, notes: notes || undefined, pdfAttachment: pdf });
  };

  if (selectedSubjectId && selectedSubject) {
    const subjectTasks = tasks.filter(t => t.subjectId === selectedSubject.id);
    const pendingSubjectTasks = subjectTasks.filter(t => !t.completed);
    const completedSubjectTasks = subjectTasks.filter(t => t.completed);

    return (
      <div className="h-full flex flex-col relative bg-zen-bg animate-reveal">
        
        {/* Mobile Header (Sticky) */}
        <div className="pt-6 px-4 md:px-10 pb-4 sticky top-0 bg-zen-bg/95 backdrop-blur-xl z-20 flex flex-col gap-6 border-b border-zen-surface/20 md:border-none">
          <div className="max-w-4xl mx-auto w-full">
            <button 
                onClick={() => setSelectedSubjectId(null)} 
                className="flex items-center gap-2 text-zen-text-secondary hover:text-zen-text-primary transition-all w-fit group active:scale-95 py-1 px-3 -ml-3 rounded-lg hover:bg-zen-surface/50 mb-2"
            >
                <IconChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-sm font-medium">Dashboard</span>
            </button>
            
            <div className="flex items-center gap-5">
                <div className="relative">
                    <div className={`w-2.5 h-10 rounded-full ${selectedSubject.color.startsWith('#') ? '' : selectedSubject.color}`} style={selectedSubject.color.startsWith('#') ? {backgroundColor: selectedSubject.color} : {}} />
                    <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-zen-bg shadow-lg ${selectedSubject.color.startsWith('#') ? '' : selectedSubject.color}`} style={selectedSubject.color.startsWith('#') ? {backgroundColor: selectedSubject.color} : {}} />
                </div>
                <div className="min-w-0">
                    <h2 className="text-2xl md:text-5xl font-light text-zen-text-primary leading-tight tracking-tight truncate">{selectedSubject.name}</h2>
                    <p className="text-[10px] md:text-xs text-zen-text-disabled font-black uppercase tracking-[0.2em] mt-1">{pendingSubjectTasks.length} Pending Actions</p>
                </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
            <div className="max-w-4xl mx-auto w-full px-4 md:px-10">
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4 py-8">
                    <div className="bg-zen-card p-6 rounded-[2rem] border border-zen-surface hover:border-zen-primary/30 transition-all flex flex-col items-center justify-center gap-2 shadow-sm">
                        <span className="text-3xl font-light text-zen-text-primary">{pendingSubjectTasks.length}</span>
                        <span className="text-[9px] text-zen-text-disabled uppercase tracking-[0.2em] font-black">Active</span>
                    </div>
                    <div className="bg-zen-card p-6 rounded-[2rem] border border-zen-surface transition-all flex flex-col items-center justify-center gap-2 shadow-sm opacity-50">
                        <span className="text-3xl font-light text-zen-text-disabled">{completedSubjectTasks.length}</span>
                        <span className="text-[9px] text-zen-text-disabled uppercase tracking-[0.2em] font-black">Resolved</span>
                    </div>
                </div>

                {/* Tasks List */}
                <div className="space-y-10">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-zen-text-disabled uppercase tracking-[0.25em]">Registry</h3>
                        <div className="h-[1px] flex-1 bg-zen-surface ml-6 opacity-20"></div>
                    </div>

                    {subjectTasks.length > 0 ? (
                    <ul className="space-y-4 pb-10">
                        {subjectTasks.map((task, idx) => (
                        <li 
                            key={task.id} 
                            onClick={() => setActiveActionTask(task)} 
                            className="group bg-zen-card p-6 rounded-3xl border border-zen-surface hover:border-zen-primary/30 transition-all cursor-pointer active:scale-[0.98] animate-reveal" 
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            <div className="flex items-center gap-5">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }} 
                                    className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-zen-primary border-zen-primary shadow-glow' : 'border-zen-surface-brighter hover:border-zen-primary'}`}
                                >
                                {task.completed && <IconCheck className="w-4 h-4 text-zen-bg stroke-[4]" />}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-lg font-medium leading-tight transition-all truncate ${task.completed ? 'text-zen-text-disabled line-through opacity-50' : 'text-zen-text-primary'}`}>
                                        {task.title}
                                    </h4>
                                    
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-400' : 'text-zen-text-disabled'}`}>
                                            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {task.pdfAttachment && (
                                            <span className="flex items-center gap-1.5 text-zen-primary font-black text-[9px] uppercase tracking-[0.15em]">
                                                <IconPaperclip className="w-3 h-3" />
                                                Data Attached
                                            </span>
                                        )}
                                    </div>
                                    
                                    {task.notes && (
                                        <p className="text-sm text-zen-text-secondary line-clamp-1 mt-3 pl-3 border-l-2 border-zen-surface/50">
                                            {task.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <div className="py-24 flex flex-col items-center justify-center gap-6 opacity-60 animate-reveal">
                        <div className="w-24 h-24 bg-zen-surface/50 rounded-[2.5rem] flex items-center justify-center rotate-3 border border-zen-surface">
                            <IconCheck className="w-10 h-10 text-zen-primary/40" />
                        </div>
                        <p className="text-zen-text-disabled font-light text-lg tracking-tight">No actions logged in memory.</p>
                    </div>
                    )}
                </div>
            </div>
        </div>

        {/* Floating Action Button (FAB) */}
        <div className="fixed bottom-[110px] right-6 md:right-10 z-30">
            <button 
                onClick={() => setShowAddTaskModal(true)} 
                className="w-16 h-16 bg-zen-primary text-zen-bg rounded-[1.5rem] shadow-[0_15px_30px_-5px_rgba(var(--zen-primary-rgb),0.3)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
            >
                <IconPlus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
            </button>
        </div>

        {showAddTaskModal && <AddTaskModal subjectName={selectedSubject.name} onClose={() => setShowAddTaskModal(false)} onSave={handleCreateTask} />}
        {editingTask && <AddTaskModal subjectName={selectedSubject.name} onClose={() => setEditingTask(null)} onSave={handleSaveTaskEdit} editMode={true} initialData={{ title: editingTask.title, date: editingTask.dueDate.slice(0, 16), notes: editingTask.notes || '', pdf: editingTask.pdfAttachment }} />}
        {activeActionTask && <TaskActionModal task={activeActionTask} onClose={() => setActiveActionTask(null)} onToggleDone={() => { toggleTask(activeActionTask.id); setActiveActionTask(null); }} onViewPdf={() => { if (activeActionTask.pdfAttachment) setViewingPdf(activeActionTask.pdfAttachment); setActiveActionTask(null); }} onEdit={() => handleEditTask(activeActionTask)} onDelete={() => setConfirmDelete({ type: 'task', id: activeActionTask.id, name: activeActionTask.title })} />}
        {confirmDelete && <ConfirmDeleteModal type={confirmDelete.type} name={confirmDelete.name} onConfirm={() => { if (confirmDelete.type === 'task') handleDeleteTask(confirmDelete.id); else handleDeleteSubject(confirmDelete.id); }} onCancel={() => setConfirmDelete(null)} />}
        {viewingPdf && <PDFViewer attachment={viewingPdf} onClose={() => setViewingPdf(null)} />}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden flex flex-col relative animate-reveal">
      {loadingSubjectId && (
          <div className="fixed inset-0 bg-zen-bg/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-fade-in">
              <div className="w-16 h-16 border-2 border-zen-primary border-t-transparent rounded-full animate-spin mb-4" />
          </div>
      )}

      <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar desktop-scroll-area p-6 lg:p-10 pb-24 lg:pb-10">
          <div className="max-w-7xl mx-auto space-y-8">
             
             <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                   <h2 className="text-3xl md:text-4xl font-light text-zen-text-primary tracking-tight">{getGreeting(profile.name)}</h2>
                   <p className="text-zen-text-secondary md:text-lg font-light">{formatDateFull(new Date())}</p>
                </div>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                <div className="lg:col-span-8 space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div onClick={completedCount > 0 ? handleClearCompleted : undefined} className={`bg-zen-card p-6 rounded-3xl border border-zen-surface/30 flex flex-col justify-center space-y-2 transition-all relative group h-32 ${completedCount > 0 ? 'cursor-pointer hover:border-zen-destructive/50 hover:bg-zen-destructive/5' : ''}`}>
                          <span className="text-4xl font-light text-zen-primary group-hover:text-zen-destructive transition-colors">{completedCount}</span>
                          <span className="text-xs text-zen-text-disabled uppercase tracking-widest font-medium group-hover:text-zen-destructive/70 transition-colors">Completed</span>
                      </div>
                      <div className="bg-zen-card p-6 rounded-3xl border border-zen-surface/30 flex flex-col justify-center space-y-2 h-32">
                          <span className="text-4xl font-light text-zen-text-secondary">{pendingCount}</span>
                          <span className="text-xs text-zen-text-disabled uppercase tracking-widest font-medium">Pending</span>
                      </div>
                   </div>

                    <section className="bg-gradient-to-br from-zen-surface to-zen-card rounded-3xl p-5 sm:p-6 lg:p-8 border border-zen-surface shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-zen-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-zen-secondary/20 transition-colors duration-1000"></div>
                      <div className="relative z-10">
                        <h3 className="text-base sm:text-lg font-medium text-zen-text-primary mb-4 sm:mb-6 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-zen-secondary"></div>
                          Up Next
                        </h3>
                        
                        {upNextTasks.length > 0 ? (
                            <div className="grid gap-3 sm:gap-4">
                            {upNextTasks.slice(0, 3).map((task, idx) => (
                                <div key={task.id} className="flex items-center gap-3 sm:gap-4 bg-zen-bg/50 p-3 sm:p-4 rounded-xl border border-zen-surface/20 hover:border-zen-primary/30 transition-all cursor-pointer" onClick={() => setActiveActionTask(task)}>
                                    <div className={`w-1.5 h-10 sm:h-12 rounded-full ${idx === 0 ? 'bg-zen-primary' : 'bg-zen-text-disabled'}`}></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm sm:text-base text-zen-text-primary font-medium truncate">{task.title}</h4>
                                        <p className="text-[11px] sm:text-xs text-zen-text-secondary mt-0.5">{new Date(task.dueDate).toLocaleString([], {weekday: 'short', hour:'2-digit', minute:'2-digit'})}</p>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                                      className="p-2 text-zen-text-disabled hover:text-zen-primary transition-colors"
                                      aria-label={`Mark ${task.title} complete`}
                                    >
                                      <IconCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>
                                </div>
                            ))}
                            </div>
                        ) : (
                            <div className="py-8 text-center"><p className="text-zen-text-secondary">All caught up. Breathe.</p></div>
                        )}
                      </div>
                   </section>
                </div>
                
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-zen-card/50 backdrop-blur-sm rounded-3xl p-6 border border-zen-surface h-full min-h-[400px]">
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-bold text-zen-text-primary tracking-tight">Subjects</h3>
                          <button onClick={() => setShowAddSubject(true)} className="p-2 hover:bg-zen-surface rounded-full text-zen-primary transition-colors hover:rotate-90 duration-300"><IconPlus className="w-5 h-5" /></button>
                       </div>
                       
                       {showAddSubject && (
                            <form onSubmit={handleCreateSubject} className="mb-6 bg-zen-bg p-4 rounded-2xl border border-zen-surface animate-reveal">
                                <input autoFocus type="text" placeholder="Subject Name..." className="w-full bg-transparent border-b border-zen-surface p-2 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-colors mb-3" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} />
                                <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowAddSubject(false)} className="text-xs text-zen-text-secondary px-3 py-2">Cancel</button><button type="submit" className="text-xs bg-zen-surface text-zen-primary px-3 py-2 rounded-lg font-medium">Create</button></div>
                            </form>
                        )}

                       <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
                          {subjects.map((subject, idx) => {
                            const total = tasks.filter(t => t.subjectId === subject.id).length;
                            const completed = tasks.filter(t => t.subjectId === subject.id && t.completed).length;
                            const progress = total === 0 ? 0 : (completed / total) * 100;
                            const showActions = showSubjectActions === subject.id;

                            return (
                                <div key={subject.id} className="relative group animate-reveal stagger-1">
                                    <div onClick={() => handleSubjectClick(subject.id)} className="p-4 rounded-2xl bg-zen-bg hover:bg-zen-surface/60 border border-transparent hover:border-zen-surface transition-all cursor-pointer relative overflow-hidden">
                                        <div className="flex justify-between items-center mb-2 z-10 relative">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-8 rounded-full ${subject.color}`} />
                                                <h4 className="font-medium text-zen-text-primary">{subject.name}</h4>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); setShowSubjectActions(showActions ? null : subject.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zen-text-secondary hover:text-zen-primary"><IconMoreVertical className="w-4 h-4" /></button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3">
                                            <div className="flex-1 h-1 bg-zen-surface rounded-full overflow-hidden"><div className={`h-full ${subject.color} opacity-70`} style={{ width: `${progress}%` }} /></div>
                                            <span className="text-[10px] text-zen-text-disabled font-mono">{Math.round(progress)}%</span>
                                        </div>
                                    </div>
                                    {showActions && (
                                        <div className="absolute right-2 top-10 bg-zen-surface border border-zen-text-disabled/20 rounded-xl shadow-2xl z-20 overflow-hidden animate-scale-in w-32">
                                            <button onClick={(e) => { e.stopPropagation(); handleEditSubject(subject); }} className="w-full px-4 py-2 text-xs text-zen-text-primary hover:bg-white/5 flex items-center gap-2 text-left">Edit</button>
                                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'subject', id: subject.id, name: subject.name }); setShowSubjectActions(null); }} className="w-full px-4 py-2 text-xs text-red-400 hover:bg-white/5 flex items-center gap-2 text-left">Delete</button>
                                        </div>
                                    )}
                                </div>
                            );
                          })}
                          {subjects.length === 0 && !showAddSubject && <div className="py-8 text-center opacity-50"><p className="text-sm text-zen-text-disabled">Nothing here yet</p></div>}
                       </div>
                    </div>
                </div>
             </div>
          </div>
      </div>

      {editingSubject && <EditSubjectModal subject={editingSubject} editName={editSubjectName} setEditName={setEditSubjectName} onSave={(e) => { e.preventDefault(); if (!editSubjectName.trim()) return; updateSubject({ ...editingSubject, name: editSubjectName.trim() }); setEditingSubject(null); setEditSubjectName(''); }} onCancel={() => { setEditingSubject(null); setEditSubjectName(''); }} />}
      {confirmDelete && <ConfirmDeleteModal type={confirmDelete.type} name={confirmDelete.name} onConfirm={() => { if (confirmDelete.type === 'task') handleDeleteTask(confirmDelete.id); else handleDeleteSubject(confirmDelete.id); }} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
};

export default Home;
