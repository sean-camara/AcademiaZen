import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Calendar as CalendarIcon, Zap, LayoutGrid, X, Plus, Trash2, FolderOpen, BrainCircuit, Upload, FileText } from 'lucide-react';
import { useAcademiaController } from './hooks/useAcademiaController';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Focus from './pages/Focus';
import SubjectDetail from './pages/SubjectDetail';
import Library from './pages/Library';
import Review from './pages/Review';
import { Button } from './components/UI';

const NavBar = ({ darkMode }) => {
  const location = useLocation();
  const getLinkClass = (path) => `flex flex-col items-center gap-1 ${location.pathname === path ? 'text-[#4a7a7d]' : 'text-slate-400'}`;
  return (
    <div className={`fixed bottom-0 w-full backdrop-blur-lg border-t px-2 py-3 z-40 ${darkMode ? 'bg-[#1c2128]/90 border-stone-800' : 'bg-white/90 border-slate-200'}`}>
      <div className="flex justify-between items-center max-w-md mx-auto px-4">
         <Link to="/" className={getLinkClass('/')}><LayoutGrid size={20} /><span className="text-[10px] font-bold">Home</span></Link>
         <Link to="/calendar" className={getLinkClass('/calendar')}><CalendarIcon size={20} /><span className="text-[10px] font-bold">Calendar</span></Link>
         <Link to="/focus" className={getLinkClass('/focus')}><Zap size={20} /><span className="text-[10px] font-bold">Focus</span></Link>
         <Link to="/review" className={getLinkClass('/review')}><BrainCircuit size={20} /><span className="text-[10px] font-bold">Review</span></Link>
         <Link to="/library" className={getLinkClass('/library')}><FolderOpen size={20} /><span className="text-[10px] font-bold">Library</span></Link>
      </div>
    </div>
  );
};

export default function App() {
  const controller = useAcademiaController();
  const { darkMode, setDarkMode, categories, addCategory, deleteCategory, activeModal, setActiveModal, addSubject, addTask, updateTask, updateSubjectName, activeSubjectId, addResource, addFlashcard, updateFlashcard, subjects } = controller;
  
  // Modal Inputs
  const [inputName, setInputName] = useState("");
  const [inputDate, setInputDate] = useState("");
  const [inputType, setInputType] = useState(""); 
  const [inputPriority, setInputPriority] = useState("Medium");
  const [editingItem, setEditingItem] = useState(null); 
  const [newCategoryName, setNewCategoryName] = useState("");
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  
  // Flashcard Inputs
  const [fcQuestion, setFcQuestion] = useState("");
  const [fcAnswer, setFcAnswer] = useState("");
  const [fcSubjectId, setFcSubjectId] = useState("");

  // Task File Input
  const [taskFile, setTaskFile] = useState(null); 
  const [taskFileName, setTaskFileName] = useState(""); 
  const taskFileInputRef = useRef(null);

  // --- Helper to read file for task ---
  const handleTaskFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 1. Strict PDF Check
      if (file.type !== "application/pdf") { 
        alert("Only PDF files are allowed."); 
        return; 
      }

      // 2. Strict Size Check (Max 0.5MB)
      if (file.size > 500000) {
        alert("File is too large (Max 0.5MB). Please use the Library tab for larger files, or compress this PDF.");
        return;
      }

      setTaskFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTaskFile(reader.result); // Save Base64
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (activeModal === 'edit-task' && editingItem) {
      setInputName(editingItem.title);
      setInputDate(editingItem.date);
      setInputType(editingItem.type || categories[0]);
      setInputPriority(editingItem.priority || "Medium");
      setTaskFile(editingItem.pdfFile || null);
      setTaskFileName(editingItem.pdfName || "");
    } else if (activeModal === 'edit-subject' && editingItem) {
      setInputName(editingItem.name);
    } else if (activeModal === 'flashcard') {
      if (editingItem) {
        setFcSubjectId(editingItem.subjectId);
        setFcQuestion(editingItem.question);
        setFcAnswer(editingItem.answer);
      } else {
        setFcQuestion("");
        setFcAnswer("");
        if (subjects.length > 0 && !fcSubjectId) {
            setFcSubjectId(subjects[0].id);
        }
      }
    } else if (activeModal !== 'manage-categories' && activeModal !== 'resource' && activeModal !== null) {
      setInputName(""); 
      setInputDate(""); 
      setInputType(categories[0] || "Homework"); 
      setInputPriority("Medium");
      setTaskFile(null);
      setTaskFileName("");
    }
  }, [activeModal, editingItem]);

  const openModal = (type, item = null) => {
    controller.openModal(type, item);
    setEditingItem(item);
  };

  const handleSave = () => {
    // CRASH PREVENTION: Wrap in try/catch to handle Storage Full errors gracefully
    try {
      if (activeModal === 'flashcard') {
        if (fcQuestion && fcAnswer && fcSubjectId) {
          if (editingItem) updateFlashcard(editingItem.id, { question: fcQuestion, answer: fcAnswer, subjectId: fcSubjectId });
          else addFlashcard(fcSubjectId, fcQuestion, fcAnswer);
          setFcQuestion(""); setFcAnswer("");
        }
        setActiveModal(null);
        return;
      }

      if (!inputName.trim() && activeModal !== 'resource' && activeModal !== 'manage-categories') return;
      
      if (activeModal === 'subject') {
        addSubject(inputName);
      } else if (activeModal === 'edit-subject' && editingItem) {
        updateSubjectName(editingItem.id, inputName);
      } else if (activeModal === 'task' && activeSubjectId) {
        // Add Task with PDF
        addTask(activeSubjectId, { 
            title: inputName, 
            date: inputDate, 
            type: inputType, 
            priority: inputPriority,
            pdfFile: taskFile,  
            pdfName: taskFileName
        });
      } else if (activeModal === 'edit-task' && editingItem && activeSubjectId) {
        // Update Task with PDF
        updateTask(activeSubjectId, editingItem.id, { 
            title: inputName, 
            date: inputDate, 
            type: inputType, 
            priority: inputPriority,
            pdfFile: taskFile,
            pdfName: taskFileName
        });
      } else if (activeModal === 'resource' && activeSubjectId) {
          addResource(activeSubjectId, { title: resTitle, url: resUrl });
          setResTitle(""); setResUrl("");
      }
      
      setActiveModal(null);
    } catch (error) {
      console.error("Save failed:", error);
      alert("Error: Storage is full! Please delete some items or try a smaller file.");
    }
  };

  if (!controller.isLoaded) return <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#1c2128]" />;

  return (
    <Router>
      <div className={darkMode ? "dark" : ""}>
        <div className={`min-h-screen transition-colors duration-300 font-sans pb-32 ${darkMode ? 'bg-[#1c2128] text-stone-200' : 'bg-[#f5f5f4] text-slate-800'}`}>
          
          <header className={`sticky top-0 z-30 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b ${darkMode ? 'bg-[#1c2128]/80 border-stone-800' : 'bg-white/80 border-slate-200'}`}>
            <h1 className={`text-xl font-bold tracking-tight ${darkMode ? 'text-[#7dd3fc]' : 'text-[#4a7a7d]'}`}>
              Academia<span className={`font-light ml-1 ${darkMode ? 'text-stone-500' : 'text-slate-400'}`}>Zen</span>
            </h1>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-stone-400 hover:bg-stone-700' : 'text-slate-400 hover:bg-slate-100'}`}>
              {darkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>
          </header>

          <main className="max-w-md mx-auto px-4 mt-6">
            <Routes>
              <Route path="/" element={<Dashboard controller={controller} openModal={openModal} />} />
              <Route path="/calendar" element={<Calendar controller={controller} />} />
              <Route path="/focus" element={<Focus controller={controller} />} />
              <Route path="/library" element={<Library controller={controller} />} />
              <Route path="/review" element={<Review controller={controller} openModal={openModal} />} />
              <Route path="/subject/:id" element={<SubjectDetail controller={controller} openModal={openModal} />} />
            </Routes>
          </main>

          <NavBar darkMode={darkMode} />

          {activeModal && (
            <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in ${darkMode ? 'bg-slate-900/60' : 'bg-slate-900/40'}`}>
              <div className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 border ${darkMode ? 'bg-[#2c333e] border-white/20' : 'bg-white border-white/50'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                    {activeModal.replace('-', ' ').toUpperCase()} {editingItem && activeModal !== 'manage-categories' ? '(EDIT)' : ''}
                  </h3>
                  <button onClick={() => setActiveModal(null)} className="text-slate-400"><X size={20}/></button>
                </div>

                {/* MODAL CONTENT SWITCHER */}
                {activeModal === 'flashcard' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Subject</label>
                      <select value={fcSubjectId} onChange={e => setFcSubjectId(e.target.value)} className={`w-full p-3 rounded-xl outline-none ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Question</label><input autoFocus value={fcQuestion} onChange={(e) => setFcQuestion(e.target.value)} className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#4a7a7d] ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}/></div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Answer</label><textarea value={fcAnswer} onChange={(e) => setFcAnswer(e.target.value)} className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#4a7a7d] ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}/></div>
                    <Button onClick={handleSave} className="w-full mt-4">{editingItem ? 'Update Card' : 'Add Card'}</Button>
                  </div>
                ) : activeModal === 'resource' ? (
                    <div className="space-y-4">
                      <div><label className="block text-xs font-bold text-slate-400 mb-1">Title</label><input autoFocus value={resTitle} onChange={(e) => setResTitle(e.target.value)} className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#4a7a7d] ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}/></div>
                      <div><label className="block text-xs font-bold text-slate-400 mb-1">URL</label><input value={resUrl} onChange={(e) => setResUrl(e.target.value)} className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#4a7a7d] ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}/></div>
                      <Button onClick={handleSave} className="w-full mt-4">Add Link</Button>
                    </div>
                ) : activeModal === 'manage-categories' ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New..." className={`flex-1 p-3 rounded-xl outline-none ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}/>
                      <Button onClick={() => { addCategory(newCategoryName); setNewCategoryName(""); }} className="px-4"><Plus size={20}/></Button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {categories.map((cat, idx) => (
                        <div key={idx} className={`flex justify-between items-center p-3 rounded-xl ${darkMode ? 'bg-black/20' : 'bg-slate-100'}`}>
                          <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-800'}`}>{cat}</span>
                          {categories.length > 1 && <button onClick={() => deleteCategory(cat)} className="text-slate-400 hover:text-rose-500"><Trash2 size={16}/></button>}
                        </div>
                      ))}
                    </div>
                    <Button variant="secondary" onClick={() => setActiveModal('task')} className="w-full mt-2">Done</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Name</label>
                      <input autoFocus value={inputName} onChange={e => setInputName(e.target.value)} className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#4a7a7d] ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}/>
                    </div>
                    {(activeModal === 'task' || activeModal === 'edit-task') && (
                      <>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-400 uppercase">Category</label>
                            <button onClick={() => setActiveModal('manage-categories')} className="text-[#4a7a7d] text-xs font-bold flex items-center gap-1 hover:underline">Edit</button>
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {categories.map(type => (
                              <button key={type} onClick={() => setInputType(type)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold transition-all border-2 ${inputType === type ? 'border-[#4a7a7d] bg-[#4a7a7d]/10 text-[#4a7a7d]' : 'border-transparent bg-slate-100 text-slate-500 dark:bg-black/20'}`}>{type}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Priority</label>
                          <div className="flex gap-2">
                            {['High', 'Medium', 'Low'].map(p => (
                              <button key={p} onClick={() => setInputPriority(p)} className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${inputPriority === p ? 'border-current bg-opacity-10 text-[#4a7a7d]' : 'border-transparent bg-slate-100 text-slate-400 dark:bg-black/20'}`}>{p}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Due Date</label>
                          <input type="datetime-local" value={inputDate} onChange={e => setInputDate(e.target.value)} className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#4a7a7d] ${darkMode ? 'bg-black/20 text-white' : 'bg-slate-100'}`}/>
                        </div>
                        
                        {/* --- ATTACH PDF SECTION (SAFE MODE) --- */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Attach PDF (Optional - Max 0.5MB)</label>
                            <div className={`border-2 border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-black/10 transition-colors ${taskFile ? 'border-[#4a7a7d]' : 'border-slate-300 dark:border-stone-600'}`} onClick={() => taskFileInputRef.current.click()}>
                                <div className="p-2 bg-slate-100 dark:bg-black/20 rounded-lg">
                                    {taskFile ? <FileText size={20} className="text-[#4a7a7d]" /> : <Upload size={20} className="text-slate-400" />}
                                </div>
                                <div className="flex-1 truncate">
                                    <p className={`text-xs font-bold truncate ${taskFile ? 'text-[#4a7a7d]' : 'text-slate-500'}`}>{taskFileName || "Click to upload..."}</p>
                                </div>
                                {taskFile && <button onClick={(e) => { e.stopPropagation(); setTaskFile(null); setTaskFileName(""); }} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>}
                            </div>
                            <input ref={taskFileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleTaskFileChange} />
                        </div>
                      </>
                    )}
                    <div className="flex gap-3 mt-8">
                      <Button variant="secondary" onClick={() => setActiveModal(null)} className="flex-1">Cancel</Button>
                      <Button className="flex-1" onClick={handleSave}>Save</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Router>
  );
}