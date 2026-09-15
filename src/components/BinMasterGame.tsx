import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  Flame, 
  Sparkles, 
  AlertTriangle,
  Infinity as InfinityIcon,
  Loader2,
  Zap,
  BookOpen,
  PlusCircle,
  Search,
  Check,
  ChevronDown,
  Bot,
  ShieldCheck,
  X
} from 'lucide-react';
import { WASTE_ITEMS } from '../data/wasteItems';
import { WasteItem, BinType } from '../types';
import { useGame } from '../context/GameContext';
import { DailyChallengesCard } from './DailyChallengesCard';

export type GameBinType = 'general_waste' | 'commingled_recycling' | 'organic' | 'paper_cardboard' | 'cloth_recycling' | 'e_waste' | 'medical_waste' | 'meat_bones' | 'hard_rubbish';

export interface BinConfig {
  type: GameBinType;
  name: string;
  sub: string;
  lidLabel: string;
  lidColor: string;
  lidBorder: string;
  color: string;
  bg: string;
  border: string;
  accentBorder: string;
  badgeClass: string;
  icon: string;
  acceptedItemsText: string;
}

export const BINS: BinConfig[] = [
  {
    type: 'general_waste',
    name: 'General Waste',
    sub: 'Red Lid Bin',
    lidLabel: '🔴 Red Lid',
    lidColor: 'bg-rose-600',
    lidBorder: 'border-rose-700',
    color: 'text-rose-900',
    bg: 'bg-rose-50/70 hover:bg-rose-100/80',
    border: 'border-rose-300 hover:border-rose-500',
    accentBorder: 'border-t-rose-600',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: '🗑️',
    acceptedItemsText: 'Paper towels, paper napkins & facial tissues (strictly Red bin, NOT in organic or clothes donation), all clothing materials & textiles (can go in Red bin or clothes donation), anything unsure / not sure ("When in doubt, throw it out"), plastic bubble wraps & air pillows, greasy pizza boxes (Red bin, NOT green bin), styrofoam meat trays (strictly general waste), mussel & oyster shells, soiled paper, soft plastic wrappers, takeaway coffee cups, ceramics, broken glassware, diapers, general trash',
  },
  {
    type: 'commingled_recycling',
    name: 'Commingled Recycling',
    sub: 'Yellow Lid Bin',
    lidLabel: '🟡 Yellow Lid',
    lidColor: 'bg-amber-400',
    lidBorder: 'border-amber-500',
    color: 'text-amber-950',
    bg: 'bg-amber-50/70 hover:bg-amber-100/80',
    border: 'border-amber-400 hover:border-amber-500',
    accentBorder: 'border-t-amber-400',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: '♻️',
    acceptedItemsText: 'Rigid plastic bottles & tubs (#1, #2, #5), aluminum beverage cans, tin & steel food cans, glass food jars & drink bottles',
  },
  {
    type: 'organic',
    name: 'Organic (FOGO)',
    sub: 'Green Lid Bin',
    lidLabel: '🟢 Green Lid',
    lidColor: 'bg-emerald-600',
    lidBorder: 'border-emerald-700',
    color: 'text-emerald-950',
    bg: 'bg-emerald-50/70 hover:bg-emerald-100/80',
    border: 'border-emerald-300 hover:border-emerald-500',
    accentBorder: 'border-t-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: '🌿',
    acceptedItemsText: 'Fruit & vegetable scraps, coffee grounds & filters, garden clippings, food scraps (NO paper towels or napkins, NO pizza boxes, NO plastic bags)',
  },
  {
    type: 'paper_cardboard',
    name: 'Cardboard and Paper',
    sub: 'Blue Lid Bin',
    lidLabel: '🔵 Blue Lid',
    lidColor: 'bg-blue-600',
    lidBorder: 'border-blue-700',
    color: 'text-blue-950',
    bg: 'bg-blue-50/70 hover:bg-blue-100/80',
    border: 'border-blue-300 hover:border-blue-500',
    accentBorder: 'border-t-blue-600',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: '📦',
    acceptedItemsText: 'Clean and unused pizza boxes, corrugated cardboard boxes, cereal & pasta boxes, clean newspaper, magazines, office & printer paper, clean paper bags, pulp egg cartons',
  },
  {
    type: 'cloth_recycling',
    name: 'Clothes Donation',
    sub: 'Designated Drop-Off or Red Bin',
    lidLabel: '👕 Clothes Donation',
    lidColor: 'bg-teal-600',
    lidBorder: 'border-teal-700',
    color: 'text-teal-950',
    bg: 'bg-teal-50/70 hover:bg-teal-100/80',
    border: 'border-teal-300 hover:border-teal-500',
    accentBorder: 'border-t-teal-600',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300 font-bold',
    icon: '👕',
    acceptedItemsText: 'All clothing materials go either here via clothes donation (stations, Coles, charity depots) or in the Red General Waste bin! Clean clothes, tied pairs of shoes, bedsheets, towels, and fabric scraps—never in yellow, blue, or green bins!',
  },
  {
    type: 'e_waste',
    name: 'E-Waste & Batteries',
    sub: 'Designated Drop-Off Location',
    lidLabel: '🏬 Designated Drop-Off',
    lidColor: 'bg-stone-900',
    lidBorder: 'border-stone-800',
    color: 'text-stone-900',
    bg: 'bg-stone-100/90 hover:bg-stone-200/90',
    border: 'border-stone-400 hover:border-stone-600',
    accentBorder: 'border-t-stone-900',
    badgeClass: 'bg-stone-900 text-amber-300 border-stone-800 font-bold',
    icon: '🔌',
    acceptedItemsText: "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.",
  },
  {
    type: 'hard_rubbish',
    name: 'Hard Rubbish',
    sub: 'Council Bulky Collection',
    lidLabel: '🛋️ Council Collection',
    lidColor: 'bg-amber-800',
    lidBorder: 'border-amber-900',
    color: 'text-amber-950',
    bg: 'bg-amber-50/80 hover:bg-amber-100/90',
    border: 'border-amber-300 hover:border-amber-500',
    accentBorder: 'border-t-amber-800',
    badgeClass: 'bg-amber-800 text-amber-100 border-amber-900 font-bold',
    icon: '🛋️',
    acceptedItemsText: 'Oversized broken furniture, mattresses, bed bases, steel frames, washing machines, dryers, dishwashers, scrap metal, rolled carpets, and bundled timber via booked council hard rubbish collection or transfer depots.',
  },
  {
    type: 'medical_waste',
    name: 'Medical & Sharps',
    sub: 'White Lid Bin',
    lidLabel: '⚪ White Lid',
    lidColor: 'bg-white',
    lidBorder: 'border-rose-400',
    color: 'text-rose-950',
    bg: 'bg-stone-50/90 hover:bg-rose-50/80',
    border: 'border-rose-200 hover:border-rose-400',
    accentBorder: 'border-t-rose-500',
    badgeClass: 'bg-rose-50 text-rose-900 border-rose-300',
    icon: '🩺',
    acceptedItemsText: 'Sharps & needles in guard cases, blister medicine packs, expired pharmaceuticals, blood-soiled bandages, medical gloves & masks',
  },
  {
    type: 'meat_bones',
    name: 'Meat & Bones',
    sub: 'Orange Lid Bin',
    lidLabel: '🟠 Orange Lid',
    lidColor: 'bg-orange-500',
    lidBorder: 'border-orange-600',
    color: 'text-orange-950',
    bg: 'bg-orange-50/70 hover:bg-orange-100/80',
    border: 'border-orange-300 hover:border-orange-500',
    accentBorder: 'border-t-orange-500',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
    icon: '🍖',
    acceptedItemsText: 'Animal bones, chicken carcasses, beef T-bones, pork ribs, fish heads & skeletons, fish bones, raw & cooked meat trimmings, bacon rinds (Note: Mussel & oyster shells go to Red General Waste)',
  },
];

export function normalizeBin(
  bin: BinType,
  category?: string,
  tags?: string[],
  name?: string
): GameBinType {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();
  const t = tags || [];

  // Unsure items, golden rule -> strictly general_waste
  if (
    n.includes('unsure') ||
    n.includes('not sure') ||
    n.includes('unknown') ||
    n.includes('doubt') ||
    t.includes('unsure') ||
    t.includes('not sure')
  ) {
    return 'general_waste';
  }

  // Plastic bubble wrap and air pillows -> strictly general_waste
  if (
    n.includes('bubble wrap') ||
    n.includes('air pillow') ||
    n.includes('air cushion') ||
    t.includes('bubble wrap') ||
    t.includes('air pillow')
  ) {
    return 'general_waste';
  }

  // Clean, dry, unused pizza box -> Blue Lid Bin (paper_cardboard)
  const isCleanPizzaBox =
    n.includes('pizza') &&
    (n.includes('clean') || n.includes('unused') || n.includes('dry') || n.includes('unsoiled') || n.includes('new') || n.includes('clean lid') || n.includes('clean top'));

  if (isCleanPizzaBox) {
    return 'paper_cardboard';
  }

  // Styrofoam meat tray -> strictly goes in general_waste (Red Lid)
  if (
    (n.includes('styrofoam') || n.includes('polystyrene') || n.includes('meat tray') || n.includes('foam tray') || n.includes('butcher tray')) &&
    (n.includes('tray') || n.includes('meat') || n.includes('foam') || n.includes('styrofoam') || n.includes('polystyrene') || n.includes('butcher'))
  ) {
    return 'general_waste';
  }

  // Greasy pizza box check -> strictly goes in general_waste (Red Lid), never in green bin
  if (n.includes('pizza')) {
    return 'general_waste';
  }

  // Mussel shells, oyster shells, clam shells check -> strictly goes to general_waste (Red Lid), never in green or meat bin
  if (
    n.includes('mussel') ||
    n.includes('oyster') ||
    n.includes('clam shell') ||
    n.includes('bivalve') ||
    n.includes('abalone') ||
    (n.includes('shell') && (n.includes('seafood') || n.includes('mollusc') || n.includes('mollusk') || n.includes('shellfish')))
  ) {
    return 'general_waste';
  }

  // Paper towels, paper napkins, serviettes -> strictly general_waste (Red Bin)
  // NEVER organic (Green Bin) and NEVER clothes donation
  if (
    n.includes('paper towel') ||
    n.includes('papertowel') ||
    n.includes('napkin') ||
    n.includes('serviette') ||
    n.includes('facial tissue') ||
    (n.includes('tissue') && !n.includes('tissue box')) ||
    t.includes('paper towel') ||
    t.includes('napkin') ||
    t.includes('serviette')
  ) {
    return 'general_waste';
  }

  // Clothing & Textiles Drop-Off Check (excluding paper towels)
  if (bin === 'cloth_recycling') return 'cloth_recycling';
  if (
    c === 'textiles' ||
    t.includes('cloth_recycling') ||
    t.includes('clothing') ||
    t.includes('textiles') ||
    n.includes('clothing') ||
    n.includes('clothes') ||
    n.includes('shirt') ||
    /\bdress\b/.test(n) ||
    n.includes('jeans') ||
    n.includes('t-shirt') ||
    n.includes('pants') ||
    n.includes('sweater') ||
    n.includes('jacket') ||
    n.includes('sneaker') ||
    n.includes('shoes') ||
    n.includes('boots') ||
    (n.includes('towel') && !n.includes('paper towel')) ||
    n.includes('bedsheet') ||
    n.includes('linen') ||
    n.includes('textile') ||
    n.includes('fabric scrap')
  ) {
    return 'cloth_recycling';
  }

  if (bin === 'meat_bones') return 'meat_bones';
  if (bin === 'e_waste') return 'e_waste';
  if (bin === 'hard_rubbish') return 'hard_rubbish';
  if (bin === 'medical_waste') return 'medical_waste';
  if (bin === 'paper_cardboard') return 'paper_cardboard';
  if (bin === 'organic' || bin === 'compost') return 'organic';
  if (bin === 'commingled_recycling') return 'commingled_recycling';

  // Hard rubbish check
  if (
    c === 'hard_rubbish' ||
    t.includes('hard_rubbish') ||
    t.includes('furniture') ||
    t.includes('bulky') ||
    n.includes('furniture') ||
    n.includes('mattress') ||
    n.includes('washing machine') ||
    n.includes('dryer') ||
    n.includes('dishwasher') ||
    n.includes('sofa') ||
    n.includes('couch') ||
    n.includes('dining table') ||
    n.includes('carpet') ||
    n.includes('wardrobe') ||
    n.includes('bed base') ||
    n.includes('bed frame')
  ) {
    return 'hard_rubbish';
  }

  // Meat and bones check (excluding packaging/pads)
  if (!n.includes('tray') && !n.includes('pad') && !n.includes('wrap') && !n.includes('twine')) {
    if (
      c === 'meat_bones' ||
      t.includes('meat') ||
      t.includes('bones') ||
      t.includes('bone') ||
      t.includes('poultry') ||
      t.includes('orange_bin') ||
      n.includes('carcass') ||
      n.includes('chicken wing') ||
      n.includes('t-bone') ||
      n.includes('steak bone') ||
      n.includes('rib bone') ||
      n.includes('ribs') ||
      n.includes('marrow') ||
      n.includes('fish head') ||
      n.includes('fish skeleton') ||
      n.includes('pork chop') ||
      n.includes('lamb chop') ||
      n.includes('shank') ||
      n.includes('crab claw') ||
      n.includes('bacon rind') ||
      n.includes('gristle')
    ) {
      return 'meat_bones';
    }
  }

  if (
    c === 'e_waste' ||
    t.includes('e_waste') ||
    t.includes('battery') ||
    t.includes('electronics') ||
    n.includes('phone') ||
    n.includes('cable') ||
    n.includes('charger') ||
    n.includes('laptop') ||
    n.includes('battery') ||
    n.includes('circuit')
  ) {
    return 'e_waste';
  }

  if (
    c === 'medical_waste' ||
    t.includes('medical') ||
    t.includes('sharps') ||
    t.includes('needle') ||
    t.includes('medicine') ||
    n.includes('syringe') ||
    n.includes('needle') ||
    n.includes('blister pack') ||
    n.includes('gauze') ||
    n.includes('pill') ||
    n.includes('insulin')
  ) {
    return 'medical_waste';
  }

  if (bin === 'recycling') {
    if (
      c === 'paper_cardboard' ||
      t.includes('paper') ||
      t.includes('cardboard') ||
      t.includes('box') ||
      n.includes('cardboard') ||
      n.includes('newspaper') ||
      n.includes('magazine') ||
      n.includes('cereal') ||
      n.includes('office paper')
    ) {
      if (n.includes('tetra') || n.includes('milk carton') || n.includes('juice carton')) {
        return 'commingled_recycling';
      }
      return 'paper_cardboard';
    }
    return 'commingled_recycling';
  }

  return 'general_waste';
}

type FilterDifficulty = 'all' | 'tricky' | 'beginner' | 'ai_generated' | 'red_waste' | 'yellow_recycle' | 'green_organic' | 'blue_paper' | 'teal_cloth' | 'grey_ewaste' | 'hard_rubbish' | 'white_medical' | 'orange_meat';

export const BinMasterGame: React.FC = () => {
  const { recordSort, currentCombo, stats } = useGame();
  
  // Unlimited Catalog State: starts with curated WASTE_ITEMS and expands indefinitely
  const [catalogItems, setCatalogItems] = useState<WasteItem[]>(() => [...WASTE_ITEMS]);
  const [filter, setFilter] = useState<FilterDifficulty>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  
  // Dynamic AI Expanding state
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionNotice, setExpansionNotice] = useState<string | null>(null);
  const [autoExpandEnabled, setAutoExpandEnabled] = useState(true);
  
  // Catalog Quick-Browse Drawer
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean;
    selectedBin: GameBinType;
    item: WasteItem;
    xpGained: number;
  } | null>(null);

  // AI Referee state: live item analysis and verified answer
  const [isAiRefAnalyzing, setIsAiRefAnalyzing] = useState(false);
  const [aiRefResult, setAiRefResult] = useState<{
    itemName: string;
    primaryBin: GameBinType;
    binColorName: string;
    acceptableBins: Array<{
      bin: GameBinType;
      binName: string;
      condition: string;
      reason: string;
    }>;
    prepInstructions: string[];
    whyItGoesHere: string;
    wishcyclingWarning?: string;
    lifecycleFact?: string;
    verificationNote?: string;
  } | null>(null);
  const [showAiRefModal, setShowAiRefModal] = useState(false);

  // Fetch new item(s) from Gemini AI to expand the catalog
  const expandCatalogWithAi = useCallback(async (count: number = 3, difficulty?: string) => {
    setIsExpanding(true);
    try {
      const recentNames = catalogItems.map(i => i.name);
      const res = await fetch('/api/generate-waste-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          difficulty: difficulty || undefined,
          recentItems: recentNames,
        }),
      });

      if (!res.ok) throw new Error('Network error generating items');
      const data = await res.json();

      const newItems: WasteItem[] = [];
      if (Array.isArray(data.items)) {
        newItems.push(...data.items);
      } else if (data && data.name) {
        newItems.push(data);
      }

      if (newItems.length > 0) {
        setCatalogItems(prev => {
          // Avoid duplicate names
          const existingIds = new Set(prev.map(p => p.name.toLowerCase()));
          const uniqueToAdd = newItems.filter(item => !existingIds.has(item.name.toLowerCase()));
          return uniqueToAdd.length > 0 ? [...prev, ...uniqueToAdd] : prev;
        });

        setExpansionNotice(`✨ Added ${newItems.length} new items to Catalog! Total: ${catalogItems.length + newItems.length}`);
        setTimeout(() => setExpansionNotice(null), 4000);
      }
    } catch {
      // Graceful fallback to existing pool
    } finally {
      setIsExpanding(false);
    }
  }, [catalogItems]);

  // Auto-expand catalog seamlessly when user approaches the end of items
  useEffect(() => {
    if (!autoExpandEnabled || isExpanding) return;
    if (currentIndex >= catalogItems.length - 2) {
      expandCatalogWithAi(3);
    }
  }, [currentIndex, catalogItems.length, autoExpandEnabled, isExpanding, expandCatalogWithAi]);

  // Filtered pool of items based on user selection
  const itemPool = useMemo(() => {
    let pool = [...catalogItems];
    if (filter === 'tricky') {
      pool = pool.filter(i => i.difficulty === 'tricky' || i.difficulty === 'expert');
    } else if (filter === 'beginner') {
      pool = pool.filter(i => i.difficulty === 'beginner');
    } else if (filter === 'ai_generated') {
      pool = pool.filter(i => i.isAiGenerated);
    } else if (filter === 'red_waste') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'general_waste');
    } else if (filter === 'yellow_recycle') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'commingled_recycling');
    } else if (filter === 'green_organic') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'organic');
    } else if (filter === 'blue_paper') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'paper_cardboard');
    } else if (filter === 'teal_cloth') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'cloth_recycling');
    } else if (filter === 'grey_ewaste') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'e_waste');
    } else if (filter === 'hard_rubbish') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'hard_rubbish');
    } else if (filter === 'white_medical') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'medical_waste');
    } else if (filter === 'orange_meat') {
      pool = pool.filter(i => normalizeBin(i.bin, i.category, i.tags, i.name) === 'meat_bones');
    }
    return pool.length > 0 ? pool : catalogItems;
  }, [filter, catalogItems]);

  const currentItem = itemPool[currentIndex % itemPool.length] || catalogItems[0];
  const targetBinType = normalizeBin(currentItem.bin, currentItem.category, currentItem.tags, currentItem.name);
  const correctBinConfig = BINS.find(b => b.type === targetBinType) || BINS[0];

  // Reset hint & AI referee analysis when switching items
  useEffect(() => {
    setShowHint(false);
    setShowAiRefModal(false);
    setAiRefResult(null);
  }, [currentIndex]);

  const askAiReferee = useCallback(async (item: WasteItem) => {
    setIsAiRefAnalyzing(true);
    setShowAiRefModal(true);
    try {
      const res = await fetch('/api/inspect-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: item.name,
          materialHint: `${item.category}, tags: ${item.tags.join(', ')}`
        }),
      });

      if (!res.ok) throw new Error('AI inspection service unavailable');
      const data = await res.json();

      const mappedPrimary = normalizeBin(data.primaryBin, item.category, item.tags, data.itemName || item.name);
      setAiRefResult({
        ...data,
        primaryBin: mappedPrimary
      });
    } catch {
      const fallbackTarget = normalizeBin(item.bin, item.category, item.tags, item.name);
      const targetConfig = BINS.find(b => b.type === fallbackTarget) || BINS[0];
      setAiRefResult({
        itemName: item.name,
        primaryBin: fallbackTarget,
        binColorName: targetConfig.name,
        acceptableBins: [
          {
            bin: fallbackTarget,
            binName: `${targetConfig.lidLabel} (${targetConfig.name})`,
            condition: 'Municipal Standard Guidance',
            reason: item.whyItGoesHere
          }
        ],
        prepInstructions: item.prepInstructions || [],
        whyItGoesHere: item.whyItGoesHere,
        wishcyclingWarning: item.wishcyclingWarning,
        lifecycleFact: item.funFact,
        verificationNote: 'Council Verified Waste Standard.'
      });
    } finally {
      setIsAiRefAnalyzing(false);
    }
  }, []);

  const handleSort = (chosenBin: GameBinType) => {
    if (lastResult || !currentItem) return;

    // Check primary target bin
    const isPrimaryCorrect = chosenBin === targetBinType;

    // Dual-destination tolerance:
    // 1. Meat & Bones: Thermal rendering (Orange Lid) or commercial FOGO (Green Lid)
    const isMeatItem = targetBinType === 'meat_bones';
    const isMeatValid = isMeatItem && (chosenBin === 'meat_bones' || chosenBin === 'organic');

    // 2. Paper towels and napkins: strictly Red Bin (general_waste), never organic or clothes donation
    const itemName = currentItem.name.toLowerCase();
    const itemTags = currentItem.tags || [];
    const isPaperTowelOrNapkin =
      itemName.includes('paper towel') ||
      itemName.includes('papertowel') ||
      itemName.includes('napkin') ||
      itemName.includes('serviette') ||
      itemTags.includes('paper towel') ||
      itemTags.includes('napkin') ||
      itemTags.includes('serviette');

    // 3. Clothing materials: All clothing materials go either in the red bin or via clothes donation
    const isClothingItem = !isPaperTowelOrNapkin && (
      targetBinType === 'cloth_recycling' ||
      currentItem.bin === 'cloth_recycling' ||
      currentItem.category === 'textiles' ||
      itemTags.includes('clothing') ||
      itemTags.includes('clothes') ||
      itemTags.includes('textiles') ||
      itemTags.includes('cloth_recycling') ||
      itemName.includes('clothing') ||
      itemName.includes('clothes') ||
      itemName.includes('shirt') ||
      /\bdress\b/.test(itemName) ||
      itemName.includes('jeans') ||
      itemName.includes('t-shirt') ||
      itemName.includes('pants') ||
      itemName.includes('sweater') ||
      itemName.includes('jacket') ||
      itemName.includes('sneaker') ||
      itemName.includes('shoes') ||
      itemName.includes('boots') ||
      (itemName.includes('towel') && !itemName.includes('paper towel')) ||
      itemName.includes('bedsheet') ||
      itemName.includes('linen') ||
      itemName.includes('textile') ||
      itemName.includes('fabric scrap')
    );

    const isClothingValid = isClothingItem && (chosenBin === 'cloth_recycling' || chosenBin === 'general_waste');

    // Paper towels strictly general_waste (Red Bin); cannot be accepted in organic or clothes donation
    const isCorrect = isPaperTowelOrNapkin
      ? chosenBin === 'general_waste'
      : (isPrimaryCorrect || isMeatValid || isClothingValid);

    const { xpGained } = recordSort(isCorrect, currentItem);

    setLastResult({
      isCorrect,
      selectedBin: chosenBin,
      item: currentItem,
      xpGained,
    });
    setShowAiRefModal(false);
  };

  const handleNextItem = () => {
    setLastResult(null);
    setCurrentIndex(prev => prev + 1);
  };

  const aiItemsCount = useMemo(() => catalogItems.filter(i => i.isAiGenerated).length, [catalogItems]);

  const filteredCatalogDrawerItems = useMemo(() => {
    if (!catalogSearch) return catalogItems;
    const q = catalogSearch.toLowerCase();
    return catalogItems.filter(i => 
      i.name.toLowerCase().includes(q) || 
      i.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [catalogItems, catalogSearch]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header bar: Mode selection & Game Status */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-extrabold text-stone-900 flex items-center gap-2">
              <span>🎯 Bin Master Challenge</span>
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
              <InfinityIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unlimited Catalog ({catalogItems.length} Items)</span>
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Sort items into <strong>Red Lid</strong> (General Waste), <strong>Yellow Lid</strong> (Recycling), <strong>Green Lid</strong> (Organic), <strong>Blue Lid</strong> (Cardboard & Paper), <strong>White Lid</strong> (Medical Waste), <strong>Orange Lid</strong> (Meat & Bones), and <strong>Designated Drop-Off</strong> (E-Waste & Batteries — No Household Bin Colour).
          </p>
        </div>

        {/* Action buttons: Expand Catalog & Browse */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            id="btn-expand-catalog-batch"
            onClick={() => expandCatalogWithAi(5)}
            disabled={isExpanding}
            className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Generate 5 new unique waste sorting items using Gemini AI"
          >
            {isExpanding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlusCircle className="w-3.5 h-3.5" />
            )}
            <span>{isExpanding ? 'Synthesizing...' : '⚡ Expand Catalog (+5 AI Items)'}</span>
          </button>

          <button
            id="btn-open-catalog-drawer"
            onClick={() => setIsCatalogOpen(true)}
            className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 font-bold text-xs px-3 py-2 rounded-xl transition-all border border-stone-200 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Browse Catalog ({catalogItems.length})</span>
          </button>
        </div>
      </div>

      {/* Expansion Notification Toast */}
      {expansionNotice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{expansionNotice}</span>
          </div>
          <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded-md">Catalog Expanded</span>
        </motion.div>
      )}

      {/* Daily Waste-Sorting Tasks Widget */}
      <DailyChallengesCard />

      {/* Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar bg-white p-1.5 rounded-2xl border border-stone-200 shadow-2xs text-xs font-semibold">
        <div className="flex items-center gap-1">
          <button
            id="filter-all-catalog"
            onClick={() => { setFilter('all'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filter === 'all' ? 'bg-stone-900 text-white font-bold shadow-2xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            All Catalog ({catalogItems.length} • ∞)
          </button>
          <button
            id="filter-tricky-traps"
            onClick={() => { setFilter('tricky'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'tricky' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'text-amber-800 hover:text-amber-900 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Tricky Traps</span>
          </button>
          <button
            id="filter-teal-cloth"
            onClick={() => { setFilter('teal_cloth'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'teal_cloth' ? 'bg-teal-700 text-white font-bold shadow-2xs' : 'text-teal-900 hover:text-teal-950 hover:bg-teal-50'
            }`}
          >
            <span>👕 Cloth Drop-Off</span>
          </button>
          <button
            id="filter-grey-ewaste"
            onClick={() => { setFilter('grey_ewaste'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'grey_ewaste' ? 'bg-stone-900 text-amber-300 font-bold shadow-2xs' : 'text-stone-800 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <span>🏬 E-Waste Drop-Off</span>
          </button>
          <button
            id="filter-hard-rubbish"
            onClick={() => { setFilter('hard_rubbish'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'hard_rubbish' ? 'bg-amber-800 text-amber-100 font-bold shadow-2xs' : 'text-amber-900 hover:text-amber-950 hover:bg-amber-50'
            }`}
          >
            <span>🛋️ Hard Rubbish</span>
          </button>
          <button
            id="filter-white-medical"
            onClick={() => { setFilter('white_medical'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'white_medical' ? 'bg-rose-700 text-white font-bold shadow-2xs' : 'text-rose-900 hover:text-rose-950 hover:bg-rose-50'
            }`}
          >
            <span>⚪ White: Medical</span>
          </button>
          <button
            id="filter-yellow-recycle"
            onClick={() => { setFilter('yellow_recycle'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'yellow_recycle' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'text-amber-900 hover:text-amber-950 hover:bg-amber-50'
            }`}
          >
            <span>🟡 Yellow: Recycle</span>
          </button>
          <button
            id="filter-green-organic"
            onClick={() => { setFilter('green_organic'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'green_organic' ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-50'
            }`}
          >
            <span>🟢 Green: Organic</span>
          </button>
          <button
            id="filter-blue-paper"
            onClick={() => { setFilter('blue_paper'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'blue_paper' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'text-blue-900 hover:text-blue-950 hover:bg-blue-50'
            }`}
          >
            <span>🔵 Blue: Paper</span>
          </button>
          <button
            id="filter-orange-meat"
            onClick={() => { setFilter('orange_meat'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'orange_meat' ? 'bg-orange-600 text-white font-bold shadow-2xs' : 'text-orange-900 hover:text-orange-950 hover:bg-orange-50'
            }`}
          >
            <span>🟠 Orange: Meat & Bones</span>
          </button>
          <button
            id="filter-red-waste"
            onClick={() => { setFilter('red_waste'); setCurrentIndex(0); setLastResult(null); }}
            className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              filter === 'red_waste' ? 'bg-rose-600 text-white font-bold shadow-2xs' : 'text-rose-900 hover:text-rose-950 hover:bg-rose-50'
            }`}
          >
            <span>🔴 Red: Waste</span>
          </button>
          {aiItemsCount > 0 && (
            <button
              id="filter-ai-generated-only"
              onClick={() => { setFilter('ai_generated'); setCurrentIndex(0); setLastResult(null); }}
              className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                filter === 'ai_generated' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50'
              }`}
            >
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>AI ({aiItemsCount})</span>
            </button>
          )}
        </div>

        {/* Auto-expand toggle */}
        <div className="flex items-center gap-2 pl-2 border-l border-stone-200 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-stone-600">
            <input
              type="checkbox"
              checked={autoExpandEnabled}
              onChange={e => setAutoExpandEnabled(e.target.checked)}
              className="accent-emerald-600 rounded"
            />
            <span className="font-medium hidden sm:inline">Auto-Generate with AI</span>
            <span className="font-medium sm:hidden">Auto-AI</span>
          </label>
        </div>
      </div>

      {/* Main Play Area */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={(currentItem?.id || 'item') + currentIndex}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-white border-2 border-stone-200 rounded-3xl p-6 sm:p-8 text-center shadow-xs relative overflow-hidden"
          >
            {/* Combo Multiplier indicator */}
            {currentCombo > 0 && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-amber-500 text-white font-black text-xs px-3 py-1 rounded-full shadow-xs animate-bounce">
                <Flame className="w-4 h-4 fill-white" />
                <span>{currentCombo}x Combo (+{Math.min(200, (currentCombo - 1) * 25)}% XP)</span>
              </div>
            )}

            {/* Item Progress in Catalog */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                Item {(currentIndex % itemPool.length) + 1} of {itemPool.length} (Unlimited ∞)
              </span>

              {currentItem.isAiGenerated && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 border border-indigo-200 flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Gemini AI Generated</span>
                </span>
              )}

              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                currentItem.difficulty === 'expert'
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : currentItem.difficulty === 'tricky'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {currentItem.difficulty === 'expert' ? 'Expert Trap' : currentItem.difficulty === 'tricky' ? 'Tricky Dilemma' : 'Beginner'}
              </span>

              {currentItem.resinCode && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-300">
                  Resin #{currentItem.resinCode}
                </span>
              )}
            </div>

            {/* Item Graphic */}
            <div className="w-24 h-24 mx-auto rounded-3xl bg-stone-50 border border-stone-200 flex items-center justify-center text-6xl shadow-inner mb-4">
              {currentItem.emoji}
            </div>

            {/* Item Title */}
            <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight mb-2">
              {currentItem.name}
            </h3>

            {/* Assistance Row: Material Hint & AI Referee */}
            <div className="max-w-md mx-auto mb-6 flex flex-wrap items-center justify-center gap-2">
              {!showHint ? (
                <button
                  id="btn-show-item-hint"
                  onClick={() => setShowHint(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
                  <span>Need a hint?</span>
                </button>
              ) : (
                <div className="w-full bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl p-3 text-left">
                  <span className="font-bold">Material Clue: </span>
                  {currentItem.category.replace('_', ' ').toUpperCase()} • {currentItem.tags.join(', ')}.
                  {currentItem.wishcyclingWarning && ` ⚠️ ${currentItem.wishcyclingWarning}`}
                </div>
              )}

              {/* Ask AI Referee Button */}
              {!lastResult && (
                <button
                  id="btn-ask-ai-referee"
                  onClick={() => askAiReferee(currentItem)}
                  disabled={isAiRefAnalyzing}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-1.5 rounded-full transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Ask Gemini AI to analyze this item and provide the verified answer"
                >
                  {isAiRefAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>AI Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ask AI Referee for Correct Answer</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* AI Referee Analysis Card */}
            <AnimatePresence>
              {showAiRefModal && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="mb-6 p-5 sm:p-6 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-stone-50 border-2 border-indigo-300 rounded-3xl text-left shadow-md relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-extrabold text-indigo-950 flex items-center gap-1.5">
                          <span>Gemini AI Sorting Referee</span>
                          <span className="text-[10px] uppercase font-bold bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full">
                            Verified Analysis
                          </span>
                        </h4>
                        <p className="text-xs text-indigo-700/90">
                          EPA & Municipal Standards Analysis for {currentItem.name}
                        </p>
                      </div>
                    </div>
                    <button
                      id="btn-close-ai-referee"
                      onClick={() => setShowAiRefModal(false)}
                      className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {isAiRefAnalyzing ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-indigo-950">Analyzing waste stream physics & paper pulping water bath rules...</p>
                        <p className="text-[11px] text-stone-500">Checking grease contamination, recyclability limits, and council regulations</p>
                      </div>
                    </div>
                  ) : aiRefResult ? (
                    <div className="space-y-3.5">
                      {/* Verified Answer Banner */}
                      {(() => {
                        const recBin = BINS.find(b => b.type === aiRefResult.primaryBin) || BINS[0];
                        return (
                          <div className={`p-3.5 rounded-2xl border ${recBin.bg} ${recBin.border} flex items-center justify-between gap-3 flex-wrap`}>
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{recBin.icon}</span>
                              <div>
                                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                                  AI Verified Correct Answer:
                                </span>
                                <span className="font-extrabold text-stone-950 text-sm sm:text-base">
                                  {recBin.name} ({recBin.lidLabel})
                                </span>
                              </div>
                            </div>
                            {!lastResult && (
                              <button
                                id="btn-apply-ai-answer"
                                onClick={() => handleSort(aiRefResult.primaryBin)}
                                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Apply & Sort into {recBin.name}</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* AI Why it goes here reasoning */}
                      <div className="text-xs text-stone-800 bg-white/80 p-3 rounded-2xl border border-stone-200/80 leading-relaxed">
                        <strong className="text-stone-950 block mb-1">Why this is the correct answer:</strong>
                        {aiRefResult.whyItGoesHere}
                      </div>

                      {/* Dual / Multiple Acceptable Bins (e.g. Greasy bottom in General Waste, clean lid in Paper) */}
                      {aiRefResult.acceptableBins && aiRefResult.acceptableBins.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-stone-700 block uppercase tracking-wider">
                            Dual-Stream & Council Variations:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {aiRefResult.acceptableBins.map((ab, idx) => (
                              <div key={idx} className="bg-white/60 border border-stone-200/60 p-2.5 rounded-xl text-xs">
                                <span className="font-bold text-stone-900 block">{ab.binName}</span>
                                <span className="text-stone-600 text-[11px] font-medium block italic">{ab.condition}</span>
                                <p className="text-[11px] text-stone-700 mt-1 leading-snug">{ab.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Best Practice Preparation */}
                      {aiRefResult.prepInstructions && aiRefResult.prepInstructions.length > 0 && (
                        <div className="text-xs text-stone-700 bg-stone-100/70 p-2.5 rounded-xl">
                          <span className="font-bold text-stone-900 block mb-1">Preparation steps:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                            {aiRefResult.prepInstructions.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Feedback result when answered */}
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 sm:p-6 rounded-3xl border-2 mb-6 text-left shadow-xs ${
                  lastResult.isCorrect
                    ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
                    : 'bg-rose-50/90 border-rose-400 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  {lastResult.isCorrect ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-base sm:text-lg">
                        {lastResult.isCorrect ? 'Correct! Expert sorting!' : 'Oops! Contamination alert!'}
                      </span>
                      {lastResult.isCorrect && (
                        <span className="bg-emerald-200 text-emerald-900 text-xs font-black px-2 py-0.5 rounded-full">
                          +{lastResult.xpGained} XP
                        </span>
                      )}
                    </div>

                    {/* Official Destination with Wheelie Bin Lid styling */}
                    <div className="mt-2.5 p-3 rounded-2xl bg-white/80 border border-stone-200/80 shadow-2xs flex items-center gap-3">
                      <span className="text-2xl p-2 rounded-xl bg-stone-100">{correctBinConfig.icon}</span>
                      <div>
                        <span className="text-[11px] font-bold text-stone-500 uppercase block">
                          Correct Stream
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-sm sm:text-base ${correctBinConfig.color}`}>
                            {correctBinConfig.name}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${correctBinConfig.badgeClass}`}>
                            {correctBinConfig.type === 'e_waste' || correctBinConfig.type === 'cloth_recycling' ? correctBinConfig.lidLabel : `${correctBinConfig.lidLabel} Bin`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm mt-3 text-stone-800 leading-relaxed">
                      {lastResult.item.whyItGoesHere}
                    </p>

                    {/* Preparation Instructions */}
                    {lastResult.item.prepInstructions && lastResult.item.prepInstructions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-stone-200/80">
                        <span className="text-xs font-bold text-stone-900 block mb-1">
                          Best Practice Preparation:
                        </span>
                        <ul className="text-xs text-stone-700 list-disc list-inside space-y-0.5">
                          {lastResult.item.prepInstructions.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lastResult.item.funFact && (
                      <div className="mt-2.5 text-xs text-stone-600 italic bg-white/50 p-2.5 rounded-xl border border-stone-200/40">
                        💡 {lastResult.item.funFact}
                      </div>
                    )}

                    {/* AI Deep Dive button if user wants full AI referee details */}
                    <div className="mt-3 pt-2">
                      <button
                        id="btn-post-sort-ai-deepdive"
                        onClick={() => askAiReferee(lastResult.item)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 bg-indigo-100/70 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>View Gemini AI Deep-Dive & Regulations</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-2 border-t border-stone-200/60">
                  <span className="text-xs text-stone-500">
                    Unlimited catalog continues automatically
                  </span>
                  <button
                    id="btn-next-waste-item"
                    onClick={handleNextItem}
                    className="flex items-center gap-2 bg-stone-900 hover:bg-black text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <span>Next Item</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* The 9 Bins with distinct Wheelie Bin Lids and Drop-Off Points */}
            {!lastResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-left">
                {BINS.map(bin => (
                  <button
                    key={bin.type}
                    id={`btn-sort-${bin.type}`}
                    onClick={() => handleSort(bin.type)}
                    className={`group relative rounded-2xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col ${bin.bg} ${bin.border} hover:shadow-md hover:scale-[1.01] active:scale-[0.99]`}
                  >
                    {/* Realistic Bin Lid Top Bar or Designated Drop-Off Header */}
                    <div className={`w-full ${bin.lidColor} ${bin.lidBorder} border-b px-3.5 py-1.5 flex items-center justify-between text-white shadow-2xs`}>
                      <span className="text-[11px] font-black tracking-wide uppercase flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        {bin.type === 'e_waste' || bin.type === 'cloth_recycling' ? bin.lidLabel : `${bin.lidLabel} Bin`}
                      </span>
                      <span className="text-[10px] opacity-90 font-bold bg-black/20 px-1.5 py-0.5 rounded">
                        {bin.sub}
                      </span>
                    </div>

                    {/* Bin Card Body */}
                    <div className="p-4 flex items-start gap-3.5">
                      <span className="text-3xl p-2 bg-white/90 rounded-2xl shadow-2xs group-hover:scale-110 transition-transform">
                        {bin.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-black text-base ${bin.color}`}>
                          {bin.name}
                        </h4>
                        <p className="text-[11px] text-stone-700 mt-1 line-clamp-2 leading-relaxed font-normal">
                          {bin.acceptedItemsText}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress & Quick Stats Footer */}
      <div className="bg-stone-100/80 rounded-2xl p-4 border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            Total Sorted: <span className="font-bold text-stone-900">{stats.totalSorted}</span>
          </div>
          <div>
            Accuracy: <span className="font-bold text-emerald-700">
              {stats.totalSorted > 0 ? `${Math.round((stats.correctSorted / stats.totalSorted) * 100)}%` : '100%'}
            </span>
          </div>
          <div>
            High Streak: <span className="font-bold text-amber-700">{stats.highScore}x</span>
          </div>
          <div>
            Catalog Size: <span className="font-bold text-stone-900">{catalogItems.length} (∞)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-skip-item"
            onClick={handleNextItem}
            className="flex items-center gap-1.5 text-stone-600 hover:text-stone-900 font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Skip to Next</span>
          </button>
        </div>
      </div>

      {/* Quick Catalog Browse Modal */}
      {isCatalogOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl border border-stone-200 relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="font-extrabold text-lg sm:text-xl text-stone-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  <span>Unlimited Waste Catalog ({catalogItems.length} Items)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Explore every item currently in your unlimited sorting pool.
                </p>
              </div>
              <button
                id="btn-close-catalog-drawer"
                onClick={() => setIsCatalogOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search and Action */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Search catalog items (e.g. coffee, pizza, box, battery)..."
                  className="w-full px-4 py-2 pl-9 rounded-xl border border-stone-300 text-xs focus:border-emerald-600 focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
              <button
                onClick={() => expandCatalogWithAi(5)}
                disabled={isExpanding}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isExpanding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>+5 AI Items</span>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredCatalogDrawerItems.map((item, idx) => {
                const itemTargetBin = normalizeBin(item.bin, item.category, item.tags, item.name);
                const binConf = BINS.find(b => b.type === itemTargetBin) || BINS[0];
                return (
                  <div
                    key={item.id + idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 hover:bg-stone-100/80 border border-stone-200 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl p-1.5 bg-white rounded-xl shadow-2xs shrink-0">{item.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">{item.name}</h4>
                          {item.isAiGenerated && (
                            <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded shrink-0">
                              AI
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 truncate">{item.whyItGoesHere}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${binConf.badgeClass}`}>
                        {binConf.lidLabel}
                      </span>
                      <button
                        onClick={() => {
                          const originalIdx = catalogItems.findIndex(i => i.id === item.id);
                          if (originalIdx !== -1) {
                            setCurrentIndex(originalIdx);
                            setFilter('all');
                            setLastResult(null);
                            setIsCatalogOpen(false);
                          }
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-bold bg-white px-2.5 py-1 rounded-lg border border-stone-200 shadow-2xs hover:bg-emerald-50 cursor-pointer"
                      >
                        Play Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
              <span>Showing {filteredCatalogDrawerItems.length} of {catalogItems.length} items</span>
              <button
                onClick={() => setIsCatalogOpen(false)}
                className="bg-stone-900 text-white font-bold px-4 py-1.5 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
