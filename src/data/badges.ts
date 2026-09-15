import { Badge } from '../types';

export const ALL_BADGES: Badge[] = [
  {
    id: 'first_sort',
    title: 'First Step',
    description: 'Sorted your first waste item correctly in the Bin Master challenge.',
    icon: '🌱',
    category: 'sorting',
  },
  {
    id: 'streak_5',
    title: 'Streak Ignition',
    description: 'Achieved a 5x flawless sorting streak without mistakes.',
    icon: '🔥',
    category: 'streak',
  },
  {
    id: 'streak_10',
    title: 'Precision Sorter',
    description: 'Achieved an incredible 10x consecutive sorting combo.',
    icon: '⚡',
    category: 'streak',
  },
  {
    id: 'detective_master',
    title: 'Purity Inspector',
    description: 'Caught all hidden batch contaminants in the Contamination Detective game.',
    icon: '🕵️',
    category: 'detective',
  },
  {
    id: 'trivia_whiz',
    title: 'Recycle IQ Scholar',
    description: 'Answered 5 recycling trivia and myth-buster questions correctly.',
    icon: '🧠',
    category: 'scholar',
  },
  {
    id: 'ai_inquisitor',
    title: 'Eco-AI Explorer',
    description: 'Used WasteSort AI to inspect an obscure or complex household item.',
    icon: '🤖',
    category: 'ai',
  },
  {
    id: 'hazard_guardian',
    title: 'Hazard Guardian',
    description: 'Safely directed batteries or chemical e-waste away from curbside bins.',
    icon: '🛡️',
    category: 'sorting',
  },
  {
    id: 'soil_alchemist',
    title: 'Soil Alchemist',
    description: 'Correctly diverted organic food waste and greasy paper to composting.',
    icon: '🌿',
    category: 'sorting',
  },
  {
    id: 'myth_destroyer',
    title: 'Myth Destroyer',
    description: 'Correctly sorted 5 tricky deceptive items (like black plastic, receipt paper, or coffee cups).',
    icon: '🎯',
    category: 'scholar',
  },
  {
    id: 'daily_champion',
    title: 'Daily Champion',
    description: 'Completed all three daily waste-sorting tasks in a single day.',
    icon: '🏆',
    category: 'sorting',
  }
];

export interface LevelThreshold {
  level: number;
  name: string;
  minXp: number;
  maxXp: number;
  badge: string;
  color: string;
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, name: 'Landfill Novice', minXp: 0, maxXp: 150, badge: '🌱', color: 'text-stone-700 bg-stone-100 border-stone-300' },
  { level: 2, name: 'Curbside Apprentice', minXp: 150, maxXp: 400, badge: '🧤', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
  { level: 3, name: 'Recycling Ranger', minXp: 400, maxXp: 800, badge: '🌿', color: 'text-teal-700 bg-teal-50 border-teal-300' },
  { level: 4, name: 'Compost Connoisseur', minXp: 800, maxXp: 1400, badge: '🪴', color: 'text-lime-800 bg-lime-50 border-lime-300' },
  { level: 5, name: 'Contamination Detective', minXp: 1400, maxXp: 2200, badge: '🔍', color: 'text-sky-800 bg-sky-50 border-sky-300' },
  { level: 6, name: 'Circular Economy Leader', minXp: 2200, maxXp: 3200, badge: '♻️', color: 'text-indigo-800 bg-indigo-50 border-indigo-300' },
  { level: 7, name: 'Planet Champion', minXp: 3200, maxXp: 99999, badge: '🌍', color: 'text-amber-800 bg-amber-50 border-amber-300' },
];

export function getLevelForXp(xp: number): LevelThreshold {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      return LEVEL_THRESHOLDS[i];
    }
  }
  return LEVEL_THRESHOLDS[0];
}
