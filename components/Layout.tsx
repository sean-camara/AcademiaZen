import React, { useState, useEffect } from 'react';
import { Tab, ZenState } from '../types';
import { IconHome, IconCalendar, IconReview, IconFocus, IconLibrary, IconSettings, IconBot } from './Icons';
import Home from '../pages/Home';
import Calendar from '../pages/Calendar';
import Review from '../pages/Review';
import Focus from '../pages/Focus';
import Library from '../pages/Library';
import Settings from '../pages/Settings';
import ZenAI from '../pages/ZenAI';
import { useZen } from '../context/ZenContext';

interface LayoutProps {}

const Layout: React.FC<LayoutProps> = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Home);
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const { focusSession, hideNavbar, setHideNavbar } = useZen();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Detect keyboard visibility using visualViewport API
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const keyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
        setKeyboardVisible(keyboardOpen);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, []);

  // Hide navbar when modals are open
  useEffect(() => {
    setHideNavbar(showSettings || showAI);
  }, [showSettings, showAI, setHideNavbar]);

  const navItems = [
    { tab: Tab.Home, icon: IconHome, label: 'Home' },
    { tab: Tab.Calendar, icon: IconCalendar, label: 'Calendar' },
    { tab: Tab.Review, icon: IconReview, label: 'Review' },
    { tab: Tab.Focus, icon: IconFocus, label: 'Focus' },
    { tab: Tab.Library, icon: IconLibrary, label: 'Library' },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-zen-bg text-zen-text-primary overflow-hidden font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-5 bg-zen-bg z-10 sticky top-0">
        <div className="flex items-center gap-2 group cursor-pointer">
           <h1 className="text-xl font-medium tracking-wide text-zen-primary/90 group-hover:scale-110 transition-transform duration-500">ZEN</h1>
        </div>
        
        <div className="flex items-center gap-4">
           {/* AI Assistant Button */}
           <button 
             onClick={() => setShowAI(true)}
             className="p-2 rounded-full hover:bg-zen-surface transition-all text-zen-secondary relative active:scale-90"
           >
             <IconBot className="w-6 h-6" />
           </button>
           
           {/* Settings Button */}
           <button 
             onClick={() => setShowSettings(true)}
             className="p-2 rounded-full hover:bg-zen-surface transition-all text-zen-text-secondary active:scale-90"
           >
             <IconSettings className="w-6 h-6" />
           </button>
        </div>
      </header>

      {/* Main Content - Using display:none for persistence with entry animations */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative pb-24">
        <div className={activeTab === Tab.Home ? 'block h-full animate-reveal' : 'hidden h-full'}><Home /></div>
        <div className={activeTab === Tab.Calendar ? 'block h-full animate-reveal' : 'hidden h-full'}><Calendar /></div>
        <div className={activeTab === Tab.Review ? 'block h-full animate-reveal' : 'hidden h-full'}><Review /></div>
        <div className={activeTab === Tab.Focus ? 'block h-full animate-reveal' : 'hidden h-full'}><Focus /></div>
        <div className={activeTab === Tab.Library ? 'block h-full animate-reveal' : 'hidden h-full'}><Library /></div>
      </main>

      {/* Floating Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 bg-zen-bg/95 backdrop-blur-md border-t border-zen-surface px-4 py-2 pb-6 flex justify-around items-center z-20 transition-transform duration-300 ${hideNavbar || keyboardVisible ? 'translate-y-full' : 'translate-y-0'}`}>
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          const isFocusRunning = item.tab === Tab.Focus && focusSession.isActive;
          
          return (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 relative ${
                isActive ? 'text-zen-primary transform -translate-y-1' : 'text-zen-text-disabled hover:text-zen-text-secondary'
              }`}
            >
              <item.icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : ''} ${isFocusRunning && !isActive ? 'animate-pulse text-zen-primary' : ''}`} />
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-zen-primary rounded-full animate-scale-in" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Overlays */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showAI && <ZenAI onClose={() => setShowAI(false)} />}
    </div>
  );
};

export default Layout;