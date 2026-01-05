import React, { useState, useEffect } from 'react';
import { useZen } from '../context/ZenContext';
import { generateId } from '../utils/helpers';
import { IconPlus, IconRefresh, IconChevronLeft, IconChevronRight, IconCheck } from '../components/Icons';
import { Flashcard, Subject } from '../types';

const Review: React.FC = () => {
  const { state, addFlashcard, updateFlashcard, addSubject, setHideNavbar } = useZen();
  const { flashcards, subjects } = state;
  
  // Navigation States
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  
  // Creation Flow
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  
  // Review Session State
  const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  // Hide navbar during review session or creating cards
  useEffect(() => {
    setHideNavbar(sessionActive || isCreatingCard);
  }, [sessionActive, isCreatingCard, setHideNavbar]);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const filteredFlashcards = flashcards.filter(f => f.subjectId === selectedSubjectId);

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const colors = ['bg-zen-primary', 'bg-zen-secondary', 'bg-blue-400', 'bg-rose-400', 'bg-amber-400'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newSubId = generateId();
    addSubject({
        id: newSubId,
        name: newSubjectName,
        color: randomColor
    });
    setNewSubjectName('');
    setIsCreatingSubject(false);
    setSelectedSubjectId(newSubId); // Auto-navigate to the new subject
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
    setIsCreatingCard(false);
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
          setSessionQueue(filteredFlashcards);
          setSessionActive(true);
          setCurrentCardIndex(0);
          setIsFlipped(false);
      }
  };

  // --- 1. Session View ---
  if (sessionActive && sessionQueue.length > 0) {
      const card = sessionQueue[currentCardIndex];
      return (
          <div className="p-8 h-full flex flex-col items-center justify-between pb-28 bg-zen-bg animate-reveal">
              <div className="w-full flex justify-between items-center mb-6">
                  <button onClick={() => setSessionActive(false)} className="p-2 -ml-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors">
                      <IconChevronLeft className="w-7 h-7" />
                  </button>
                  <span className="text-xs font-bold text-zen-text-disabled uppercase tracking-[0.2em]">
                      {selectedSubject?.name} &bull; {currentCardIndex + 1}/{sessionQueue.length}
                  </span>
                  <div className="w-10" /> {/* Spacer */}
              </div>
              
              <div 
                className="w-full max-w-sm aspect-[4/5] perspective-1000 cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                  <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                      {/* Front */}
                      <div className="absolute inset-0 backface-hidden bg-zen-card rounded-[2.5rem] border border-zen-surface flex flex-col items-center justify-center p-12 shadow-2xl">
                          <p className="text-3xl text-center font-light leading-relaxed text-zen-text-primary">{card.front}</p>
                          <span className="absolute bottom-12 text-[10px] text-zen-primary uppercase tracking-[0.3em] font-bold animate-pulse">Tap to reveal</span>
                      </div>
                      
                      {/* Back */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#1a1f26] rounded-[2.5rem] border border-zen-primary/30 flex items-center justify-center p-12 shadow-2xl">
                          <p className="text-2xl text-center text-zen-primary leading-relaxed font-medium">{card.back}</p>
                      </div>
                  </div>
              </div>

              <div className="w-full max-w-sm h-20 mt-8">
                  {isFlipped && (
                      <div className="grid grid-cols-3 gap-4 animate-slide-up">
                          <button onClick={() => handleRating('again')} className="py-5 rounded-2xl bg-zen-destructive/10 text-zen-destructive border border-zen-destructive/20 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-zen-destructive/20 transition-all active:scale-95">Again</button>
                          <button onClick={() => handleRating('good')} className="py-5 rounded-2xl bg-zen-surface text-zen-text-primary border border-zen-surface text-[10px] font-black uppercase tracking-[0.15em] hover:bg-zen-surface/80 transition-all active:scale-95">Good</button>
                          <button onClick={() => handleRating('easy')} className="py-5 rounded-2xl bg-zen-primary/10 text-zen-primary border border-zen-primary/20 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-zen-primary/20 transition-all active:scale-95">Easy</button>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- 2. Add Card Form ---
  if (isCreatingCard) {
      return (
          <div className="p-8 h-full flex flex-col animate-reveal bg-zen-bg">
              <div className="flex items-center gap-5 mb-10">
                  <button onClick={() => setIsCreatingCard(false)} className="p-2 -ml-2 text-zen-text-secondary hover:text-zen-text-primary transition-colors">
                      <IconChevronLeft className="w-7 h-7" />
                  </button>
                  <h2 className="text-2xl font-light text-zen-text-primary">New for {selectedSubject?.name}</h2>
              </div>
              <form onSubmit={handleCreateCard} className="flex-1 flex flex-col gap-8">
                  <div className="space-y-4">
                      <label className="text-[10px] text-zen-text-disabled uppercase tracking-[0.2em] font-bold ml-1">Question / Term</label>
                      <textarea 
                          autoFocus
                          value={newFront}
                          onChange={e => setNewFront(e.target.value)}
                          className="w-full h-40 bg-zen-card rounded-[2rem] p-7 text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/20 resize-none border border-zen-surface transition-all placeholder:text-zen-text-disabled/50"
                          placeholder="What is the concept you want to master?"
                      />
                  </div>
                  <div className="space-y-4">
                      <label className="text-[10px] text-zen-text-disabled uppercase tracking-[0.2em] font-bold ml-1">Answer / Definition</label>
                      <textarea 
                          value={newBack}
                          onChange={e => setNewBack(e.target.value)}
                          className="w-full h-40 bg-zen-card rounded-[2rem] p-7 text-zen-text-primary focus:outline-none focus:ring-2 focus:ring-zen-primary/20 resize-none border border-zen-surface transition-all placeholder:text-zen-text-disabled/50"
                          placeholder="Provide a clear, concise explanation..."
                      />
                  </div>
                  <div className="mt-auto pt-6">
                      <button type="submit" className="w-full py-5 rounded-[1.5rem] bg-zen-primary text-zen-bg font-black uppercase tracking-[0.1em] text-sm shadow-xl shadow-zen-primary/10 hover:scale-[1.02] active:scale-95 transition-all">Create Card</button>
                  </div>
              </form>
          </div>
      );
  }

  // --- 3. Subject Detail View ---
  if (selectedSubject) {
      const mastery = filteredFlashcards.length === 0 ? 0 : (filteredFlashcards.filter(f => f.box >= 4).length / filteredFlashcards.length) * 100;
      return (
          <div className="p-8 h-full flex flex-col bg-zen-bg animate-reveal">
              <button 
                  onClick={() => setSelectedSubjectId(null)}
                  className="flex items-center gap-3 text-zen-text-secondary hover:text-zen-text-primary mb-10 transition-all group p-1 -ml-1"
              >
                  <IconChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-sm font-medium">Back to Study Sets</span>
              </button>

              <div className="mb-12">
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`w-4 h-4 rounded-full ${selectedSubject.color}`} />
                    <h2 className="text-4xl font-light text-zen-text-primary tracking-tight">{selectedSubject.name}</h2>
                  </div>
                  <p className="text-base text-zen-text-secondary ml-8">{filteredFlashcards.length} flashcards in this collection</p>
              </div>

              <div className="space-y-6">
                  <div className="bg-zen-card p-10 rounded-[2.5rem] border border-zen-surface shadow-2xl relative overflow-hidden">
                      <div className="flex justify-between items-end mb-6 relative z-10">
                          <div>
                            <span className="text-5xl font-light text-zen-primary tracking-tighter">{Math.round(mastery)}%</span>
                            <p className="text-[10px] text-zen-text-disabled uppercase tracking-[0.25em] font-bold mt-2">Overall Mastery</p>
                          </div>
                          <IconRefresh className="w-10 h-10 text-zen-primary opacity-20" />
                      </div>
                      <div className="w-full h-2 bg-zen-surface rounded-full overflow-hidden relative z-10">
                          <div className={`h-full bg-zen-primary transition-all duration-1000 ease-out`} style={{ width: `${mastery}%` }} />
                      </div>
                      {/* Decorative background element */}
                      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-zen-primary/5 rounded-full blur-3xl" />
                  </div>

                  <div className="grid grid-cols-1 gap-5 pt-6">
                      <button 
                          onClick={startSession}
                          disabled={filteredFlashcards.length === 0}
                          className="w-full py-6 bg-zen-primary text-zen-bg rounded-[2rem] font-black uppercase tracking-[0.1em] text-sm flex items-center justify-center gap-4 disabled:opacity-50 shadow-2xl shadow-zen-primary/20 active:scale-95 transition-all"
                      >
                          <IconRefresh className="w-5 h-5" />
                          Start Review Session
                      </button>
                      <button 
                          onClick={() => setIsCreatingCard(true)}
                          className="w-full py-6 bg-zen-card text-zen-text-primary border border-zen-surface rounded-[2rem] font-black uppercase tracking-[0.1em] text-sm flex items-center justify-center gap-4 hover:border-zen-primary/50 transition-all active:scale-95"
                      >
                          <IconPlus className="w-5 h-5" />
                          Add New Flashcards
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- 4. Category Selector (Main View) ---
  return (
    <div className="p-8 h-full flex flex-col bg-zen-bg animate-reveal pb-28 overflow-y-auto no-scrollbar">
       <div className="mb-14 text-center space-y-3">
            <h2 className="text-4xl font-light text-zen-text-primary tracking-tight">Active Recall</h2>
            <p className="text-base text-zen-text-secondary font-light max-w-[240px] mx-auto">Select a category to strengthen your knowledge.</p>
       </div>

       <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center px-2 mb-2">
              <h3 className="text-[10px] text-zen-text-disabled uppercase tracking-[0.3em] font-black">Your Sets</h3>
              <button 
                onClick={() => setIsCreatingSubject(true)}
                className="text-zen-primary text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-80 transition-opacity"
              >
                  + Create New
              </button>
          </div>

          {isCreatingSubject && (
             <form onSubmit={handleCreateSubject} className="bg-zen-card p-8 rounded-[2rem] border border-zen-primary/30 animate-reveal shadow-xl mb-2">
                <input 
                    autoFocus
                    type="text" 
                    placeholder="Set Name (e.g. Molecular Biology)..."
                    className="w-full bg-transparent border-b border-zen-surface pb-3 text-lg text-zen-text-primary focus:outline-none focus:border-zen-primary transition-all mb-6 placeholder:text-zen-text-disabled/50"
                    value={newSubjectName}
                    onChange={e => setNewSubjectName(e.target.value)}
                />
                <div className="flex justify-end gap-5">
                    <button type="button" onClick={() => setIsCreatingSubject(false)} className="text-xs font-bold text-zen-text-secondary px-4 py-2 hover:text-zen-text-primary transition-colors">Cancel</button>
                    <button type="submit" className="text-xs bg-zen-primary text-zen-bg px-6 py-2.5 rounded-xl font-black uppercase tracking-wider shadow-lg shadow-zen-primary/10">Create Set</button>
                </div>
             </form>
          )}

          {subjects.map((subject, idx) => {
            const count = flashcards.filter(f => f.subjectId === subject.id).length;
            return (
              <button 
                key={subject.id} 
                onClick={() => setSelectedSubjectId(subject.id)}
                className={`bg-zen-card p-7 rounded-[2.2rem] border border-zen-surface/50 hover:border-zen-primary/50 transition-all text-left group animate-reveal stagger-${Math.min(idx + 1, 5)} active:scale-[0.97] flex items-center justify-between shadow-lg hover:shadow-zen-primary/5`}
              >
                <div className="flex items-center gap-5">
                    <div className={`w-3.5 h-3.5 rounded-full ${subject.color}`} />
                    <div>
                        <h4 className="font-medium text-zen-text-primary text-xl group-hover:text-zen-primary transition-colors tracking-tight">{subject.name}</h4>
                        <p className="text-xs text-zen-text-disabled font-bold uppercase tracking-widest mt-1.5 opacity-60">{count} Cards</p>
                    </div>
                </div>
                <div className="p-3 bg-zen-surface/30 rounded-2xl group-hover:bg-zen-primary/10 transition-colors">
                    <IconChevronRight className="w-5 h-5 text-zen-text-disabled group-hover:text-zen-primary transition-all group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
          
          {subjects.length === 0 && !isCreatingSubject && (
             <div className="py-24 text-center border-2 border-dashed border-zen-surface rounded-[3rem] animate-reveal opacity-50 px-8">
                 <div className="w-20 h-20 bg-zen-surface/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <IconRefresh className="w-10 h-10 text-zen-text-disabled" />
                 </div>
                 <p className="text-base text-zen-text-disabled leading-relaxed">Your library is empty.<br/>Create a study set to begin your journey.</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default Review;