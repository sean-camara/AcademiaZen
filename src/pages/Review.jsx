import React, { useState, useEffect } from 'react';
import { RotateCcw, ChevronRight, ChevronLeft, Plus, Trash2, BrainCircuit, Pencil, FolderCog } from 'lucide-react';
import { Button } from '../components/UI';

export default function Review({ controller, openModal }) {
  const { flashcards, deleteFlashcard, subjects, deleteSubject, darkMode } = controller;
  const [activeSubjectFilter, setActiveSubjectFilter] = useState('all');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [animClass, setAnimClass] = useState('');

  // Filter logic
  const filteredCards = activeSubjectFilter === 'all' 
    ? flashcards 
    : flashcards.filter(c => c.subjectId === activeSubjectFilter);

  const activeSubject = subjects.find(s => s.id === activeSubjectFilter);

  // Safety: If cards are deleted, ensure index is valid
  useEffect(() => {
    if (currentCardIndex >= filteredCards.length && filteredCards.length > 0) {
      setCurrentCardIndex(filteredCards.length - 1);
    }
  }, [filteredCards.length, currentCardIndex]);

  const currentCard = filteredCards[currentCardIndex];

  // --- Creative Card Animation Logic ---
  const handleNext = () => {
    if (filteredCards.length <= 1) return;
    setIsFlipped(false);
    setAnimClass('animate-toss-left'); 
    setTimeout(() => {
        setCurrentCardIndex((prev) => (prev + 1) % filteredCards.length);
        setAnimClass('animate-bouncy-in'); 
        setTimeout(() => setAnimClass(''), 400); 
    }, 200);
  };

  const handlePrev = () => {
    if (filteredCards.length <= 1) return;
    setIsFlipped(false);
    setAnimClass('animate-toss-right'); 
    setTimeout(() => {
        setCurrentCardIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length);
        setAnimClass('animate-bouncy-in'); 
        setTimeout(() => setAnimClass(''), 400);
    }, 200);
  };

  const handleDeleteSubject = () => {
      if (window.confirm(`Delete "${activeSubject.name}" and all its flashcards?`)) {
          deleteSubject(activeSubject.id);
          setActiveSubjectFilter('all'); 
      }
  };

  // Custom Scrollbar Class for Vertical Content (Inside Card)
  const cardScrollbarClass = `
    overflow-y-auto 
    [&::-webkit-scrollbar]:w-1.5 
    [&::-webkit-scrollbar-track]:bg-transparent 
    [&::-webkit-scrollbar-thumb]:bg-slate-200 
    [&::-webkit-scrollbar-thumb]:rounded-full 
    dark:[&::-webkit-scrollbar-thumb]:bg-stone-600
  `;

  return (
    <div className="animate-in fade-in duration-500 pb-24 relative overflow-hidden">
      
      {/* Creative Animations Styles & Horizontal Scrollbar */}
      <style>{`
        @keyframes tossLeft {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(-120%) rotate(-15deg); opacity: 0; }
        }
        @keyframes tossRight {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(120%) rotate(15deg); opacity: 0; }
        }
        @keyframes bouncyIn {
          0% { transform: scale(0.85) translateY(20px); opacity: 0; }
          60% { transform: scale(1.02) translateY(-5px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-toss-left { animation: tossLeft 0.25s forwards ease-in; }
        .animate-toss-right { animation: tossRight 0.25s forwards ease-in; }
        .animate-bouncy-in { animation: bouncyIn 0.4s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275); }

        /* CUSTOM HORIZONTAL SCROLLBAR FOR SUBJECTS */
        .subject-scroll::-webkit-scrollbar {
            height: 6px; /* Horizontal height */
        }
        .subject-scroll::-webkit-scrollbar-track {
            background: transparent;
        }
        .subject-scroll::-webkit-scrollbar-thumb {
            background-color: ${darkMode ? '#4b5563' : '#cbd5e1'};
            border-radius: 10px;
        }
        .subject-scroll::-webkit-scrollbar-thumb:hover {
            background-color: #4a7a7d;
        }
      `}</style>

      {/* 1. Deck Filter / Navigation (With Custom Scrollbar) */}
      <div className="flex gap-2 overflow-x-auto pb-4 items-center mb-2 subject-scroll">
        <button 
          onClick={() => { setActiveSubjectFilter('all'); setCurrentCardIndex(0); setIsFlipped(false); }}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold border transition-all ${activeSubjectFilter === 'all' ? 'bg-[#4a7a7d] text-white border-[#4a7a7d]' : `bg-transparent border-slate-300 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}`}
        >
          All Decks
        </button>
        {subjects.map(sub => (
          <button 
            key={sub.id}
            onClick={() => { setActiveSubjectFilter(sub.id); setCurrentCardIndex(0); setIsFlipped(false); }}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold border transition-all ${activeSubjectFilter === sub.id ? 'bg-[#4a7a7d] text-white border-[#4a7a7d]' : `bg-transparent border-slate-300 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}`}
          >
            {sub.name}
          </button>
        ))}
        <button 
            onClick={() => openModal('subject')}
            className="whitespace-nowrap px-3 py-2 rounded-full text-xs font-bold border border-dashed border-slate-400 text-slate-400 hover:border-[#4a7a7d] hover:text-[#4a7a7d] flex items-center gap-1 active:scale-95 transition-transform"
        >
            <Plus size={14} /> New
        </button>
      </div>

      {/* 2. Active Deck Controls */}
      {activeSubjectFilter !== 'all' && activeSubject && (
          <div className={`mb-6 flex items-center justify-between px-4 py-2 rounded-xl border border-dashed ${darkMode ? 'bg-[#2c333e]/50 border-stone-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                  <FolderCog size={16} className="text-slate-400" />
                  <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      Managing: <span className="text-[#4a7a7d]">{activeSubject.name}</span>
                  </span>
              </div>
              <div className="flex gap-2">
                  <button 
                    onClick={() => openModal('edit-subject', activeSubject)} 
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                      <Pencil size={12} /> Rename
                  </button>
                  <button 
                    onClick={handleDeleteSubject} 
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                  >
                      <Trash2 size={12} /> Delete
                  </button>
              </div>
          </div>
      )}

      {/* 3. Main Flashcard Area */}
      <div className={`min-h-[350px] flex flex-col relative perspective-container`}>
        {filteredCards.length > 0 && currentCard ? (
          <>
            <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-xs font-bold text-slate-400">Card {currentCardIndex + 1} of {filteredCards.length}</span>
              <div className="flex gap-2 bg-slate-100 dark:bg-black/20 p-1 rounded-lg">
                <button onClick={() => openModal('flashcard', currentCard)} className="p-1.5 text-slate-400 hover:text-[#4a7a7d] rounded-md hover:bg-white dark:hover:bg-white/10 transition-all"><Pencil size={14}/></button>
                <button onClick={() => deleteFlashcard(currentCard.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md hover:bg-white dark:hover:bg-white/10 transition-all"><Trash2 size={14}/></button>
              </div>
            </div>

            {/* CARD CONTAINER WITH ANIMATION CLASS */}
            <div className={`w-full h-72 cursor-pointer group [perspective:1000px] ${animClass}`} onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                
                {/* Front (Question) */}
                <div className={`absolute w-full h-full [backface-visibility:hidden] rounded-3xl shadow-xl border-b-[6px] border-b-[#4a7a7d] flex flex-col items-center p-6 text-center border border-slate-100 ${darkMode ? 'bg-[#2c333e] border-stone-700' : 'bg-white'}`}>
                    <div className="w-12 h-1 bg-slate-100 dark:bg-stone-700 rounded-full mb-4 flex-none"></div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-2 tracking-widest flex-none">Question</p>
                    
                    {/* SCROLLABLE CONTENT (Vertical) */}
                    <div className={`flex-1 w-full flex items-center justify-center ${cardScrollbarClass}`}>
                        <h3 className={`text-xl font-bold leading-relaxed max-h-full py-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                            {currentCard.question}
                        </h3>
                    </div>
                    
                    <p className="text-xs text-slate-400 opacity-50 font-medium mt-4 flex-none">Tap to flip</p>
                </div>

                {/* Back (Answer) */}
                <div className={`absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl shadow-xl border-b-[6px] border-b-amber-500 flex flex-col items-center p-6 text-center border border-slate-100 ${darkMode ? 'bg-[#2c333e] border-stone-700' : 'bg-white'}`}>
                    <div className="w-12 h-1 bg-slate-100 dark:bg-stone-700 rounded-full mb-4 flex-none"></div>
                    <p className="text-[10px] text-amber-500 font-bold uppercase mb-2 tracking-widest flex-none">Answer</p>
                    
                    {/* SCROLLABLE CONTENT (Vertical) */}
                    <div className={`flex-1 w-full flex items-center justify-center ${cardScrollbarClass}`}>
                        <h3 className={`text-xl font-bold leading-relaxed max-h-full py-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                            {currentCard.answer}
                        </h3>
                    </div>
                </div>

              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 mt-8">
              <Button onClick={handlePrev} variant="secondary" className="rounded-full w-14 h-14 p-0 shadow-sm active:scale-90 transition-transform"><ChevronLeft size={24}/></Button>
              <Button onClick={() => setIsFlipped(!isFlipped)} variant="primary" className="px-10 rounded-full h-14 shadow-lg shadow-[#4a7a7d]/30 active:scale-95 transition-transform">
                <RotateCcw size={18} className="mr-2"/> Flip
              </Button>
              <Button onClick={handleNext} variant="secondary" className="rounded-full w-14 h-14 p-0 shadow-sm active:scale-90 transition-transform"><ChevronRight size={24}/></Button>
            </div>
          </>
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl min-h-[300px] ${darkMode ? 'border-stone-700 bg-stone-800/20' : 'border-slate-300 bg-slate-50'}`}>
            <BrainCircuit size={48} className="text-slate-300 mb-4"/>
            <p className="text-slate-500 font-medium">No cards in this deck.</p>
            {subjects.length === 0 ? (
                <Button onClick={() => openModal('subject')} variant="contrast" className="mt-4 text-[#4a7a7d] border"><Plus size={16} className="mr-2"/> Add First Subject</Button>
            ) : (
                <Button onClick={() => openModal('flashcard')} variant="contrast" className="mt-4 text-[#4a7a7d] border"><Plus size={16} className="mr-2"/> Add Card</Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Add Fab */}
      {filteredCards.length > 0 && (
        <div className="fixed bottom-24 right-6 z-40">
          <button onClick={() => openModal('flashcard')} className="w-14 h-14 bg-[#4a7a7d] text-white rounded-full shadow-lg shadow-[#4a7a7d]/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><Plus size={28} /></button>
        </div>
      )}
    </div>
  );
}