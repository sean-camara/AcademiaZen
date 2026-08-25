import React from 'react';
import { AcademicAnalytics } from './types';

interface AdminAcademicsProps {
  academics: AcademicAnalytics | null;
}

export const AdminAcademics: React.FC<AdminAcademicsProps> = ({ academics }) => {
  if (!academics) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs">
        No academic telemetry data currently recorded.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e]">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-4">Top Enrolled Study Subjects</h3>
          <div className="space-y-3">
            {academics.topSubjects.map((s) => (
              <div key={s.subject} className="flex justify-between text-xs border-b border-slate-800 pb-2">
                <span className="font-semibold text-white">{s.subject}</span>
                <span className="font-mono text-emerald-400">{s.count} enrolled students</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e]">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-4">AI Quiz Performance Matrix</h3>
          <div className="text-center p-8 bg-slate-900/60 rounded-xl border border-slate-800">
            <p className="text-5xl font-extrabold text-emerald-300">{academics.avgQuizScore}%</p>
            <p className="mt-2 text-xs text-slate-400">
              Average Student Quiz Score across {academics.totalQuizAttempts} completed attempts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
