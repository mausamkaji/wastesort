import { DailySortTask, WasteItem } from '../types';

// Curated template pools for generating balanced, diverse daily sorting challenges
interface TaskTemplate {
  title: string;
  description: string;
  emoji: string;
  target: number;
  bonusPoints: number;
  taskType: 'bin' | 'difficulty' | 'specific_item' | 'category' | 'streak';
  targetBin?: DailySortTask['targetBin'];
  targetCategory?: DailySortTask['targetCategory'];
  targetDifficulty?: DailySortTask['targetDifficulty'];
  itemKeywords?: string[];
  streakTarget?: number;
}

// Pool 1: Dedicated Material & Bin Stream Tasks
const STREAM_TASKS: TaskTemplate[] = [
  {
    title: 'Paper & Cardboard Sorter',
    description: 'Correctly sort 3 clean items into the Blue Paper & Cardboard bin',
    emoji: '📦',
    target: 3,
    bonusPoints: 45,
    taskType: 'bin',
    targetBin: 'paper_cardboard',
  },
  {
    title: 'Container Recycler',
    description: 'Recycle 3 rigid plastic bottles, aluminum cans, or glass jars into the Yellow Commingled bin',
    emoji: '🧴',
    target: 3,
    bonusPoints: 45,
    taskType: 'bin',
    targetBin: 'commingled_recycling',
  },
  {
    title: 'Compost & FOGO Champion',
    description: 'Divert 3 organic food scraps or garden clippings into the Green Organic bin',
    emoji: '🌿',
    target: 3,
    bonusPoints: 45,
    taskType: 'bin',
    targetBin: 'organic',
  },
  {
    title: 'Residual Waste Specialist',
    description: 'Place 2 non-recyclable items (like greasy pizza box bottoms or soft plastic wrappers) into Red General Waste',
    emoji: '🗑️',
    target: 2,
    bonusPoints: 40,
    taskType: 'bin',
    targetBin: 'general_waste',
  },
  {
    title: 'Carnivore Stream Diverter',
    description: 'Correctly place 2 raw meat scraps, bones, or seafood shells into the Orange Meat & Bones bin',
    emoji: '🥩',
    target: 2,
    bonusPoints: 50,
    taskType: 'bin',
    targetBin: 'meat_bones',
  },
  {
    title: 'E-Waste & Battery Safeguard',
    description: 'Direct 1 hazardous item (battery, old phone, or broken appliance) to designated drop-off',
    emoji: '🔋',
    target: 1,
    bonusPoints: 50,
    taskType: 'bin',
    targetBin: 'e_waste',
  },
];

// Pool 2: High-Skill & Tricky Contamination Busting Tasks
const TRICKY_AND_SKILL_TASKS: TaskTemplate[] = [
  {
    title: 'Myth Buster',
    description: 'Correctly sort 2 tricky or deceptive waste items (e.g. coffee cups, receipts, greasy boxes)',
    emoji: '🎯',
    target: 2,
    bonusPoints: 60,
    taskType: 'difficulty',
    targetDifficulty: 'tricky',
  },
  {
    title: 'Pizza Box Protocol',
    description: 'Correctly divert a greasy pizza box into Red General Waste (not green bin)',
    emoji: '🍕',
    target: 1,
    bonusPoints: 50,
    taskType: 'specific_item',
    itemKeywords: ['pizza', 'greasy', 'soiled', 'coffee cup', 'receipt'],
  },
  {
    title: 'Expert Level Precision',
    description: 'Flawlessly sort 1 expert-tier challenge item with zero mistakes',
    emoji: '🎓',
    target: 1,
    bonusPoints: 60,
    taskType: 'difficulty',
    targetDifficulty: 'expert',
  },
  {
    title: 'Plastic Polymer Detective',
    description: 'Correctly classify 3 plastic items based on resin type and flexibility',
    emoji: '🧪',
    target: 3,
    bonusPoints: 45,
    taskType: 'category',
    targetCategory: 'plastics',
  },
  {
    title: 'Bulky & Hazardous Triage',
    description: 'Properly identify and sort 1 bulky furniture item or clinical medical waste item',
    emoji: '🛋️',
    target: 1,
    bonusPoints: 55,
    taskType: 'specific_item',
    itemKeywords: ['furniture', 'mattress', 'sofa', 'syringe', 'needle', 'bandage', 'sharps', 'chair'],
  },
];

// Pool 3: Performance, Streak & Volume Tasks
const PERFORMANCE_TASKS: TaskTemplate[] = [
  {
    title: 'Flawless 5-Streak',
    description: 'Achieve an unbroken 5x correct sorting combo without any mistakes',
    emoji: '🔥',
    target: 1,
    bonusPoints: 60,
    taskType: 'streak',
    streakTarget: 5,
  },
  {
    title: 'Rapid Sorting Spree',
    description: 'Correctly sort 6 waste items of any category in Bin Master',
    emoji: '⚡',
    target: 6,
    bonusPoints: 50,
    taskType: 'difficulty',
    // Matches any difficulty (beginner, tricky, expert)
  },
  {
    title: 'Triple Precision Combo',
    description: 'Build a 3x sorting combo streak in Bin Master',
    emoji: '🌟',
    target: 1,
    bonusPoints: 40,
    taskType: 'streak',
    streakTarget: 3,
  },
  {
    title: 'Clean Stream Sweep',
    description: 'Correctly sort 5 items without putting any recyclable into landfill',
    emoji: '🧹',
    target: 5,
    bonusPoints: 50,
    taskType: 'difficulty',
  },
];

// Simple deterministic pseudo-random generator based on date string (YYYY-MM-DD)
function getHashFromDate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Generates exactly 3 diverse, specific waste-sorting tasks for the given date.
 */
export function generateDailyTasksForDate(dateStr: string): DailySortTask[] {
  const hash = getHashFromDate(dateStr);

  // Pick one from each pool deterministically
  const task1Template = STREAM_TASKS[hash % STREAM_TASKS.length];
  const task2Template = TRICKY_AND_SKILL_TASKS[(hash + 1) % TRICKY_AND_SKILL_TASKS.length];
  const task3Template = PERFORMANCE_TASKS[(hash + 2) % PERFORMANCE_TASKS.length];

  return [
    {
      id: `task-${dateStr}-1`,
      title: task1Template.title,
      description: task1Template.description,
      emoji: task1Template.emoji,
      target: task1Template.target,
      current: 0,
      bonusPoints: task1Template.bonusPoints,
      completed: false,
      taskType: task1Template.taskType,
      targetBin: task1Template.targetBin,
      targetCategory: task1Template.targetCategory,
      targetDifficulty: task1Template.targetDifficulty,
      itemKeywords: task1Template.itemKeywords,
      streakTarget: task1Template.streakTarget,
    },
    {
      id: `task-${dateStr}-2`,
      title: task2Template.title,
      description: task2Template.description,
      emoji: task2Template.emoji,
      target: task2Template.target,
      current: 0,
      bonusPoints: task2Template.bonusPoints,
      completed: false,
      taskType: task2Template.taskType,
      targetBin: task2Template.targetBin,
      targetCategory: task2Template.targetCategory,
      targetDifficulty: task2Template.targetDifficulty,
      itemKeywords: task2Template.itemKeywords,
      streakTarget: task2Template.streakTarget,
    },
    {
      id: `task-${dateStr}-3`,
      title: task3Template.title,
      description: task3Template.description,
      emoji: task3Template.emoji,
      target: task3Template.target,
      current: 0,
      bonusPoints: task3Template.bonusPoints,
      completed: false,
      taskType: task3Template.taskType,
      targetBin: task3Template.targetBin,
      targetCategory: task3Template.targetCategory,
      targetDifficulty: task3Template.targetDifficulty,
      itemKeywords: task3Template.itemKeywords,
      streakTarget: task3Template.streakTarget,
    },
  ];
}

/**
 * Checks whether a correctly sorted item advances the given daily task.
 */
export function checkTaskMatch(
  task: DailySortTask,
  item: WasteItem,
  normalizedBin: string,
  newStreak: number
): boolean {
  if (task.completed) return false;

  switch (task.taskType) {
    case 'bin': {
      if (!task.targetBin) return false;
      return (
        item.bin === task.targetBin ||
        normalizedBin === task.targetBin ||
        (task.targetBin === 'general_waste' && (item.bin === 'landfill' || normalizedBin === 'general_waste')) ||
        (task.targetBin === 'commingled_recycling' && (item.bin === 'recycling' || normalizedBin === 'commingled_recycling')) ||
        (task.targetBin === 'organic' && (item.bin === 'compost' || normalizedBin === 'organic'))
      );
    }
    case 'difficulty': {
      if (!task.targetDifficulty) {
        // Matches any correctly sorted item (e.g. general volume)
        return true;
      }
      return item.difficulty === task.targetDifficulty;
    }
    case 'category': {
      if (!task.targetCategory) return true;
      return item.category === task.targetCategory;
    }
    case 'specific_item': {
      if (!task.itemKeywords || task.itemKeywords.length === 0) return true;
      const lowerName = item.name.toLowerCase();
      const lowerId = item.id.toLowerCase();
      const tagsStr = item.tags.join(' ').toLowerCase();
      return task.itemKeywords.some(
        kw => lowerName.includes(kw) || lowerId.includes(kw) || tagsStr.includes(kw)
      );
    }
    case 'streak': {
      const needed = task.streakTarget || 3;
      return newStreak >= needed;
    }
    default:
      return true;
  }
}
