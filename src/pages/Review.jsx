import React, { useState } from 'react';
import { RotateCcw, ChevronRight, ChevronLeft, Plus, Trash2, BrainCircuit } from 'lucide-react';
import { Card, Button } from '../components/UI';

export default function Review({ controller, openModal }) {
  const { flashcards, deleteFlashcard, subjects, darkMode } = controller;
  const [activeSubjectFilter, setActiveSubjectFilter] = useState('all');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const filteredCards = activeSubjectFilter === 'all' 
    ? flashcards 
    : flashcards.filter(c => c.subjectId === activeSubjectFilter);

  const currentCard = filteredCards[currentCardIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentCardIndex((prev) => (prev + 1) % filteredCards.length), 200);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentCardIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length), 200);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      {/* Header / Filter */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
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
      </div>

      {/* Main Flashcard Area */}
      <div className="min-h-[300px] flex flex-col">
        {filteredCards.length > 0 ? (
          <>
            <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-xs font-bold text-slate-400">Card {currentCardIndex + 1} of {filteredCards.length}</span>
              <button onClick={() => deleteFlashcard(currentCard.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
            </div>

            {/* 3D Flip Container */}
            <div className="w-full h-64 cursor-pointer group [perspective:1000px]" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                
                {/* Front (Question) */}
                <div className={`absolute w-full h-full [backface-visibility:hidden] rounded-2xl shadow-md border-b-4 border-b-[#4a7a7d] flex items-center justify-center p-8 text-center ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-4 tracking-widest">Question</p>
                    <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentCard.question}</h3>
                    <p className="text-xs text-slate-400 mt-8 opacity-50">(Tap to flip)</p>
                  </div>
                </div>

                {/* Back (Answer) - Rotated 180deg initially so it's correct when flipped */}
                <div className={`absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl shadow-md border-b-4 border-b-amber-500 flex items-center justify-center p-8 text-center ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
                  <div>
                    <p className="text-xs text-amber-500 font-bold uppercase mb-4 tracking-widest">Answer</p>
                    <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentCard.answer}</h3>
                  </div>
                </div>

              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 mt-8">
              <Button onClick={handlePrev} variant="secondary" className="rounded-full w-12 h-12 p-0"><ChevronLeft size={20}/></Button>
              <Button onClick={() => setIsFlipped(!isFlipped)} variant="primary" className="px-8 rounded-full">
                <RotateCcw size={16} className="mr-2"/> Flip
              </Button>
              <Button onClick={handleNext} variant="secondary" className="rounded-full w-12 h-12 p-0"><ChevronRight size={20}/></Button>
            </div>
          </>
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl ${darkMode ? 'border-stone-700' : 'border-slate-300'}`}>
            <BrainCircuit size={48} className="text-slate-300 mb-4"/>
            <p className="text-slate-500 font-medium">No cards in this deck.</p>
            <Button onClick={() => openModal('flashcard')} variant="contrast" className="mt-4 text-[#4a7a7d]"><Plus size={16} className="mr-2"/> Add Card</Button>
          </div>
        )}
      </div>

      {/* Quick Add Fab */}
      {filteredCards.length > 0 && (
        <div className="fixed bottom-24 right-6 z-40">
          <button onClick={() => openModal('flashcard')} className="w-14 h-14 bg-[#4a7a7d] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><Plus size={28} /></button>
        </div>
      )}
    </div>
  );
}