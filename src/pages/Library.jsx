import React, { useRef } from 'react';
import { FileText, Trash2, Upload, File as FileIcon, X } from 'lucide-react';
import { Card, Button } from '../components/UI';

export default function Library({ controller }) {
  const { libraryFiles, addFile, deleteFile, darkMode } = controller;
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2000000) { // 2MB limit for local storage safety
      alert("File is too large for local storage (Max 2MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const newFile = {
        name: file.name,
        type: file.type,
        data: event.target.result,
        date: new Date().toISOString()
      };
      addFile(newFile);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      {/* Header Action */}
      <Card className={`p-6 mb-6 text-center border-dashed border-2 ${darkMode ? 'bg-[#2c333e] border-stone-600' : 'bg-white border-slate-300'}`}>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          accept="application/pdf,image/*,.doc,.docx,.txt"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#4a7a7d]/10 flex items-center justify-center text-[#4a7a7d]">
            <Upload size={24} />
          </div>
          <div>
            <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Upload Material</h3>
            <p className="text-xs text-slate-400 mt-1">PDFs, Images, or Text files (Max 2MB)</p>
          </div>
          <Button onClick={() => fileInputRef.current.click()} variant="primary" className="px-6">
            Choose File
          </Button>
        </div>
      </Card>

      {/* Files List */}
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Your Library</h3>
      
      <div className="grid grid-cols-1 gap-3">
        {libraryFiles.length === 0 && (
          <div className="text-center py-10 opacity-50">
            <p className="text-sm text-slate-400">Library is empty.</p>
          </div>
        )}

        {libraryFiles.map((file) => (
          <Card key={file.id} className={`p-4 flex items-center justify-between ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
            <a 
              href={file.data} 
              download={file.name}
              className="flex items-center gap-4 flex-1 min-w-0"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-stone-700' : 'bg-slate-100'}`}>
                <FileIcon size={20} className="text-[#4a7a7d]" />
              </div>
              <div className="truncate">
                <p className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{file.name}</p>
                <p className="text-xs text-slate-400">{new Date(file.date).toLocaleDateString()}</p>
              </div>
            </a>
            <button onClick={() => deleteFile(file.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}