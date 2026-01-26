
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useZen } from '../context/ZenContext';
// Added IconLibrary to the imports from components/Icons
import { IconPlus, IconChevronRight, IconChevronLeft, IconPaperclip, IconX, IconTrash, IconFileText, IconFolder, IconExternalLink, IconLibrary } from '../components/Icons';
import { generateId } from '../utils/helpers';
import ConfirmModal from '../components/ConfirmModal';

// Helper: Splits text into readable chunks for the Zen Reader
const paginateText = (text: string, charsPerPage: number = 1400) => {
  if (!text || text.trim() === "") return ["Empty document."];
  const pages: string[] = [];
  const paragraphs = text.split('\n');
  let currentPage = "";
  
  paragraphs.forEach(para => {
    if ((currentPage.length + para.length) > charsPerPage && currentPage.length > 0) {
      pages.push(currentPage.trim());
      currentPage = para + "\n";
    } else {
      currentPage += para + "\n";
    }
  });
  
  if (currentPage.trim()) pages.push(currentPage.trim());
  return pages;
};

// Component: Specialized canvas-based PDF page renderer
const PdfPageRenderer: React.FC<{ data: string; pageNum: number; onDocumentLoad: (numPages: number) => void }> = ({ data, pageNum, onDocumentLoad }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<any>(null);

  const renderPage = useCallback(async (pdfDoc: any, num: number) => {
    if (!canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale: 1.5 });
      const containerWidth = canvas.parentElement?.clientWidth || 500;
      const scale = (containerWidth - 32) / viewport.width;
      const scaledViewport = page.getViewport({ scale: Math.min(scale, 1.8) });

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = { canvasContext: context, viewport: scaledViewport };
      await page.render(renderContext).promise;
      setLoading(false);
    } catch (err) {
      console.error('PDF Render Error:', err);
      setError('Unable to display this page.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument(data);
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        onDocumentLoad(pdf.numPages);
        renderPage(pdf, pageNum);
      } catch (err) {
        setError('Document format not recognized.');
        setLoading(false);
      }
    };
    loadPdf();
  }, [data, onDocumentLoad, renderPage]);

  useEffect(() => {
    if (pdfDocRef.current) renderPage(pdfDocRef.current, pageNum);
  }, [pageNum, renderPage]);

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[400px] relative">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-8 h-8 border-2 border-zen-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] text-zen-primary uppercase tracking-[0.2em] animate-pulse">Scanning Document...</p>
        </div>
      )}
      {error && <div className="text-zen-destructive text-sm font-medium">{error}</div>}
      <canvas ref={canvasRef} className="max-w-full h-auto bg-white rounded-xl shadow-2xl animate-scale-in" />
    </div>
  );
};

const Library: React.FC = () => {
  const { state, addFolder, deleteFolder, addItemToFolder, deleteItemFromFolder, setHideNavbar } = useZen();
  const { folders } = state;
  
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemType, setItemType] = useState<'note' | 'pdf'>('note');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemPdf, setNewItemPdf] = useState<{ name: string; data: string } | null>(null);

  const [activeDoc, setActiveDoc] = useState<{ id: string; title: string; type: 'note' | 'pdf'; content?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const activeFolder = folders.find(f => f.id === activeFolderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hide navbar when viewing documents or adding items
  useEffect(() => {
    const hasModal = activeDoc !== null || isAddingItem || isAddingFolder;
    setHideNavbar(hasModal);
  }, [activeDoc, isAddingItem, isAddingFolder, setHideNavbar]);

  // Sync total pages for text notes whenever a document is opened
  useEffect(() => {
    if (activeDoc && activeDoc.type === 'note') {
      const p = paginateText(activeDoc.content || "");
      setTotalPages(p.length);
    }
  }, [activeDoc]);

  const handleCreateFolder = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newFolderName.trim()) return;
      addFolder({
          id: generateId(),
          name: newFolderName.trim(),
          items: []
      });
      setNewFolderName('');
      setIsAddingFolder(false);
  };

  const handleSaveItem = () => {
    if (!activeFolderId || !newItemTitle.trim()) return;
    const item = {
      id: generateId(),
      title: newItemTitle.trim() + (itemType === 'note' ? '.txt' : '.pdf'),
      type: itemType,
      content: itemType === 'note' ? newItemContent : newItemPdf?.data
    };
    addItemToFolder(activeFolderId, item);
    setIsAddingItem(false); setNewItemTitle(''); setNewItemContent(''); setNewItemPdf(null);
  };

  const openInNewTab = () => {
    if (!activeDoc?.content) return;
    if (activeDoc.type === 'pdf') {
      const win = window.open();
      win?.document.write(`<iframe src="${activeDoc.content}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
      const blob = new Blob([activeDoc.content], { type: 'text/plain' });
      window.open(URL.createObjectURL(blob), '_blank');
    }
  };

  // --- 1. Folder View ---
  if (activeFolder) {
    const textPages = activeDoc?.type === 'note' ? paginateText(activeDoc.content || "") : [];

    return (
      <div className="h-full w-full flex flex-col bg-zen-bg animate-reveal overflow-y-auto no-scrollbar desktop-scroll-area p-0 md:p-10 pb-24">
        {/* Header (Sticky Mobile) */}
        <div className="sticky top-0 z-20 bg-zen-bg/80 backdrop-blur-xl md:static md:bg-transparent p-4 md:p-0 border-b border-zen-surface/30 md:border-none mb-4 md:mb-8">
            <div className="max-w-6xl mx-auto w-full">
                <button 
                    onClick={() => setActiveFolderId(null)}
                    className="flex items-center gap-2 text-zen-text-secondary hover:text-zen-text-primary mb-4 md:mb-6 transition-all group w-fit hover:bg-zen-surface/50 px-3 py-1.5 rounded-lg -ml-3"
                >
                    <IconChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Library</span>
                </button>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
                    <div>
                        <div className="flex items-center gap-2 md:gap-3 mb-2">
                            <IconFolder className="w-4 h-4 md:w-5 md:h-5 text-zen-primary" />
                            <span className="text-[10px] md:text-xs font-bold text-zen-text-disabled uppercase tracking-widest">Archive Collection</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-light text-zen-text-primary tracking-tight truncate max-w-[80vw] leading-tight">{activeFolder.name}</h2>
                        <p className="text-zen-text-secondary mt-1 md:mt-2 text-sm md:text-base">{activeFolder.items.length} knowledge items stored</p>
                    </div>
                    
                    <div className="hidden md:flex gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
                        <button 
                            onClick={() => setIsAddingItem(true)}
                            className="flex-1 md:flex-none px-6 md:px-8 py-3 bg-zen-primary text-zen-bg rounded-xl font-bold uppercase tracking-wider text-xs md:text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-zen-primary/20"
                        >
                            <IconPlus className="w-4 h-4" />
                            Add Knowledge
                        </button>
                        <button 
                            onClick={() => setConfirmState({
                                isOpen: true,
                                title: 'Delete Collection',
                                message: `Permanently delete "${activeFolder.name}" and all ${activeFolder.items.length} documents?`,
                                action: () => deleteFolder(activeFolder.id)
                            })}
                            className="px-4 py-3 bg-zen-card border border-zen-surface text-zen-text-disabled hover:text-red-400 hover:border-red-400/30 rounded-xl transition-all active:scale-95"
                        >
                            <IconTrash className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <ConfirmModal
            isOpen={confirmState.isOpen}
            onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            onConfirm={confirmState.action}
            title={confirmState.title}
            message={confirmState.message}
            confirmText="Delete"
            isDangerous
        />

        {/* List of Files */}
        <div className="px-4 md:px-0 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pb-24 md:pb-0">
          {activeFolder.items.map((item, idx) => (
            <div 
              key={item.id} 
              onClick={() => { setActiveDoc(item); setCurrentPage(1); }}
              className="group relative bg-zen-card hover:bg-zen-surface/40 p-5 md:p-6 rounded-3xl md:rounded-[2rem] border border-zen-surface hover:border-zen-primary/30 transition-all cursor-pointer flex flex-col justify-between hover:-translate-y-1 hover:shadow-xl animate-reveal min-h-[140px]"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-zen-surface rounded-2xl flex items-center justify-center text-zen-text-secondary group-hover:text-zen-primary transition-colors">
                  {item.type === 'pdf' ? <IconPaperclip className="w-5 h-5 md:w-6 md:h-6" /> : <IconFileText className="w-5 h-5 md:w-6 md:h-6" />}
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); deleteItemFromFolder(activeFolder.id, item.id); }} 
                    className="p-2 text-zen-text-disabled hover:text-red-400 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <IconTrash className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-lg md:text-xl font-medium text-zen-text-primary leading-tight line-clamp-2 mb-2">{item.title}</h3>
                <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase font-black tracking-widest">{item.type === 'pdf' ? 'Portable Document' : 'Text Knowledge'}</p>
              </div>

              <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-zen-surface/50 flex items-center justify-between">
                <span className="text-[10px] text-zen-text-disabled uppercase font-medium">Click to view</span>
                <IconChevronRight className="w-4 h-4 text-zen-text-disabled" />
              </div>
            </div>
          ))}

          {/* Empty State */}
          {activeFolder.items.length === 0 && (
            <button 
                onClick={() => setIsAddingItem(true)}
                className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-zen-text-disabled hover:text-zen-primary border-2 border-dashed border-zen-surface rounded-[2.5rem] hover:bg-zen-surface/10 transition-all group"
            >
                <div className="w-16 h-16 bg-zen-surface group-hover:bg-zen-primary/10 rounded-full flex items-center justify-center transition-colors">
                    <IconPlus className="w-8 h-8" />
                </div>
                <div className="text-center">
                    <p className="text-lg font-light text-zen-text-primary">Empty Archive</p>
                    <p className="text-sm font-light">Add your first note or PDF to this collection.</p>
                </div>
            </button>
          )}
        </div>

        {/* Mobile FAB */}
        <div className="md:hidden fixed bottom-24 right-4 z-30">
            <button 
                onClick={() => setIsAddingItem(true)}
                className="w-14 h-14 bg-zen-primary text-zen-bg rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform"
            >
                 <IconPlus className="w-6 h-6" />
            </button>
        </div>

        {/* Create Item Modal */}
        {isAddingItem && (
          <div className="fixed inset-0 bg-zen-bg/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 md:p-6 animate-reveal">
            <div className="bg-zen-card w-full max-w-xl rounded-[2rem] md:rounded-[2.5rem] border border-zen-primary/30 shadow-2xl p-6 md:p-8 space-y-6 md:space-y-8 animate-reveal overflow-y-auto max-h-full">
              <div className="flex justify-between items-center">
                <h3 className="text-xl md:text-2xl font-light text-zen-text-primary">Add Knowledge</h3>
                <button onClick={() => setIsAddingItem(false)} className="p-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors"><IconX className="w-5 h-5 md:w-6 md:h-6" /></button>
              </div>
              
              <div className="flex bg-zen-surface rounded-xl md:rounded-2xl p-1">
                <button onClick={() => setItemType('note')} className={`flex-1 py-2 md:py-3 text-[10px] font-black uppercase tracking-widest rounded-lg md:rounded-xl transition-all ${itemType === 'note' ? 'bg-zen-bg text-zen-primary shadow-lg' : 'text-zen-text-disabled'}`}>Text Note</button>
                <button onClick={() => setItemType('pdf')} className={`flex-1 py-2 md:py-3 text-[10px] font-black uppercase tracking-widest rounded-lg md:rounded-xl transition-all ${itemType === 'pdf' ? 'bg-zen-bg text-zen-primary shadow-lg' : 'text-zen-text-disabled'}`}>PDF Archive</button>
              </div>

              <div className="space-y-4 md:space-y-6">
                <div className="space-y-2 md:space-y-3">
                  <label className="text-xs text-zen-text-disabled uppercase tracking-widest font-bold ml-1">Document Title</label>
                  <input autoFocus placeholder="e.g. Modern Physics Summary" className="w-full bg-zen-surface rounded-xl md:rounded-2xl p-3 md:p-4 text-base md:text-lg text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 border border-zen-surface transition-all placeholder:text-zen-text-disabled/30" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} />
                </div>
                
                {itemType === 'note' ? (
                  <div className="space-y-2 md:space-y-3">
                    <label className="text-xs text-zen-text-disabled uppercase tracking-widest font-bold ml-1">Notes Content</label>
                    <textarea placeholder="Paste or type your knowledge here..." className="w-full h-48 md:h-64 bg-zen-surface rounded-xl md:rounded-2xl p-4 md:p-5 text-zen-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-zen-primary/30 border border-zen-surface transition-all placeholder:text-zen-text-disabled/30 text-sm md:text-base" value={newItemContent} onChange={e => setNewItemContent(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                     <label className="text-xs text-zen-text-disabled uppercase tracking-widest font-bold ml-1">Archive File</label>
                     <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 md:h-48 border-2 border-dashed border-zen-surface rounded-[1.5rem] md:rounded-[2rem] flex flex-col items-center justify-center gap-2 md:gap-4 cursor-pointer group hover:border-zen-primary/50 transition-all bg-zen-surface/30">
                        <input type="file" ref={fileInputRef} accept="application/pdf" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setNewItemPdf({ name: file.name, data: ev.target?.result as string });
                              if (!newItemTitle) setNewItemTitle(file.name.replace('.pdf', ''));
                            };
                            reader.readAsDataURL(file);
                          }
                        }} className="hidden" />
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-zen-surface group-hover:bg-zen-primary/10 rounded-full flex items-center justify-center transition-colors">
                            <IconPaperclip className={`w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:scale-110 ${newItemPdf ? 'text-zen-primary' : 'text-zen-text-disabled'}`} />
                        </div>
                        <p className="text-xs md:text-sm font-medium text-zen-text-secondary px-6 truncate w-full text-center">{newItemPdf ? newItemPdf.name : 'Select or drop PDF document'}</p>
                      </div>
                  </div>
                )}
                
                <div className="flex gap-4 pt-2 md:pt-4">
                    <button onClick={() => setIsAddingItem(false)} className="flex-1 py-3 md:py-4 text-zen-text-secondary font-medium text-sm md:text-base">Cancel</button>
                    <button onClick={handleSaveItem} disabled={!newItemTitle || (itemType === 'pdf' && !newItemPdf)} className="flex-[2] py-3 md:py-4 bg-zen-primary text-zen-bg font-bold uppercase tracking-widest text-xs md:text-sm rounded-xl shadow-lg shadow-zen-primary/20 active:scale-95 transition-all disabled:opacity-30">
                      Save to Collection
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Reader */}
        {activeDoc && (
          <div className="fixed inset-0 bg-zen-bg/95 backdrop-blur-2xl z-[110] flex items-center justify-center p-0 sm:p-4 md:p-6 animate-reveal">
            <div className="bg-zen-card w-full h-full md:max-w-4xl md:h-[92vh] sm:rounded-[3rem] border-none sm:border border-zen-surface shadow-2xl flex flex-col overflow-hidden">
              
              {/* Reader Header */}
              <header className="px-4 py-4 md:px-8 md:py-6 border-b border-zen-surface flex justify-between items-center bg-zen-card shrink-0">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-zen-surface rounded-xl md:rounded-2xl flex items-center justify-center text-zen-primary">
                    {activeDoc.type === 'pdf' ? <IconPaperclip className="w-5 h-5 md:w-6 md:h-6" /> : <IconFileText className="w-5 h-5 md:w-6 md:h-6" />}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-medium text-zen-text-primary truncate max-w-[50vw] sm:max-w-md">{activeDoc.title}</h3>
                    <p className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-bold tracking-widest">Knowledge Archive &bull; {activeDoc.type.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-3">
                  <button onClick={openInNewTab} className="p-2 md:p-3 text-zen-text-secondary hover:text-zen-primary active:scale-90 transition-all" title="Open PDF Original">
                    <IconExternalLink className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                  <button onClick={() => setActiveDoc(null)} className="p-2 md:p-3 text-zen-text-secondary hover:text-zen-text-primary active:scale-90 transition-all">
                    <IconX className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              </header>

              {/* Reader Body */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-0 md:p-8 bg-zen-bg/30 flex flex-col items-center">
                {activeDoc.type === 'pdf' ? (
                  <PdfPageRenderer data={activeDoc.content || ""} pageNum={currentPage} onDocumentLoad={setTotalPages} />
                ) : (
                  <div className="w-full max-w-2xl bg-zen-card p-6 md:p-12 sm:p-20 md:rounded-[3rem] border border-zen-surface shadow-xl animate-reveal mt-0 md:mt-4 h-full md:h-auto overflow-y-auto">
                    <div className="text-lg md:text-xl font-light text-zen-text-primary leading-relaxed whitespace-pre-wrap select-text selection:bg-zen-primary/30">
                      {textPages[currentPage - 1]}
                    </div>
                  </div>
                )}
              </div>

              {/* Reader Footer Navigation */}
              <footer className="px-8 py-6 flex justify-center items-center gap-12 bg-zen-card border-t border-zen-surface shrink-0">
                <button 
                  disabled={currentPage <= 1} 
                  onClick={() => setCurrentPage(p => p - 1)} 
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zen-surface text-zen-text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zen-primary hover:text-zen-bg transition-all active:scale-90"
                >
                  <IconChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3 px-6 py-2 bg-zen-bg rounded-full border border-zen-surface">
                  <span className="text-2xl font-light text-zen-primary leading-none">{currentPage}</span>
                  <span className="text-zen-text-disabled font-light">/</span>
                  <span className="text-lg font-light text-zen-text-disabled leading-none">{totalPages}</span>
                </div>
                <button 
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)} 
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zen-surface text-zen-text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zen-primary hover:text-zen-bg transition-all active:scale-90"
                >
                  <IconChevronRight className="w-6 h-6" />
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 2. Create Folder Modal ---
  if (isAddingFolder) {
    return (
        <div className="fixed inset-0 bg-zen-bg/80 backdrop-blur-xl z-[60] flex items-center justify-center p-4 md:p-6 animate-reveal">
            <div className="w-full max-w-md bg-zen-card p-6 md:p-8 rounded-[2rem] border border-zen-primary/30 shadow-2xl shadow-zen-primary/10">
                <div className="flex justify-between items-center mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-light text-zen-text-primary">New Collection</h2>
                    <button onClick={() => setIsAddingFolder(false)} className="p-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors">
                        <IconChevronLeft className="w-5 h-5 rotate-90" />
                    </button>
                </div>

                <form onSubmit={handleCreateFolder} className="space-y-6 md:space-y-8">
                    <div className="space-y-2 md:space-y-3">
                        <label className="text-xs text-zen-text-disabled uppercase tracking-widest font-bold ml-1">Collection Name</label>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="e.g., Thesis References..."
                            className="w-full bg-zen-surface rounded-xl md:rounded-2xl p-3 md:p-4 text-base md:text-lg text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 border border-zen-surface transition-all placeholder:text-zen-text-disabled/30"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setIsAddingFolder(false)} className="flex-1 py-3 md:py-4 text-zen-text-secondary font-medium text-sm md:text-base">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={!newFolderName.trim()} 
                            className="flex-[2] py-3 md:py-4 rounded-xl bg-zen-primary text-zen-bg font-bold uppercase tracking-wider text-xs md:text-sm shadow-lg shadow-zen-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                            Create Folder
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
  }

  // --- 3. Main Dashboard ---
  const totalItems = folders.reduce((acc, f) => acc + f.items.length, 0);

  return (
    <div className="h-full w-full flex flex-col animate-reveal pb-24 overflow-y-auto no-scrollbar desktop-scroll-area p-4 md:p-6 lg:p-10">
       <div className="max-w-6xl mx-auto w-full">
           
           {/* Mobile Header (Visible only on small screens) */}
           <div className="md:hidden py-4 mb-4 border-b border-zen-surface/30">
               <h2 className="text-3xl font-light text-zen-text-primary tracking-tight">Library</h2>
               <p className="text-sm text-zen-text-secondary mt-1">Resource Archive</p>
           </div>

           {/* Desktop Header */}
           <div className="hidden md:block py-6 md:py-10 lg:py-16 space-y-2 md:space-y-4">
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-extralight text-zen-text-primary tracking-tight">Library</h2>
                <p className="text-zen-text-secondary font-light text-sm md:text-lg max-w-lg">
                    Your personal vault of curated knowledge and research.
                </p>
           </div>

           {/* Stats Overview */}
           <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-16">
               <div className="bg-zen-card hover:bg-zen-surface/30 p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-zen-surface/50 transition-all">
                   <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.2em] font-bold mb-2 md:mb-4">Storage</p>
                   <div className="flex items-end gap-1 md:gap-2">
                       <p className="text-2xl md:text-4xl text-zen-text-primary font-light leading-none">{totalItems}</p>
                       <p className="text-[10px] md:text-sm text-zen-text-disabled mb-1 font-medium">Docs</p>
                   </div>
               </div>
               
               <div className="bg-zen-card hover:bg-zen-surface/30 p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-zen-surface/50 transition-all">
                   <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.2em] font-bold mb-2 md:mb-4">Folders</p>
                   <div className="flex items-end gap-1 md:gap-2">
                       <p className="text-2xl md:text-4xl text-zen-primary font-light leading-none">{folders.length}</p>
                       <p className="text-[10px] md:text-sm text-zen-text-disabled mb-1 font-medium">Sets</p>
                   </div>
               </div>

               <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-zen-secondary/10 to-transparent p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-zen-secondary/20 backdrop-blur-sm relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all flex items-center justify-between md:flex-col md:items-start md:gap-8 animate-pulse-soft" onClick={() => setIsAddingFolder(true)}>
                   <div className="relative z-10 flex flex-col justify-center">
                       <p className="text-[10px] md:text-xs text-zen-secondary uppercase tracking-[0.2em] font-bold mb-1 md:mb-4">Quick Add</p>
                       <p className="text-base md:text-xl text-zen-text-primary font-medium tracking-tight">New Folder</p>
                   </div>
                   <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zen-secondary text-zen-bg flex items-center justify-center group-hover:scale-110 transition-transform relative z-10 shadow-lg md:mt-auto">
                        <IconPlus className="w-5 h-5 md:w-6 md:h-6" />
                   </div>
                   <div className="absolute inset-0 bg-zen-secondary/5 group-hover:bg-zen-secondary/10 transition-colors" />
               </div>
           </div>

           {/* Collections Grid */}
           <div className="space-y-4 md:space-y-8">
                <div className="flex items-center justify-between border-b border-zen-surface/30 pb-2 md:pb-6">
                    <h3 className="text-lg md:text-2xl font-light text-zen-text-primary flex items-center gap-3">
                        Collections
                        <span className="bg-zen-surface/50 px-2 py-0.5 rounded text-[10px] md:text-xs text-zen-text-disabled font-bold">{folders.length}</span>
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {folders.map((folder, idx) => (
                      <button 
                        key={folder.id} 
                        onClick={() => setActiveFolderId(folder.id)} 
                        className="group relative bg-zen-card hover:bg-zen-surface/40 p-6 md:p-10 rounded-3xl md:rounded-[3rem] flex items-center md:flex-col md:text-center gap-4 md:gap-6 border border-zen-surface hover:border-zen-primary/30 transition-all shadow-lg hover:-translate-y-1 animate-reveal min-h-[100px] md:min-h-[300px]"
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        <div className="w-12 h-12 md:w-24 md:h-24 bg-zen-surface rounded-2xl md:rounded-[2rem] flex items-center justify-center text-zen-primary/40 group-hover:text-zen-primary group-hover:bg-zen-primary/10 transition-all duration-500 relative shrink-0">
                            <IconFolder className="w-6 h-6 md:w-10 md:h-10" />
                            <div className="absolute -top-2 -right-2 bg-zen-primary text-zen-bg text-[10px] font-bold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full shadow-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                {folder.items.length}
                            </div>
                        </div>
                        
                        <div className="flex-1 text-left md:text-center">
                            <h3 className="text-lg md:text-2xl font-medium text-zen-text-primary tracking-tight transition-colors group-hover:text-zen-primary line-clamp-1">{folder.name}</h3>
                            <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.2em] mt-0.5 md:mt-2 font-bold">{folder.items.length} Items</p>
                        </div>

                        <div className="md:mt-4 p-2 md:p-2.5 rounded-full bg-zen-surface text-zen-text-disabled group-hover:bg-zen-primary group-hover:text-zen-bg transition-all shrink-0">
                            <IconChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        
                        {/* Decorative background element */}
                        <div className="hidden md:block absolute top-0 right-0 w-32 h-32 bg-zen-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}

                    <button 
                        onClick={() => setIsAddingFolder(true)}
                        className="hidden md:flex rounded-[3rem] border-2 border-dashed border-zen-surface hover:border-zen-secondary/50 hover:bg-zen-surface/10 transition-all flex-col items-center justify-center gap-4 text-zen-text-disabled hover:text-zen-secondary h-[250px] md:h-[340px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-zen-surface group-hover:bg-zen-secondary/10 flex items-center justify-center transition-colors">
                            <IconPlus className="w-8 h-8" />
                        </div>
                        <div className="text-center px-6">
                            <p className="text-lg font-light text-zen-text-primary">New Collection</p>
                            <p className="text-xs font-light mt-1">Organize your research by subject or project.</p>
                        </div>
                    </button>
                </div>
           </div>
       </div>
    </div>
  );
};

export default Library;
