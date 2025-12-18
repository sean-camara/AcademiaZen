import React, { useState, useRef } from 'react';
import { FileText, Trash2, Upload, File as FileIcon, X, Image as ImageIcon, Maximize2, BookOpen, Eye, Folder, ChevronLeft, ArrowLeft, Plus, MoreVertical } from 'lucide-react';
import { Card, Button } from '../components/UI';

export default function Library({ controller, openModal }) {
  const { libraryFiles = [], libraryFolders = [], addFile, deleteFile, deleteLibraryFolder, darkMode, subjects = [] } = controller;
  
  // State for Navigation
  const [activeFolderId, setActiveFolderId] = useState(null); // null = Folder View, 'id' = File View
  
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null); // For Preview Modal
  const [isReading, setIsReading] = useState(false);

  // --- Helpers ---
  const readFileAsync = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve({
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

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Size check (Backend allows 50MB)
    if (file.size > 50 * 1024 * 1024) { 
      alert("File is too large (Max 50MB).");
      return;
    }

    try {
      setIsReading(true);
      const newFileObj = await readFileAsync(file);
      // Pass the activeFolderId so it saves to the right folder
      addFile(newFileObj, activeFolderId);
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Failed to upload file.");
    } finally {
      setIsReading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- PREVIEW LOGIC (Same as SubjectDetail) ---
  const openFileViewer = () => {
    if (!selectedFile) return;
    const byteCharacters = atob(selectedFile.data.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: selectedFile.type });
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
        // Fallback for popups
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const getFileVisuals = (type) => {
    if (type.includes('image')) return { icon: <ImageIcon size={20} className="text-purple-500" />, bg: darkMode ? 'bg-purple-500/10' : 'bg-purple-50' };
    if (type.includes('pdf')) return { icon: <FileText size={20} className="text-rose-500" />, bg: darkMode ? 'bg-rose-500/10' : 'bg-rose-50' };
    return { icon: <FileIcon size={20} className="text-[#4a7a7d]" />, bg: darkMode ? 'bg-[#4a7a7d]/10' : 'bg-teal-50' };
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  };

  // --- DERIVED STATE ---
  // Combine default subjects + user created folders for display
  // We treat 'general' specially
  const activeFolder = libraryFolders.find(f => f.id === activeFolderId) || subjects.find(s => s.id === activeFolderId);
  const folderName = activeFolderId === 'general' ? "General Files" : (activeFolder ? activeFolder.name : "Unknown Folder");

  // Filter files for the current folder
  const currentFiles = libraryFiles.filter(f => {
       if (activeFolderId === 'general') return !f.folderId || f.folderId === 'general';
       return f.folderId === activeFolderId;
  });

  return (
    <div className="h-full flex flex-col pb-24 relative overflow-hidden animate-in fade-in duration-500">
      
      {/* CUSTOM SCROLLBAR STYLES */}
      <style>{`
        .library-scroll::-webkit-scrollbar {
            width: 6px;
        }
        .library-scroll::-webkit-scrollbar-track {
            background: transparent;
        }
        .library-scroll::-webkit-scrollbar-thumb {
            background-color: ${darkMode ? '#4b5563' : '#cbd5e1'};
            border-radius: 10px;
        }
        .library-scroll::-webkit-scrollbar-thumb:hover {
            background-color: #4a7a7d;
        }
      `}</style>

      {/* --- PREVIEW MODAL --- */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedFile(null)}></div>
          <div className={`relative w-full max-w-lg rounded-2xl flex flex-col overflow-hidden shadow-2xl ${darkMode ? 'bg-stone-900' : 'bg-white'}`}>
             <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex justify-between items-center">
                 <h3 className={`font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{selectedFile.name}</h3>
                 <button onClick={() => setSelectedFile(null)}><X size={20} className="text-slate-400" /></button>
             </div>
             <div className="p-8 flex justify-center">
                 <Button onClick={openFileViewer} className="gap-2 shadow-lg shadow-[#4a7a7d]/20"><Eye size={18}/> View / Open File</Button>
             </div>
          </div>
        </div>
      )}

      {/* --- VIEW 1: FOLDERS LIST --- */}
      {!activeFolderId ? (
          <div className="flex-1 overflow-y-auto library-scroll pr-2">
              <div className="flex items-center justify-between mb-6 px-1">
                <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Library</h2>
                    <p className="text-xs text-slate-400 mt-1">Manage your study materials</p>
                </div>
                <Button onClick={() => openModal('create-folder')} className="px-3 h-9 text-xs gap-1 shadow-sm">
                    <Plus size={16} /> New Folder
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  {/* General Folder (Default) */}
                  <Card 
                    onClick={() => setActiveFolderId('general')}
                    className={`p-5 cursor-pointer hover:scale-[1.02] transition-all relative group border ${darkMode ? 'bg-[#2c333e] border-stone-700' : 'bg-white border-slate-100 shadow-sm'}`}
                  >
                      <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3 text-amber-500">
                          <Folder size={20} fill="currentColor" fillOpacity={0.2} />
                      </div>
                      <p className={`font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>General</p>
                      <p className="text-xs text-slate-400 mt-1">
                          {libraryFiles.filter(f => !f.folderId || f.folderId === 'general').length} files
                      </p>
                  </Card>

                  {/* Subject Folders (From Dashboard) */}
                  {subjects.map(sub => (
                      <Card 
                        key={sub.id} 
                        onClick={() => setActiveFolderId(sub.id)}
                        className={`p-5 cursor-pointer hover:scale-[1.02] transition-all relative group border ${darkMode ? 'bg-[#2c333e] border-stone-700' : 'bg-white border-slate-100 shadow-sm'}`}
                      >
                          <div className="w-10 h-10 rounded-lg bg-[#4a7a7d]/10 flex items-center justify-center mb-3 text-[#4a7a7d]">
                              <Folder size={20} fill="currentColor" fillOpacity={0.2} />
                          </div>
                          <p className={`font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{sub.name}</p>
                          <p className="text-xs text-slate-400 mt-1">
                              {libraryFiles.filter(f => f.folderId === sub.id).length} files
                          </p>
                      </Card>
                  ))}

                  {/* Custom Created Folders */}
                  {libraryFolders.map(folder => (
                      <Card 
                        key={folder.id} 
                        onClick={() => setActiveFolderId(folder.id)}
                        className={`p-5 cursor-pointer hover:scale-[1.02] transition-all relative group border ${darkMode ? 'bg-[#2c333e] border-stone-700' : 'bg-white border-slate-100 shadow-sm'}`}
                      >
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); if(confirm("Delete folder and all its files?")) deleteLibraryFolder(folder.id); }}
                                className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors"
                              >
                                  <Trash2 size={14} />
                              </button>
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3 text-indigo-500">
                              <Folder size={20} fill="currentColor" fillOpacity={0.2} />
                          </div>
                          <p className={`font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{folder.name}</p>
                          <p className="text-xs text-slate-400 mt-1">
                              {libraryFiles.filter(f => f.folderId === folder.id).length} files
                          </p>
                      </Card>
                  ))}
              </div>
          </div>
      ) : (
          /* --- VIEW 2: FILES LIST --- */
          <div className="flex-1 flex flex-col h-full">
              {/* Header with Back Button */}
              <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setActiveFolderId(null)} className={`p-2 rounded-xl transition-colors ${darkMode ? 'bg-stone-800 hover:bg-stone-700 text-stone-300' : 'bg-white hover:bg-slate-50 text-slate-600 shadow-sm border border-slate-100'}`}>
                      <ChevronLeft size={20} />
                  </button>
                  <h2 className={`text-xl font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{folderName}</h2>
              </div>

              {/* Upload Area */}
              <div 
                  onClick={() => fileInputRef.current.click()}
                  className={`mb-6 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.01] ${darkMode ? 'border-stone-700 hover:border-[#4a7a7d] bg-stone-800/30' : 'border-slate-300 hover:border-[#4a7a7d] bg-white'}`}
              >
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isReading ? 'bg-amber-100 text-amber-500' : 'bg-[#4a7a7d]/10 text-[#4a7a7d]'}`}>
                    {isReading ? <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"/> : <Upload size={20} />}
                  </div>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{isReading ? "Uploading..." : "Click to Upload"}</p>
                  <p className="text-xs text-slate-400 mt-1">PDFs, Images, Docs allowed</p>
              </div>

              {/* Files Grid */}
              <div className="flex-1 overflow-y-auto space-y-2 pb-20 library-scroll pr-1">
                  {currentFiles.length === 0 && (
                      <div className="text-center py-12 opacity-50 flex flex-col items-center">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-3">
                            <BookOpen size={24} className="text-slate-400"/>
                          </div>
                          <p className="text-sm font-medium text-slate-500">Folder is empty</p>
                      </div>
                  )}

                  {currentFiles.map((file, index) => {
                      const visuals = getFileVisuals(file.type);
                      return (
                          <div key={file.id || index} className="animate-in slide-in-from-bottom-2 duration-300">
                              <Card className={`p-3 flex items-center justify-between group hover:shadow-md transition-shadow ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
                                  <div onClick={() => setSelectedFile(file)} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${visuals.bg}`}>{visuals.icon}</div>
                                      <div className="min-w-0">
                                          <p className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{file.name}</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{formatDate(file.date)}</p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => { if(confirm('Delete file?')) deleteFile(file.id); }} 
                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={16}/>
                                  </button>
                              </Card>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}
    </div>
  );
}