import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { UserStats, DailySortTask, DailyChallengeState } from '../types';
import { ALL_BADGES, getLevelForXp } from '../data/badges';
import { sound } from '../utils/audio';
import { generateDailyTasksForDate } from '../data/dailyTasks';

export interface ChallengeNotification {
  id: string;
  taskTitle: string;
  taskEmoji: string;
  bonusPoints: number;
  message: string;
  isAllCompleted?: boolean;
}

interface GameContextType {
  stats: UserStats;
  currentCombo: number;
  soundEnabled: boolean;
  activeLevelInfo: ReturnType<typeof getLevelForXp>;
  nextLevelInfo: ReturnType<typeof getLevelForXp> | null;
  dailyTasks: DailySortTask[];
  dailyTasksDate: string;
  allDailyTasksCompleted: boolean;
  totalDailyBonusPointsEarned: number;
  challengeNotification: ChallengeNotification | null;
  dismissNotification: () => void;
  toggleSound: () => void;
  recordAiInspection: () => void;
  resetProgress: () => void;
}

const STORAGE_KEY = 'ecosort_gamification_stats_v1';
const DAILY_CHALLENGES_KEY = 'ecosort_daily_challenges_v2';

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const initialStats: UserStats = {
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: getTodayDateString(),
  totalSorted: 0,
  correctSorted: 0,
  highScore: 0,
  unlockedBadgeIds: [],
  completedQuestIds: [],
  co2DivertedKg: 0,
  energySavedKwh: 0,
  waterSavedLiters: 0,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<UserStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialStats, ...parsed };
      }
    } catch {
      // Fallback
    }
    return initialStats;
  });

  const [dailyChallengeState, setDailyChallengeState] = useState<DailyChallengeState>(() => {
    const today = getTodayDateString();
    try {
      const saved = localStorage.getItem(DAILY_CHALLENGES_KEY);
      if (saved) {
        const parsed: DailyChallengeState = JSON.parse(saved);
        if (parsed.date === today && Array.isArray(parsed.tasks) && parsed.tasks.length === 3) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return {
      date: today,
      tasks: generateDailyTasksForDate(today),
      allCompletedBonusClaimed: false,
    };
  });

  const [challengeNotification, setChallengeNotification] = useState<ChallengeNotification | null>(null);
  const [currentCombo, setCurrentCombo] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => sound.enabled);

  // Persist gamification stats to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // Ignore storage errors
    }
  }, [stats]);

  // Persist daily challenges to local storage
  useEffect(() => {
    try {
      localStorage.setItem(DAILY_CHALLENGES_KEY, JSON.stringify(dailyChallengeState));
    } catch {
      // Ignore storage errors
    }
  }, [dailyChallengeState]);

  // Check for daily rollover
  useEffect(() => {
    const checkDayRollover = () => {
      const today = getTodayDateString();
      setDailyChallengeState(prev => {
        if (prev.date !== today) {
          return {
            date: today,
            tasks: generateDailyTasksForDate(today),
            allCompletedBonusClaimed: false,
          };
        }
        return prev;
      });
    };

    const interval = setInterval(checkDayRollover, 60000);
    return () => clearInterval(interval);
  }, []);

  const dismissNotification = useCallback(() => {
    setChallengeNotification(null);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      sound.enabled = next;
      if (next) sound.playClick();
      return next;
    });
  }, []);

  const triggerConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#14b8a6'],
      });
    } catch {
      // Ignore confetti errors
    }
  }, []);

  const awardBadge = useCallback((badgeId: string) => {
    setStats(prev => {
      if (prev.unlockedBadgeIds.includes(badgeId)) return prev;
      triggerConfetti();
      sound.playLevelUp();
      return {
        ...prev,
        unlockedBadgeIds: [...prev.unlockedBadgeIds, badgeId],
      };
    });
  }, [triggerConfetti]);

  const addXp = useCallback((amount: number) => {
    setStats(prev => {
      const newXp = prev.xp + amount;
      const oldLevel = getLevelForXp(prev.xp);
      const newLevel = getLevelForXp(newXp);

      if (newLevel.level > oldLevel.level) {
        sound.playLevelUp();
        triggerConfetti();
      }

      return {
        ...prev,
        xp: newXp,
        level: newLevel.level,
      };
    });
  }, [triggerConfetti]);

  const recordAiInspection = useCallback(() => {
    addXp(15);
    awardBadge('ai_inquisitor');
  }, [addXp, awardBadge]);

  const resetProgress = useCallback(() => {
    if (window.confirm('Reset all your WasteSort XP, badges, daily challenges, and sorting stats?')) {
      const today = getTodayDateString();
      setStats(initialStats);
      setCurrentCombo(0);
      setDailyChallengeState({
        date: today,
        tasks: generateDailyTasksForDate(today),
        allCompletedBonusClaimed: false,
      });
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DAILY_CHALLENGES_KEY);
    }
  }, []);

  const activeLevelInfo = getLevelForXp(stats.xp);
  const nextLevelIndex = activeLevelInfo.level;
  const nextLevelInfo = ALL_BADGES ? (nextLevelIndex < 7 ? getLevelForXp(activeLevelInfo.maxXp) : null) : null;

  const allDailyTasksCompleted = dailyChallengeState.tasks.length === 3 && dailyChallengeState.tasks.every(t => t.completed);
  const totalDailyBonusPointsEarned = dailyChallengeState.tasks
    .filter(t => t.completed)
    .reduce((acc, t) => acc + t.bonusPoints, 0) + (dailyChallengeState.allCompletedBonusClaimed ? 100 : 0);

  return (
    <GameContext.Provider
      value={{
        stats,
        currentCombo,
        soundEnabled,
        activeLevelInfo,
        nextLevelInfo,
        dailyTasks: dailyChallengeState.tasks,
        dailyTasksDate: dailyChallengeState.date,
        allDailyTasksCompleted,
        totalDailyBonusPointsEarned,
        challengeNotification,
        dismissNotification,
        toggleSound,
        recordAiInspection,
        resetProgress,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

