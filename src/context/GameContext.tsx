import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { UserStats, WasteItem, DailySortTask, DailyChallengeState } from '../types';
import { ALL_BADGES, getLevelForXp } from '../data/badges';
import { sound } from '../utils/audio';
import { generateDailyTasksForDate, checkTaskMatch } from '../data/dailyTasks';

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
  recordSort: (isCorrect: boolean, item: WasteItem) => { xpGained: number; dailyBonus?: number; newStreak: number };
  recordDetectiveCompleted: (perfect: boolean) => void;
  recordTriviaAnswer: (isCorrect: boolean) => void;
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

  const recordSort = useCallback((isCorrect: boolean, item: WasteItem) => {
    if (isCorrect) {
      sound.playSuccess();
      const newCombo = currentCombo + 1;
      setCurrentCombo(newCombo);

      if (newCombo > 1) {
        sound.playCombo(newCombo);
      }

      // Calculate base sorting XP with combo multiplier
      const multiplier = Math.min(3, 1 + (newCombo - 1) * 0.25);
      const basePoints = item.difficulty === 'expert' ? 30 : item.difficulty === 'tricky' ? 20 : 15;
      const baseSortXp = Math.round(basePoints * multiplier);

      // Estimated eco-impact metrics
      const isRecyclable = item.bin === 'commingled_recycling' || item.bin === 'paper_cardboard' || (item.bin as string) === 'recycling';
      const isOrganic = item.bin === 'organic' || (item.bin as string) === 'compost';
      const co2 = isRecyclable ? 0.35 : isOrganic ? 0.45 : 0.05;
      const kwh = isRecyclable ? 0.6 : 0.1;
      const water = isRecyclable ? 1.5 : 0.8;

      // Evaluate Daily Challenge System progress
      let dailyBonusXp = 0;
      let completedTaskInfo: DailySortTask | null = null;
      let allJustCompleted = false;

      setDailyChallengeState(prev => {
        let taskBonus = 0;
        let justFinishedTask: DailySortTask | null = null;

        const updatedTasks = prev.tasks.map(task => {
          if (task.completed) return task;

          const isMatch = checkTaskMatch(task, item, item.bin, newCombo);
          if (!isMatch) return task;

          const newCurrent = Math.min(task.target, task.current + 1);
          const isDone = newCurrent >= task.target;

          if (isDone) {
            taskBonus += task.bonusPoints;
            justFinishedTask = { ...task, current: newCurrent, completed: true };
          }

          return {
            ...task,
            current: newCurrent,
            completed: isDone,
          };
        });

        // Check if all 3 tasks are now completed
        const completedCount = updatedTasks.filter(t => t.completed).length;
        let allCompletedBonusClaimed = prev.allCompletedBonusClaimed;

        if (completedCount === 3 && !allCompletedBonusClaimed) {
          allCompletedBonusClaimed = true;
          allJustCompleted = true;
          taskBonus += 100; // All-3 Daily Master bonus points!
          awardBadge('daily_champion');
        }

        if (taskBonus > 0) {
          dailyBonusXp = taskBonus;
          completedTaskInfo = justFinishedTask;
          sound.playLevelUp();
          triggerConfetti();

          if (allJustCompleted) {
            setChallengeNotification({
              id: `all-completed-${Date.now()}`,
              taskTitle: 'All 3 Daily Challenges Complete! 🌟',
              taskEmoji: '🏆',
              bonusPoints: taskBonus,
              message: `Incredible sorting! You completed all 3 daily tasks and earned +${taskBonus} total bonus XP!`,
              isAllCompleted: true,
            });
          } else if (justFinishedTask) {
            const task = justFinishedTask as DailySortTask;
            setChallengeNotification({
              id: `task-done-${task.id}-${Date.now()}`,
              taskTitle: `Daily Challenge Complete! ${task.emoji}`,
              taskEmoji: task.emoji,
              bonusPoints: task.bonusPoints,
              message: `"${task.title}" complete! Earned +${task.bonusPoints} bonus points!`,
            });
          }
        }

        return {
          ...prev,
          tasks: updatedTasks,
          allCompletedBonusClaimed,
        };
      });

      const totalXpGained = baseSortXp + dailyBonusXp;

      setStats(prev => {
        const totalCorrect = prev.correctSorted + 1;
        const total = prev.totalSorted + 1;
        const newHighScore = Math.max(prev.highScore, newCombo);
        const newXp = prev.xp + totalXpGained;
        const newLevel = getLevelForXp(newXp).level;

        return {
          ...prev,
          xp: newXp,
          level: newLevel,
          streak: newCombo,
          totalSorted: total,
          correctSorted: totalCorrect,
          highScore: newHighScore,
          co2DivertedKg: parseFloat((prev.co2DivertedKg + co2).toFixed(2)),
          energySavedKwh: parseFloat((prev.energySavedKwh + kwh).toFixed(2)),
          waterSavedLiters: parseFloat((prev.waterSavedLiters + water).toFixed(1)),
        };
      });

      // Check standard badge triggers
      awardBadge('first_sort');
      if (newCombo >= 5) awardBadge('streak_5');
      if (newCombo >= 10) awardBadge('streak_10');
      if ((item.bin as string) === 'hazardous_special' || item.category === 'e_waste_hazardous') awardBadge('hazard_guardian');
      if (isOrganic) awardBadge('soil_alchemist');
      if (item.difficulty === 'tricky' || item.difficulty === 'expert') awardBadge('myth_destroyer');

      return { xpGained: totalXpGained, dailyBonus: dailyBonusXp, newStreak: newCombo };
    } else {
      sound.playError();
      setCurrentCombo(0);
      setStats(prev => ({
        ...prev,
        streak: 0,
        totalSorted: prev.totalSorted + 1,
      }));
      return { xpGained: 0, dailyBonus: 0, newStreak: 0 };
    }
  }, [currentCombo, awardBadge, triggerConfetti]);

  const recordDetectiveCompleted = useCallback((perfect: boolean) => {
    if (perfect) {
      sound.playSuccess();
      triggerConfetti();
      addXp(60);
      awardBadge('detective_master');
    } else {
      addXp(25);
    }
  }, [addXp, awardBadge, triggerConfetti]);

  const recordTriviaAnswer = useCallback((isCorrect: boolean) => {
    if (isCorrect) {
      sound.playSuccess();
      addXp(25);
      awardBadge('trivia_whiz');
    } else {
      sound.playError();
    }
  }, [addXp, awardBadge]);

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
        recordSort,
        recordDetectiveCompleted,
        recordTriviaAnswer,
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

