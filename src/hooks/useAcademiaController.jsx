import { useState, useEffect, useRef } from 'react';

export const useAcademiaController = () => {
  // --- STATE MANAGEMENT ---
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState(["Homework", "Exam", "Reading"]);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // New Features State
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [flashcards, setFlashcards] = useState([]);

  // Modal & Navigation State
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeModal, setActiveModal] = useState(null); 
  const [editingItem, setEditingItem] = useState(null);

  const audioRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Preload notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audioRef.current.volume = 0.5;

    try {
      const savedData = localStorage.getItem('academiaZenData');
      if (savedData) setSubjects(JSON.parse(savedData));
      
      const savedTheme = localStorage.getItem('academiaZenTheme');
      if (savedTheme === 'dark') setDarkMode(true);
      
      const savedCategories = localStorage.getItem('academiaZenCategories');
      if (savedCategories) setCategories(JSON.parse(savedCategories));

      const savedFiles = localStorage.getItem('academiaZenFiles');
      if (savedFiles) setLibraryFiles(JSON.parse(savedFiles));

      const savedCards = localStorage.getItem('academiaZenFlashcards');
      if (savedCards) setFlashcards(JSON.parse(savedCards));

    } catch (e) { console.error(e); } 
    finally { setIsLoaded(true); }
  }, []);

  // --- PERSISTENCE ---
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('academiaZenData', JSON.stringify(subjects));
    localStorage.setItem('academiaZenTheme', darkMode ? 'dark' : 'light');
    localStorage.setItem('academiaZenCategories', JSON.stringify(categories));
    localStorage.setItem('academiaZenFiles', JSON.stringify(libraryFiles));
    localStorage.setItem('academiaZenFlashcards', JSON.stringify(flashcards));
  }, [subjects, darkMode, categories, libraryFiles, flashcards, isLoaded]);

  // --- NOTIFICATIONS LOGIC (FIXED) ---
  const checkNotifications = (force = false) => {
    // 1. Check if browser supports it
    if (!("Notification" in window)) return;
    
    // 2. Check if permission is granted
    if (Notification.permission !== "granted") return;
    
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    let updatesNeeded = false;
    
    // 3. Scan tasks
    const updatedSubjects = subjects.map(sub => {
      let subUpdated = false;
      const updatedTasks = sub.tasks.map(task => {
        if (!task.completed && task.date) {
          const taskDate = new Date(task.date);
          
          // Check if due within 3 days AND in the future
          if (taskDate > now && taskDate <= threeDaysFromNow) {
             const lastNotified = task.lastNotified || 0;
             // Notify if: forced (user clicked enable), OR 2 hours (7200000ms) passed since last
             if (force || Date.now() - lastNotified > 7200000) { 
                 
                 try {
                    new Notification(`Upcoming: ${sub.name}`, { 
                        body: `${task.title} is due on ${taskDate.toLocaleDateString()}`,
                        // Note: Icons depend on browser/OS support
                        icon: '/icon-192.png' 
                    });
                    if(audioRef.current) audioRef.current.play().catch(() => {});
                 } catch(e) { console.log("Notify error", e); }

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

  // Run check every minute automatically
  useEffect(() => {
    const interval = setInterval(() => checkNotifications(false), 60000); 
    return () => clearInterval(interval);
  }, [subjects]);

  // Manual Trigger for the UI Button
  const enableNotifications = async () => {
      if (!("Notification" in window)) {
          alert("This browser does not support notifications.");
          return;
      }
      
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
          // Send a test notification immediately to prove it works
          new Notification("Notifications Enabled", { body: "You will be alerted 3 days before tasks are due." });
          // Check for actual tasks immediately
          checkNotifications(true); 
      }
  };

  // --- CRUD ACTIONS ---

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

  // --- LIBRARY & FLASHCARD ACTIONS ---

  const addFile = (fileObj) => {
    setLibraryFiles([...libraryFiles, { ...fileObj, id: Date.now().toString() }]);
  };

  const deleteFile = (fileId) => {
    setLibraryFiles(libraryFiles.filter(f => f.id !== fileId));
  };

  const addFlashcard = (subjectId, question, answer) => {
    setFlashcards([...flashcards, { id: Date.now().toString(), subjectId, question, answer, mastery: 0 }]);
  };

  const updateFlashcard = (cardId, updates) => {
    setFlashcards(flashcards.map(c => c.id === cardId ? { ...c, ...updates } : c));
  };

  const deleteFlashcard = (cardId) => {
    setFlashcards(flashcards.filter(c => c.id !== cardId));
  };

  const openModal = (type, item = null) => {
    setEditingItem(item);
    setActiveModal(type);
  };

  return {
    // State
    subjects, categories, darkMode, setDarkMode, isLoaded,
    activeSubjectId, setActiveSubjectId, 
    activeModal, setActiveModal, openModal, editingItem,
    libraryFiles, flashcards,
    
    // Core Actions
    addSubject, updateSubjectName, deleteSubject, 
    addTask, updateTask, deleteTask, toggleTaskComplete,
    updateNote, addResource, deleteResource, updateGrade,
    addCategory, deleteCategory,
    
    // Feature Actions
    addFile, deleteFile,
    addFlashcard, updateFlashcard, deleteFlashcard,
    
    // Notification Actions
    enableNotifications
  };
};