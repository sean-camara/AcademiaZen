import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Bell, Shield, Sun, Moon, Edit2, Check, X, Camera } from 'lucide-react';
import { Card, Button } from '../components/UI';
import { useNavigate } from 'react-router-dom';

export default function Settings({ controller }) {
  const { user, logout } = useAuth(); 
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Destructure with SAFE defaults. 
  // Even if controller is null, we default to empty object.
  // Even if userProfile is null, we default to empty object.
  const { 
      userProfile = {}, 
      updateUserProfile = () => {}, 
      darkMode = false, 
      setDarkMode = () => {} 
  } = controller || {};

  // --- STATE ---
  const [isEditingName, setIsEditingName] = useState(false);
  
  // Initialize tempName with whatever we have (Profile name > Auth name > "Student")
  const [tempName, setTempName] = useState(
      userProfile?.displayName || user?.displayName || "Student"
  );
  
  const [notificationsOn, setNotificationsOn] = useState(true);

  // Sync state if userProfile loads later
  useEffect(() => {
    if (userProfile?.displayName) {
        setTempName(userProfile.displayName);
    }
  }, [userProfile]);

  // --- HANDLERS ---
  const handleSaveName = () => {
      updateUserProfile({ displayName: tempName });
      setIsEditingName(false);
  };

  const handleCancelEdit = () => {
      // Revert to saved name
      setTempName(userProfile?.displayName || user?.displayName || "Student");
      setIsEditingName(false);
  };

  const handleLogout = async () => {
      if(window.confirm("Are you sure you want to log out?")) {
          await logout();
          navigate('/login');
      }
  };

  const handlePhotoUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) { 
              alert("Image too large. Please pick one under 2MB.");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              updateUserProfile({ photo: reader.result }); 
          };
          reader.readAsDataURL(file);
      }
  };

  // --- DERIVED VALUES (Fail-safe) ---
  // We calculate these inside render so they update instantly
  const currentName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || "Student";
  const currentPhoto = userProfile?.photo || user?.photoURL;
  const currentEmail = user?.email || "Guest Account";

  // Reusable Card Style for consistency
  const cardClassName = `p-4 flex items-center justify-between border transition-all duration-300 ${
      darkMode 
        ? 'bg-[#2c333e] border-stone-700 hover:border-stone-600' 
        : 'bg-white border-slate-100 shadow-sm hover:border-[#4a7a7d]/30'
  }`;

  return (
    <div className={`pb-24 animate-in fade-in duration-500 w-full min-h-screen transition-colors duration-300 ${darkMode ? 'bg-[#1c2128]' : 'bg-[#f5f5f4]'}`}>
      
      <div className="max-w-xl mx-auto px-4 pt-8">
        
        {/* --- HEADER --- */}
        <div className="mb-6">
            <h2 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-[#4A7A7D]' : 'text-slate-900'}`}>Settings</h2>
            <p className={`text-sm mt-1 ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>Manage your profile and preferences</p>
        </div>
        
        {/* --- PROFILE CARD --- */}
        <Card className={`relative overflow-hidden mb-8 border-none shadow-lg transition-colors ${darkMode ? 'bg-[#2C333E]' : 'bg-white'}`}>
            {/* Header Background */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-[#4a7a7d] to-[#2d5c5e]"></div>
            
            <div className="relative pt-14 px-6 pb-6 flex flex-col items-center">
                
                {/* Avatar */}
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className={`w-28 h-28 rounded-3xl flex items-center justify-center text-white font-bold text-4xl shadow-xl border-4 overflow-hidden transition-colors ${darkMode ? 'bg-[#2C333E] border-[#2C333E]' : 'bg-white border-white'}`}>
                        {currentPhoto ? (
                            <img src={currentPhoto} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[#4a7a7d]">{currentName[0]?.toUpperCase()}</span>
                        )}
                    </div>
                    {/* Camera Badge */}
                    <div className={`absolute -bottom-2 -right-2 p-2 rounded-xl shadow-md transition-transform hover:scale-110 ${darkMode ? 'bg-[#1c2128] text-[#4a7a7d] border border-stone-700' : 'bg-white text-[#4a7a7d] border border-slate-200'}`}>
                        <Camera size={18} />
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
                </div>

                {/* Name & Edit Logic */}
                <div className="mt-5 text-center w-full">
                    {isEditingName ? (
                        <div className="flex items-center justify-center gap-2 mb-2 animate-in slide-in-from-bottom-2">
                            <input 
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className={`text-xl font-bold px-3 py-1.5 rounded-xl outline-none border-2 border-[#4a7a7d] w-full max-w-[200px] text-center ${darkMode ? 'bg-[#1c2128] text-white' : 'bg-slate-50 text-slate-800'}`}
                                autoFocus
                            />
                            <button onClick={handleSaveName} className="p-2 bg-[#4a7a7d] text-white rounded-xl hover:bg-[#3b6366] shadow-sm transition-colors"><Check size={20}/></button>
                            <button onClick={handleCancelEdit} className={`p-2 rounded-xl border transition-colors ${darkMode ? 'border-stone-600 text-stone-400 hover:bg-stone-700' : 'border-slate-200 text-slate-400 hover:bg-slate-100'}`}><X size={20}/></button>
                        </div>
                    ) : (
                        <div className="group flex items-center justify-center gap-2 cursor-pointer p-1" onClick={() => setIsEditingName(true)}>
                            <h3 className={`font-bold text-2xl ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentName}</h3>
                            <div className={`p-1.5 rounded-lg transition-all opacity-50 group-hover:opacity-100 ${darkMode ? 'bg-stone-700/50 text-stone-400' : 'bg-slate-100 text-slate-400'}`}>
                                <Edit2 size={14} />
                            </div>
                        </div>
                    )}
                    <p className={`font-medium text-sm mt-1 ${darkMode ? 'text-stone-500' : 'text-slate-500'}`}>{currentEmail}</p>
                </div>
            </div>
        </Card>

        {/* --- PREFERENCES --- */}
        <div className="space-y-6">
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-3">Preferences</p>
                <div className="space-y-3">
                    
                    {/* Notifications Toggle */}
                    <Card 
                        className={cardClassName}
                        onClick={() => setNotificationsOn(!notificationsOn)}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${notificationsOn ? 'bg-[#4a7a7d]/10 text-[#4a7a7d]' : 'bg-slate-100 text-slate-400'} ${darkMode && !notificationsOn ? 'bg-[#1c2128]' : ''}`}>
                                <Bell size={20} />
                            </div>
                            <div>
                                <p className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>Notifications</p>
                                <p className={`text-xs mt-0.5 ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>Enable task alerts</p>
                            </div>
                        </div>
                        <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${notificationsOn ? 'bg-[#4a7a7d]' : (darkMode ? 'bg-stone-600' : 'bg-slate-200')}`}>
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${notificationsOn ? 'left-6' : 'left-1'}`}></div>
                        </div>
                    </Card>
                    
                    {/* Theme Toggle */}
                    <Card 
                        className={cardClassName}
                        onClick={() => setDarkMode(!darkMode)}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${!darkMode ? 'bg-amber-100 text-amber-500' : 'bg-[#1c2128] text-indigo-400'}`}>
                                {darkMode ? <Moon size={20} /> : <Sun size={20} />}
                            </div>
                            <div>
                                <p className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>Appearance</p>
                                <p className={`text-xs mt-0.5 ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>{darkMode ? 'Dark Mode' : 'Light Mode'}</p>
                            </div>
                        </div>
                         <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${darkMode ? 'bg-indigo-600' : 'bg-amber-400'}`}>
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${darkMode ? 'left-6' : 'left-1'}`}>
                                {darkMode ? <Moon size={10} className="text-indigo-600"/> : <Sun size={10} className="text-amber-400"/>}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Account */}
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-3">Account</p>
                <div className="space-y-3">
                    <Card className={cardClassName}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${darkMode ? 'bg-[#1c2128] text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <p className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>Security</p>
                                <p className={`text-xs mt-0.5 ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>Standard Auth</p>
                            </div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide ${darkMode ? 'bg-[#4a7a7d]/20 text-[#4a7a7d]' : 'bg-[#4a7a7d]/10 text-[#4a7a7d]'}`}>
                            ACTIVE
                        </div>
                    </Card>

                    <Button 
                        onClick={handleLogout} 
                        className={`w-full py-4 font-bold flex items-center justify-center gap-2 border shadow-none mt-6 transition-all ${
                            darkMode 
                                ? 'bg-rose-900/20 border-rose-800 text-rose-400 hover:bg-rose-900/30' 
                                : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        }`}
                    >
                        <LogOut size={18} /> Sign Out
                    </Button>
                </div>
            </div>
        </div>
        
        <div className="mt-12 mb-6 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest opacity-50">AcademiaZen v2.3</p>
        </div>

      </div>
    </div>
  );
}