import React, { useEffect } from 'react';
import { Sparkles, Trophy, X, CheckCircle2 } from 'lucide-react';
import { useGame } from '../context/GameContext';

export const DailyChallengeNotification: React.FC = () => {
  const { challengeNotification, dismissNotification } = useGame();

  useEffect(() => {
    if (challengeNotification) {
      const timer = setTimeout(() => {
        dismissNotification();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [challengeNotification, dismissNotification]);

  if (!challengeNotification) return null;

  return (
    <div
      id="daily-challenge-toast"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div className="glass-dark text-white p-4 rounded-2xl ring-1 ring-amber-400/40 flex items-start gap-3.5 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-2xl shrink-0">
          {challengeNotification.taskEmoji}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-stone-950" />
              Bonus +{challengeNotification.bonusPoints} XP
            </span>
            <span className="text-xs font-bold text-amber-200">
              Daily Challenge
            </span>
          </div>
          <h4 className="font-extrabold text-sm text-white tracking-tight">
            {challengeNotification.taskTitle}
          </h4>
          <p className="text-xs text-stone-300 mt-1 leading-relaxed">
            {challengeNotification.message}
          </p>
        </div>

        <button
          onClick={dismissNotification}
          className="absolute top-3 right-3 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
