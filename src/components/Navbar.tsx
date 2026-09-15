import React from 'react';
import { Sparkles, Flame, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useGame } from '../context/GameContext';

export type ActiveTab = 'home' | 'bin_master' | 'contamination_detective' | 'trivia' | 'ai_inspector';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { stats, currentCombo, soundEnabled, toggleSound, activeLevelInfo, dailyTasks } = useGame();

  const completedDailyCount = dailyTasks.filter(t => t.completed).length;

  // Calculate progress to next level
  const xpCurrentLevel = stats.xp - activeLevelInfo.minXp;
  const xpSpan = activeLevelInfo.maxXp - activeLevelInfo.minXp;
  const progressPercent = activeLevelInfo.level >= 7 ? 100 : Math.min(100, Math.max(0, Math.round((xpCurrentLevel / xpSpan) * 100)));

  const navItems = [
    { id: 'home' as ActiveTab, label: 'Home & Guide', icon: '🏠', badge: 'Start' },
    { id: 'bin_master' as ActiveTab, label: 'Bin Master', icon: '🎯', badge: `${completedDailyCount}/3 Daily` },
    { id: 'contamination_detective' as ActiveTab, label: 'Detective', icon: '🕵️', badge: 'Puzzle' },
    { id: 'trivia' as ActiveTab, label: 'Trivia', icon: '🧠', badge: 'Quiz' },
    { id: 'ai_inspector' as ActiveTab, label: 'AI Inspector', icon: '🤖', badge: 'Smart' },
  ];

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: Brand, Level stats, Sound */}
        <div className="flex items-center justify-between py-3 gap-3 border-b border-stone-100">
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 text-left cursor-pointer group"
          >
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-700 to-amber-700 group-hover:from-green-600 group-hover:to-amber-600 transition-all text-white flex items-center justify-center font-bold text-xl shadow-md shadow-green-900/20 group-hover:shadow-amber-600/40 group-hover:scale-105 group-hover:-rotate-3">
              <span className="drop-shadow-sm">🌍</span>
              <span className="absolute inset-0 rounded-xl ring-2 ring-amber-300/0 group-hover:ring-amber-300/60 transition-all" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-stone-900 to-green-800 tracking-tight text-lg group-hover:from-green-700 group-hover:to-amber-700 transition-all">WasteSort</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-gradient-to-r from-green-100 to-amber-100 text-green-900 px-2 py-0.5 rounded-full border border-amber-200/60">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Quest Edition
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">Interactive Waste Management & Recycling Mastery</p>
            </div>
          </button>

          {/* Gamification Bar */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Streak Counter */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
              currentCombo > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                : 'bg-stone-100 text-stone-600'
            }`}>
              <Flame className={`w-4 h-4 ${currentCombo > 0 ? 'text-amber-600 fill-amber-500' : 'text-stone-400'}`} />
              <span>{currentCombo > 0 ? `${currentCombo}x Streak` : '0 Streak'}</span>
            </div>

            {/* Level & XP widget */}
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1 rounded-xl">
              <span className="text-base">{activeLevelInfo.badge}</span>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-stone-800 leading-tight">
                  Lvl {activeLevelInfo.level}: {activeLevelInfo.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-24 bg-stone-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-green-700 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-stone-500 font-semibold">{stats.xp} XP</span>
                </div>
              </div>
              <div className="md:hidden text-xs font-bold text-green-800">
                Lvl {activeLevelInfo.level}
              </div>
            </div>

            {/* Sound Toggle */}
            <button
              id="btn-toggle-sound"
              onClick={toggleSound}
              className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors"
              title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
              aria-label="Toggle sound effects"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-green-700" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
            </button>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-green-700 to-amber-700 text-white shadow-md shadow-green-900/20 scale-[1.03]'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                      isActive ? 'bg-green-900/60 text-white' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
