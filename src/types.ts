export type BinType = 
  | 'general_waste' 
  | 'commingled_recycling' 
  | 'organic' 
  | 'paper_cardboard' 
  | 'cloth_recycling'
  | 'soft_plastic_dropoff'
  | 'e_waste'
  | 'medical_waste'
  | 'meat_bones'
  | 'hard_rubbish'
  | 'compost' 
  | 'recycling' 
  | 'landfill' 
  | 'hazardous_special';

export interface WasteItem {
  id: string;
  name: string;
  category: 'plastics' | 'paper_cardboard' | 'metals' | 'glass' | 'organics' | 'e_waste_hazardous' | 'composites' | 'meat_bones' | 'hard_rubbish' | 'textiles';
  bin: BinType;
  emoji: string;
  prepInstructions: string[];
  whyItGoesHere: string;
  wishcyclingWarning?: string;
  funFact?: string;
  resinCode?: string; // e.g. "PET 1", "PP 5"
  difficulty: 'beginner' | 'tricky' | 'expert';
  tags: string[];
  isAiGenerated?: boolean;
  userSearched?: boolean;
  googleVerified?: boolean;
  validatedAt?: string;
  searchQuery?: string;
  verificationSources?: Array<{ title: string; uri: string }>;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  category: 'sorting' | 'streak' | 'detective' | 'scholar' | 'ai';
}

export interface DailySortTask {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  current: number;
  bonusPoints: number;
  completed: boolean;
  taskType: 'bin' | 'difficulty' | 'specific_item' | 'category' | 'streak';
  targetBin?: BinType;
  targetCategory?: string;
  targetDifficulty?: 'beginner' | 'tricky' | 'expert';
  itemKeywords?: string[];
  streakTarget?: number;
}

export interface DailyChallengeState {
  date: string;
  tasks: DailySortTask[];
  allCompletedBonusClaimed: boolean;
}

export interface DailyQuest {
  id: string;
  title: string;
  target: number;
  current: number;
  rewardXp: number;
  completed: boolean;
  type: 'sort_items' | 'streak' | 'detective' | 'trivia' | 'ai_inspect';
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string;
  totalSorted: number;
  correctSorted: number;
  highScore: number;
  unlockedBadgeIds: string[];
  completedQuestIds: string[];
  co2DivertedKg: number;
  energySavedKwh: number;
  waterSavedLiters: number;
}

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ecoFact: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ContaminantItem {
  id: string;
  name: string;
  emoji: string;
  isContaminant: boolean;
  explanation: string;
  consequence: string;
}

export interface ContaminationScenario {
  id: string;
  title: string;
  binTarget: BinType;
  description: string;
  items: ContaminantItem[];
  tips: string;
  isAiGenerated?: boolean;
}

export interface AcceptableBinOption {
  bin: BinType;
  binName: string;
  condition?: string;
  reason: string;
}

export interface InspectionResult {
  itemName: string;
  primaryBin: BinType;
  binColorName: string;
  acceptableBins?: AcceptableBinOption[];
  prepInstructions: string[];
  whyItGoesHere: string;
  wishcyclingWarning?: string;
  lifecycleFact?: string;
  upcycleIdeas?: string[];
  resinCode?: string | null;
  googleVerified?: boolean;
  verificationNote?: string;
  verificationSources?: Array<{ title: string; uri: string }>;
  webSearchQueries?: string[];
  detectedMaterials?: string[];
  photoDataUrl?: string;
  encyclopediaItem?: WasteItem;
  isUnclear?: boolean;
  unclearReason?: string;
}
