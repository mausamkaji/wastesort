import React from 'react';
import { Award, Flame, TreePine, Droplets, Zap, ShieldCheck, RotateCcw } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { ALL_BADGES, LEVEL_THRESHOLDS } from '../data/badges';
import { DailyChallengesCard } from './DailyChallengesCard';

export const ImpactDashboard: React.FC = () => {
  const { stats, activeLevelInfo, resetProgress } = useGame();

  const xpCurrentLevel = stats.xp - activeLevelInfo.minXp;
  const xpSpan = activeLevelInfo.maxXp - activeLevelInfo.minXp;
  const progressPercent = activeLevelInfo.level >= 7 ? 100 : Math.min(100, Math.max(0, Math.round((xpCurrentLevel / xpSpan) * 100)));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 1. Level & Hero Summary */}
      <div className="glass-strong rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-3xl flex items-center justify-center shadow-xs shrink-0">
              {activeLevelInfo.badge}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Level {activeLevelInfo.level}
                </span>
                <span className="text-xs font-bold text-stone-500">
                  {stats.xp} Total XP
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight mt-1">
                {activeLevelInfo.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-center">
              <span className="text-[10px] font-bold text-stone-500 uppercase block">Accuracy</span>
              <span className="text-base font-extrabold text-emerald-700">
                {stats.totalSorted > 0 ? `${Math.round((stats.correctSorted / stats.totalSorted) * 100)}%` : '100%'}
              </span>
            </div>
            <div className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-center">
              <span className="text-[10px] font-bold text-stone-500 uppercase block">High Streak</span>
              <span className="text-base font-extrabold text-amber-700">
                {stats.highScore}x
              </span>
            </div>
          </div>
        </div>

        {/* Level XP bar */}
        <div className="mt-6 pt-4 border-t border-stone-100 space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-stone-700">
            <span>Progress to Next Rank</span>
            <span>{activeLevelInfo.level >= 7 ? 'Max Level Achieved!' : `${xpCurrentLevel} / ${xpSpan} XP`}</span>
          </div>
          <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden border border-stone-200/80">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Daily Waste-Sorting Challenges System */}
      <DailyChallengesCard />

      {/* 2. Tangible Environmental Impact Counters */}
      <div>
        <h3 className="text-base font-extrabold text-stone-900 mb-3 flex items-center gap-2">
          <span>🌱 Estimated Resource Conservation</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass glass-hover rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <TreePine className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-stone-500 block">GHG Emissions Prevented</span>
              <span className="text-xl font-extrabold text-stone-900">
                {stats.co2DivertedKg} <span className="text-xs font-bold text-stone-500">kg CO₂e</span>
              </span>
            </div>
          </div>

          <div className="glass glass-hover rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-stone-500 block">Electricity Conserved</span>
              <span className="text-xl font-extrabold text-stone-900">
                {stats.energySavedKwh} <span className="text-xs font-bold text-stone-500">kWh</span>
              </span>
            </div>
          </div>

          <div className="glass glass-hover rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-sky-700 rounded-xl">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-stone-500 block">Clean Water Protected</span>
              <span className="text-xl font-extrabold text-stone-900">
                {stats.waterSavedLiters} <span className="text-xs font-bold text-stone-500">Liters</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Badges Showcase */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span>Achievement Badges ({stats.unlockedBadgeIds.length}/{ALL_BADGES.length})</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {ALL_BADGES.map(badge => {
            const isUnlocked = stats.unlockedBadgeIds.includes(badge.id);

            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  isUnlocked
                    ? 'glass border-amber-300/70 shadow-md shadow-amber-900/5'
                    : 'bg-stone-50/50 border-stone-200/60 opacity-60'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center shrink-0 ${
                  isUnlocked ? 'bg-amber-100 shadow-2xs' : 'bg-stone-200 grayscale'
                }`}>
                  {badge.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-stone-900">
                      {badge.title}
                    </h4>
                    {isUnlocked && (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                    {badge.description}
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    {isUnlocked ? '✓ Unlocked' : '🔒 Locked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Level Roadmap */}
      <div className="glass-strong rounded-3xl p-6 space-y-4">
        <h3 className="text-base font-extrabold text-stone-900">
          WasteSort Rank Progression Ladder
        </h3>
        <div className="space-y-2">
          {LEVEL_THRESHOLDS.map(lvl => {
            const isCurrent = lvl.level === activeLevelInfo.level;
            const isPassed = stats.xp >= lvl.maxXp;

            return (
              <div
                key={lvl.level}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                  isCurrent
                    ? 'bg-emerald-50 border-emerald-400 font-bold text-emerald-950 shadow-2xs'
                    : isPassed
                    ? 'bg-stone-50 border-stone-200 text-stone-700'
                    : 'bg-white border-stone-200 text-stone-400 opacity-70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{lvl.badge}</span>
                  <span className="font-bold">Lvl {lvl.level}: {lvl.name}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span>{lvl.minXp} - {lvl.maxXp === 99999 ? '∞' : lvl.maxXp} XP</span>
                  {isCurrent && (
                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                      Active
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset Progress Footer */}
      <div className="pt-4 flex justify-end">
        <button
          id="btn-reset-stats"
          onClick={resetProgress}
          className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset all game progress</span>
        </button>
      </div>
    </div>
  );
};
