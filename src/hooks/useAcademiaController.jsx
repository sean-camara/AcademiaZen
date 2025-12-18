import { useState, useEffect, useRef } from 'react';
import api from '../api/axios'; 
import { useAuth } from '../context/AuthContext'; 

export const useAcademiaController = () => {
  const { user } = useAuth(); 
  
  // --- STATE ---
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState(["Homework", "Exam", "Reading"]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [libraryFolders, setLibraryFolders] = useState([]); 
  
  // NEW: User Profile State (Initialized from Auth Context or Defaults)
  const [userProfile, setUserProfile] = useState({
      displayName: user?.displayName || "Student",
      photo: user?.photo || null
  });

  const [darkMode, setDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Navigation State
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeModal, setActiveModal] = useState(null); 
  const [editingItem, setEditingItem] = useState(null);

  const audioRef = useRef(null);

  // --- 1. LOAD DATA ---
  useEffect(() => {
    // Safety check for audio
    if (typeof Audio !== "undefined") {
        audioRef.current = new Audio("/rain.mp3");
    }

    // SAFETY TIMEOUT
    const safetyTimer = setTimeout(() => {
        setIsLoaded(true);
    }, 2000);

    const fetchData = async () => {
        if (!user) {
            setIsLoaded(true);
            return;
        }

        try {
            const savedTheme = localStorage.getItem('academiaZenTheme');
            if (savedTheme === 'dark') setDarkMode(true);

            // Sync User Profile from Auth Context (Backend source of truth)
            if (user) {
                setUserProfile({
                    displayName: user.displayName || "Student",
                    photo: user.photo || null
                });
            }

            // GET request for app data
            // Note: Make sure your backend has a GET endpoint for this data too!
            // If not, we rely on what was loaded during login or initial state.
            // Assuming your previous /api/data endpoint still exists or handles this.
             try {
                const response = await api.get('/api/data');
                const data = response.data;
                if (data) {
                    if (data.subjects) setSubjects(data.subjects);
                    if (data.categories) setCategories(data.categories);
                    if (data.libraryFiles) setLibraryFiles(data.libraryFiles);
                    if (data.libraryFolders) setLibraryFolders(data.libraryFolders);
                    if (data.flashcards) setFlashcards(data.flashcards);
                }
             } catch (err) {
                 // It's okay if data fetch fails initially (new user), don't block app
                 console.warn("Could not fetch app data (New user?):", err);
             }

        } catch (error) {
            console.error("Data Load Error:", error);
        } finally {
            setIsLoaded(true);
            clearTimeout(safetyTimer);
        }
    };

    fetchData();
  }, [user]); 

  // --- 2. SAVE DATA (General App Data) ---
  const saveData = async (dataToSave) => {
      if (!user) return;
      setIsSaving(true);
      try {
          await api.post('/api/data', dataToSave);
      } catch (error) {
          console.error("Save Failed:", error);
      } finally {
          setIsSaving(false);
      }
  };

  const updateAndSave = (updates) => {
      // Local Update
      if (updates.subjects) setSubjects(updates.subjects);
      if (updates.categories) setCategories(updates.categories);
      if (updates.libraryFiles) setLibraryFiles(updates.libraryFiles);
      if (updates.libraryFolders) setLibraryFolders(updates.libraryFolders);
      if (updates.flashcards) setFlashcards(updates.flashcards);
      // Note: We handle userProfile differently now (separate endpoint)

      // Server Update (App Data)
      const currentData = {
          subjects: updates.subjects || subjects,
          categories: updates.categories || categories,
          libraryFiles: updates.libraryFiles || libraryFiles,
          libraryFolders: updates.libraryFolders || libraryFolders,
          flashcards: updates.flashcards || flashcards,
      };
      saveData(currentData);
  };

  // --- 3. UPDATE USER PROFILE ---
  const updateUserProfile = async (newProfileData) => {
      // 1. Optimistic UI Update (Instant feedback)
      const updatedProfile = { ...userProfile, ...newProfileData };
      setUserProfile(updatedProfile);

      // 2. Send to Backend
      try {
          // This matches ChatGPT's route: router.post('/profile') mounted at /api/user
          const res = await api.post('/api/user/profile', newProfileData);
          
          // 3. Confirm with Server Response
          if (res.data) {
              setUserProfile({
                  displayName: res.data.displayName,
                  photo: res.data.photo
              });
              // Update local cache too so it persists on reload even if offline
              localStorage.setItem('academiaZenProfile', JSON.stringify({
                  displayName: res.data.displayName,
                  photo: res.data.photo
              }));
          }
      } catch (error) {
          console.error("Failed to update profile:", error);
          alert("Failed to save profile changes. Please try again.");
      }
  };

  useEffect(() => {
    localStorage.setItem('academiaZenTheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const enableNotifications = async () => {
    if ("Notification" in window) {
        const p = await Notification.requestPermission();
        if(p==='granted') new Notification("Reminders On");
    }
  };

  // --- CRUD ACTIONS ---
  const addSubject = (name) => {
    const newSubjects = [...subjects, {id: Date.now().toString(), name, tasks: [], note: "", resources: [], grades: {target: '', current: ''}}];
    updateAndSave({ subjects: newSubjects });
  };

  const updateSubjectName = (id, name) => {
    const newSubjects = subjects.map(s => s.id === id ? { ...s, name } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const deleteSubject = (id) => {
    const newSubjects = subjects.filter(s => s.id !== id);
    updateAndSave({ subjects: newSubjects });
  };

  const addTask = (subjectId, task) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? {
      ...s, 
      tasks: [...s.tasks, { ...task, id: Date.now().toString(), completed: false }]
    } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const updateTask = (subjectId, taskId, updates) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? {
      ...s,
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const deleteTask = (subjectId, taskId) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? {
      ...s,
      tasks: s.tasks.filter(t => t.id !== taskId)
    } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const toggleTaskComplete = (subjectId, taskId) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? {
      ...s,
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const updateNote = (subjectId, note) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? { ...s, note } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const addResource = (subjectId, resource) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? {
      ...s, resources: [...(s.resources || []), { ...resource, id: Date.now() }]
    } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const deleteResource = (subjectId, resourceId) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? {
      ...s, resources: (s.resources || []).filter(r => r.id !== resourceId)
    } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const updateGrade = (subjectId, type, value) => {
    const newSubjects = subjects.map(s => s.id === subjectId ? { 
      ...s, grades: { ...s.grades, [type]: value } 
    } : s);
    updateAndSave({ subjects: newSubjects });
  };

  const addCategory = (cat) => {
    if (cat.trim() && !categories.includes(cat.trim())) {
        updateAndSave({ categories: [...categories, cat.trim()] });
    }
  };

  const deleteCategory = (cat) => {
    if (categories.length > 1) {
        updateAndSave({ categories: categories.filter(c => c !== cat) });
    }
  };

  const addLibraryFolder = (name) => {
    const newFolders = [...libraryFolders, { id: Date.now().toString(), name }];
    updateAndSave({ libraryFolders: newFolders });
  };

  const deleteLibraryFolder = (folderId) => {
    const newFolders = libraryFolders.filter(f => f.id !== folderId);
    const newFiles = libraryFiles.filter(f => f.folderId !== folderId);
    updateAndSave({ libraryFolders: newFolders, libraryFiles: newFiles });
  };

  const addFile = (fileObj, folderId) => {
    const newFiles = [...libraryFiles, { ...fileObj, folderId: folderId, id: Date.now().toString() }];
    updateAndSave({ libraryFiles: newFiles });
  };

  const deleteFile = (fileId) => {
    const newFiles = libraryFiles.filter(f => f.id !== fileId);
    updateAndSave({ libraryFiles: newFiles });
  };

  const addFlashcard = (subjectId, question, answer) => {
    const newCards = [...flashcards, { id: Date.now().toString(), subjectId, question, answer, mastery: 0 }];
    updateAndSave({ flashcards: newCards });
  };

  const updateFlashcard = (cardId, updates) => {
    const newCards = flashcards.map(c => c.id === cardId ? { ...c, ...updates } : c);
    updateAndSave({ flashcards: newCards });
  };

  const deleteFlashcard = (cardId) => {
    const newCards = flashcards.filter(c => c.id !== cardId);
    updateAndSave({ flashcards: newCards });
  };

  const openModal = (type, item = null) => {
    setEditingItem(item);
    setActiveModal(type);
  };

  return {
    subjects, categories, darkMode, setDarkMode, isLoaded, isSaving,
    activeSubjectId, setActiveSubjectId, 
    activeModal, setActiveModal, openModal, editingItem,
    libraryFiles, libraryFolders, flashcards,
    userProfile, // Export user profile state
    addSubject, updateSubjectName, deleteSubject, 
    addTask, updateTask, deleteTask, toggleTaskComplete,
    updateNote, addResource, deleteResource, updateGrade,
    addCategory, deleteCategory,
    addLibraryFolder, deleteLibraryFolder,
    addFile, deleteFile,
    addFlashcard, updateFlashcard, deleteFlashcard,
    updateUserProfile, // Export update function
    enableNotifications
  };
};