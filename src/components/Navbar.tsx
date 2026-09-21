import React from 'react';
import { Sparkles, Flame, Volume2, VolumeX } from 'lucide-react';
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
    <header className="glass border-x-0 border-t-0 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: Brand, Level stats, Sound */}
        <div className="flex items-center justify-between py-3.5 gap-3 border-b border-stone-900/5">
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 text-left cursor-pointer group"
          >
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 group-hover:from-emerald-400 group-hover:to-emerald-600 transition-all text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-emerald-900/20 group-hover:shadow-emerald-500/30 group-hover:scale-105 group-hover:-rotate-3">
              <span className="drop-shadow-sm">🌍</span>
              <span className="absolute inset-0 rounded-2xl ring-2 ring-emerald-300/0 group-hover:ring-emerald-300/60 transition-all" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-stone-900 to-emerald-700 tracking-tight text-lg group-hover:from-emerald-700 group-hover:to-amber-600 transition-all">WasteSort</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200/70">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Quest Edition
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">Interactive Waste Management & Recycling Mastery</p>
            </div>
          </button>

          {/* Gamification Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Streak Counter */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              currentCombo > 0
                ? 'bg-amber-100/80 text-amber-900 border border-amber-300/70 animate-pulse'
                : 'bg-white/60 text-stone-600 border border-stone-200/70'
            }`}>
              <Flame className={`w-4 h-4 ${currentCombo > 0 ? 'text-amber-600 fill-amber-500' : 'text-stone-400'}`} />
              <span>{currentCombo > 0 ? `${currentCombo}x Streak` : '0 Streak'}</span>
            </div>

            {/* Level & XP widget */}
            <div className="flex items-center gap-2 bg-white/60 border border-stone-200/70 px-3 py-1.5 rounded-2xl">
              <span className="text-base">{activeLevelInfo.badge}</span>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-stone-800 leading-tight">
                  Lvl {activeLevelInfo.level}: {activeLevelInfo.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-24 bg-stone-200/70 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-stone-500 font-semibold">{stats.xp} XP</span>
                </div>
              </div>
              <div className="md:hidden text-xs font-bold text-emerald-800">
                Lvl {activeLevelInfo.level}
              </div>
            </div>

            {/* Sound Toggle */}
            <button
              id="btn-toggle-sound"
              onClick={toggleSound}
              className="p-2.5 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/70 bg-white/40 border border-stone-200/70 transition-colors cursor-pointer"
              title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
              aria-label="Toggle sound effects"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-700" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
            </button>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex items-center space-x-1.5 py-2.5 overflow-x-auto no-scrollbar">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-900/20 scale-[1.02]'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isActive ? 'bg-white/25 text-white' : 'bg-stone-900/5 text-stone-500'
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
