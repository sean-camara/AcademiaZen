import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useZen } from '../context/ZenContext';
import { getGreeting, formatDateFull, generateId } from '../utils/helpers';
import { IconCheck, IconPlus, IconChevronLeft, IconPaperclip, IconX, IconEye, IconChevronRight, IconRefresh, IconExternalLink, IconEdit, IconTrash, IconMoreVertical, IconCalendar, IconZoomIn, IconZoomOut } from '../components/Icons';
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
  const [showHeader, setShowHeader] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideHeaderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderTaskRef = useRef<any>(null);
  const isRenderingRef = useRef(false);

  // Auto-hide header on inactivity
  useEffect(() => {
    const resetHideTimer = () => {
      setShowHeader(true);
      if (hideHeaderTimeoutRef.current) {
        clearTimeout(hideHeaderTimeoutRef.current);
      }
      hideHeaderTimeoutRef.current = setTimeout(() => {
        setShowHeader(false);
      }, 3000);
    };

    const handleMouseMove = () => resetHideTimer();
    const handleTouchStart = () => resetHideTimer();

    resetHideTimer();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      if (hideHeaderTimeoutRef.current) {
        clearTimeout(hideHeaderTimeoutRef.current);
      }
    };
  }, []);

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
        // Step 1: Fetch signed URL if needed
        if (!sourceUrl && attachment?.key) {
          setIsLoading(true);
          const url = attachment.url || await getPdfSignedUrl(attachment.key);
          setSourceUrl(url);
          return; // Wait for next render with sourceUrl populated
        }

        // Step 2: Check if we have a URL to load
        const legacyData = (attachment as any)?.data;
        const hasLegacyData = legacyData && String(legacyData).startsWith('data:');
        
        if (!sourceUrl && !hasLegacyData) {
          throw new Error('No PDF source available');
        }
        
        setIsLoading(true);
        setIsRendering(true);
        
        if (!(window as any).pdfjsLib) {
          throw new Error('PDF library not loaded. Please refresh the page.');
        }
        
        // Step 3: Load PDF document
        let loadingTask;
        if (sourceUrl) {
          loadingTask = (window as any).pdfjsLib.getDocument({ url: sourceUrl, withCredentials: false });
        } else if (hasLegacyData) {
          const base64Data = String(legacyData).split(',')[1] || '';
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
        }
        
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
        renderPage(1, pdf);
      } catch (err: any) {
        console.error('[PDF] Load Error:', err);
        setError(err.message || 'Failed to load study material. Try using "View All" to open in browser.');
        setIsRendering(false);
        setIsLoading(false);
      }
    };

    const timer = setTimeout(loadPdf, 100);
    return () => clearTimeout(timer);
  }, [attachment, sourceUrl]);

  // Handle Window Resize
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      if (!pdfDoc) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderPage(pageNum, pdfDoc);
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [pdfDoc, pageNum]);

  // Core render function
  const renderPage = async (num: number, doc: any) => {
    if (!doc) {
      return;
    }
    
    if (!canvasRef.current) {
      setTimeout(() => renderPage(num, doc), 50);
      return;
    }

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
        await renderTaskRef.current.promise.catch(() => {});
      } catch (e) {
        // Ignore cancel errors
      }
      renderTaskRef.current = null;
    }

    if (isRenderingRef.current) {
      return;
    }
    
    isRenderingRef.current = true;
    setIsRendering(true);

    try {
      const page = await doc.getPage(num);
      
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas not available');
      }
      
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Calculate responsive scale
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const baseViewport = page.getViewport({ scale: 1.0 });
      // Responsive padding: Near full-width on mobile (24px total), breathable on desktop (96px)
      const padding = window.innerWidth < 640 ? 24 : 96;
      const targetWidth = Math.min(containerWidth - padding, 1000);
      const scale = targetWidth / baseViewport.width;

      const viewport = page.getViewport({ scale });

      context.clearRect(0, 0, canvas.width, canvas.height);
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;
      renderTaskRef.current = null;
      setPageNum(num);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('[PDF] Render Error:', err);
        setError('Error rendering page.');
      }
    } finally {
      isRenderingRef.current = false;
      setIsRendering(false);
    }
  };

  const handlePrevPage = () => {
    if (pageNum <= 1 || isRendering || !pdfDoc) return;
    const newPage = pageNum - 1;
    setPageNum(newPage);
    renderPage(newPage, pdfDoc);
  };

  const handleNextPage = () => {
    if (pageNum >= totalPages || isRendering || !pdfDoc) return;
    const newPage = pageNum + 1;
    setPageNum(newPage);
    renderPage(newPage, pdfDoc);
  };

  const handlePageSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pdfDoc) return;
    const newPage = parseInt(e.target.value);
    setPageNum(newPage);
    renderPage(newPage, pdfDoc);
  };

  // Touch gesture handling for swipe
  const touchStartX = useRef<number>(0);

  const handleTouchStartCanvas = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEndCanvas = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          handleNextPage();
        } else {
          handlePrevPage();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0A0C0F] z-[70] flex flex-col">
      {/* Floating Auto-Hide Header */}
      <div 
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 w-auto max-w-[95%] transition-all duration-300 ${
          showHeader ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        <div className="backdrop-blur-xl bg-[#0F1115]/90 border border-white/10 rounded-full shadow-2xl px-4 py-2 flex items-center gap-3">
          <div className="min-w-0 max-w-[150px] sm:max-w-xs">
            <h3 className="text-[10px] font-bold text-gray-200 truncate uppercase tracking-wider">{attachment.name}</h3>
          </div>
          
          <div className="w-px h-3 bg-white/10 md:block hidden" />

          <div className="flex items-center gap-1">
            <button 
              onClick={sourceUrl ? viewAll : viewAllLegacy}
              className="p-1 text-gray-400 hover:text-emerald-400 hover:bg-white/10 rounded-full transition-all"
              title="Open in new tab"
            >
              <IconExternalLink className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onClose} 
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-full transition-all"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center relative py-20 px-0 sm:px-4 scroll-smooth custom-scrollbar"
        onTouchStart={handleTouchStartCanvas}
        onTouchEnd={handleTouchEndCanvas}
      >
        
        {isLoading && !error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500/20 border-t-emerald-500 mx-auto mb-4"></div>
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-xl"></div>
            </div>
            <p className="text-gray-400 font-medium">Loading your document...</p>
            <p className="text-gray-600 text-sm mt-1">Preparing pages for viewing</p>
          </div>
        ) : error ? (
          <div className="text-center z-10 max-w-md mx-auto px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <IconX className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 font-medium mb-2">Failed to load PDF</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button 
              onClick={sourceUrl ? viewAll : viewAllLegacy} 
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium border border-emerald-500/30 transition-all"
            >
              Open in Browser
            </button>
          </div>
        ) : (
          <div className="relative p-4">
            <canvas 
              ref={canvasRef}
              className="max-w-full h-auto shadow-2xl rounded-lg"
              style={{ 
                filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5))',
              }}
            />
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg backdrop-blur-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500/20 border-t-emerald-500"></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Hub */}
      {totalPages > 0 && (
        <div 
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-auto transition-all duration-300 ${
            showHeader ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
          }`}
        >
          <div className="backdrop-blur-xl bg-[#0F1115]/90 border border-white/10 rounded-full shadow-2xl p-1.5 flex items-center gap-2 px-3">
            
            <button
              onClick={handlePrevPage}
              disabled={pageNum <= 1 || isRendering}
              className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                Page {pageNum} <span className="text-gray-600">of</span> {totalPages}
              </span>
              <input
                type="range"
                min="1"
                max={totalPages}
                value={pageNum}
                onChange={handlePageSliderChange}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                style={{
                   background: `linear-gradient(to right, #10B981 0%, #10B981 ${((pageNum - 1) / (Math.max(totalPages - 1, 1))) * 100}%, rgb(55, 65, 81) ${((pageNum - 1) / (Math.max(totalPages - 1, 1))) * 100}%, rgb(55, 65, 81) 100%)`
                }}
              />
            </div>
            
            <button
              onClick={handleNextPage}
              disabled={pageNum >= totalPages || isRendering}
              className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
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
    const { state } = useZen();
    const subject = state.subjects.find(s => s.id === task.subjectId);
    
    // Format Date
    const dueDate = new Date(task.dueDate);
    const isOverdue = dueDate < new Date() && !task.completed;
    const formattedDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(dueDate);

    return (
        <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-xl z-[65] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-[#0D1117] w-full max-w-sm rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-scale-in relative group"
                onClick={e => e.stopPropagation()}
            >
                {/* Decorative Blur */}
                <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full pointer-events-none opacity-20 ${subject?.color.startsWith('bg-') ? subject.color.replace('bg-', 'bg-') : 'bg-emerald-500'}`} />

                {/* Header */}
                <div className="p-8 pb-6 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        {subject ? (
                            <div className={`px-3 py-1 rounded-full border border-white/5 flex items-center gap-2 ${subject.color.startsWith('bg-') ? 'bg-white/5' : ''}`} style={!subject.color.startsWith('bg-') ? { backgroundColor: `${subject.color}20` } : {}}>
                                <div className={`w-1.5 h-1.5 rounded-full ${subject.color}`} style={!subject.color.startsWith('bg-') ? { backgroundColor: subject.color } : {}} />
                                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-300 max-w-[150px] truncate">{subject.name}</span>
                            </div>
                        ) : (
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">General Task</span>
                            </div>
                        )}
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors hover:rotate-90">
                            <IconX className="w-4 h-4" />
                        </button>
                    </div>

                    <h3 className="text-2xl font-medium text-white mb-3 leading-tight tracking-tight">{task.title}</h3>

                    {task.notes && (
                      <p className="text-sm text-gray-300/90 leading-relaxed font-light whitespace-pre-wrap mb-4">
                        {task.notes}
                      </p>
                    )}
                    
                    <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                        <IconCalendar className="w-4 h-4 opacity-70" />
                        {formattedDate}
                    </div>

                </div>

                {/* Primary Actions Grid */}
                <div className="p-4 pt-0 grid grid-cols-2 gap-3 relative z-10">
                    {/* View Material Card */}
                    {task.pdfAttachment ? (
                        <button 
                            onClick={onViewPdf}
                            className="col-span-1 aspect-square rounded-[2rem] bg-emerald-500 text-[#091510] flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-emerald-500/20 group/btn"
                        >
                            <IconEye className="w-8 h-8 group-hover/btn:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Study Mode</span>
                        </button>
                    ) : (
                         <div className="col-span-1 aspect-square rounded-[2rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 text-gray-600">
                             <IconPaperclip className="w-8 h-8 opacity-20" />
                             <span className="text-[10px] font-black uppercase tracking-widest opacity-60">No PDF</span>
                         </div>
                    )}

                    {/* Completion Toggle */}
                    <button 
                        onClick={onToggleDone}
                        className={`col-span-1 aspect-square rounded-[2rem] border flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all ${
                            task.completed 
                            ? 'bg-[#0D1117] border-emerald-500/50 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]' 
                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {task.completed ? (
                            <>
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 mb-1">
                                    <IconCheck className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">Completed</span>
                            </>
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded-full border-2 border-white/10 flex items-center justify-center mb-1 bg-white/5 group-hover:border-white/30">
                                    <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-white transition-colors" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">Mark Done</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Secondary Actions */}
                <div className="p-4 grid grid-cols-2 gap-3 relative z-10 border-t border-white/5 mt-2">
                    <button 
                        onClick={onEdit}
                        className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <IconEdit className="w-4 h-4" /> Edit
                    </button>
                    <button 
                        onClick={onDelete}
                        className="py-4 rounded-2xl bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <IconTrash className="w-4 h-4" /> Delete
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
    onSave: (e: React.FormEvent, color: string) => void;
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
                    onSave(e, selectedColor);
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

  const handleSaveTaskEdit = (title: string, date: string, notes: string, pdf?: PdfAttachment) => {
    if (!editingTask) return;
    updateTask({ ...editingTask, title, dueDate: date, notes: notes || undefined, pdfAttachment: pdf });
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(id);
    setConfirmDelete(null);
    setActiveActionTask(null);
  };

  const handleSubjectClick = useCallback((id: string) => {
    setLoadingSubjectId(id);
    setTimeout(() => {
        setSelectedSubjectId(id);
        setLoadingSubjectId(null);
    }, 400);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const id = detail?.id as string | undefined;
      if (!id) return;
      if (selectedSubjectId === id) return;
      const exists = subjects.some(subject => subject.id === id);
      if (!exists) return;
      handleSubjectClick(id);
    };
    window.addEventListener('open-subject', handler as EventListener);
    return () => window.removeEventListener('open-subject', handler as EventListener);
  }, [handleSubjectClick, subjects, selectedSubjectId]);

  const handleCreateTask = (title: string, date: string, notes: string, pdf?: PdfAttachment) => {
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
                            className="group bg-zen-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zen-surface hover:border-zen-primary/30 transition-all cursor-pointer active:scale-[0.98] animate-reveal" 
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            <div className="flex items-start gap-4 sm:gap-5">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }} 
                                    className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all mt-0.5 ${task.completed ? 'bg-zen-primary border-zen-primary shadow-glow' : 'border-zen-surface-brighter hover:border-zen-primary'}`}
                                >
                                {task.completed && <IconCheck className="w-4 h-4 text-zen-bg stroke-[4]" />}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-base sm:text-lg font-medium leading-tight transition-all line-clamp-2 sm:line-clamp-1 ${task.completed ? 'text-zen-text-disabled line-through opacity-50' : 'text-zen-text-primary'}`}>
                                        {task.title}
                                    </h4>
                                    
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
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
        {editingTask && <AddTaskModal subjectName={selectedSubject.name} onClose={() => setEditingTask(null)} onSave={handleSaveTaskEdit} editMode={true} initialData={{ title: editingTask.title, date: editingTask.dueDate, notes: editingTask.notes || '', pdf: editingTask.pdfAttachment }} />}
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
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-8">
             
             <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                   <h2 className="text-3xl md:text-4xl font-light text-zen-text-primary tracking-tight">{getGreeting(profile.firstName || 'Student')}</h2>
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
                            {upNextTasks.slice(0, 3).map((task, idx) => {
                                const taskSubject = subjects.find(s => s.id === task.subjectId);
                                const handleTaskClick = () => {
                                    if (task.subjectId) {
                                        setSelectedSubjectId(task.subjectId);
                                    }
                                };
                                
                                return (
                                <div key={task.id} className="flex items-center gap-3 sm:gap-4 bg-zen-bg/50 p-3 sm:p-4 rounded-xl border border-zen-surface/20 hover:border-zen-primary/30 transition-all cursor-pointer" onClick={handleTaskClick}>
                                    <div className={`w-1.5 h-10 sm:h-12 rounded-full ${idx === 0 ? 'bg-zen-primary' : 'bg-zen-text-disabled'}`}></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm sm:text-base text-zen-text-primary font-medium truncate">{task.title}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {taskSubject && (
                                                <span className="text-[10px] sm:text-[11px] text-zen-primary font-medium uppercase tracking-wider">{taskSubject.name}</span>
                                            )}
                                            {taskSubject && <span className="text-zen-text-disabled">•</span>}
                                            <p className="text-[11px] sm:text-xs text-zen-text-secondary">{new Date(task.dueDate).toLocaleString([], {weekday: 'short', hour:'2-digit', minute:'2-digit'})}</p>
                                        </div>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                                      className="p-2 text-zen-text-disabled hover:text-zen-primary transition-colors"
                                      aria-label={`Mark ${task.title} complete`}
                                    >
                                      <IconCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>
                                </div>
                                );
                            })}
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

                       <div className="space-y-3 max-h-[500px] overflow-y-auto overflow-x-visible no-scrollbar pr-4 pt-3 -mt-3 -mr-3">
                          {subjects.map((subject, idx) => {
                            const total = tasks.filter(t => t.subjectId === subject.id).length;
                            const completed = tasks.filter(t => t.subjectId === subject.id && t.completed).length;
                            const progress = total === 0 ? 0 : (completed / total) * 100;
                            const showActions = showSubjectActions === subject.id;

                            const unchecked = total - completed;

                            return (
                                <div key={subject.id} className="relative group animate-reveal stagger-1">
                                    {unchecked > 0 && (
                                        <span className="absolute -top-2 -right-2 z-20 inline-flex items-center justify-center w-6 h-6 rounded-full bg-zen-primary text-zen-bg text-[10px] font-black shadow-lg ring-4 ring-[#0D1117]">
                                            {unchecked}
                                        </span>
                                    )}
                                    <div onClick={() => handleSubjectClick(subject.id)} className="p-4 rounded-2xl bg-zen-bg hover:bg-zen-surface/60 border border-transparent hover:border-zen-surface transition-all cursor-pointer relative">
                                        <div className="flex justify-between items-center mb-2 z-10 relative">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-8 rounded-full ${subject.color}`} />
                                                <h4 className="font-medium text-zen-text-primary pr-6">{subject.name}</h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); setShowSubjectActions(showActions ? null : subject.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zen-text-secondary hover:text-zen-primary"><IconMoreVertical className="w-4 h-4" /></button>
                                            </div>
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

      {editingSubject && (
        <EditSubjectModal
          subject={editingSubject}
          editName={editSubjectName}
          setEditName={setEditSubjectName}
          onSave={(e, color) => {
            e.preventDefault();
            if (!editSubjectName.trim()) return;
            updateSubject({ ...editingSubject, name: editSubjectName.trim(), color });
            setEditingSubject(null);
            setEditSubjectName('');
          }}
          onCancel={() => {
            setEditingSubject(null);
            setEditSubjectName('');
          }}
        />
      )}
      {confirmDelete && <ConfirmDeleteModal type={confirmDelete.type} name={confirmDelete.name} onConfirm={() => { if (confirmDelete.type === 'task') handleDeleteTask(confirmDelete.id); else handleDeleteSubject(confirmDelete.id); }} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
};

export default Home;
