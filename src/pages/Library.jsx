import React, { useState, useRef } from 'react';
import { FileText, Trash2, Upload, File as FileIcon, X, Image as ImageIcon, Maximize2, BookOpen } from 'lucide-react';
import { Card, Button } from '../components/UI';

export default function Library({ controller }) {
  const { libraryFiles, addFile, deleteFile, darkMode } = controller;
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isReading, setIsReading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // --- Helpers ---

  const readFileAsync = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve({
          id: Date.now(),
          name: file.name,
          type: file.type,
          data: event.target.result,
          date: new Date()
        });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    if (file.size > 2500000) { 
      alert("File is too large (Max 2.5MB).");
      return;
    }

    try {
      setIsReading(true);
      const newFile = await readFileAsync(file);
      addFile(newFile);
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Failed to upload file.");
    } finally {
      setIsReading(false);
      setIsDragActive(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Smart Link Handler ---
  // This ensures PC opens in new tab, but Mobile downloads to Gallery
  const handleOpenOriginal = (e) => {
    // Check if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (!isMobile) {
      // DESKTOP: Prevent download, open in new tab instead
      e.preventDefault();
      
      const newWindow = window.open();
      if (newWindow) {
        // We write the content manually to bypass Chrome's "Not allowed to navigate top frame to data URL" security block
        newWindow.document.write(`
          <html>
            <head><title>${selectedFile.name}</title></head>
            <body style="margin:0; display:flex; align-items:center; justify-content:center; background:#1a1a1a;">
              ${selectedFile.type.includes('image') 
                ? `<img src="${selectedFile.data}" style="max-width:100%; max-height:100vh; object-fit:contain;">`
                : `<iframe src="${selectedFile.data}" style="width:100vw; height:100vh; border:none;"></iframe>`
              }
            </body>
          </html>
        `);
      }
    }
    // MOBILE: We do nothing (allow default behavior). 
    // The <a> tag has the 'download' attribute, so it will download the file.
    // Once downloaded, the user can open it in their Gallery/Photos app.
  };


  // --- Drag & Drop Logic ---

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e) => { 
    e.preventDefault(); e.stopPropagation(); 
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragActive(false); 
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if (!isDragActive) setIsDragActive(true); };
  const handleDrop = (e) => { 
    e.preventDefault(); e.stopPropagation(); setIsDragActive(false); 
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFileSelect(files[0]);
  };
  const onInputChange = (e) => handleFileSelect(e.target.files[0]);


  // --- Visual Helpers ---

  const getFileVisuals = (type) => {
    if (type.includes('image')) return { icon: <ImageIcon size={20} className="text-purple-500" />, bg: darkMode ? 'bg-purple-500/10' : 'bg-purple-50' };
    if (type.includes('pdf')) return { icon: <FileText size={20} className="text-rose-500" />, bg: darkMode ? 'bg-rose-500/10' : 'bg-rose-50' };
    return { icon: <FileIcon size={20} className="text-[#4a7a7d]" />, bg: darkMode ? 'bg-[#4a7a7d]/10' : 'bg-teal-50' };
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className="h-full flex flex-col pb-24 relative overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: ${darkMode ? '#4b5563' : '#cbd5e1'}; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #4a7a7d; }
        @keyframes pulse-border {
          0% { border-color: rgba(74, 122, 125, 0.5); box-shadow: 0 0 0 0 rgba(74, 122, 125, 0.4); }
          70% { border-color: rgba(74, 122, 125, 1); box-shadow: 0 0 0 10px rgba(74, 122, 125, 0); }
          100% { border-color: rgba(74, 122, 125, 0.5); box-shadow: 0 0 0 0 rgba(74, 122, 125, 0); }
        }
        .drag-active { animation: pulse-border 2s infinite; }
      `}</style>

      {/* --- PREVIEW MODAL --- */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedFile(null)}></div>
          <div className={`relative w-full h-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-300 ${darkMode ? 'bg-stone-900' : 'bg-white'}`}>
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between border-b ${darkMode ? 'border-stone-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-2 rounded-lg ${getFileVisuals(selectedFile.type).bg}`}>{getFileVisuals(selectedFile.type).icon}</div>
                <h3 className={`font-bold truncate text-lg ${darkMode ? 'text-stone-100' : 'text-slate-800'}`}>{selectedFile.name}</h3>
              </div>
              <button onClick={() => setSelectedFile(null)} className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={24} /></button>
            </div>
            
            {/* Body */}
            <div className={`flex-1 overflow-hidden flex items-center justify-center relative ${darkMode ? 'bg-stone-950' : 'bg-slate-50'}`}>
               {selectedFile.type.includes('image') ? <img src={selectedFile.data} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg" /> : <iframe src={selectedFile.data} className="w-full h-full" title="File Preview" />}
            </div>
            
            {/* Footer with Smart Action */}
             <div className={`px-6 py-3 border-t flex justify-between items-center ${darkMode ? 'border-stone-800 bg-stone-900' : 'border-slate-100 bg-white'}`}>
                 <span className="text-xs text-slate-400">Added on {formatDate(selectedFile.date)}</span>
                 <a 
                   href={selectedFile.data} 
                   download={selectedFile.name} // Essential for Mobile Gallery support
                   onClick={handleOpenOriginal} // Intercepts for Desktop New Tab
                   className="text-sm font-medium text-[#4a7a7d] hover:text-[#3a6163] transition-colors flex items-center gap-2 cursor-pointer"
                 >
                   <Maximize2 size={16} /> Open Original
                 </a>
             </div>
          </div>
        </div>
      )}

      {/* --- UPLOAD ZONE --- */}
      <div className="animate-in slide-in-from-bottom-4 duration-500 z-10 mb-6">
        <input type="file" ref={fileInputRef} onChange={onInputChange} className="hidden" accept="application/pdf,image/*,.doc,.docx,.txt" disabled={isReading}/>
        
        <div 
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
          className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 overflow-hidden ${isDragActive ? `drag-active bg-[#4a7a7d]/10 border-[#4a7a7d] scale-[1.02]` : darkMode ? 'border-stone-700 hover:border-stone-500 bg-[#2c333e]' : 'border-slate-300 hover:border-[#4a7a7d]/50 bg-white'}`}
        >
          <div className="p-8 flex flex-col items-center gap-4 relative z-20 pointer-events-none">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${isReading ? 'scale-110 bg-amber-500/10 text-amber-500' : isDragActive ? 'bg-[#4a7a7d] text-white scale-110 rotate-12' : 'bg-[#4a7a7d]/10 text-[#4a7a7d]'}`}>
              {isReading ? <div className="animate-spin h-7 w-7 border-2 border-current border-t-transparent rounded-full" /> : <Upload size={28} />}
            </div>
            <div>
              <h3 className={`text-lg font-bold transition-colors text-center ${isDragActive ? 'text-[#4a7a7d]' : (darkMode ? 'text-stone-100' : 'text-slate-800')}`}>{isReading ? 'Processing...' : isDragActive ? 'Drop File Here!' : 'Upload Material'}</h3>
              <p className={`text-sm mt-2 text-center ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>{isDragActive ? 'Release to upload' : 'Drag & drop or click to choose'}</p>
            </div>
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 bg-gradient-to-tr from-[#4a7a7d]/20 to-transparent pointer-events-none ${isDragActive ? 'opacity-100' : 'opacity-0'}`} />
        </div>
      </div>

      {/* --- FILE LIST --- */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <div className="flex items-center justify-between px-2 mb-4">
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Library</h3>
           <span className="text-xs text-slate-400">{libraryFiles.length} items</span>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-12 z-10 bg-gradient-to-t pointer-events-none ${darkMode ? 'from-[#1a1f2e] to-transparent' : 'from-slate-50 to-transparent'}`}></div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar pb-16 pl-1">
          {libraryFiles.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center pb-20 animate-in fade-in duration-500 opacity-50">
              <BookOpen size={40} className="text-slate-400 mb-4" />
              <p className="text-sm">Library is empty</p>
            </div>
          )}

          {libraryFiles.map((file, index) => {
            const visuals = getFileVisuals(file.type);
            return (
            <div key={file.id || index} className="animate-in slide-in-from-bottom-4 fade-in duration-500 fill-mode-backwards" style={{ animationDelay: `${index * 75}ms` }}>
              <Card className={`p-3 flex items-center justify-between group cursor-pointer border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${darkMode ? 'bg-[#2c333e] border-stone-800 hover:border-stone-700 shadow-black/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-slate-200/50'}`}>
                <div onClick={() => setSelectedFile(file)} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${visuals.bg}`}>{visuals.icon}</div>
                  <div className="flex-1 truncate">
                    <p className={`font-bold text-[15px] truncate mb-1 ${darkMode ? 'text-stone-100' : 'text-slate-800'}`}>{file.name}</p>
                    <div className="flex items-center text-xs text-slate-400"><p>{formatDate(file.date)}</p><span className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-[#4a7a7d] ml-3 font-semibold tracking-wide">View</span></div>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pl-2">
                  <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete file?')) deleteFile(file.id); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 size={18} /></button>
                </div>
              </Card>
            </div>
          )})}
        </div>
      </div>
    </div>
  );
}