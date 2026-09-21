import React from 'react';
import { Target, CheckCircle2, Sparkles, Trophy, Calendar } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface DailyChallengesCardProps {
  compact?: boolean;
}

export const DailyChallengesCard: React.FC<DailyChallengesCardProps> = ({ compact = false }) => {
  const { dailyTasks, allDailyTasksCompleted, totalDailyBonusPointsEarned, dailyTasksDate } = useGame();

  const completedCount = dailyTasks.filter(t => t.completed).length;

  return (
    <div
      id="daily-challenges-widget"
      className="glass-strong rounded-3xl p-5 sm:p-6 relative overflow-hidden"
    >
      {/* Decorative subtle background accents */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-100/50 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-amber-100/40 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-black text-lg shadow-2xs shrink-0">
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-stone-900 tracking-tight">
                Daily Sorting Challenges
              </h3>
              <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Bonus XP
              </span>
            </div>
            <p className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <span>Tasks for {dailyTasksDate} • Complete all 3 for +100 XP Master Bonus</span>
            </p>
          </div>
        </div>

        {/* Completion Counter & Total Earned */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] font-bold text-stone-400 uppercase block leading-none">Completed</span>
            <span className={`text-sm font-extrabold ${completedCount === 3 ? 'text-emerald-600' : 'text-stone-800'}`}>
              {completedCount} / 3
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] font-bold text-amber-700 uppercase block leading-none">Bonus Earned</span>
            <span className="text-sm font-extrabold text-amber-900">
              +{totalDailyBonusPointsEarned} XP
            </span>
          </div>
        </div>
      </div>

      {/* All Completed Banner */}
      {allDailyTasksCompleted && (
        <div className="mt-4 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border-2 border-emerald-300 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-xl shrink-0">
            🏆
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                Daily Master Bonus Unlocked!
              </span>
              <span className="text-[10px] font-extrabold bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded-full">
                +100 XP Awarded
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5 font-medium">
              You crushed all three daily waste-sorting tasks! Check back tomorrow for 3 fresh challenges.
            </p>
          </div>
        </div>
      )}

      {/* The 3 Specific Tasks */}
      <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
        {dailyTasks.map((task, idx) => {
          const progressPercent = Math.min(100, Math.round((task.current / task.target) * 100));

          return (
            <div
              key={task.id}
              id={`daily-task-card-${idx + 1}`}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between relative ${
                task.completed
                  ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                  : 'bg-stone-50/70 border-stone-200/90 hover:border-emerald-200 hover:bg-stone-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl p-1 bg-white border border-stone-200 rounded-xl shadow-2xs">
                      {task.emoji}
                    </span>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-stone-600 block">
                        Task {idx + 1}
                      </span>
                      <h4 className="font-extrabold text-sm text-stone-900 leading-tight">
                        {task.title}
                      </h4>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-full whitespace-nowrap border shrink-0 ${
                      task.completed
                        ? 'bg-emerald-200 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    +{task.bonusPoints} XP
                  </span>
                </div>

                <p className="text-xs text-stone-600 mb-3 leading-relaxed">
                  {task.description}
                </p>
              </div>

              {/* Progress and status */}
              <div className="mt-2 pt-2 border-t border-stone-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-500">
                    {task.completed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Completed
                      </span>
                    ) : (
                      <span>Progress</span>
                    )}
                  </span>
                  <span className="font-extrabold text-stone-800">
                    {task.current} / {task.target}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-stone-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      task.completed ? 'bg-emerald-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
