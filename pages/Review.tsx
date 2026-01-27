import React, { useState, useEffect } from 'react';
import { useZen } from '../context/ZenContext';
import { generateId } from '../utils/helpers';
import { IconPlus, IconRefresh, IconChevronLeft, IconChevronRight, IconTrash, IconEdit } from '../components/Icons';
import { Flashcard, Subject } from '../types';
import ConfirmModal from '../components/ConfirmModal';

const Review: React.FC = () => {
  const { state, addFlashcard, updateFlashcard, addSubject, updateSubject, deleteSubject, deleteFlashcard, setHideNavbar } = useZen();
  const { flashcards, subjects } = state;
  
  // Navigation States
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  
  // Editing Subject
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  
  // Creation Flow
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  // Editing Card
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  
  // Review Session State
  const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  
  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  // Hide navbar during review session or creating cards
  useEffect(() => {
    setHideNavbar(sessionActive || isCreatingCard || editingCard !== null);
  }, [sessionActive, isCreatingCard, editingCard, setHideNavbar]);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const filteredFlashcards = flashcards.filter(f => f.subjectId === selectedSubjectId);
  
  // Sort cards by review date or creation
  const sortedCards = [...filteredFlashcards].sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const colors = ['bg-zen-primary', 'bg-zen-secondary', 'bg-blue-400', 'bg-rose-400', 'bg-amber-400', 'bg-purple-400', 'bg-cyan-400'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newSubId = generateId();
    addSubject({
        id: newSubId,
        name: newSubjectName,
        color: randomColor
    });
    setNewSubjectName('');
    setIsCreatingSubject(false);
  };

  const handleUpdateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubjectId || !editSubjectName.trim()) return;
    const subj = subjects.find(s => s.id === editingSubjectId);
    if (subj) {
        updateSubject({ ...subj, name: editSubjectName });
    }
    setEditingSubjectId(null);
    setEditSubjectName('');
  };

  const handleDeleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({
        isOpen: true,
        title: 'Delete Flashcard Set',
        message: 'This operation will permanently remove this set and all contained flashcards.',
        action: () => {
            deleteSubject(id);
            if (selectedSubjectId === id) setSelectedSubjectId(null);
        }
    });
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim() || !selectedSubjectId) return;
    
    addFlashcard({
        id: generateId(),
        subjectId: selectedSubjectId,
        front: newFront,
        back: newBack,
        box: 0,
        nextReviewDate: new Date().toISOString()
    });
    setNewFront('');
    setNewBack('');
    // Keep dialog open for rapid entry
    const input = document.getElementById('new-front-input');
    if (input) input.focus();
  };

  const handleUpdateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard || !editFront.trim() || !editBack.trim()) return;
    updateFlashcard({
        ...editingCard,
        front: editFront,
        back: editBack
    });
    setEditingCard(null);
  };

  const handleDeleteCard = (id: string) => {
    setConfirmState({
        isOpen: true,
        title: 'Delete Card',
        message: 'Remove this card from the deck?',
        action: () => {
            deleteFlashcard(id);
            setEditingCard(null);
        }
    });
  };

  const startEditCard = (card: Flashcard) => {
      setEditingCard(card);
      setEditFront(card.front);
      setEditBack(card.back);
  };

  const handleRating = (rating: 'again' | 'good' | 'easy') => {
      const currentCard = sessionQueue[currentCardIndex];
      updateFlashcard({
          ...currentCard,
          box: Math.min(5, currentCard.box + (rating === 'again' ? -1 : rating === 'easy' ? 2 : 1)),
          nextReviewDate: new Date().toISOString() 
      });

      setIsFlipped(false);
      if (currentCardIndex < sessionQueue.length - 1) {
          setCurrentCardIndex(prev => prev + 1);
      } else {
          setSessionActive(false);
      }
  };

  const startSession = () => {
      if (filteredFlashcards.length > 0) {
          setSessionQueue(sortedCards);
          setSessionActive(true);
          setCurrentCardIndex(0);
          setIsFlipped(false);
      }
  };

  // --- 1. Session View (Immersive) ---
  if (sessionActive && sessionQueue.length > 0) {
      const card = sessionQueue[currentCardIndex];
      const progress = ((currentCardIndex) / sessionQueue.length) * 100;
      
      return (
          <div className="fixed inset-0 bg-zen-bg z-50 flex flex-col items-center justify-center p-6 animate-reveal">
              {/* Progress Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-zen-surface">
                  <div className="h-full bg-zen-primary transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>

              {/* Header */}
              <div className="w-full max-w-2xl flex justify-between items-center mb-8 absolute top-6 px-6">
                  <button onClick={() => setSessionActive(false)} className="p-2 -ml-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors flex items-center gap-2 group">
                      <IconChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                      <span className="text-sm font-medium">End Session</span>
                  </button>
                  <span className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest bg-zen-surface/50 px-3 py-1 rounded-full border border-zen-surface">
                      {currentCardIndex + 1} / {sessionQueue.length}
                  </span>
              </div>
              
              {/* Card */}
              <div 
                className="w-full max-w-xl aspect-[1.4/1] md:aspect-[2/1] perspective-1000 cursor-pointer group"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                  <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                      {/* Front */}
                      <div className="absolute inset-0 backface-hidden bg-zen-card rounded-[1.5rem] md:rounded-[2rem] border border-zen-surface flex flex-col items-center justify-center p-6 md:p-12 shadow-2xl group-hover:border-zen-primary/30 transition-colors">
                          <p className="text-xl md:text-3xl text-center font-light leading-relaxed text-zen-text-primary selection:bg-zen-primary/30 overflow-y-auto max-h-full no-scrollbar">{card.front}</p>
                          <span className="absolute bottom-6 md:bottom-8 text-[10px] text-zen-text-disabled uppercase tracking-[0.3em] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Click to reveal</span>
                      </div>
                      
                      {/* Back */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#1a1f26] rounded-[1.5rem] md:rounded-[2rem] border border-zen-primary/30 flex items-center justify-center p-6 md:p-12 shadow-2xl shadow-zen-primary/5">
                          <p className="text-lg md:text-2xl text-center text-zen-primary leading-relaxed font-medium selection:bg-white/20 overflow-y-auto max-h-full no-scrollbar">{card.back}</p>
                      </div>
                  </div>
              </div>

              {/* Controls */}
              <div className="w-full max-w-md mt-8 md:mt-12 flex items-center justify-center pb-8 safe-area-bottom">
                  {isFlipped ? (
                      <div className="grid grid-cols-3 gap-3 md:gap-4 w-full animate-slide-up">
                          <button onClick={() => handleRating('again')} className="py-3 md:py-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 hover:scale-105 transition-all active:scale-95">Hard</button>
                          <button onClick={() => handleRating('good')} className="py-3 md:py-4 rounded-xl bg-zen-surface text-zen-text-primary border border-zen-surface text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-zen-surface/80 hover:scale-105 transition-all active:scale-95">Good</button>
                          <button onClick={() => handleRating('easy')} className="py-3 md:py-4 rounded-xl bg-zen-primary/10 text-zen-primary border border-zen-primary/20 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-zen-primary/20 hover:scale-105 transition-all active:scale-95">Easy</button>
                      </div>
                  ) : (
                      <p className="text-zen-text-disabled text-sm animate-pulse">Tap card to see answer</p>
                  )}
              </div>
          </div>
      );
  }

  // --- 2. Create/Edit Card Modal ---
  const isEditing = editingCard !== null;
  const showModal = isCreatingCard || isEditing;
  
  if (showModal) {
      return (
          <div className="fixed inset-0 bg-zen-bg z-50 flex flex-col p-4 md:p-6 lg:p-12 animate-reveal overflow-y-auto">
              <div className="mx-auto w-full max-w-2xl flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <button onClick={() => { setIsCreatingCard(false); setEditingCard(null); }} className="p-2 -ml-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors rounded-full hover:bg-zen-surface">
                            <IconChevronLeft className="w-6 h-6" />
                        </button>
                        <h2 className="text-2xl font-light text-zen-text-primary">{isEditing ? 'Edit Card' : 'New Flashcard'}</h2>
                      </div>
                      {isEditing && (
                          <button 
                            type="button" 
                            onClick={() => handleDeleteCard(editingCard!.id)}
                            className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                              <IconTrash className="w-5 h-5" />
                          </button>
                      )}
                  </div>

                  <form onSubmit={isEditing ? handleUpdateCard : handleCreateCard} className="flex-1 flex flex-col gap-6">
                      <div className="space-y-3 group">
                          <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-bold ml-1 group-focus-within:text-zen-primary transition-colors">Front (Question)</label>
                          <div className="relative">
                            <textarea 
                                id="new-front-input"
                                autoFocus
                                value={isEditing ? editFront : newFront}
                                onChange={e => isEditing ? setEditFront(e.target.value) : setNewFront(e.target.value)}
                                className="w-full h-32 bg-zen-card rounded-2xl p-5 text-lg text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 resize-none border border-zen-surface transition-all placeholder:text-zen-text-disabled/30"
                                placeholder="Concept, term, or question..."
                            />
                            <div className="absolute right-4 bottom-4 text-[10px] text-zen-text-disabled uppercase font-bold bg-zen-surface/50 px-2 py-1 rounded">Front</div>
                          </div>
                      </div>

                      <div className="space-y-3 group">
                          <label className="text-xs text-zen-text-secondary uppercase tracking-wider font-bold ml-1 group-focus-within:text-zen-primary transition-colors">Back (Answer)</label>
                          <div className="relative">
                            <textarea 
                                value={isEditing ? editBack : newBack}
                                onChange={e => isEditing ? setEditBack(e.target.value) : setNewBack(e.target.value)}
                                className="w-full h-32 bg-zen-card rounded-2xl p-5 text-lg text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 resize-none border border-zen-surface transition-all placeholder:text-zen-text-disabled/30"
                                placeholder="Definition, explanation, or answer..."
                            />
                            <div className="absolute right-4 bottom-4 text-[10px] text-zen-text-disabled uppercase font-bold bg-zen-surface/50 px-2 py-1 rounded">Back</div>
                          </div>
                      </div>

                      <div className="mt-8 flex gap-4">
                          <button 
                             type="button" 
                             onClick={() => { setIsCreatingCard(false); setEditingCard(null); }}
                             className="flex-1 py-4 text-zen-text-secondary hover:text-zen-text-primary transition-colors font-medium"
                          >
                             Cancel
                          </button>
                          <button 
                             type="submit" 
                             className="flex-[2] py-4 rounded-xl bg-zen-primary text-zen-bg font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                          >
                             {isEditing ? 'Save Changes' : 'Create Card'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      );
  }

  // --- 3. Subject Detail View ---
  if (selectedSubject) {
      const mastery = filteredFlashcards.length === 0 ? 0 : (filteredFlashcards.filter(f => f.box >= 4).length / filteredFlashcards.length) * 100;
      
      return (
          <div className="h-full w-full flex flex-col bg-zen-bg animate-reveal overflow-y-auto no-scrollbar desktop-scroll-area p-0 md:p-10 pb-24 md:pb-24">
              {/* Header (Sticky on Mobile) */}
              <div className="sticky top-0 z-20 bg-zen-bg/80 backdrop-blur-xl md:static md:bg-transparent p-4 md:p-0 border-b border-zen-surface/30 md:border-none mb-4 md:mb-8">
                <div className="max-w-6xl mx-auto w-full">
                    <button 
                        onClick={() => setSelectedSubjectId(null)}
                        className="flex items-center gap-2 text-zen-text-secondary hover:text-zen-text-primary mb-4 md:mb-6 transition-all group w-fit hover:bg-zen-surface/50 px-3 py-1.5 rounded-lg -ml-3"
                    >
                        <IconChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">All Sets</span>
                    </button>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-3 h-3 rounded-full ${selectedSubject.color}`} />
                                <span className="text-xs font-bold text-zen-text-disabled uppercase tracking-widest">Flashcard Set</span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-light text-zen-text-primary tracking-tight leading-tight">{selectedSubject.name}</h2>
                            <p className="text-zen-text-secondary mt-2 text-sm md:text-base">{filteredFlashcards.length} cards &bull; {Math.round(mastery)}% Mastered</p>
                        </div>
                        
                        <div className="hidden md:flex gap-3 w-full md:w-auto">
                            <button 
                                onClick={startSession}
                                disabled={filteredFlashcards.length === 0}
                                className="flex-1 md:flex-none px-8 py-3 bg-zen-primary text-zen-bg rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zen-primary/20"
                            >
                                <IconRefresh className="w-4 h-4" />
                                Study Now
                            </button>
                            <button 
                                onClick={() => setIsCreatingCard(true)}
                                className="px-4 py-3 bg-zen-card border border-zen-surface text-zen-text-primary rounded-xl hover:border-zen-primary hover:text-zen-primary transition-all active:scale-95"
                                title="Add Card"
                            >
                                <IconPlus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
              </div>

              {/* Card Grid */}
              <div className="px-4 md:px-0 max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 md:pb-0">
                  {/* Add New Card (Inline Button) */}
                  <button 
                    onClick={() => setIsCreatingCard(true)}
                    className="min-h-[160px] md:min-h-[200px] rounded-[1.5rem] border-2 border-dashed border-zen-surface hover:border-zen-primary/50 flex flex-col items-center justify-center gap-3 group transition-all bg-transparent hover:bg-zen-card/30"
                  >
                        <div className="w-12 h-12 rounded-full bg-zen-surface group-hover:bg-zen-primary text-zen-text-secondary group-hover:text-zen-bg flex items-center justify-center transition-colors">
                            <IconPlus className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-zen-text-secondary uppercase tracking-wider">Add Flashcard</span>
                  </button>

                  {sortedCards.map((card, idx) => (
                      <div 
                        key={card.id}
                        onClick={() => startEditCard(card)}
                        className="group relative bg-zen-card hover:bg-zen-surface/40 p-6 md:p-8 rounded-[1.5rem] border border-zen-surface hover:border-zen-primary/30 transition-all cursor-pointer min-h-[160px] md:min-h-[200px] flex flex-col justify-between hover:-translate-y-1 hover:shadow-xl animate-reveal"
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      > 
                          <div className="absolute top-4 right-4 text-[10px] font-bold text-zen-text-disabled uppercase bg-zen-surface/50 px-2 py-1 rounded opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">Edit</div>
                          
                          <p className="text-xl md:text-2xl text-zen-text-primary font-light line-clamp-3 mb-4 leading-snug">{card.front}</p>
                          
                          <div className="border-t border-zen-surface/50 pt-4 mt-auto">
                              <p className="text-sm md:text-base text-zen-text-secondary line-clamp-2">{card.back}</p>
                          </div>
                          
                          {/* Mastery Indicator */}
                          <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-[1.5rem] ${
                              card.box >= 4 ? 'bg-zen-primary' : 
                              card.box >= 2 ? 'bg-yellow-400' : 'bg-zen-surface'
                          }`} />
                      </div>
                  ))}
              </div>

               {/* Mobile Floating Action Bar */}
               <div className="md:hidden fixed bottom-24 left-4 right-4 z-30 flex gap-3">
                    <button 
                        onClick={startSession}
                        disabled={filteredFlashcards.length === 0}
                        className="flex-1 py-4 bg-zen-primary text-zen-bg rounded-2xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-lg shadow-zen-primary/30 active:scale-95 transition-transform disabled:opacity-50 disabled:grayscale"
                    >
                        <IconRefresh className="w-5 h-5" />
                        Study Now
                    </button>
                    <button 
                        onClick={() => setIsCreatingCard(true)}
                        className="w-14 bg-zen-card border border-zen-surface text-zen-text-primary rounded-2xl flex items-center justify-center hover:bg-zen-surface active:scale-95 transition-all shadow-lg"
                    >
                        <IconPlus className="w-6 h-6" />
                    </button>
               </div>
          </div>
      );
  }

  // --- 4. Create Subject Modal ---
  if (isCreatingSubject) {
    return (
        <div className="fixed inset-0 bg-zen-bg/80 backdrop-blur-xl z-[60] flex items-center justify-center p-6 animate-reveal">
            <div className="w-full max-w-md bg-zen-card p-8 rounded-[2.5rem] border border-zen-primary/30 shadow-2xl shadow-zen-primary/10">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-light text-zen-text-primary">New Study Set</h2>
                    <button onClick={() => setIsCreatingSubject(false)} className="p-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors">
                        <IconChevronLeft className="w-5 h-5 rotate-90" />
                    </button>
                </div>

                <form onSubmit={handleCreateSubject} className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-xs text-zen-text-disabled uppercase tracking-widest font-bold ml-1">Set Name</label>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="e.g., Organic Chemistry..."
                            className="w-full bg-zen-surface rounded-2xl p-4 text-lg text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/30 border border-zen-surface transition-all placeholder:text-zen-text-disabled/30"
                            value={newSubjectName}
                            onChange={e => setNewSubjectName(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setIsCreatingSubject(false)} className="flex-1 py-4 text-zen-text-secondary font-medium hover:text-zen-text-primary transition-colors">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={!newSubjectName.trim()} 
                            className="flex-[2] py-4 rounded-xl bg-zen-primary text-zen-bg font-bold uppercase tracking-wider text-sm shadow-lg shadow-zen-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            Create Set
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
  }

  // --- 5. Main Dashboard ---
  return (
    <div className="h-full w-full flex flex-col bg-zen-bg animate-reveal overflow-y-auto no-scrollbar desktop-scroll-area p-4 md:p-6 lg:p-10 pb-24">
       <div className="max-w-6xl mx-auto w-full">
           
           {/* Mobile Header (Visible only on small screens) */}
           <div className="md:hidden py-4 mb-4 border-b border-zen-surface/30">
               <h2 className="text-3xl font-light text-zen-text-primary tracking-tight">Review</h2>
               <p className="text-sm text-zen-text-secondary mt-1">Spaced Repetition System</p>
           </div>

           {/* Desktop Header */}
           <div className="hidden md:block py-6 md:py-10 lg:py-16 space-y-2 md:space-y-4 text-left">
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-extralight text-zen-text-primary tracking-tight">Active Recall</h2>
                <p className="text-zen-text-secondary font-light text-sm md:text-lg max-w-lg">
                    Strengthen your neural pathways through spaced repetition.
                </p>
           </div>

           {/* Stats Overview */}
           <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-16">
               <div className="bg-zen-card hover:bg-zen-surface/30 p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-zen-surface/50 transition-all">
                   <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.2em] font-bold mb-2 md:mb-4">Total</p>
                   <div className="flex items-end gap-1 md:gap-2">
                       <p className="text-2xl md:text-4xl text-zen-text-primary font-light leading-none">{flashcards.length}</p>
                       <p className="text-[10px] md:text-sm text-zen-text-disabled mb-1 font-medium">Cards</p>
                   </div>
               </div>
               
               <div className="bg-zen-card hover:bg-zen-surface/30 p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-zen-surface/50 transition-all">
                   <p className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.2em] font-bold mb-2 md:mb-4">Due</p>
                   <div className="flex items-end gap-1 md:gap-2">
                       <p className="text-2xl md:text-4xl text-zen-primary font-light leading-none">{flashcards.filter(f => new Date(f.nextReviewDate) <= new Date()).length}</p>
                       <p className="text-[10px] md:text-sm text-zen-text-disabled mb-1 font-medium">Now</p>
                   </div>
               </div>

               <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-zen-primary/10 to-transparent p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-zen-primary/20 backdrop-blur-sm relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all flex items-center justify-between md:flex-col md:items-start md:gap-8" onClick={() => setIsCreatingSubject(true)}>
                   <div className="relative z-10 flex flex-col justify-center">
                       <p className="text-[10px] md:text-xs text-zen-primary uppercase tracking-[0.2em] font-bold mb-1 md:mb-4">Quick Action</p>
                       <p className="text-base md:text-xl text-zen-text-primary font-medium tracking-tight">Create Set</p>
                   </div>
                   <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zen-primary text-zen-bg flex items-center justify-center group-hover:rotate-90 transition-transform duration-500 shadow-lg relative z-10 md:mt-auto">
                        <IconPlus className="w-5 h-5 md:w-6 md:h-6" />
                   </div>
                   <div className="absolute inset-0 bg-zen-primary/5 group-hover:bg-zen-primary/10 transition-colors" />
               </div>
           </div>

           {/* Sets Grid */}
           <div className="space-y-4 md:space-y-8">
                <div className="flex items-center justify-between border-b border-zen-surface/30 pb-2 md:pb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg md:text-2xl font-light text-zen-text-primary tracking-tight">Sets</h3>
                        <span className="bg-zen-surface/50 text-zen-text-disabled text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-tighter">
                            {subjects.length}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    {subjects.map((subject, idx) => {
                        const count = flashcards.filter(f => f.subjectId === subject.id).length;
                        const isEditing = editingSubjectId === subject.id;

                        if (isEditing) {
                            return (
                                <form key={subject.id} onSubmit={handleUpdateSubject} className="bg-zen-card p-6 rounded-3xl border border-zen-primary/50 shadow-xl relative animate-reveal">
                                    <input 
                                        autoFocus
                                        type="text"
                                        value={editSubjectName}
                                        onChange={e => setEditSubjectName(e.target.value)}
                                        className="w-full bg-zen-surface rounded-lg px-3 py-2 text-zen-text-primary mb-4 focus:outline-none focus:ring-1 focus:ring-zen-primary"
                                    />
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-zen-primary text-zen-bg rounded-lg py-2 text-xs font-bold uppercase">Save</button>
                                        <button type="button" onClick={() => setEditingSubjectId(null)} className="flex-1 bg-zen-surface text-zen-text-secondary rounded-lg py-2 text-xs font-bold uppercase">Cancel</button>
                                    </div>
                                </form>
                            );
                        }

                        return (
                          <div 
                            key={subject.id} 
                            onClick={() => setSelectedSubjectId(subject.id)}
                            className="group relative bg-zen-card hover:bg-zen-surface/40 p-5 md:p-8 pt-12 md:pt-8 rounded-3xl md:rounded-[2rem] border border-zen-surface hover:border-zen-primary/30 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-xl aspect-auto flex flex-col justify-between overflow-hidden animate-reveal min-h-[160px] md:min-h-[180px]"
                            style={{ animationDelay: `${idx * 0.05}s` }}
                          >
                            {/* Actions (Always visible on mobile, Hover on desktop) */}
                            <div className="absolute top-3 right-3 md:top-4 md:right-4 flex gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingSubjectId(subject.id); setEditSubjectName(subject.name); }}
                                    className="p-2 bg-zen-bg/80 text-zen-text-secondary hover:text-zen-primary rounded-full backdrop-blur-sm"
                                >
                                    <IconEdit className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteSubject(subject.id, e)}
                                    className="p-2 bg-zen-bg/80 text-zen-text-secondary hover:text-red-400 rounded-full backdrop-blur-sm"
                                >
                                    <IconTrash className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center md:block gap-4 md:gap-0">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl ${subject.color} mb-0 md:mb-4 flex items-center justify-center shadow-lg shadow-black/10 shrink-0`}>
                                    <span className="text-zen-bg font-bold text-lg">{subject.name.charAt(0)}</span>
                                </div>
                                <h4 className="text-lg md:text-2xl font-medium text-zen-text-primary tracking-tight leading-tight line-clamp-1 md:line-clamp-2 md:min-h-[3rem]">{subject.name}</h4>
                            </div>
                            
                            <div className="flex items-end justify-between border-t border-zen-surface/50 pt-3 md:pt-4 mt-3 md:mt-auto">
                                <div>
                                    <p className="text-xl md:text-3xl font-light text-zen-text-primary">{count}</p>
                                    <p className="text-[10px] text-zen-text-disabled uppercase tracking-widest font-bold">Cards</p>
                                </div>
                                <div className="p-2 rounded-full bg-zen-surface group-hover:bg-zen-primary group-hover:text-zen-bg text-zen-text-secondary transition-colors">
                                    <IconChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                                </div>
                            </div>

                            {/* Decorative Blur */}
                            <div className={`absolute -bottom-10 -right-10 w-24 h-24 md:w-32 md:h-32 ${subject.color} opacity-5 blur-3xl rounded-full group-hover:opacity-10 transition-opacity`} />
                          </div>
                        );
                    })}
                    
                    {/* Add New Set (Grid Item) */}
                    <button 
                        onClick={() => setIsCreatingSubject(true)}
                        className="hidden md:flex rounded-[2rem] border-2 border-dashed border-zen-surface hover:border-zen-primary/50 hover:bg-zen-surface/10 transition-all flex-col items-center justify-center gap-4 text-zen-text-disabled hover:text-zen-primary min-h-[200px]"
                    >
                        <div className="w-14 h-14 rounded-full bg-zen-surface group-hover:bg-zen-primary flex items-center justify-center">
                            <IconPlus className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">Create New Set</span>
                    </button>
                </div>
           </div>

           <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.action}
                title={confirmState.title}
                message={confirmState.message}
                isDangerous
                confirmText="Delete"
           />
       </div>
    </div>
  );
};

export default Review;
