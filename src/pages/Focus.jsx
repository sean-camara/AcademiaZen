import React, { useMemo } from 'react';
import { Tag, Check } from 'lucide-react';
import { Card } from '../components/UI';

export default function Focus({ controller }) {
  const { subjects, darkMode } = controller;
  const urgentTask = useMemo(() => {
    let all = [];
    subjects.forEach(s => s.tasks.forEach(t => !t.completed && all.push({...t, subject: s.name})));
    return all.sort((a,b) => new Date(a.date) - new Date(b.date))[0];
  }, [subjects]);

  return (
    <div className="py-20 text-center animate-in zoom-in-95">
      {urgentTask ? (
        <>
          <p className="text-slate-400 font-medium uppercase tracking-widest text-xs mb-6">Current Priority</p>
          <Card className={`p-10 border-t-4 border-t-[#4a7a7d] shadow-xl ${darkMode ? 'bg-[#2c333e]' : 'bg-white'}`}>
            <h2 className={`text-3xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-800'}`}>{urgentTask.title}</h2>
            <div className="text-xl text-slate-500 mb-8 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold bg-slate-100 dark:bg-stone-800 px-3 py-1 rounded-full">
                <Tag size={14}/> {urgentTask.type}
              </div>
              <span>{urgentTask.subject}</span>
            </div>
            <div className="inline-block px-6 py-2 rounded-full text-sm font-bold bg-[#4a7a7d]/10 text-[#4a7a7d]">
              Due {new Date(urgentTask.date).toLocaleDateString()}
            </div>
          </Card>
          <p className="mt-8 text-sm text-slate-400">One step at a time.</p>
        </>
      ) : (
        <div className="opacity-50 mt-10">
          <Check size={64} className="mx-auto mb-4 text-[#4a7a7d]" />
          <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>All caught up.</p>
        </div>
      )}
    </div>
  );
}