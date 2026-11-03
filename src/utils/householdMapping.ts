import { BinType } from '../types';
import { HOUSEHOLD_BINS, HouseholdBin } from '../data/householdBins';
import { HOUSEHOLD_DROPOFFS, HouseholdDropoff } from '../data/householdDropoffs';

export interface HouseholdPlacement {
  /** One of the four household bins, or null when the item belongs to no kerbside bin. */
  bin: HouseholdBin | null;
  /** A reuse/recycling drop-off point (clothes, e-waste, soft plastics) when the item has one. */
  dropoff?: HouseholdDropoff | null;
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

/**
 * Catalog and AI text is written for the nine-stream industry system, which has
 * an orange meat & bones bin, a blue paper/cardboard bin and white medical
 * containers. Households only have FOGO, Garden, General and Recycling, so this
 * rewrites those references into household terms.
 */
export function householdizeText(text: string): string {
  const cap = (original: string, offset: number, replacement: string) =>
    offset === 0 || /[.!?]\s$/.test(text.slice(Math.max(0, offset - 2), offset))
      ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
      : replacement;

  return (
    text
      // Orange meat & bones bin -> FOGO (households put meat in FOGO)
      .replace(/(?:🟠\s*)?\borange(?:[- ]lid)?\s+meat\s*(?:&|and)\s*bones(?:\s+(?:lid\s+)?bins?)?/gi, 'FOGO bin')
      .replace(/\borange(?:[- ]lid)?\s+meat\s+bins?/gi, 'FOGO bin')
      .replace(/\borange(?:[- ]lid)?\s+bins\b/gi, 'FOGO bins')
      .replace(/\borange(?:[- ]lid)?\s+bin\b/gi, 'FOGO bin')
      // ...and collapse the duplicates that creates ("FOGO bin or green organic bin")
      .replace(/,\s*FOGO bin,\s+or\s+(?:the\s+)?green\s+(?:lid\s+)?(?:organics?\s*\/?\s*)?(?:FOGO\s+)?bins?\b/gi, ' or FOGO bin')
      .replace(/FOGO bin,?\s+(?:or|and)\s+(?:the\s+)?green\s+(?:lid\s+)?(?:organics?\s*\/\s*)?(?:organics?\s+)?(?:FOGO\s+)?bin/gi, 'FOGO bin')
      .replace(/((?:green\s+)?organics?\s*\/\s*FOGO bin)\s+or\s+FOGO bin/gi, '$1')
      .replace(/FOGO bin\s*\(or\s+(?:the\s+)?(?:organic\s+)?(?:FOGO\s+)?bin\b[^)]*\)/gi, 'FOGO bin')

      // Lists of coloured bins that include blue
      .replace(/\b(?:yellow(?:\s+recycling)?)\s*(?:,\s*|\s+or\s+|\s+and\s+)\s*(?:or\s+)?blue(?:\s+(?:paper|cardboard|lid))?\s+bins?\b/gi, 'recycling bin')
      .replace(/\bblue\s+or\s+yellow\s+recycling\s+bins\b/gi, 'recycling bins')
      .replace(/,\s*blue(?:\s+paper)?,\s*or\b/gi, ' or')
      .replace(/,\s*blue(?=\s*[,)])/gi, '')

      // Blue paper & cardboard bin -> recycling bin
      .replace(/\bBlue Bin \(Cardboard (?:and|&) Paper\)/gi, 'recycling bin')
      .replace(
        /\bblue\s+(?:paper\s*(?:&|and)\s*cardboard|cardboard\s*(?:&|and)\s*paper|cardboard|paper|lid)?\s*(bins?|recycling)\b/gi,
        (match, kind: string, offset: number) =>
          cap(match, offset, /recycling/i.test(kind) ? 'recycling' : /s$/i.test(kind) ? 'recycling bins' : 'recycling bin')
      )

      // White clinical containers -> where a household would actually take it
      .replace(
        /\b(?:the\s+)?(?:dedicated\s+|certified\s+)?white\s+Medical\s+Waste\s+(?:disposal\s+)?(?:bins?|containers?)/gi,
        'a pharmacy or council medical collection point'
      )
      .replace(/\b(?:Dispose|Deposit|Place)(?:\s+directly)?\s+(?:in|into|via)\s+(a pharmacy or council medical collection point)/gi, 'Take it to $1')
      .replace(/(a pharmacy or council medical collection point)\s+or\s+pharmacy\s+medicine\s+take-?back(?:\s+box)?/gi, '$1')

      // Households have a single FOGO stream, so "combined streams" caveats and "dedicated" bins make no sense
      .replace(/,?\s+if your council combines the two streams/gi, '')
      .replace(/\b(?:the\s+)?dedicated\s+FOGO bin/gi, 'the FOGO bin')
      .replace(/paper pulp\s+\(recycling bin\)\s+or\s+clear PET plastic\s+\(yellow bin\)/gi, 'paper pulp or clear PET plastic (both go in the recycling bin)')

      // Article pass: "in recycling bin" -> "in the recycling bin"
      .replace(/\b(in|into|on|via|or|than)\s+(standard\s+)?((?:recycling|FOGO)\s+bins?)\b/gi, (_m, prep: string, std: string | undefined, bin: string) =>
        `${prep} the ${std ?? ''}${bin}`
      )
  );
}

const byId = (id: string) => HOUSEHOLD_BINS.find(b => b.id === id) ?? null;
const dropoffById = (id: string) => HOUSEHOLD_DROPOFFS.find(d => d.id === id) ?? null;

/** What the guide should show for a placement: a bin id, a drop-off id, or 'none' for other special disposal. */
export function placementFocus(placement: HouseholdPlacement): string {
  return placement.bin?.id ?? placement.dropoff?.id ?? 'none';
}

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
        bin: null,
        dropoff: dropoffById('softplastics'),
        note: 'Only if it is clean and dry. If it is dirty or there is no drop-off near you, use the General bin.',
      };

    case 'cloth_recycling':
      return {
        bin: null,
        dropoff: dropoffById('clothing'),
        note: 'Not for your bins. Fabric jams sorting machines.',
      };
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
          dropoff: dropoffById('ewaste'),
          note: 'Fire risk, so never put it in a bin.',
        };
      }
      return { bin: null, dropoff: dropoffById('ewaste'), note: 'Not for your bins. It has a plug, cord or battery.' };
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
