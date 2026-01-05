
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useZen } from '../context/ZenContext';
// Added IconLibrary to the imports from components/Icons
import { IconPlus, IconChevronRight, IconChevronLeft, IconPaperclip, IconX, IconTrash, IconFileText, IconFolder, IconExternalLink, IconLibrary } from '../components/Icons';
import { generateId } from '../utils/helpers';

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
  
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemType, setItemType] = useState<'note' | 'pdf'>('note');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemPdf, setNewItemPdf] = useState<{ name: string; data: string } | null>(null);

  const [activeDoc, setActiveDoc] = useState<{ title: string; type: 'note' | 'pdf'; content?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const activeFolder = folders.find(f => f.id === activeFolderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hide navbar when viewing documents or adding items
  useEffect(() => {
    const hasModal = activeDoc !== null || isAddingItem;
    setHideNavbar(hasModal);
  }, [activeDoc, isAddingItem, setHideNavbar]);

  // Sync total pages for text notes whenever a document is opened
  useEffect(() => {
    if (activeDoc && activeDoc.type === 'note') {
      const p = paginateText(activeDoc.content || "");
      setTotalPages(p.length);
    }
  }, [activeDoc]);

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

  if (activeFolder) {
    const textPages = activeDoc?.type === 'note' ? paginateText(activeDoc.content || "") : [];

    return (
      <div className="p-8 h-full flex flex-col bg-zen-bg animate-reveal relative overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-5 mb-10">
          <button onClick={() => setActiveFolderId(null)} className="p-3 bg-zen-surface/50 rounded-2xl text-zen-text-secondary active:scale-90 transition-all">
            <IconChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-semibold text-zen-text-primary tracking-tight">{activeFolder.name}</h2>
            <p className="text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">{activeFolder.items.length} Archived Items</p>
          </div>
          <button onClick={() => confirm('Delete this folder?') && deleteFolder(activeFolder.id)} className="p-2 text-zen-text-disabled hover:text-zen-destructive transition-colors">
            <IconTrash className="w-5 h-5" />
          </button>
        </header>

        {/* List of Files */}
        <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pb-32">
          {activeFolder.items.map((item, idx) => (
            <div 
              key={item.id} 
              onClick={() => { setActiveDoc(item); setCurrentPage(1); }}
              className={`glass p-5 rounded-3xl border border-white/5 flex items-center justify-between group cursor-pointer hover:border-zen-primary/20 transition-all animate-reveal stagger-${Math.min(idx+1, 5)}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zen-surface rounded-2xl flex items-center justify-center text-zen-text-secondary group-hover:text-zen-primary transition-colors">
                  {item.type === 'pdf' ? <IconPaperclip className="w-6 h-6" /> : <IconFileText className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-medium text-zen-text-primary group-hover:text-white transition-colors">{item.title}</h3>
                  <p className="text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">{item.type === 'pdf' ? 'Portable Document' : 'Text Knowledge'}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteItemFromFolder(activeFolder.id, item.id); }} className="p-2 text-zen-text-disabled hover:text-zen-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
          {activeFolder.items.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center opacity-30 border border-dashed border-white/10 rounded-3xl">
              <IconLibrary className="w-10 h-10 mb-2" />
              <p className="text-sm">Empty folder</p>
            </div>
          )}
        </div>

        <button onClick={() => setIsAddingItem(true)} className="fixed bottom-28 right-8 w-16 h-16 bg-zen-primary text-zen-bg rounded-[2rem] shadow-zen shadow-zen-glow flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-20">
          <IconPlus className="w-8 h-8" />
        </button>

        {/* --- MODAL: CREATE ITEM (Styled like AddTaskModal) --- */}
        {isAddingItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-zen-card w-full max-w-md rounded-3xl border border-zen-surface shadow-2xl p-6 space-y-6 animate-scale-in">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-medium text-zen-text-primary">Add Knowledge</h3>
                <button onClick={() => setIsAddingItem(false)} className="p-2 text-zen-text-secondary hover:text-white transition-colors"><IconX className="w-6 h-6" /></button>
              </div>
              
              <div className="flex bg-zen-bg p-1 rounded-2xl">
                <button onClick={() => setItemType('note')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${itemType === 'note' ? 'bg-zen-surface text-zen-primary shadow-sm' : 'text-zen-text-disabled'}`}>Text Note</button>
                <button onClick={() => setItemType('pdf')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${itemType === 'pdf' ? 'bg-zen-surface text-zen-primary shadow-sm' : 'text-zen-text-disabled'}`}>PDF Archive</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-medium ml-1">Document Title</label>
                  <input autoFocus placeholder="e.g. History Summary" className="w-full bg-zen-bg border border-zen-surface rounded-xl p-4 text-zen-text-primary focus:outline-none focus:border-zen-primary" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} />
                </div>
                
                {itemType === 'note' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-medium ml-1">Notes Content</label>
                    <textarea placeholder="Paste or type your notes here..." className="w-full h-48 bg-zen-bg border border-zen-surface rounded-xl p-4 text-zen-text-primary resize-none focus:outline-none focus:border-zen-primary" value={newItemContent} onChange={e => setNewItemContent(e.target.value)} />
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-zen-surface rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-zen-primary/50 transition-colors">
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
                    <IconPaperclip className={`w-8 h-8 transition-transform group-hover:scale-110 ${newItemPdf ? 'text-zen-primary' : 'text-zen-text-disabled'}`} />
                    <p className="text-xs font-medium text-zen-text-secondary px-4 truncate w-full text-center">{newItemPdf ? newItemPdf.name : 'Select PDF'}</p>
                  </div>
                )}
                
                <button onClick={handleSaveItem} disabled={!newItemTitle || (itemType === 'pdf' && !newItemPdf)} className="w-full py-5 bg-zen-primary text-zen-bg font-black uppercase tracking-[0.2em] rounded-2xl shadow-zen shadow-zen-glow active:scale-95 transition-all disabled:opacity-30">
                  Save to Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL: DOCUMENT READER (Same design language, wider container) --- */}
        {activeDoc && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="bg-zen-card w-full max-w-2xl h-[90vh] rounded-[2.5rem] border border-zen-surface shadow-2xl flex flex-col overflow-hidden animate-scale-in">
              
              {/* Reader Header */}
              <header className="p-6 border-b border-zen-surface flex justify-between items-center bg-zen-card/80 backdrop-blur shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zen-surface rounded-xl flex items-center justify-center text-zen-primary">
                    {activeDoc.type === 'pdf' ? <IconPaperclip className="w-5 h-5" /> : <IconFileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zen-text-primary truncate max-w-[140px] sm:max-w-[280px]">{activeDoc.title}</h3>
                    <p className="text-[9px] text-zen-text-disabled uppercase font-black tracking-widest">Zen Knowledge Archive</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={openInNewTab} className="p-3 bg-zen-bg rounded-2xl text-zen-text-secondary hover:text-zen-primary active:scale-90 transition-all" title="View in Tab">
                    <IconExternalLink className="w-6 h-6" />
                  </button>
                  <button onClick={() => setActiveDoc(null)} className="p-3 bg-zen-surface/50 rounded-2xl text-zen-text-secondary hover:text-white active:scale-90 transition-all">
                    <IconX className="w-6 h-6" />
                  </button>
                </div>
              </header>

              {/* Reader Body */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-zen-bg flex flex-col items-center">
                {activeDoc.type === 'pdf' ? (
                  <PdfPageRenderer data={activeDoc.content || ""} pageNum={currentPage} onDocumentLoad={setTotalPages} />
                ) : (
                  <div className="w-full max-w-xl bg-zen-card p-10 sm:p-14 rounded-[2rem] border border-zen-surface shadow-xl animate-reveal mt-4">
                    <div className="text-lg font-light text-zen-text-primary leading-loose whitespace-pre-wrap select-text">
                      {textPages[currentPage - 1]}
                    </div>
                  </div>
                )}
              </div>

              {/* Reader Footer Navigation */}
              <footer className="p-6 pb-10 flex justify-center items-center gap-8 bg-zen-card border-t border-zen-surface shrink-0">
                <button 
                  disabled={currentPage <= 1} 
                  onClick={() => setCurrentPage(p => p - 1)} 
                  className="p-4 glass rounded-2xl text-zen-primary disabled:opacity-10 transition-all active:scale-90"
                >
                  <IconChevronLeft className="w-8 h-8" />
                </button>
                <div className="flex items-center gap-2 px-6 py-2 bg-zen-bg rounded-full border border-zen-surface">
                  <span className="text-2xl font-mono text-zen-primary">{currentPage}</span>
                  <span className="text-zen-text-disabled opacity-30">/</span>
                  <span className="text-lg font-mono text-zen-text-disabled">{totalPages}</span>
                </div>
                <button 
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)} 
                  className="p-4 glass rounded-2xl text-zen-primary disabled:opacity-10 transition-all active:scale-90"
                >
                  <IconChevronRight className="w-8 h-8" />
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 h-full flex flex-col bg-zen-bg animate-reveal pb-32 overflow-y-auto no-scrollbar">
      <header className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-semibold text-zen-text-primary tracking-tight">Library</h2>
          <p className="text-xs text-zen-text-disabled font-medium">Knowledge Hub</p>
        </div>
        <button onClick={() => setIsAddingFolder(true)} className="p-4 glass rounded-2xl text-zen-primary border border-zen-primary/20 hover:scale-105 active:scale-90 transition-all"><IconPlus className="w-6 h-6" /></button>
      </header>
      
      {isAddingFolder && (
        <form onSubmit={(e) => { e.preventDefault(); if(newFolderName.trim()){ addFolder({id: generateId(), name: newFolderName.trim(), items: []}); setNewFolderName(''); setIsAddingFolder(false); } }} className="mb-8 animate-reveal flex gap-3">
          <input autoFocus className="flex-1 glass p-6 rounded-[1.5rem] text-zen-text-primary outline-none focus:ring-1 focus:ring-zen-primary/30" placeholder="New Folder Name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <button type="submit" className="px-8 glass rounded-[1.5rem] text-zen-primary border border-zen-primary/30 font-black uppercase text-[10px] active:scale-95">Create</button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-5">
        {folders.map((folder, idx) => (
          <button key={folder.id} onClick={() => setActiveFolderId(folder.id)} className={`glass p-7 rounded-[2.5rem] flex items-center justify-between group border border-white/5 hover:border-zen-primary/30 transition-all shadow-zen animate-reveal stagger-${Math.min(idx+1, 5)}`}>
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-zen-surface rounded-2xl flex items-center justify-center text-zen-primary/40 group-hover:text-zen-primary transition-all">
                <IconFolder className="w-8 h-8" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold text-zen-text-primary tracking-tight">{folder.name}</h3>
                <p className="text-[10px] text-zen-text-disabled uppercase tracking-widest font-black">{folder.items.length} items</p>
              </div>
            </div>
            <IconChevronRight className="w-6 h-6 text-zen-text-disabled group-hover:text-zen-primary transition-all group-hover:translate-x-1" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default Library;
