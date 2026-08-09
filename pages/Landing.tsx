import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const Arrow = () => <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none"><path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Check = () => <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none"><path d="m4 10 3.2 3.2L16 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const MenuIcon = ({ open }: { open: boolean }) => open ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;

const productCards = [
  { number: '01', name: 'Gather', description: 'Keep tasks, subjects, notes, and PDFs in one place.', image: '/images/landing/dashboard.png', alt: 'AcademiaZen dashboard' },
  { number: '02', name: 'Choose', description: 'See deadlines in context and decide what matters today.', image: '/images/landing/calendar.png', alt: 'AcademiaZen calendar' },
  { number: '03', name: 'Focus', description: 'Study with a clear target, timer, and calming ambience.', image: '/images/landing/pomodoro.png', alt: 'AcademiaZen focus timer' },
  { number: '04', name: 'Review', description: 'Turn your own material into active-recall quizzes.', image: '/images/landing/quiz-generation.png', alt: 'AcademiaZen review quiz' },
];

const suite = [
  { eyebrow: 'Plan your workload', title: 'A dashboard that makes the next move obvious.', body: 'Subjects, deadlines, priority tasks, and progress are gathered into one daily workspace.', image: '/images/landing/dashboard.png', alt: 'Dashboard preview' },
  { eyebrow: 'Protect study time', title: 'A calendar built around real academic commitments.', body: 'Schedule exams, projects, events, and study sessions—not just isolated to-do items.', image: '/images/landing/calendar.png', alt: 'Calendar preview' },
  { eyebrow: 'Study with intention', title: 'Focus sessions that remember what you are working on.', body: 'Choose a task or document, use a flexible focus cycle, then reflect on what helped or interrupted you.', image: '/images/landing/pomodoro.png', alt: 'Focus preview' },
  { eyebrow: 'Learn actively', title: 'Reviewers made from the material you actually study.', body: 'Generate interactive quizzes from PDFs, resume unfinished attempts, and learn from each result.', image: '/images/landing/quiz-generation.png', alt: 'Quiz preview' },
];

const faqs = [
  ['What can I do with AcademiaZen?', 'Organize academic tasks and subjects, plan your calendar, run focused study sessions, save notes and PDFs, ask Zen AI for help, and generate review quizzes from your own material.'],
  ['Does Zen AI read everything automatically?', 'No. You deliberately choose the notes or PDFs that you attach to a question. Zen AI is meant to support your studying, not replace academic judgment.'],
  ['Can I use it on my phone?', 'Yes. AcademiaZen is designed as a responsive study workspace, so planning, focus sessions, and study tools remain usable across desktop and mobile.'],
  ['What stays useful without AI?', 'Your tasks, calendar, focus tools, study library, and history all remain useful even when you are not using an AI feature.'],
];

const TiltCard: React.FC<{ card: (typeof productCards)[0]; index: number }> = ({ card, index }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  const [glare, setGlare] = useState<{ x: number; y: number; opacity: number }>({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.03, 1.03, 1.03)`);
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlare(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform, transition: 'transform 0.15s ease-out, border-color 0.3s ease, box-shadow 0.3s ease' }}
      className={`reveal-on-scroll reveal-delay-${index + 1} group relative flex min-w-[82%] snap-start flex-col justify-between overflow-hidden rounded-2xl border border-white/[.08] bg-[#070c14]/90 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition duration-300 hover:border-emerald-300/40 hover:shadow-[0_20px_50px_rgba(16,185,129,0.18)] sm:min-w-[46%] lg:min-w-0 [transform-style:preserve-3d]`}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 rounded-2xl"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, ${glare.opacity}), transparent 60%)`,
        }}
      />

      <div className="relative z-10 [transform:translateZ(20px)] transition-transform duration-300">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold text-emerald-300 transition duration-300 group-hover:scale-110">{card.number}</span>
          <span className="text-sm font-semibold text-white transition duration-300 group-hover:text-emerald-200">{card.name}</span>
        </div>
        <p className="mt-3 min-h-12 text-sm leading-6 text-slate-400">{card.description}</p>
      </div>

      <div className="relative z-10 mt-5 overflow-hidden rounded-xl border border-white/[.08] bg-[#05080f] p-1.5 shadow-lg transition duration-500 group-hover:border-emerald-300/40 group-hover:shadow-[0_0_25px_rgba(52,211,153,0.2)] [transform:translateZ(35px)]">
        <img
          src={card.image}
          alt={card.alt}
          className="aspect-[16/10] w-full rounded-lg object-contain transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
    </article>
  );
};

const Landing: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showHeader, setShowHeader] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;
      setShowHeader(currentScrollY < 40 || !scrollingDown);
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);  useEffect(() => {
    if (!showMenu) return;
    const closeMenu = () => setShowMenu(false);
    window.addEventListener('resize', closeMenu);
    return () => window.removeEventListener('resize', closeMenu);
  }, [showMenu]);

  useEffect(() => {
    const scrollContainer = document.querySelector('.landing-scroll');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
          }
        });
      },
      {
        root: scrollContainer,
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-scale-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-shell landing-scroll h-screen w-full overflow-x-hidden overflow-y-auto bg-[#070b12] text-slate-100 selection:bg-emerald-300/30">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(148,163,184,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.07)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="animate-pulse-glow pointer-events-none fixed left-1/2 top-0 -z-10 h-[620px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[150px]" />
      <div className="animate-pulse-glow pointer-events-none fixed right-[-15%] top-[18%] -z-10 h-[430px] w-[430px] rounded-full bg-violet-500/10 blur-[140px]" />

      <header className={`fixed inset-x-0 top-0 z-50 border-b border-white/[.06] bg-[#070b12]/80 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="group flex items-center gap-3 font-semibold tracking-tight text-white">
            <img src="/icons/academiazen-mark.svg" alt="AcademiaZen" className="h-9 w-9 rounded-xl shadow-[0_0_24px_rgba(52,211,153,.15)] transition duration-300 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(52,211,153,.35)]" />
            <span className="transition duration-300 group-hover:text-emerald-200">AcademiaZen</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-300 lg:flex">
            <a href="#how-it-works" className="transition duration-200 hover:text-emerald-300">How It Works</a>
            <a href="#workspace" className="transition duration-200 hover:text-emerald-300">Features</a>
            <a href="#trust" className="transition duration-200 hover:text-emerald-300">Zen AI</a>
            <a href="#faq" className="transition duration-200 hover:text-emerald-300">FAQ</a>
          </div>
          <div className="hidden items-center gap-2 sm:gap-4 lg:flex">
            <Link to="/login" className="px-3 py-2 text-sm font-medium text-slate-300 transition duration-200 hover:text-white">Sign in</Link>
            <Link to="/login?mode=signup" className="rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-4 py-2.5 text-sm font-bold text-[#06211b] shadow-[0_0_24px_rgba(52,211,153,.2)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_0_35px_rgba(52,211,153,.4)]">Get started</Link>
          </div>
          <button type="button" onClick={() => setShowMenu(value => !value)} aria-label={showMenu ? 'Close menu' : 'Open menu'} aria-expanded={showMenu} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-200 transition hover:border-emerald-300/30 hover:text-white lg:hidden"><MenuIcon open={showMenu} /></button>
        </nav>
        {showMenu && (
          <div className="border-t border-white/[.06] bg-[#080d15]/95 px-5 py-4 shadow-2xl backdrop-blur-xl sm:px-8 lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 text-sm font-medium">
              <a href="#how-it-works" onClick={() => setShowMenu(false)} className="rounded-xl px-4 py-3 text-slate-300 transition hover:bg-white/[.05] hover:text-white">How It Works</a>
              <a href="#workspace" onClick={() => setShowMenu(false)} className="rounded-xl px-4 py-3 text-slate-300 transition hover:bg-white/[.05] hover:text-white">Features</a>
              <a href="#trust" onClick={() => setShowMenu(false)} className="rounded-xl px-4 py-3 text-slate-300 transition hover:bg-white/[.05] hover:text-white">Zen AI</a>
              <a href="#faq" onClick={() => setShowMenu(false)} className="rounded-xl px-4 py-3 text-slate-300 transition hover:bg-white/[.05] hover:text-white">FAQ</a>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[.06] pt-3">
                <Link to="/login" onClick={() => setShowMenu(false)} className="rounded-xl border border-white/10 px-4 py-3 text-center text-slate-200">Sign in</Link>
                <Link to="/login?mode=signup" onClick={() => setShowMenu(false)} className="rounded-xl bg-emerald-300 px-4 py-3 text-center font-bold text-[#06211b]">Get started</Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:pb-32">
          <div className="mx-auto max-w-7xl text-center">
            <p className="reveal-on-scroll mx-auto inline-flex items-center gap-2.5 rounded-full border border-emerald-300/30 bg-emerald-300/[.08] px-3.5 py-2 text-[11px] font-semibold tracking-wide text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,.1)] transition hover:border-emerald-300/50 sm:px-4.5 sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,1)]" />
              </span>
              Your calm academic operating system
            </p>
            <h1 className="reveal-on-scroll reveal-delay-1 landing-display mx-auto mt-8 max-w-5xl text-balance text-[2.4rem] font-semibold leading-[.99] tracking-[-.06em] text-white sm:mt-7 sm:text-6xl sm:leading-[.98] lg:text-8xl">
              From academic chaos<br />to <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-violet-300 bg-clip-text text-transparent text-shimmer-anim">calm progress.</span>
            </h1>
            <p className="reveal-on-scroll reveal-delay-2 mx-auto mt-6 max-w-[22rem] text-pretty text-base leading-7 text-slate-300 sm:mt-7 sm:max-w-3xl sm:text-xl sm:leading-8">
              <span className="sm:hidden">Organize deadlines, focus, and study from your own materials—all in one calm workspace.</span>
              <span className="hidden sm:inline">Organize deadlines, focus on what matters, study from your own notes and PDFs, and review what you learned—inside one connected workspace.</span>
            </p>
            <div className="reveal-on-scroll reveal-delay-3 mt-9 flex flex-col justify-center gap-3.5 sm:flex-row">
              <Link to="/login?mode=signup" className="group relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-6 py-3.5 font-bold text-[#06211b] shadow-[0_10px_40px_rgba(16,185,129,.25)] transition duration-300 hover:-translate-y-1 hover:brightness-110 hover:shadow-[0_15px_50px_rgba(16,185,129,.4)] active:scale-95">
                <span className="relative z-10 flex items-center gap-2">Create your study space <Arrow /></span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </Link>
              <a href="#workspace" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-6 py-3.5 font-semibold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-white/[.09] active:scale-95">Explore the workspace</a>
            </div>
            <div className="reveal-on-scroll reveal-delay-4 mt-8 hidden flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-slate-400 sm:flex">
              {['Real student workspace', 'Tasks, PDFs & focus connected', 'AI context is chosen by you'].map(item => <span key={item} className="inline-flex items-center gap-1.5 transition hover:text-emerald-200"><span className="text-emerald-300"><Check /></span>{item}</span>)}
            </div>

            <div className="reveal-scale-on-scroll reveal-delay-2 relative mx-auto mt-16 max-w-5xl [perspective:1200px]">
              <div className="animate-landing-float absolute -left-24 top-8 hidden w-[30%] rotate-[-8deg] rounded-xl border border-emerald-300/25 bg-[#0a101a] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition duration-500 hover:border-emerald-300/50 hover:shadow-[0_0_30px_rgba(52,211,153,0.2)] lg:block"><p className="border-b border-white/[.06] px-2 py-2 text-left text-[10px] font-mono text-emerald-300">CALENDAR · LIVE PLAN</p><img src="/images/landing/calendar.png" alt="Calendar view" className="mt-1 rounded-lg" /></div>
              <div className="animate-landing-float-reverse absolute -right-24 top-12 hidden w-[30%] rotate-[8deg] rounded-xl border border-violet-300/25 bg-[#0a101a] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition duration-500 hover:border-violet-300/50 hover:shadow-[0_0_30px_rgba(167,139,250,0.2)] lg:block"><p className="border-b border-white/[.06] px-2 py-2 text-left text-[10px] font-mono text-violet-300">FOCUS · 25:00</p><img src="/images/landing/pomodoro.png" alt="Focus timer" className="mt-1 rounded-lg" /></div>
              <div className="animate-card-glow relative overflow-hidden rounded-2xl border border-emerald-300/30 bg-[#0a101a] p-2 shadow-[0_26px_90px_rgba(0,0,0,.75),0_0_70px_rgba(16,185,129,.18)] transition duration-700 hover:rotate-0 hover:scale-[1.01] sm:p-3 [transform:rotateX(4deg)]">
                <div className="flex items-center justify-between rounded-t-xl border-b border-white/[.06] bg-white/[.035] px-4 py-2.5 text-left"><span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-400/80" /><i className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" /></span><span className="font-mono text-[10px] text-slate-500">app.academiazen.com</span><span className="hidden rounded bg-emerald-300/10 px-2 py-1 text-[9px] font-mono text-emerald-200 sm:block">YOUR STUDY SPACE</span></div>
                <img src="/images/landing/dashboard.png" alt="AcademiaZen student dashboard" className="w-full rounded-b-xl" />
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/[.06] bg-[#0a1018]/80 px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="reveal-on-scroll mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">The academic loop</p><h2 className="landing-display mt-4 text-4xl font-semibold tracking-[-.05em] text-white sm:text-5xl">A calmer way to move through your workload.</h2><p className="mt-5 text-lg leading-8 text-slate-400">AcademiaZen follows the study rhythm you already need—without becoming another complicated system to maintain.</p></div>
            <div className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4 lg:overflow-visible">
              {productCards.map((card, index) => (
                <TiltCard key={card.name} card={card} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section id="workspace" className="px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="reveal-on-scroll max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">Inside the workspace</p><h2 className="landing-display mt-4 text-4xl font-semibold tracking-[-.05em] text-white sm:text-5xl">Your academic life, finally connected.</h2><p className="mt-5 text-lg leading-8 text-slate-400">Each part of AcademiaZen supports the next: your plans guide your focus, your materials power your review, and your progress stays visible.</p></div>
            <div className="mt-16 space-y-20">
              {suite.map((item, index) => (
                <article key={item.title} className={`reveal-on-scroll grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${index % 2 ? 'lg:[&>div:first-child]:order-2' : ''}`}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">{item.eyebrow}</p>
                    <h3 className="mt-4 text-3xl font-semibold leading-tight tracking-[-.035em] text-white sm:text-4xl">{item.title}</h3>
                    <p className="mt-5 max-w-xl text-base leading-8 text-slate-400">{item.body}</p>
                    <a href="#trust" className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition duration-300 hover:text-emerald-100 hover:translate-x-1">See how it connects <span className="transition duration-300 group-hover:translate-x-1"><Arrow /></span></a>
                  </div>
                  <div className="group overflow-hidden rounded-2xl border border-white/[.08] bg-gradient-to-br from-emerald-300/[.08] via-transparent to-violet-300/[.08] p-2 shadow-2xl transition duration-500 hover:border-emerald-300/30 hover:shadow-[0_0_50px_rgba(52,211,153,.15)]">
                    <img src={item.image} alt={item.alt} className="w-full rounded-xl transition duration-500 group-hover:scale-[1.015]" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="border-y border-white/[.06] bg-[#0a1018]/80 px-5 py-24 sm:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div className="reveal-on-scroll">
              <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">Zen AI assistant</p>
              <h2 className="landing-display mt-4 text-4xl font-semibold tracking-[-.05em] text-white sm:text-5xl">An AI study partner that keeps you in control.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-400">Ask about your workload, work through difficult concepts, or attach selected study materials for grounded help.</p>
            </div>
            <div className="reveal-scale-on-scroll reveal-delay-2 group rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/[.09] to-violet-300/[.06] p-6 shadow-[0_0_70px_rgba(16,185,129,.08)] transition duration-500 hover:border-emerald-300/40 hover:shadow-[0_0_90px_rgba(16,185,129,.18)] sm:p-8">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-300/15 text-2xl text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)] transition duration-500 group-hover:scale-110">✦</div>
                <div>
                  <p className="font-semibold text-white">Zen AI</p>
                  <p className="text-sm text-emerald-200">Context-aware academic support</p>
                </div>
              </div>
              <div className="mt-8 rounded-2xl border border-white/[.08] bg-[#080d15]/80 p-5 shadow-xl transition duration-300 group-hover:border-white/[.15]">
                <p className="text-sm text-slate-300">“Help me make a study plan for my biology exam using these notes.”</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200 transition duration-300 hover:border-emerald-300/40">Biology notes.pdf</span>
                  <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200 transition duration-300 hover:border-emerald-300/40">Exam schedule</span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/[.06] pt-4">
                  <span className="text-xs text-slate-500">You choose what informs the answer.</span>
                  <span className="rounded-lg bg-emerald-300 px-3 py-1.5 text-xs font-bold text-[#06211b] shadow-[0_0_15px_rgba(52,211,153,0.4)] transition duration-300 hover:scale-105 hover:bg-emerald-200">Ask Zen AI</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-14 grid max-w-7xl gap-4 sm:grid-cols-3">
            {[
              ['You choose the context', 'Attach the material you want Zen AI to use.'],
              ['Your work stays useful', 'Planning, focus, and review work without AI too.'],
              ['Limits stay visible', 'Usage and access are clearly explained in the app.']
            ].map(([title, body], index) => (
              <div key={title} className={`reveal-on-scroll reveal-delay-${index + 1} landing-card-hover rounded-2xl border border-white/[.08] bg-white/[.025] p-6 transition duration-300`}>
                <span className="text-emerald-300"><Check /></span>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="reveal-on-scroll text-center">
              <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">Questions</p>
              <h2 className="landing-display mt-4 text-4xl font-semibold tracking-[-.05em] text-white sm:text-5xl">A clearer start to studying.</h2>
            </div>
            <div className="reveal-on-scroll reveal-delay-2 mt-12 divide-y divide-white/[.08] border-y border-white/[.08]">
              {faqs.map(([question, answer], index) => (
                <div key={question} className="group">
                  <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-6 py-6 text-left font-medium text-white transition duration-300 hover:text-emerald-200">
                    <span>{question}</span>
                    <span className={`text-xl text-emerald-300 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`}>{openFaq === index ? '−' : '+'}</span>
                  </button>
                  {openFaq === index && <p className="animate-fade-in max-w-3xl pb-6 pr-10 leading-7 text-slate-400">{answer}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8">
          <div className="reveal-scale-on-scroll relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-300/[.13] via-[#0d191a] to-violet-300/[.10] px-7 py-20 text-center shadow-[0_0_100px_rgba(16,185,129,.12)] sm:px-12 sm:py-20">
            <div className="animate-pulse-glow pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="animate-pulse-glow pointer-events-none absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-violet-400/20 blur-3xl" />
            <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-200">Ready when you are</p>
            <h2 className="landing-display mx-auto mt-5 max-w-3xl text-[2.2rem] font-semibold leading-[1.05] tracking-[-.06em] text-white sm:text-6xl">Make your next study session feel clear.</h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">Create one calm place for your workload, study material, focused time, and progress.</p>
            <Link to="/login?mode=signup" className="group relative mt-9 inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-5 py-3.5 text-sm font-bold text-[#06211b] shadow-[0_10px_40px_rgba(16,185,129,.3)] transition duration-300 hover:-translate-y-1 hover:brightness-110 hover:shadow-[0_15px_50px_rgba(16,185,129,.5)] active:scale-95 sm:px-6 sm:text-base">
              <span className="relative z-10 flex items-center gap-2">Create your study space <Arrow /></span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[.06] px-5 py-10 text-sm text-slate-500 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} AcademiaZen. A calmer way to study.</p><div className="flex gap-6"><a href="mailto:support@academiazen.app" className="transition hover:text-white">Support</a><Link to="/login" className="transition hover:text-white">Sign in</Link></div></div></footer>
    </div>
  );
};

export default Landing;
