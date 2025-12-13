import React from 'react';

export const Card = ({ children, className = "", onClick, style }) => (
  <div onClick={onClick} style={style} className={`rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
    {children}
  </div>
);

export const Button = ({ children, onClick, className = "", variant = "primary", disabled=false }) => {
  const variants = {
    primary: "bg-[#4a7a7d] text-white hover:bg-[#3b6366] active:bg-[#2f4f51] shadow-sm disabled:opacity-50", 
    contrast: "bg-white text-[#2c333e] font-bold hover:bg-stone-100 shadow-sm",
    secondary: "bg-slate-200 dark:bg-[#374151] text-slate-800 dark:text-stone-200 hover:bg-slate-300 dark:hover:bg-[#4b5563]",
    ghost: "bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center px-4 py-3 font-medium rounded-xl active:scale-95 transition-all duration-200 ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const ProgressBar = ({ total, completed }) => {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="h-2 w-full bg-slate-200 dark:bg-stone-700 rounded-full overflow-hidden mt-3">
      <div className="h-full bg-[#4a7a7d] transition-all duration-500 ease-out rounded-full" style={{ width: `${percent}%` }} />
    </div>
  );
};