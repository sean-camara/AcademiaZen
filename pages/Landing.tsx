import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    eyebrow: 'Plan',
    title: 'See what matters next',
    body: 'Bring tasks, subjects, and due dates into one calm view that helps you choose the next useful action.',
  },
  {
    eyebrow: 'Focus',
    title: 'Turn intention into study time',
    body: 'Start a focused session from the work already in front of you, then reflect without losing your place.',
  },
  {
    eyebrow: 'Understand',
    title: 'Study from your own material',
    body: 'Organize notes and PDFs, build reviewers, and ask Zen AI questions with context you deliberately select.',
  },
];

const workflow = [
  ['01', 'Gather', 'Capture the task, class, note, or PDF before it disappears into another tab.'],
  ['02', 'Choose', 'Use deadlines and your study context to decide what deserves attention now.'],
  ['03', 'Focus', 'Work in a dedicated session with a clear target and a recoverable timer.'],
  ['04', 'Review', 'Turn your material into active recall and keep the useful context close.'],
];

const faqs = [
  ['What does Zen AI know about me?', 'Only the study context your account provides to the product and the references you choose for a request. AcademiaZen should never be treated as a source of final academic authority.'],
  ['Can I use AcademiaZen on my phone?', 'Yes. The workspace is designed as a responsive web app, including mobile navigation, focus sessions, and contextual notification support where the browser allows it.'],
  ['What happens when I reach an AI limit?', 'The app shows the current limit and reset state from the server. Your tasks, notes, focus history, and library remain available.'],
  ['Does the landing page need 3D to work?', 'No. Every important message, preview, and action is real HTML. The study-world artwork is a lightweight visual enhancement.'],
];

const Arrow = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
    <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ProductPreview = () => (
  <div className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-[#101715] p-4 shadow-2xl shadow-black/40 sm:grid-cols-[1.15fr_.85fr] sm:p-6">
    <div className="rounded-2xl border border-white/8 bg-[#151d1b] p-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Today</p>
          <p className="mt-1 text-xl font-semibold text-white">A clear next step</p>
        </div>
        <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">3 priorities</span>
      </div>
      <div className="space-y-3">
        {['Review cell structure notes', 'Draft research outline', 'Practice calculus set'].map((task, index) => (
          <div key={task} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/15 p-3.5">
            <span className={`h-4 w-4 rounded-full border ${index === 0 ? 'border-emerald-300 bg-emerald-300/20' : 'border-white/25'}`} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{task}</span>
            <span className="text-xs text-slate-500">{index === 0 ? 'Next' : 'Later'}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-rows-2">
      <div className="flex flex-col justify-between rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-emerald-200">
          <span>Focus</span><span>Cell biology</span>
        </div>
        <p className="py-5 font-mono text-4xl tracking-tight text-white">24:18</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/5 rounded-full bg-emerald-300" /></div>
      </div>
      <div className="rounded-2xl border border-white/8 bg-[#151d1b] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Knowledge</p>
        <p className="mt-3 text-base font-medium text-white">Your material stays connected.</p>
        <div className="mt-4 flex gap-2">
          {['Notes', 'PDF', 'Review'].map(item => <span key={item} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300">{item}</span>)}
        </div>
      </div>
    </div>
  </div>
);

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08100f] text-slate-100 selection:bg-emerald-300/30">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-black">Skip to content</a>
      <header className="relative z-50 border-b border-white/8 bg-[#08100f]/90 backdrop-blur-xl">
        <nav aria-label="Primary navigation" className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link to="/" className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 font-semibold text-emerald-200">A</span>
            <span className="font-semibold tracking-tight text-white">AcademiaZen</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            <a href="#workflow" className="hover:text-white">How it works</a>
            <a href="#workspace" className="hover:text-white">Workspace</a>
            <a href="#trust" className="hover:text-white">Trust</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 hover:text-white sm:px-4">Sign in</Link>
            <Link to="/login?mode=signup" className="min-h-11 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-[#09201a] hover:bg-emerald-200 sm:px-5">Get started</Link>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="relative isolate mx-auto grid min-h-[760px] max-w-[1600px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:px-12 lg:py-24">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-6 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Your calm academic system</p>
            <h1 className="text-balance text-5xl font-semibold leading-[.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl xl:text-[5.5rem]">Enter your<br /><span className="text-emerald-200">study world.</span></h1>
            <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">Plan what matters, focus without friction, and turn your own materials into useful review—inside one calm workspace.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/login?mode=signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-6 py-3.5 font-semibold text-[#09201a] hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">Create your study space <Arrow /></Link>
              <a href="#workspace" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 font-medium text-white hover:bg-white/[0.08]">Explore the workflow</a>
            </div>
            <p className="mt-5 text-sm text-slate-500">Start with an account. Your AI access and limits are shown clearly inside the app.</p>
          </div>
          <div className="relative min-h-[390px] lg:min-h-[620px]" aria-label="A study desk moving from scattered work to an organized system">
            <div className="absolute inset-[-12%] rounded-full bg-emerald-400/10 blur-[100px]" aria-hidden="true" />
            <picture>
              <source media="(max-width: 767px)" srcSet="/images/study-world-hero-960.webp" />
              <img src="/images/study-world-hero-1600.webp" width="1600" height="900" fetchPriority="high" alt="Stylized study desk with tasks, calendar, notebook, organized materials, and a friendly AI assistant" className="relative h-full w-full object-contain drop-shadow-[0_35px_70px_rgba(0,0,0,.45)]" />
            </picture>
          </div>
        </section>

        <section className="border-y border-white/8 bg-[#0b1412] px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">One connected rhythm</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">Less context switching. More meaningful progress.</h2></div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">{features.map(feature => <article key={feature.title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{feature.eyebrow}</p><h3 className="mt-8 text-xl font-semibold text-white">{feature.title}</h3><p className="mt-3 leading-7 text-slate-400">{feature.body}</p></article>)}</div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
            <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">How it works</p><h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">From scattered responsibilities to a repeatable study loop.</h2><p className="mt-5 leading-7 text-slate-400">AcademiaZen is designed around the work students already do—not another complicated system to maintain.</p></div>
            <ol className="mt-12 border-t border-white/10 lg:mt-0">{workflow.map(([number,title,body]) => <li key={number} className="grid gap-3 border-b border-white/10 py-7 sm:grid-cols-[4rem_9rem_1fr] sm:items-start"><span className="font-mono text-sm text-emerald-300">{number}</span><h3 className="font-semibold text-white">{title}</h3><p className="leading-7 text-slate-400">{body}</p></li>)}</ol>
          </div>
        </section>

        <section id="workspace" className="scroll-mt-20 bg-[#0b1412] px-5 py-24 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl"><div className="mb-10 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">The workspace</p><h2 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Your next task, focused time, and study material—together.</h2></div><ProductPreview /></div>
        </section>

        <section id="trust" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-20">
            <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Built for trust</p><h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">AI that supports your studying—not a black box that replaces it.</h2></div>
            <div className="grid gap-4 sm:grid-cols-2">{[['You choose context','References are attached deliberately, so you stay in control of what informs a request.'],['Limits stay visible','Usage and premium state come from the server and are explained when access changes.'],['Your system still works','Tasks, focus, library, and settings remain useful without an AI response.'],['Errors should recover','Timeouts, offline state, and conflicts are treated as recoverable product states.']].map(([title,body]) => <article key={title} className="rounded-2xl border border-white/8 p-6"><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}</div>
          </div>
        </section>

        <section className="border-t border-white/8 bg-[#0b1412] px-5 py-24 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Questions</p><h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">A clearer start.</h2><div className="mt-10 divide-y divide-white/10 border-y border-white/10">{faqs.map(([question,answer]) => <details key={question} className="group py-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">{question}<span className="text-emerald-300 transition-transform group-open:rotate-45" aria-hidden="true">＋</span></summary><p className="max-w-3xl pb-2 pr-10 leading-7 text-slate-400">{answer}</p></details>)}</div></div>
        </section>

        <section className="px-5 py-24 sm:px-8 lg:px-12"><div className="mx-auto max-w-6xl rounded-[2rem] border border-emerald-300/20 bg-emerald-300/[0.06] px-6 py-16 text-center sm:px-12"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Ready when you are</p><h2 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Make your next study session feel clear.</h2><Link to="/login?mode=signup" className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-300 px-6 py-3.5 font-semibold text-[#09201a] hover:bg-emerald-200">Create your study space <Arrow /></Link></div></section>
      </main>

      <footer className="border-t border-white/8 px-5 py-10 text-sm text-slate-500 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} AcademiaZen. A calmer way to study.</p><div className="flex gap-6"><a href="mailto:support@academiazen.app" className="hover:text-white">Support</a><Link to="/login" className="hover:text-white">Sign in</Link></div></div></footer>
    </div>
  );
};

export default Landing;
