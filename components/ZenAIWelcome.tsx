import React from 'react';
import {
  IconBot,
  IconCalendar,
  IconChevronRight,
  IconFileText,
  IconReview,
} from './Icons';

const ZEN_AI_STARTERS = [
  {
    label: 'Plan my week',
    prompt: 'What tasks, exams, projects, and study sessions are scheduled this week, and how should I prioritize them?',
    Icon: IconCalendar,
    iconClass: 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300',
    chevronClass: 'text-emerald-300',
    hoverClass: 'hover:border-emerald-400/25 hover:bg-emerald-400/[0.045]',
  },
  {
    label: 'Break down a task',
    prompt: 'Help me break down my upcoming tasks into smaller steps',
    Icon: IconFileText,
    iconClass: 'border-violet-400/15 bg-violet-400/[0.07] text-violet-300',
    chevronClass: 'text-violet-300',
    hoverClass: 'hover:border-violet-400/25 hover:bg-violet-400/[0.045]',
  },
  {
    label: 'Build a study plan',
    prompt: 'Create a study schedule around my scheduled exams, projects, study sessions, events, and unfinished tasks',
    Icon: IconReview,
    iconClass: 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300',
    chevronClass: 'text-amber-300',
    hoverClass: 'hover:border-amber-400/25 hover:bg-amber-400/[0.045]',
  },
] as const;

interface ZenAIWelcomeProps {
  disabled?: boolean;
  onSelectPrompt: (prompt: string) => void;
}

export const ZenAIWelcome: React.FC<ZenAIWelcomeProps> = ({ disabled = false, onSelectPrompt }) => (
  <section className="zen-ai-welcome mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-1 py-8 text-center sm:px-3 sm:py-10" aria-labelledby="zen-ai-welcome-title">
    <div className="zen-ai-welcome-bot mb-7 flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/[0.11] bg-white/[0.045] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:h-24 sm:w-24 sm:rounded-[28px]">
      <IconBot className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true" />
    </div>

    <h2 id="zen-ai-welcome-title" className="text-balance text-[1.65rem] font-semibold leading-[1.18] tracking-[-0.035em] text-white sm:text-3xl">
      What can I help you study?
    </h2>
    <p className="mt-3 max-w-md text-pretty text-sm leading-6 text-slate-400 sm:text-[15px]">
      Ask a question, attach your notes, or turn your week into a focused plan.
    </p>

    <div className="zen-ai-welcome-actions mt-8 grid w-full gap-2.5 sm:mt-10 sm:gap-3" aria-label="Suggested prompts">
      {ZEN_AI_STARTERS.map(({ label, prompt, Icon, iconClass, chevronClass, hoverClass }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onSelectPrompt(prompt)}
          className={`group flex min-h-[70px] w-full items-center gap-3 rounded-[20px] border border-white/[0.085] bg-white/[0.025] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zen-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[76px] sm:p-3.5 ${hoverClass}`}
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border sm:h-12 sm:w-12 sm:rounded-2xl ${iconClass}`} aria-hidden="true">
            <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold tracking-[-0.015em] text-slate-100 sm:text-base">{label}</span>
          <IconChevronRight className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${chevronClass}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  </section>
);
