import { useState, useEffect, useRef } from 'react';

export const useAcademiaController = () => {
  // Existing State
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState(["Homework", "Exam", "Reading"]);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // NEW: State for Library and Flashcards
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [flashcards, setFlashcards] = useState([]);

  // Modal & Navigation State
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeModal, setActiveModal] = useState(null); 
  const [editingItem, setEditingItem] = useState(null);

  const audioRef = useRef(null);

  // --- Initialization ---
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audioRef.current.volume = 0.5;
    try {
      const savedData = localStorage.getItem('academiaZenData');
      if (savedData) setSubjects(JSON.parse(savedData));
      
      const savedTheme = localStorage.getItem('academiaZenTheme');
      if (savedTheme === 'dark') setDarkMode(true);
      
      const savedCategories = localStorage.getItem('academiaZenCategories');
      if (savedCategories) setCategories(JSON.parse(savedCategories));

      // Load new features
      const savedFiles = localStorage.getItem('academiaZenFiles');
      if (savedFiles) setLibraryFiles(JSON.parse(savedFiles));

      const savedCards = localStorage.getItem('academiaZenFlashcards');
      if (savedCards) setFlashcards(JSON.parse(savedCards));

    } catch (e) { console.error(e); } 
    finally { setIsLoaded(true); }
  }, []);

  // --- Persistence ---
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('academiaZenData', JSON.stringify(subjects));
    localStorage.setItem('academiaZenTheme', darkMode ? 'dark' : 'light');
    localStorage.setItem('academiaZenCategories', JSON.stringify(categories));
    localStorage.setItem('academiaZenFiles', JSON.stringify(libraryFiles));
    localStorage.setItem('academiaZenFlashcards', JSON.stringify(flashcards));
  }, [subjects, darkMode, categories, libraryFiles, flashcards, isLoaded]);

  // --- Notifications (Existing Logic) ---
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    const checkNotifications = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      let updatesNeeded = false;
      const updatedSubjects = subjects.map(sub => {
        let subUpdated = false;
        const updatedTasks = sub.tasks.map(task => {
          if (!task.completed) {
            const taskDate = new Date(task.date);
            if (taskDate > now && taskDate <= threeDaysFromNow) {
               const lastNotified = task.lastNotified || 0;
               if (Date.now() - lastNotified > 7200000) { 
                   new Notification(`Upcoming: ${sub.name}`, { body: `${task.title} is due on ${taskDate.toLocaleDateString()}` });
                   if(audioRef.current) audioRef.current.play().catch(() => {});
                   subUpdated = true;
                   updatesNeeded = true;
                   return { ...task, lastNotified: Date.now() }; 
               }
            }
          }
          return task;
        });
        if (subUpdated) return { ...sub, tasks: updatedTasks };
        return sub;
      });
      if (updatesNeeded) setSubjects(updatedSubjects);
    };
    const interval = setInterval(checkNotifications, 60000); 
    const timeout = setTimeout(checkNotifications, 3000); 
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [subjects]);

  // --- CRUD Actions ---
  const addSubject = (name) => {
    setSubjects([...subjects, {id: Date.now().toString(), name, tasks: [], note: "", resources: [], grades: {target: '', current: ''}}]);
  };

  const updateSubjectName = (id, name) => {
    setSubjects(subjects.map(s => s.id === id ? { ...s, name } : s));
  };

  const deleteSubject = (id) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  const addTask = (subjectId, task) => {
    setSubjects(subjects.map(s => s.id === subjectId ? {
      ...s, 
      tasks: [...s.tasks, { ...task, id: Date.now().toString(), completed: false }]
    } : s));
  };

  const updateTask = (subjectId, taskId, updates) => {
    setSubjects(subjects.map(s => s.id === subjectId ? {
      ...s,
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    } : s));
  };

  const deleteTask = (subjectId, taskId) => {
    setSubjects(subjects.map(s => s.id === subjectId ? {
      ...s,
      tasks: s.tasks.filter(t => t.id !== taskId)
    } : s));
  };

  const toggleTaskComplete = (subjectId, taskId) => {
    setSubjects(subjects.map(s => s.id === subjectId ? {
      ...s,
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    } : s));
  };

  const updateNote = (subjectId, note) => {
    setSubjects(subjects.map(s => s.id === subjectId ? { ...s, note } : s));
  };

  const addResource = (subjectId, resource) => {
    setSubjects(subjects.map(s => s.id === subjectId ? {
      ...s, resources: [...(s.resources || []), { ...resource, id: Date.now() }]
    } : s));
  };

  const deleteResource = (subjectId, resourceId) => {
    setSubjects(subjects.map(s => s.id === subjectId ? {
      ...s, resources: (s.resources || []).filter(r => r.id !== resourceId)
    } : s));
  };

  const updateGrade = (subjectId, type, value) => {
    setSubjects(subjects.map(s => s.id === subjectId ? { 
      ...s, grades: { ...s.grades, [type]: value } 
    } : s));
  };

  const addCategory = (cat) => {
    if (cat.trim() && !categories.includes(cat.trim())) setCategories([...categories, cat.trim()]);
  };

  const deleteCategory = (cat) => {
    if (categories.length > 1) setCategories(categories.filter(c => c !== cat));
  };

  // --- NEW ACTIONS for Library & Review ---

  const addFile = (fileObj) => {
    // fileObj: { name, type, data (base64), date }
    setLibraryFiles([...libraryFiles, { ...fileObj, id: Date.now().toString() }]);
  };

  const deleteFile = (fileId) => {
    setLibraryFiles(libraryFiles.filter(f => f.id !== fileId));
  };

  const addFlashcard = (subjectId, question, answer) => {
    setFlashcards([...flashcards, { id: Date.now().toString(), subjectId, question, answer, mastery: 0 }]);
  };

  const deleteFlashcard = (cardId) => {
    setFlashcards(flashcards.filter(c => c.id !== cardId));
  };

  const openModal = (type, item = null) => {
    setEditingItem(item);
    setActiveModal(type);
  };

  return {
    subjects, categories, darkMode, setDarkMode, isLoaded,
    activeSubjectId, setActiveSubjectId, 
    activeModal, setActiveModal, openModal, editingItem,
    addSubject, updateSubjectName, deleteSubject, 
    addTask, updateTask, deleteTask, toggleTaskComplete,
    updateNote, addResource, deleteResource, updateGrade,
    addCategory, deleteCategory,
    // New Exports
    libraryFiles, addFile, deleteFile,
    flashcards, addFlashcard, deleteFlashcard
  };
};