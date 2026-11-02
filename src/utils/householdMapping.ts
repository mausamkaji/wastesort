import { BinType } from '../types';
import { HOUSEHOLD_BINS, HouseholdBin } from '../data/householdBins';

export interface HouseholdPlacement {
  /** One of the four household bins, or null when the item belongs to no kerbside bin. */
  bin: HouseholdBin | null;
  /** Extra context shown next to the bin (or instead of it when bin is null). */
  note?: string;
  /**
   * Replaces the item's own explanation and steps when they describe an
   * industry process (e.g. a clinical waste container) that does not apply at home.
   */
  override?: { why: string; prep: string[] };
}

const HAZARDOUS_WORDS = /\b(paint|oil|chemical|cleaner|solvent|pesticide|fuel|petrol|gas|bleach|mercury|thermometer|fluorescent|cfl|detector|turpentine)\b/i;
const BATTERY_WORDS = /\b(batter\w*|vape|lithium|cell)\b/i;
const SHARPS_OR_MEDICINE_WORDS = /\b(syringe|needle|lancet|pen|epipen|injector|cartridge|medication|medicine|antibiotic|blister|prescription|pill|pills|tablet)\b/i;
const COMPOSTABLE_WORDS = /\b(pla|compostable|bioplastic)\b/i;

const GARDEN_WORDS = /\b(garden|lawn|grass|leaf|leaves|prun\w*|weed\w*|branch\w*|hedge|clipping\w*|flower\w*|twig\w*|bark)\b/i;
const FOOD_WORDS = /\b(food|fruit|veg\w*|peel\w*|coffee|tea|egg\w*|bread|scrap\w*|leftover\w*|kitchen|cooked|rice|pasta|meat|bone\w*)\b/i;

const byId = (id: string) => HOUSEHOLD_BINS.find(b => b.id === id) ?? null;

/**
 * Maps a WasteSort (industry) bin to the four household bins.
 * `context` is the item name plus tags, used to tell garden waste from food waste.
 */
export function toHouseholdPlacement(primaryBin: BinType, context = ''): HouseholdPlacement {
  switch (primaryBin) {
    case 'commingled_recycling':
    case 'paper_cardboard':
    case 'recycling':
      return { bin: byId('recycling') };

    case 'organic':
    case 'compost':
      if (COMPOSTABLE_WORDS.test(context)) {
        return {
          bin: byId('fogo'),
          note: 'Only if your council accepts certified compostable items in FOGO. If it does not, use the General bin.',
        };
      }
      return GARDEN_WORDS.test(context) && !FOOD_WORDS.test(context)
        ? { bin: byId('garden') }
        : { bin: byId('fogo') };

    case 'meat_bones':
      return { bin: byId('fogo'), note: 'Meat and bones are accepted in FOGO by most councils. Check yours.' };

    case 'general_waste':
    case 'landfill':
      return { bin: byId('general') };

    case 'soft_plastic_dropoff':
      return {
        bin: byId('general'),
        note: 'Better still, take soft plastics to a supermarket soft-plastic drop-off.',
      };

    case 'cloth_recycling':
      return { bin: null, note: 'Not for your bins. Donate wearable clothes or use a textile collection bin.' };
    case 'e_waste':
      if (HAZARDOUS_WORDS.test(context)) {
        return {
          bin: null,
          note: 'Hazardous. Never put it in a bin or down a drain. Take it to a council household hazardous waste drop-off.',
        };
      }
      if (BATTERY_WORDS.test(context)) {
        return {
          bin: null,
          note: 'Fire risk, so never put it in a bin. Use a supermarket or hardware store battery drop-off, or your council recovery centre.',
        };
      }
      return { bin: null, note: 'Not for your bins. Take it to an e-waste drop-off or your council recovery centre.' };
    case 'medical_waste':
      if (SHARPS_OR_MEDICINE_WORDS.test(context)) {
        return {
          bin: null,
          note: 'Not for your bins. Return medicines to a pharmacy, and take sharps in a rigid sharps container to a pharmacy or council collection.',
        };
      }
      // Dressings, swabs, test kits and masks used at home are ordinary general waste.
      return {
        bin: byId('general'),
        override: {
          why: 'Used at home, items like this are general waste. The special clinical containers are for hospitals and clinics.',
          prep: ['Seal it in a bag or tie it off so nothing can leak', 'Put it in the General bin', 'Wash your hands afterwards'],
        },
      };
    case 'hard_rubbish':
      return { bin: null, note: 'Too bulky for your bins. Book a council hard rubbish collection or visit a tip.' };
    case 'hazardous_special':
      return { bin: null, note: 'Hazardous. Take it to a council hazardous waste drop-off.' };

    default:
      return { bin: byId('general') };
  }
}
