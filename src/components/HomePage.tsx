import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Layers,
  Droplets,
  Zap,
  HeartPulse,
  Trash2,
  Recycle,
  Leaf,
  Box,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Globe,
  Loader2,
  Camera,
  BookOpen,
} from 'lucide-react';
import { ActiveTab } from './Navbar';
import { WASTE_ITEMS } from '../data/wasteItems';
import { WasteItem, InspectionResult } from '../types';
import { useEncyclopediaStore, saveValidatedSearchToEncyclopedia } from '../utils/encyclopediaStore';

interface HomePageProps {
  onNavigate: (tab: ActiveTab, subTab?: 'ai_inspector' | 'catalog' | 'resin_codes') => void;
}

interface WasteStreamDetail {
  id: string;
  name: string;
  sub: string;
  lidColor: string;
  lidBorder: string;
  accentText: string;
  bgCard: string;
  borderCard: string;
  badgeBg: string;
  badgeText: string;
  icon: string;
  summary: string;
  acceptedItems: string[];
  forbiddenItems: string[];
  separationRules: string[];
  managementDestination: string;
  proTip: string;
}

const WASTE_STREAMS: WasteStreamDetail[] = [
  {
    id: 'commingled_recycling',
    name: 'Commingled Recycling',
    sub: 'Yellow Lid Bin',
    lidColor: 'bg-amber-500',
    lidBorder: 'border-amber-600',
    accentText: 'text-amber-950',
    bgCard: 'bg-amber-50/50 hover:bg-amber-50/80',
    borderCard: 'border-amber-200 hover:border-amber-400',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900 border-amber-300',
    icon: '♻️',
    summary: 'For clean, rigid packaging containers made of recyclable plastic, aluminum, steel, and glass.',
    acceptedItems: [
      'Rigid plastic bottles & jugs (drink bottles, milk jugs, shampoo bottles)',
      'Plastic tubs & trays (#1 PET, #2 HDPE, #5 PP like margarine, yogurt, takeaway)',
      'Aluminum beverage cans & clean aluminum foil (scrunched into tennis-ball size)',
      'Tin & steel food cans (tuna, soup, baked beans)',
      'Glass bottles & food jars (pasta sauce, jam, wine, beer)',
      'Metal jar lids (screw onto jars or collect inside steel cans)',
    ],
    forbiddenItems: [
      'Soft scrunchable plastics & shopping bags (jams sorting stars)',
      'Broken drinking glasses, window panes, pyrex, ceramics (higher melting point)',
      'Plastic bags holding recyclables (must be loose!)',
      'Food-soiled packaging dripping with grease or liquids',
      'Batteries & electronics (catastrophic truck fire risk)',
    ],
    separationRules: [
      'Give dirty containers a quick cold rinse or spatula scrape—they need to be empty and dry enough not to spoil paper fiber.',
      'Always leave caps screwed firmly ON plastic bottles—modern reclaimers separate caps in float-sink wash vats.',
      'Never put recyclables inside tied garbage or shopping bags—keep all items 100% loose.',
      'Scrunch aluminum foil into a fist-sized ball so optical sorters do not mistake it for paper.',
    ],
    managementDestination: 'Sent to Materials Recovery Facilities (MRFs). High-speed trommel screens, eddy current magnets, and near-infrared (NIR) optical sensors separate plastics by resin, metals by magnetism, and glass by weight for melting into brand new packaging.',
    proTip: 'If a plastic item bends easily or scrunches into a ball and stays crinkled (like chip bags), it belongs in the Red Bin or soft plastic drop-off, NOT the Yellow Bin.'
  },
  {
    id: 'organic',
    name: 'Food & Garden Organics (FOGO)',
    sub: 'Green Lid Bin',
    lidColor: 'bg-emerald-600',
    lidBorder: 'border-emerald-700',
    accentText: 'text-emerald-950',
    bgCard: 'bg-emerald-50/50 hover:bg-emerald-50/80',
    borderCard: 'border-emerald-200 hover:border-emerald-400',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900 border-emerald-300',
    icon: '🌿',
    summary: 'Transforms everyday kitchen food scraps and garden trimmings into certified organic compost and renewable energy.',
    acceptedItems: [
      'Fruit & vegetable peelings, cores, skins, and leftover plant scraps',
      'Cooked food leftovers, plate scrapings, pasta, rice, bread, and grains',
      'Eggshells, cheese crusts, and dairy residues',
      'Coffee grounds, loose tea leaves, and unbleached paper coffee filters',
      'Certified compostable bin liners (must feature AS 4736 / AS 5810 seedlings logo)',
      'Lawn clippings, tree branches (<10cm thick), weeds, flowers, and leaves',
    ],
    forbiddenItems: [
      'Paper towels, paper napkins, tissues, and serviettes (strictly belong in the Red General Waste bin, NOT in organic and NOT in clothes donation)',
      'Greasy pizza boxes and heavily oil-soiled takeout packaging (strictly belongs in Red General Waste bin, NEVER in Green Organics / FOGO bin)',
      'Whole chicken carcasses, mammal bones, and meat scraps (belong in 🟠 Orange Meat & Bones Bin)',
      'Standard plastic bags or degradable/biodegradable plastic (leaves microplastics)',
      'Produce fruit stickers (PLU stickers are made of vinyl plastic)',
      'Treated timber, sawdust from painted wood, or plastic plant pots',
      'Pet feces, dog waste bags, or kitty litter (pathogen risks)',
      'Nappies, diapers, wet wipes, or sanitary hygiene products',
    ],
    separationRules: [
      'Keep a countertop kitchen caddy lined with certified compostable liners or plain newspaper.',
      'Paper towels and paper napkins belong in the Red Bin, NOT in organic or clothes donation.',
      'Peel all small plastic branding stickers off apples, bananas, and avocados before composting.',
      'Layer wet kitchen scraps between dry brown garden leaves to eliminate odors and balance nitrogen/carbon.',
      'Keep greasy pizza boxes strictly out of the Green FOGO bin and place them into the Red General Waste bin.',
    ],
    managementDestination: 'Transported to commercial in-vessel aerobic composting tunnels or industrial anaerobic digestion reactors. Microbes heat materials up to 60°C to kill weed seeds and pathogens, turning waste into high-grade agricultural fertilizer and green biomethane electricity.',
    proTip: 'Diverting organics from landfill is the fastest way to slash methane emissions—methane generated by rotting food in oxygen-starved landfills is 28x more potent than CO₂.'
  },
  {
    id: 'paper_cardboard',
    name: 'Paper & Cardboard',
    sub: 'Blue Lid Bin',
    lidColor: 'bg-blue-600',
    lidBorder: 'border-blue-700',
    accentText: 'text-blue-950',
    bgCard: 'bg-blue-50/50 hover:bg-blue-50/80',
    borderCard: 'border-blue-200 hover:border-blue-400',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900 border-blue-300',
    icon: '📦',
    summary: 'Dedicated fiber stream for unsoiled, dry paperboard, shipping boxes, newspapers, and printing paper.',
    acceptedItems: [
      'Clean and unused pizza boxes (100% clean corrugated kraft cardboard with zero food oils)',
      'Corrugated cardboard shipping & parcel boxes (flattened)',
      'Cereal boxes, shoe boxes, tissue boxes, and dry food packaging',
      'Clean newspapers, magazines, circulars, brochures, and phonebooks',
      'Office paper, printer paper, lined notebook paper, and envelopes',
      'Pulp egg cartons, cardboard drink trays, and clean paper grocery bags',
    ],
    forbiddenItems: [
      'Takeaway coffee cups (lined with polyethylene plastic film)',
      'Wax-coated produce boxes or frozen food containers',
      'Greasy cheese-stained pizza box bottoms & oily boxes (strictly belongs in Red General Waste bin, NOT Green bin)',
      'Thermal cash register receipts (coated with BPA/BPS chemical developers)',
      'Padded bubble-wrap envelopes (unless plastic bubble lining is fully removed)',
      'Metallic or glitter foil holiday wrapping paper',
    ],
    separationRules: [
      'Always flatten all cardboard boxes flat to save bin capacity and prevent blockages.',
      'Keep paper completely dry—wet fibers turn into mush and clog sorting screens.',
      'Peel off thick plastic shipping label pouches and remove bubble wrap inserts.',
      'Plastic windows in envelopes and small staples are acceptable—hydrapulpers screen them out.',
    ],
    managementDestination: 'Delivered to dedicated paper mills. Batches are submerged into warm water hydrapulpers to slurry the fibers, filtered through fine slot screens to remove adhesives and staples, de-inked, and pressed into fresh kraft paper and corrugated boxes up to 7 times.',
    proTip: 'Takeaway coffee cups look like paper, but 99% have a hidden waterproof plastic lining that does not dissolve in water baths. Put cups in Red General Waste unless you have a dedicated cup-drop station.'
  },
  {
    id: 'e_waste',
    name: 'E-Waste & Batteries',
    sub: 'Designated Drop-Off Depot',
    lidColor: 'bg-stone-900',
    lidBorder: 'border-stone-800',
    accentText: 'text-stone-900',
    bgCard: 'bg-stone-100/90 hover:bg-stone-100',
    borderCard: 'border-stone-300 hover:border-stone-500',
    badgeBg: 'bg-stone-900',
    badgeText: 'text-amber-300 border-stone-800 font-bold',
    icon: '🔌',
    summary: "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.",
    acceptedItems: [
      'Rechargeable Lithium-ion (Li-ion) batteries, power banks, and camera batteries',
      'Standard AA, AAA, C, D, and 9V alkaline batteries',
      'Dead smartphones, feature phones, tablets, smartwatches, and GPS devices',
      'Laptops, desktop PCs, computer motherboards, RAM, and hard drives',
      'Charging cables, USB power adapters, power strips, and extension cords',
      'Small kitchen appliances (kettles, toasters, blenders) and electric toothbrushes',
      'Old televisions, monitors, keyboards, mice, and gaming consoles',
    ],
    forbiddenItems: [
      'ALL household curbside bins (Red, Yellow, Green, Blue, Orange, White)! E-waste requires designated drop-off!',
      'Putting e-waste in regular household bins is a fire hazard and illegal in many areas',
      'Pressurized gas cylinders or camping butane canisters (take to designated hazardous depots)',
      'Leaking industrial car lead-acid batteries without protective transport trays',
      'Smoke detectors containing radioactive americium-241 (consult fire authority)',
    ],
    separationRules: [
      "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks.",
      'E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances).',
      'Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.',
      'CRITICAL SAFETY: Place clear tape across the terminals (+ / - poles) of 9V and lithium batteries to prevent sparks and thermal runaway.',
      'Wipe personal data and perform factory resets on phones and laptops prior to drop-off.',
    ],
    managementDestination: 'Delivered to certified e-waste recyclers and designated material recovery centres. Circuit boards are smelted to recover 99% pure gold, silver, copper, and tin. Batteries are shredded under nitrogen gas to harvest battery-grade lithium carbonate, cobalt, and nickel.',
    proTip: "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials."
  },
  {
    id: 'hard_rubbish',
    name: 'Hard Rubbish & Bulky Waste',
    sub: 'Council Collection / Transfer Station',
    lidColor: 'bg-amber-800',
    lidBorder: 'border-amber-900',
    accentText: 'text-amber-950',
    bgCard: 'bg-amber-50/60 hover:bg-amber-50/90',
    borderCard: 'border-amber-300 hover:border-amber-500',
    badgeBg: 'bg-amber-800',
    badgeText: 'text-amber-100 border-amber-900 font-bold',
    icon: '🛋️',
    summary: 'Oversized household goods too large for curbside wheelie bins. Collected via booked council hard rubbish pickups or municipal transfer depots.',
    acceptedItems: [
      'Broken furniture (timber dining tables, chairs, bookshelves, desks, sofas, wardrobes)',
      'Mattresses, box bed bases, and steel bed frames',
      'Whitegoods (washing machines, dryers, dishwashers, stoves, degassed fridges & freezers)',
      'Scrap metal: corrugated roofing sheets, gutters, clotheslines, wire fencing',
      'Bicycles, lawnmowers (drained of fuel and motor oil), metal garden tools',
      'Rolled and tied carpets, linoleum, foam underlay, and large rugs (up to 1.5m)',
      'Bundled timber offcuts (protruding nails hammered flat or removed, max 1.5m length)',
      'Ceramic washbasins, vanity sinks, toilet bowls, and steel/porcelain bathtubs',
    ],
    forbiddenItems: [
      'Everyday household food scraps and garden organics (belong in Green FOGO bin)',
      'Standard curbside recyclables: paper, cardboard, bottles, cans (belong in Yellow/Blue bins)',
      'Asbestos and fibrous cement sheeting (STRICTLY FORBIDDEN; requires licensed hazardous contractor)',
      'Liquid chemicals, wet paint cans, motor oils, and pesticides (belong in Chemical CleanOut)',
      'Gas bottles, barbecue butane canisters, and fire extinguishers',
      'Commercial building construction demolition rubble, concrete slabs, soil, sand, and bricks',
    ],
    separationRules: [
      'Book your hard rubbish collection online with your local council or verify your suburb annual collection date.',
      'Stack neatly on your nature strip 24-48 hours before collection without blocking pedestrian walkways or storm drains.',
      'Separate scrap metal and whitegoods into a dedicated pile to streamline direct metal salvage.',
      'Remove or tape shut doors on old fridges, freezers, and wardrobes to eliminate child entrapment risks.',
      'Observe council volume limits (typically a maximum of 2 to 3 cubic metres per household booking).',
    ],
    managementDestination: 'Collected by heavy flatbed trucks and hydraulic lifters. Metal scrap and whitegoods are fed to heavy scrap shredders for 100% steel, aluminum, and copper recovery. Mattresses undergo manual and mechanical deconstruction at circular facilities where steel springs are recycled and foam is converted into carpet underlay. Clean timber is chipped for landscaping mulch or composite wood products.',
    proTip: 'Before booking hard rubbish, consider offering usable furniture to charitable thrift shops (Salvos, Vinnies) or neighborhood reuse networks. Reusing an item in its current form saves 100% of the manufacturing and recycling energy!'
  },
  {
    id: 'medical_waste',
    name: 'Medical & Sharps Waste',
    sub: 'White Lid / Clinical Stream',
    lidColor: 'bg-white',
    lidBorder: 'border-rose-400',
    accentText: 'text-rose-950',
    bgCard: 'bg-stone-50/90 hover:bg-rose-50/80',
    borderCard: 'border-rose-200 hover:border-rose-400',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-900 border-rose-300',
    icon: '🩺',
    summary: 'Clinical biohazard protection for sharps, infectious dressings, and active pharmaceutical compounds.',
    acceptedItems: [
      'Hypodermic needles, insulin pen needles, syringes, and lancets (in approved rigid sharps bin)',
      'Blood-soaked surgical dressings, clinical gauze, and wound swabs',
      'Expired prescription medicines, antibiotics, painkillers, and blister packs',
      'Intravenous (IV) fluid bags, plastic tubing, and dialysate bags',
      'Biohazard protective gloves and masks used in infectious home care',
    ],
    forbiddenItems: [
      'Loose needles in household garbage or recycling bins (major injury threat to collectors)',
      'Needles in soft soda bottles, milk jugs, or aluminum cans (needles poke through)',
      'Flushing pills down sinks or toilets (contaminates rivers, lakes, and drinking aquifers)',
      'Clean outer retail cardboard medicine boxes (clean paperboard goes into Blue Bin)',
    ],
    separationRules: [
      'Sharps MUST be dropped immediately into an Australian/ISO standard puncture-proof yellow or white rigid sharps container.',
      'Never attempt to bend, break, or manually re-cap used needles.',
      'When the sharps container reaches the 3/4 full fill line, securely lock the one-way lid and return it to participating pharmacies or community health depots.',
      'Return all unused and expired pills, liquids, and creams to your community pharmacy via the Return Unwanted Medicines (RUM) program.',
    ],
    managementDestination: 'Sterilized inside high-pressure autoclaves (steam at 134°C under high pressure) to neutralize bloodborne viruses (HIV, Hepatitis B/C), or thermally destructed via high-temperature clinical incineration at 1100°C so pharmaceuticals never leach into groundwater.',
    proTip: 'Never flush medications down the toilet. Wastewater treatment plants cannot filter out antibiotics and hormones, which disrupts aquatic life and enters the food chain.'
  },
  {
    id: 'meat_bones',
    name: 'Meat & Bones Stream',
    sub: 'Orange Lid Bin',
    lidColor: 'bg-orange-500',
    lidBorder: 'border-orange-600',
    accentText: 'text-orange-950',
    bgCard: 'bg-orange-50/50 hover:bg-orange-50/80',
    borderCard: 'border-orange-200 hover:border-orange-400',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-900 border-orange-300',
    icon: '🍖',
    summary: 'Dedicated biological stream for raw and cooked animal bones, meat scraps, poultry carcasses, fish heads, and seafood shells.',
    acceptedItems: [
      'Rotisserie chicken carcasses, turkey frames, wing bones, and poultry scraps',
      'Cooked and raw beef T-bones, steak bones, lamb shanks, and marrow bones',
      'Pork rib bones, pork chops, bacon rinds, and animal fat/gristle trimmings',
      'Fish heads, backbones, tails, fins, scales, and seafood waste',
      'Shrimp & prawn peels, crab carapaces, and soft crustacean shells',
      'Plate leftovers with cooked meat, meat stews, gravy scrapings, and ham bones',
    ],
    forbiddenItems: [
      'Hard bivalve shells like mussel shells, oyster shells, and clam shells (they do NOT break down in biological rendering/FOGO and damage shredder blades; put in Red General Waste)',
      'Plastic butcher packaging trays & polystyrene meat containers (belong in Red General Waste)',
      'Blood-soaked absorbent cellulose pads & soaker pads (belong in Red General Waste)',
      'Plastic cling wrap, plastic butcher sheets, or shrink wrap',
      'Metal skewers, barbecue tongs, or butcher netting (ruins industrial grinder blades)',
      'Garden branches, soil, rocks, grass clippings (belong in Green FOGO bin)',
      'Pet feces, dog poop bags, or cat litter (sanitary pathogen risk; belongs in Red Bin)',
    ],
    separationRules: [
      'Wrap greasy bones and carcass scraps in a sheet of plain newspaper or a certified compostable liner to control moisture and odors.',
      'In hot weather, store meat leftovers and bones in a sealed container in the freezer until collection morning to avoid odor and maggots.',
      'Always ensure plastic meat trays and absorbent pads are completely removed—synthetic plastics ruin biological bone-meal purity.',
      'Do not include elastic butcher roasting netting, twine, or barbecue skewers.',
    ],
    managementDestination: 'Transported to commercial high-temperature bio-rendering plants and thermophilic anaerobic digestion reactors. Pasteurization at >70°C for over 1 hour eradicates all animal pathogens (Salmonella, Listeria, E. coli). Animal fats and volatile fatty acids yield clean biomethane for renewable power, while calcium phosphate bone minerals are milled into rich organic agricultural bone meal.',
    proTip: 'Never place large animal bones or meat in standard backyard home compost bins. Home compost tumblers cannot reach the 70°C pasteurization heat required to sanitize animal pathogens, and will attract rats, raccoons, and flies. The municipal Orange Lid Bin is specifically designed for safe, industrial-grade biological thermal recycling!'
  },
  {
    id: 'general_waste',
    name: 'General Waste (Landfill)',
    sub: 'Red Lid Bin',
    lidColor: 'bg-rose-600',
    lidBorder: 'border-rose-700',
    accentText: 'text-rose-950',
    bgCard: 'bg-rose-50/50 hover:bg-rose-50/80',
    borderCard: 'border-rose-200 hover:border-rose-400',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900 border-rose-300',
    icon: '🗑️',
    summary: 'The final destination for non-recyclable, non-compostable household residual waste.',
    acceptedItems: [
      'Paper towels, paper napkins, facial tissues, and serviettes (strictly Red General Waste bin; NOT in organic and NOT in clothes donation)',
      'All clothing materials, textiles, worn garments, and fabric scraps (all clothing goes either in Red General Waste or via clothes donation)',
      'Anything you are unsure, uncertain, or doubtful about ("When in doubt, throw it out into Red General Waste" to safeguard recycling purity)',
      'Plastic bubble wraps, padded bubble mailers, and plastic air pillows / inflatable packaging cushions',
      'Mussel shells, oyster shells, clam shells, and hard bivalve shells (dense calcium carbonate does not decompose in commercial FOGO or meat rendering and damages shredder machinery)',
      'Greasy pizza boxes, cheese-stained bottoms & heavily oil-soaked food cardboard (Red bin, NEVER Green bin)',
      'Soft scrunchable plastics & plastic bags (if no specialized store drop-off available)',
      'Broken ceramics, porcelain plates, terracotta pots, and drinking glassware',
      'Disposable baby nappies, adult incontinence pads, and wet sanitary wipes',
      'Vacuum cleaner dust, lint, and floor sweepings (in a tied bag)',
      'Styrofoam meat trays & expanded polystyrene packaging (strictly Red bin; cannot go into meat bin, green bin, or curbside yellow recycling)',
      'Toothpaste tubes, toothbrushes, and multi-laminate foil toothpaste packaging',
      'Cat litter, pet waste, and dog poop bags (unless certified for home composting)',
      'Incandescent & halogen light bulbs (not fluorescent/mercury CFL tubes)',
    ],
    forbiddenItems: [
      'Recyclable plastic bottles, aluminum cans, or glass jars (belong in Yellow Bin)',
      'Clean cardboard boxes or office paper (belong in Blue Bin)',
      'Food scraps and garden pruning (belong in Green FOGO Bin)',
      'Batteries, power banks, and electronics (fire hazard; take to designated drop-off locations like Officeworks or council depots—no household bin)',
      'Liquid paints, motor oils, and household chemical solvents (belong in HHW depots)',
      'Loose needles or clinical sharps (puncture risk for sanitation workers)',
    ],
    separationRules: [
      'All clothing materials go either into the Red General Waste bin or via clothes donation banks (near train stations, Coles, or charities).',
      'Paper towels and napkins belong in the Red Bin, NOT in organic and NOT in clothes donation.',
      'Universal rule: If you are not sure or uncertain whether an item is recyclable, place it into the Red General Waste bin to prevent contaminating entire clean loads.',
      'Treat the red bin as your last resort after reducing, reusing, recycling, and composting.',
      'Bag dusty items (vacuum cleaner dust, fireplace cold ashes) so they do not blow in workers’ faces during compaction.',
      'Never place hot embers or lit coals in the red bin.',
      'Squeeze air out of bags to maximize bin volume and prevent bin lid from staying ajar.',
    ],
    managementDestination: 'Compacted and buried in engineered sanitary landfills equipped with thick geomembrane composite liners, leachate collection pipelines, and methane extraction wells. In modern regions, residual waste is sent to Waste-to-Energy (WtE) combustion facilities generating municipal electricity.',
    proTip: 'All clothing materials go either in the red bin or via clothes donation, and paper towels and napkins belong in the red bin (not in organic or clothes donation). By sorting properly, you keep clean recyclables free of contamination!'
  },
  {
    id: 'cloth_recycling',
    name: 'Clothes Donation & Textiles',
    sub: 'Designated Drop-Off (Station, Coles) or Red Bin',
    lidColor: 'bg-teal-600',
    lidBorder: 'border-teal-700',
    accentText: 'text-teal-950',
    bgCard: 'bg-teal-50/50 hover:bg-teal-50/80',
    borderCard: 'border-teal-200 hover:border-teal-400',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-900 border-teal-300 font-bold',
    icon: '👕',
    summary: 'All clothing materials go either in the Red Bin or via clothes donation hubs situated conveniently near train stations, Coles supermarkets, Woolworths, and charity depots (Salvos, Vinnies). Never place in Yellow, Green, or Blue bins!',
    acceptedItems: [
      'Clean wearable clothing: shirts, t-shirts, dresses, jeans, trousers, jackets, coats, and sweaters',
      'Pairs of shoes, sneakers, and boots (must be tied together by laces or secured with rubber bands)',
      'Clean household bedsheets, pillowcases, linen, and blankets',
      'Clean bath towels, hand towels, and washcloths',
      'Clean fabric offcuts and clean textile scraps (bagged for industrial fiber shredding)',
      'Hats, fabric belts, scarves, and paired gloves',
    ],
    forbiddenItems: [
      'Paper towels, paper napkins, or facial tissues (belong strictly in Red General Waste bin, NOT in clothes donation or organic)',
      'Yellow commingled recycling, Blue paper, or Green organic bins (clothing tangles revolving sorting axles and causes plant shutdowns)',
      'Wet, damp, or mildewed clothing (spolls entire textile collection bales with fungus)',
      'Rags contaminated with wet paint, toxic chemical solvents, or motor oil (hazardous waste)',
      'Single unmatched loose shoes without their pair',
      'Large mattresses or bulky carpet underlay (belong in council Hard Rubbish collection)',
    ],
    separationRules: [
      'All clothing materials go either in the Red Bin or via clothes donation hubs (near train stations, Coles, Woolworths, or charity shops).',
      'Never put clothes, shoes, or towels into Yellow recycling, Blue paper, or Green organic bins—they act as "tanglers" in recycling plants.',
      'Paper towels and napkins belong in the Red Bin, NOT in organic and NOT in clothes donation.',
      'Wash and dry garments thoroughly before clothes donation so textiles remain clean and odor-free.',
      'Tie shoe pairs securely together by their laces so they do not separate during sorting.',
      'Drop off at designated textile collection banks located conveniently near train stations, Coles supermarkets, Woolworths carparks, and charity hubs (Salvos, Vinnies).',
      'Bag textiles in waterproof bags to protect them from weather when dropping into collection banks.',
    ],
    managementDestination: 'Collected from designated drop-off banks near stations and supermarkets. Wearable garments are sorted for charitable community resale or disaster relief. Damaged, unwearable fabrics are processed in industrial rag mills and shredded into commercial cleaning cloths, automotive acoustic felt insulation, and recycled fiber yarn. Unwearable garments can also be disposed of in Red General Waste.',
    proTip: 'All clothing materials go either in the red bin or via clothes donation, and paper towels and napkins belong in the red bin (not in organic and clothes donation). Convenient drop-off banks situated near train stations and Coles supermarkets make donating clothes effortless!'
  },
];

interface HardToRecycleStream {
  id: string;
  title: string;
  icon: string;
  color: string;
  badge: string;
  badgeColor: string;
  description: string;
  howToManage: string;
  whereToGo: string;
  examples: string[];
}

const HARD_TO_RECYCLE_STREAMS: HardToRecycleStream[] = [
  {
    id: 'soft_plastics',
    title: 'Soft Plastics & Plastic Film',
    icon: '🛍️',
    color: 'border-amber-400 bg-amber-50/60',
    badge: 'Supermarket Drop-Off Hubs',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Bread bags, frozen food bags, bubble wrap, plastic zip-lock pouches, cling wrap, and chip packets.',
    howToManage: 'Perform the "Scrunch Test": if it scrunches into a ball in your hand, it is soft plastic. NEVER put in your yellow bin because soft films wrap around revolving sorter axles and shut down recycling plants.',
    whereToGo: 'Drop off at supermarket soft-plastic collection hubs (RedCycle / store bins) or specialized council programs for reprocessing into outdoor plastic furniture, asphalt additive, and composite bollards.',
    examples: ['Bread bags', 'Bubble wrap & air cushions', 'Frozen food bags', 'Zip-lock pouches', 'Cling film', 'Silver-lined chip packets']
  },
  {
    id: 'hazardous_chemicals',
    title: 'Household Hazardous Chemicals & Paint',
    icon: '🧪',
    color: 'border-purple-400 bg-purple-50/60',
    badge: 'Hazardous Waste Depot / Paintback',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Oil-based paints, thinners, turpentine, pool chemicals, weed killers, motor oil, car brake fluids, and CFL fluorescent tubes.',
    howToManage: 'Never pour chemical liquids down the sink, into storm water drains, or onto the soil—1 liter of oil can contaminate 1,000,000 liters of fresh water. Never place chemicals into curbside wheelie bins.',
    whereToGo: 'Store safely in original labeled containers and take to annual community Household Hazardous Waste (HHW) drop-off events, Paintback retail drop-offs, or council transfer stations.',
    examples: ['Paint cans & thinners', 'Motor oil & brake fluid', 'Pool chlorine & acid', 'Weed killers & pesticides', 'Fluorescent tubes & CFLs']
  },
  {
    id: 'clothing_textiles',
    title: 'Clothing & Textiles',
    icon: '👕',
    color: 'border-teal-400 bg-teal-50/60',
    badge: 'Donation Hubs or Red Bin',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    description: 'All clothing materials go either in the Red Bin or via clothes donation.',
    howToManage: 'All clothing materials go either in the Red General Waste bin or via clothes donation banks. Wearable clothes and paired shoes should be donated to charity or drop-off hubs; unwearable textiles can go into the Red General Waste bin. They must NEVER go into yellow recycling, blue paper, or green organic bins.',
    whereToGo: 'Donate clean garments to local thrift charity shops (Vinnies, Salvos) or drop-off banks near train stations and Coles supermarkets. Worn-out or damaged textiles can be placed directly into the Red General Waste bin.',
    examples: ['Wearable shirts & dresses', 'Shoes (tied in pairs)', 'Bed sheets & towels', 'Damaged fabric (Red Bin)', 'Fabric scraps & offcuts']
  },
  {
    id: 'white_goods_scrap',
    title: 'Bulky White Goods & Scrap Metal',
    icon: '🧊',
    color: 'border-blue-400 bg-blue-50/60',
    badge: 'Council Booking / Transfer Station',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Refrigerators, freezers, air conditioners, washing machines, dryers, metal bed frames, and copper piping.',
    howToManage: 'Refrigerators and freezers contain dangerous CFC or HFC ozone-depleting refrigerants and compressor oils. Certified technicians must safely de-gas the appliances before metal reclamation.',
    whereToGo: 'Book a council curbside hard-rubbish / clean-up collection, or drop off directly at scrap metal merchants and transfer stations to receive commodity metal scrap value.',
    examples: ['Fridges & freezers (degassed)', 'Washing machines & dryers', 'Air conditioners', 'Metal bed frames & scrap', 'Copper pipes & gutters']
  }
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('commingled_recycling');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Special Streams & Hard-to-Recycle expandable state
  const [expandedSpecialStreams, setExpandedSpecialStreams] = useState<Record<string, boolean>>({});

  // 9 Core Waste Streams full deep dive guide visibility state
  const [isStreamGuideExpanded, setIsStreamGuideExpanded] = useState<boolean>(false);

  // Waste Hierarchy & Golden Rules tab switcher state
  const [activeRulesTab, setActiveRulesTab] = useState<'golden_rules' | 'hierarchy'>('golden_rules');

  const toggleSpecialStream = (id: string) => {
    setExpandedSpecialStreams(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const areAllSpecialExpanded = useMemo(() => {
    return HARD_TO_RECYCLE_STREAMS.every(s => expandedSpecialStreams[s.id]);
  }, [expandedSpecialStreams]);

  const toggleAllSpecialStreams = () => {
    if (areAllSpecialExpanded) {
      setExpandedSpecialStreams({});
    } else {
      const all: Record<string, boolean> = {};
      HARD_TO_RECYCLE_STREAMS.forEach(s => {
        all[s.id] = true;
      });
      setExpandedSpecialStreams(all);
    }
  };

  // Mobile Keyboard & Focus Optimization State
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const gamesRef = React.useRef<HTMLDivElement>(null);

  const scrollToGames = () => {
    gamesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // AI-Powered Search & Google Verification State
  const { allItems, saveValidatedSearch } = useEncyclopediaStore();
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState<InspectionResult | null>(null);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  const handleSearchFocus = () => {
    setIsInputFocused(true);
    // Smoothly scroll the search box into the top portion of the screen right below the header
    // so the mobile virtual keyboard is placed cleanly BELOW the search box and the user
    // can clearly see what they are typing without keyboard obstruction.
    const scrollTarget = () => {
      if (searchContainerRef.current) {
        const rect = searchContainerRef.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 16;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }
    };
    setTimeout(scrollTarget, 80);
    setTimeout(scrollTarget, 240);
  };

  const handleSearchBlur = () => {
    setTimeout(() => {
      setIsInputFocused(false);
    }, 250);
  };

  const handleAiSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!q) return;

    if (queryText !== undefined) {
      setSearchQuery(queryText);
    }

    setIsAiSearching(true);
    setAiSearchError(null);

    try {
      const res = await fetch('/api/inspect-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: q }),
      });

      if (!res.ok) throw new Error('AI search failed');
      const data: InspectionResult = await res.json();
      setAiSearchResult(data);
    } catch {
      setAiSearchError('Could not verify item with AI. Showing local catalog results below.');
    } finally {
      setIsAiSearching(false);
    }
  };

  // Filtered waste catalog search
  const filteredItems = useMemo(() => {
    let list = allItems;
    if (selectedCategory !== 'all') {
      list = list.filter(item => {
        if (selectedCategory === 'plastics') return item.category === 'plastics';
        if (selectedCategory === 'paper_cardboard') return item.category === 'paper_cardboard';
        if (selectedCategory === 'metals') return item.category === 'metals';
        if (selectedCategory === 'glass') return item.category === 'glass';
        if (selectedCategory === 'organics') return item.category === 'organics';
        if (selectedCategory === 'textiles') return item.category === 'textiles' || item.bin === 'cloth_recycling';
        if (selectedCategory === 'e_waste') return item.category === 'e_waste_hazardous' || item.bin === 'e_waste';
        if (selectedCategory === 'medical_waste') return item.bin === 'medical_waste';
        if (selectedCategory === 'meat_bones') return item.bin === 'meat_bones' || item.category === 'meat_bones';
        if (selectedCategory === 'hard_rubbish') return item.bin === 'hard_rubbish' || item.category === 'hard_rubbish';
        return true;
      });
    }

    if (!searchQuery.trim()) {
      return list.slice(0, 12);
    }

    const q = searchQuery.toLowerCase().trim();
    return list.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.whyItGoesHere.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q)) ||
      item.prepInstructions.some(p => p.toLowerCase().includes(q))
    ).slice(0, 24);
  }, [searchQuery, selectedCategory]);

  const activeStream = WASTE_STREAMS.find(s => s.id === selectedStreamId) || WASTE_STREAMS[0];

  const getBinBadgeColor = (bin: string) => {
    switch (bin) {
      case 'commingled_recycling':
      case 'recycling':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'organic':
      case 'compost':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'paper_cardboard':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'cloth_recycling':
        return 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
      case 'soft_plastic_dropoff':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold';
      case 'e_waste':
        return 'bg-stone-900 text-amber-300 border-stone-800 font-bold';
      case 'medical_waste':
        return 'bg-rose-50 text-rose-900 border-rose-300';
      case 'meat_bones':
        return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'hard_rubbish':
        return 'bg-amber-800 text-amber-100 border-amber-900 font-bold';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  const getBinNameFormatted = (bin: string) => {
    switch (bin) {
      case 'commingled_recycling':
      case 'recycling':
        return '🟡 Yellow: Commingled';
      case 'organic':
      case 'compost':
        return '🟢 Green: FOGO / Organic';
      case 'paper_cardboard':
        return '🔵 Blue: Cardboard & Paper';
      case 'cloth_recycling':
        return '👕 Cloth: Designated Drop-Off (Station, Coles)';
      case 'soft_plastic_dropoff':
        return '🛍️ Soft Plastic: Supermarket Drop-Off';
      case 'e_waste':
        return '🏬 E-Waste: Designated Drop-Off';
      case 'medical_waste':
        return '⚪ White: Medical / Sharps';
      case 'meat_bones':
        return '🟠 Orange: Meat & Bones';
      case 'hard_rubbish':
        return '🛋️ Hard Rubbish: Council Collection';
      default:
        return '🔴 Red: General Waste';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Welcome Banner with Quick Search */}
      <section className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-emerald-950 via-stone-950 to-stone-900 text-white p-6 sm:p-10 shadow-2xl shadow-emerald-950/40 border border-white/10">
        {/* Animated glow blobs + dot grid texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 text-xs sm:text-sm font-extrabold text-emerald-200 shadow-2xs animate-fade-in-up">
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>Complete Modern Waste Separation & Circular Economy Guide</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight animate-fade-in-up">
            Know Where It Goes. <br className="hidden sm:inline" />
            <span className="text-gradient-eco">Sort Clean, Waste Zero.</span>
          </h1>

          {/* Quick value-prop stat strip */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 animate-fade-in-up">
            {[
              { label: '9 Waste Streams', icon: '♻️', onClick: undefined },
              { label: '3 Interactive Games', icon: '🎮', onClick: scrollToGames },
              { label: 'AI-Powered Verification', icon: '✨', onClick: undefined },
            ].map(stat => {
              const className = "inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold text-emerald-50 transition-colors";
              return stat.onClick ? (
                <button key={stat.label} type="button" onClick={stat.onClick} className={`${className} cursor-pointer`}>
                  <span>{stat.icon}</span>
                  {stat.label}
                </button>
              ) : (
                <span key={stat.label} className={className}>
                  <span>{stat.icon}</span>
                  {stat.label}
                </span>
              );
            })}
          </div>

          <p className="text-stone-200/90 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
            Every year, millions of tons of clean recyclables are ruined by wishcycling and improper binning. Explore our complete guide to all 9 municipal waste streams & drop-off networks, learn critical preparation steps, and test your skills in interactive challenges!
          </p>

          {/* Quick-Jump Waste Search Bar with AI & Google Grounding */}
          <div ref={searchContainerRef} className="pt-2 scroll-mt-20 sm:scroll-mt-28">
            <div className="relative max-w-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAiSearch(searchQuery);
                }}
                className={`relative flex items-center transition-all duration-200 rounded-2xl ${
                  isInputFocused ? 'ring-4 ring-emerald-400/50 shadow-xl' : 'shadow-lg'
                }`}
              >
                <Search className="w-5 h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  id="home-search-input"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setAiSearchResult(null);
                    }
                  }}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Search any rubbish (e.g. bubble wrap, air pillow, clothes)..."
                  className="w-full pl-10 sm:pl-12 pr-28 sm:pr-44 py-3.5 rounded-2xl bg-white text-stone-900 placeholder:text-stone-400 text-base sm:text-sm font-semibold focus:outline-none border border-stone-200 transition-colors"
                />
                <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blurring input
                        setSearchQuery('');
                        setAiSearchResult(null);
                        searchInputRef.current?.focus();
                      }}
                      className="w-7 h-7 flex items-center justify-center text-xs font-bold text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    id="home-ai-search-btn"
                    type="submit"
                    disabled={isAiSearching || !searchQuery.trim()}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold text-xs px-2.5 sm:px-3.5 py-2 rounded-xl shadow-md shadow-emerald-900/20 transition-all cursor-pointer whitespace-nowrap"
                    title="Verify disposal stream using Gemini AI & Google Search data"
                  >
                    {isAiSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="hidden sm:inline">Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span className="hidden sm:inline">AI & Google </span>
                        <span>Verify</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Mobile Live Typing Bar - placed directly below search box so user clearly sees what they type above soft keyboard */}
              {isInputFocused && (
                <div className="sm:hidden mt-2 p-2.5 rounded-xl bg-stone-950/95 backdrop-blur-md border border-amber-600/50 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <span className="text-amber-400 font-black shrink-0">Typing:</span>
                      {searchQuery.trim() ? (
                        <span className="font-extrabold truncate text-white max-w-[200px] bg-white/10 px-1.5 py-0.5 rounded">
                          &ldquo;{searchQuery}&rdquo;
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">Start typing or tap below...</span>
                      )}
                    </div>
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAiSearch(searchQuery);
                        }}
                        className="text-[11px] font-black text-stone-950 bg-amber-400 hover:bg-amber-300 px-2.5 py-1 rounded-lg shrink-0 active:scale-95 cursor-pointer shadow-xs"
                      >
                        Verify ↵
                      </button>
                    )}
                  </div>
                  {/* Quick-tap suggestions for fast mobile typing */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
                    <span className="text-stone-400 text-[10px] uppercase font-bold shrink-0">Quick:</span>
                    {[
                      'Bubble Wrap',
                      'Air Pillows',
                      'Unsure Item',
                      'Old Clothes',
                      'Shoes',
                      'Pizza Box',
                      'Battery',
                    ].map(kw => (
                      <button
                        key={kw}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchQuery(kw);
                          handleAiSearch(kw);
                        }}
                        className="bg-stone-800 hover:bg-amber-900/80 text-stone-200 hover:text-amber-200 px-2 py-0.5 rounded-md border border-stone-700 whitespace-nowrap shrink-0 active:scale-95"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-stone-300/90 mt-2.5 font-medium">
              <span>Popular searches:</span>
              {[
                'Bubble Wrap',
                'Packaging Air Pillows',
                'Unsure Item',
                'Old Clothes & Shoes',
                'Clean Pizza Box',
                'Styrofoam Meat Tray',
                'Greasy Pizza Box',
                'Mussel Shells',
                'Alkaline Battery',
              ].map(kw => (
                <button
                  key={kw}
                  onClick={() => handleAiSearch(kw)}
                  className="underline hover:text-white transition-colors cursor-pointer bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subtle Background Decorative Graphic */}
        <div className="absolute right-0 bottom-0 top-0 opacity-10 pointer-events-none hidden md:flex items-center justify-center pr-12 text-[260px] select-none animate-float">
          🌍
        </div>
      </section>

      {/* Live Search Quick Results (Only visible when user types or filters) */}
      {searchQuery.trim() && (
        <section className="glass-strong rounded-3xl p-6 sm:p-8 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-base font-bold">🔍</span>
              <h2 className="text-xl font-extrabold text-stone-900">
                Search Results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full">
                {filteredItems.length} found
              </span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setAiSearchResult(null);
              }}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
            >
              Close Search
            </button>
          </div>

          {/* AI Verification Loading State */}
          {isAiSearching && (
            <div className="bg-emerald-50 border border-emerald-300/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-2xs">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
              <div>
                <h4 className="text-sm font-extrabold text-emerald-950">
                  Verifying &ldquo;{searchQuery}&rdquo; with WasteSort AI & Google Search Data...
                </h4>
                <p className="text-xs text-emerald-700 font-medium">
                  Checking municipal solid waste standards, commercial FOGO composting, bio-rendering, and dual-stream acceptance rules.
                </p>
              </div>
            </div>
          )}

          {/* AI & Google Verified Result Card */}
          {aiSearchResult && !isAiSearching && (
            <div className="bg-gradient-to-br from-emerald-50/80 via-white to-stone-50 border border-emerald-300/60 rounded-3xl p-5 sm:p-7 shadow-lg shadow-emerald-900/5 space-y-5 animate-scale-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      WasteSort AI Verified Analysis
                    </span>
                    <span className="text-xs font-bold text-stone-600 bg-white border border-stone-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Globe className="w-3 h-3 text-blue-600" />
                      Google Verified Data
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 tracking-tight">
                    {aiSearchResult.itemName}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-3 py-1.5 rounded-xl border ${getBinBadgeColor(aiSearchResult.primaryBin)}`}>
                    {getBinNameFormatted(aiSearchResult.primaryBin)}
                  </span>
                  <button
                    onClick={() => onNavigate('ai_inspector')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    title="Open Camera in AI Inspector"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Camera Inspector</span>
                  </button>
                </div>
              </div>

              {/* Special Notice for E-Waste */}
              {aiSearchResult.primaryBin === 'e_waste' && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-stone-900 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 font-black text-amber-950 text-xs sm:text-sm">
                    <span className="p-1 bg-amber-500 text-stone-950 rounded-md text-xs font-extrabold">⚠️ CRITICAL</span>
                    <span>E-Waste Mandatory Drop-Off (Do Not Put in Curbside Bins)</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold leading-relaxed text-amber-950">
                    Instead, you must take e-waste to a designated drop-off location, such as your local council&apos;s resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.
                  </p>
                </div>
              )}

              {/* DUAL / MULTI-STREAM ACCEPTANCE SHOWCASE (e.g. Raw Meat in both Meat & Bones and Organic) */}
              {aiSearchResult.acceptableBins && aiSearchResult.acceptableBins.length > 1 ? (
                <div className="bg-white border-2 border-emerald-400/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="p-2 bg-emerald-600 text-white rounded-xl text-base shrink-0 shadow-xs">
                      ✨
                    </span>
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-stone-900">
                        Accepted in Multiple Waste Streams (Both Answers Correct!)
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed font-medium">
                        Depending on your regional council&apos;s processing technology, this item is accepted in <strong className="text-stone-900">both</strong> bins shown below:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {aiSearchResult.acceptableBins.map((opt, idx) => (
                      <div
                        key={idx}
                        className="bg-stone-50/80 border border-emerald-300/70 rounded-2xl p-4 space-y-2 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${getBinBadgeColor(opt.bin)}`}>
                            {opt.binName}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                            Valid Option #{idx + 1}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-stone-800">
                          {opt.condition}
                        </div>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          {opt.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-2xl border border-stone-200 text-xs text-stone-700 leading-relaxed font-medium">
                  <strong className="text-stone-900 block mb-1">Sorting Logic:</strong>
                  {aiSearchResult.whyItGoesHere}
                </div>
              )}

              {/* Step-by-Step Preparation */}
              {aiSearchResult.prepInstructions && aiSearchResult.prepInstructions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Preparation & Hygiene Protocol</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {aiSearchResult.prepInstructions.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white p-3 rounded-xl border border-stone-200 text-xs text-stone-800 shadow-2xs">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed font-medium">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wishcycling warning & Verification footnote */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {aiSearchResult.wishcyclingWarning && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-900 font-bold">Wishcycling Contamination Alert:</strong>
                      <span>{aiSearchResult.wishcyclingWarning}</span>
                    </div>
                  </div>
                )}

                {aiSearchResult.verificationNote && (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 flex items-start gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-blue-900 font-bold">Verification Note (Google & Council Standards):</strong>
                      <span>{aiSearchResult.verificationNote}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Added to Disposal Encyclopedia Notification */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-2xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shrink-0">✨</span>
                  <div>
                    <span className="text-xs font-black text-emerald-950 block">
                      Disposal Encyclopedia Updated!
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Validated with Google Search & AI municipal rules and saved to your permanent catalog.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('ai_inspector', 'catalog')}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
                >
                  <span>Open Encyclopedia</span>
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {aiSearchError && (
            <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-medium">
              {aiSearchError}
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
              Matching Encyclopedia Items ({filteredItems.length}):
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 hover:bg-white hover:border-emerald-400 transition-all shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl p-2 bg-white rounded-xl border border-stone-200 shadow-2xs">{item.emoji}</span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-sm text-stone-900 leading-tight">{item.name}</h4>
                      </div>
                      <span className="text-[11px] text-stone-500 capitalize">{item.category.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border whitespace-nowrap ${getBinBadgeColor(item.bin)}`}>
                    {getBinNameFormatted(item.bin)}
                  </span>
                </div>

                <div className="text-xs text-stone-700 leading-relaxed font-medium">
                  {item.whyItGoesHere}
                </div>

                {item.prepInstructions.length > 0 && (
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 space-y-1">
                    <span className="font-bold text-stone-800 block">How to prepare:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                      {item.prepInstructions.slice(0, 2).map((step, i) => (
                        <li key={i} className="leading-tight">{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.wishcyclingWarning && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200/70 flex items-start gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{item.wishcyclingWarning}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The 9 Core Waste Streams Detailed Interactive Separation Matrix */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg text-lg">🗂️</span>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                The 9 Essential Municipal Waste Streams & Drop-Off Systems
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Select a wheelie bin or drop-off stream below to reveal what belongs, common hazardous contaminants, preparation protocols, and industrial processing lifecycles.
            </p>
          </div>
          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
            Standardized Colour Code
          </span>
        </div>

        {/* 9 Waste Stream Tab Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-2.5">
          {WASTE_STREAMS.map(stream => {
            const isSelected = selectedStreamId === stream.id;
            return (
              <button
                key={stream.id}
                id={`stream-tab-${stream.id}`}
                onClick={() => setSelectedStreamId(stream.id)}
                className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? `${stream.bgCard} ${stream.borderCard} ring-2 ring-stone-900/10 shadow-lg scale-[1.02]`
                    : 'glass border-stone-200/60 hover:border-emerald-300 opacity-85 hover:opacity-100'
                }`}
              >
                {/* Lid indicator banner / Drop-Off Indicator */}
                {stream.id === 'e_waste' || stream.id === 'cloth_recycling' ? (
                  <div className={`h-3.5 -mx-3 -mt-3 mb-2 ${stream.id === 'cloth_recycling' ? 'bg-teal-700' : 'bg-stone-900'} border-b ${stream.id === 'cloth_recycling' ? 'border-teal-800' : 'border-stone-800'} flex items-center justify-center px-1`}>
                    <span className={`text-[7.5px] uppercase tracking-wider ${stream.id === 'cloth_recycling' ? 'text-teal-100' : 'text-amber-300'} font-extrabold truncate`}>
                      Designated Drop-Off
                    </span>
                  </div>
                ) : (
                  <div className={`h-2 -mx-3 -mt-3 mb-2 ${stream.lidColor} ${stream.lidBorder} border-b`} />
                )}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-2xl">{stream.icon}</span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-stone-900 leading-tight">
                    {stream.name}
                  </h4>
                  <span className="text-[10px] font-bold text-stone-500 block mt-0.5 leading-tight">
                    {stream.sub}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

          {/* Active Stream Deep-Dive Information Card */}
          <div className={`p-5 sm:p-7 rounded-3xl border transition-all ${activeStream.bgCard} ${activeStream.borderCard} shadow-lg shadow-stone-900/5 space-y-5 animate-scale-in`}>
            {/* Special Callout Banner for Clothes Donation & Textiles */}
            {activeStream.id === 'cloth_recycling' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-teal-500/15 border-2 border-teal-500/40 text-stone-900 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 font-black text-teal-950 text-sm">
                  <span className="p-1 bg-teal-600 text-white rounded-md text-xs font-black">📍 DONATION OR RED BIN</span>
                  <span>Clothes Donation & Red General Waste Standard</span>
                </div>
                <p className="text-xs sm:text-sm font-bold leading-relaxed text-teal-950">
                  All clothing materials go either in the Red Bin or via clothes donation! Clean wearable clothes, paired shoes (tied together), and linens can be dropped off at designated clothes donation hubs located conveniently near train stations, Coles supermarkets, Woolworths carparks, and charity hubs (Salvos, Vinnies)—or disposed of directly in the Red General Waste bin. Clothing must NEVER go into Yellow recycling, Blue paper, or Green organic bins!
                </p>
              </div>
            )}

            {/* Special Callout Banner for E-Waste */}
            {activeStream.id === 'e_waste' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-stone-900 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                  <span className="p-1 bg-amber-500 text-stone-950 rounded-md text-xs font-black">⚠️ NOTICE</span>
                  <span>E-Waste Requires Designated Drop-Off</span>
                </div>
                <p className="text-xs sm:text-sm font-bold leading-relaxed text-amber-950">
                  Instead, you must take e-waste to a designated drop-off location, such as your local council&apos;s resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.
                </p>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
              <div className="flex items-start gap-3.5">
                <span className="text-4xl p-2.5 bg-white rounded-2xl border border-stone-200 shadow-2xs shrink-0">
                  {activeStream.icon}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                      {activeStream.name}
                    </h3>
                    <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${activeStream.badgeBg} ${activeStream.badgeText}`}>
                      {activeStream.sub}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 mt-1.5 font-medium leading-relaxed max-w-3xl">
                    {activeStream.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
                <button
                  onClick={() => setIsStreamGuideExpanded(!isStreamGuideExpanded)}
                  className={`inline-flex items-center justify-center gap-1.5 font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap ${
                    isStreamGuideExpanded
                      ? 'bg-stone-200 text-stone-900 hover:bg-stone-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <span>{isStreamGuideExpanded ? 'Collapse Stream Guide' : 'Show Full Stream Guide'}</span>
                  {isStreamGuideExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onNavigate('bin_master')}
                  className="inline-flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-black text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Practice in Game</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Summary Highlights (always visible) */}
            <div className="bg-white/80 p-4 rounded-2xl border border-stone-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Key Accepted:</span>
                </span>
                <span className="text-stone-700 font-medium">
                  {activeStream.acceptedItems.slice(0, 3).join(', ')}...
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-rose-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Top Hazard:</span>
                </span>
                <span className="text-stone-700 font-medium">
                  {activeStream.forbiddenItems[0]}
                </span>
              </div>
              <button
                onClick={() => setIsStreamGuideExpanded(!isStreamGuideExpanded)}
                className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer text-xs ml-auto sm:ml-0"
              >
                {isStreamGuideExpanded ? 'Hide deep-dive' : 'View all items & prep rules'}
              </button>
            </div>

            {/* Collapsible Deep-Dive Details */}
            <AnimatePresence>
              {isStreamGuideExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-6 pt-2"
                >
                  {/* 2 Columns: Accepted vs Forbidden */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Accepted Items List */}
                    <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm pb-2 border-b border-emerald-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>What Goes IN This Stream:</span>
                      </div>
                      <ul className="space-y-2 text-xs text-stone-700">
                        {activeStream.acceptedItems.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-emerald-600 font-black mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Forbidden / Contaminant Items List */}
                    <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm pb-2 border-b border-rose-100">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>What NEVER Goes In (Contaminants):</span>
                      </div>
                      <ul className="space-y-2 text-xs text-stone-700">
                        {activeStream.forbiddenItems.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-rose-600 font-black mt-0.5">✕</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* How to Separate & Prepare */}
                  <div className="bg-white/80 p-5 rounded-2xl border border-stone-200 space-y-3">
                    <h4 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
                      <span>🧼</span>
                      <span>Step-by-Step Preparation & Separation Protocol:</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeStream.separationRules.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-700 bg-stone-50/80 p-3 rounded-xl border border-stone-200/70">
                          <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="leading-relaxed">{rule}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lifecycle Destination & Pro Tip */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 bg-stone-900 text-white p-5 rounded-2xl shadow-xs space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                        <Layers className="w-4 h-4" />
                        <span>Industrial Processing Lifecycle & Destination:</span>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
                        {activeStream.managementDestination}
                      </p>
                    </div>

                    <div className="bg-amber-100/90 text-amber-950 p-5 rounded-2xl border border-amber-300 shadow-2xs space-y-2">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-700" />
                        <span>Detective Pro Tip:</span>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed font-medium">
                        {activeStream.proTip}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setIsStreamGuideExpanded(false)}
                      className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl border border-stone-200 shadow-2xs cursor-pointer"
                    >
                      <span>Collapse Stream Guide</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Specialty & Hard-to-Recycle Streams */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-100 text-purple-800 rounded-lg text-lg">💡</span>
                <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                  Special Streams & Hard-To-Recycle Items
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                Items that cannot go into standard curbside bins. Click any item below to view full preparation methods, drop-off depots, and circular pathways.
              </p>
            </div>

            {/* Expand / Collapse All Toggle Button */}
            <button
              onClick={toggleAllSpecialStreams}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 shadow-2xs transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              {areAllSpecialExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Expand All</span>
                </>
              )}
            </button>
          </div>

          {/* Collapsible Cards for Hard-to-Recycle Streams */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HARD_TO_RECYCLE_STREAMS.map((item) => {
              const isExpanded = !!expandedSpecialStreams[item.id];
              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border-2 transition-all shadow-2xs hover:shadow-xs overflow-hidden ${item.color} ${
                    isExpanded ? 'ring-2 ring-stone-900/10' : ''
                  }`}
                >
                  {/* Card Header / Clickable Preview */}
                  <div
                    onClick={() => toggleSpecialStream(item.id)}
                    className="p-5 sm:p-6 cursor-pointer select-none space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-2.5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs shrink-0">
                          {item.icon}
                        </span>
                        <div>
                          <h3 className="font-extrabold text-base sm:text-lg text-stone-900 leading-tight">
                            {item.title}
                          </h3>
                          <span className={`inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        </div>
                      </div>

                      <div className="p-1.5 bg-white rounded-xl border border-stone-200/80 text-stone-600 shadow-2xs shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-purple-700" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-500" />
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 font-medium leading-relaxed">
                      {item.description}
                    </p>

                    {/* Collapsed Indicator Button */}
                    <div className="pt-1 flex items-center justify-between text-xs font-bold text-purple-900">
                      <span className="flex items-center gap-1 hover:underline">
                        <span>{isExpanded ? 'Hide detailed handling & drop-offs' : 'Click to view all info, handling rules & drop-offs'}</span>
                      </span>
                      <span className="text-[11px] text-stone-500 font-normal">
                        {isExpanded ? 'Showing full guide' : 'Click to expand'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Information Inside the Stream */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-3.5 border-t border-stone-200/80 pt-4 bg-white/40"
                      >
                        {/* Examples Chips */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block">
                            Common Accepted Items:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.examples.map((ex, exIdx) => (
                              <span
                                key={exIdx}
                                className="bg-white px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-800 border border-stone-200/80 shadow-2xs"
                              >
                                {ex}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* How to Separate & Handle */}
                        <div className="bg-white/90 p-4 rounded-2xl border border-stone-200 space-y-1.5 shadow-2xs">
                          <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                            <span>📋</span>
                            <span>How to Separate & Handle:</span>
                          </span>
                          <p className="text-xs text-stone-600 leading-relaxed font-normal">
                            {item.howToManage}
                          </p>
                        </div>

                        {/* Where to Take It */}
                        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 text-xs text-stone-800 space-y-1 shadow-2xs">
                          <span className="font-bold text-stone-900 flex items-center gap-1.5 text-emerald-800">
                            <span>📍</span>
                            <span>Where to Take It (Drop-Off Locations):</span>
                          </span>
                          <p className="text-xs text-stone-600 leading-relaxed font-normal">
                            {item.whereToGo}
                          </p>
                        </div>

                        {/* Action Buttons for this Stream */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                onNavigate('ai_inspector');
                              }}
                              className="inline-flex items-center gap-1 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                            >
                              <Camera className="w-3 h-3 text-purple-600" />
                              <span>Verify in AI Inspector</span>
                            </button>
                            <button
                              onClick={() => {
                                onNavigate('ai_inspector', 'catalog');
                              }}
                              className="inline-flex items-center gap-1 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                            >
                              <BookOpen className="w-3 h-3 text-emerald-600" />
                              <span>View in Catalog</span>
                            </button>
                          </div>

                          <button
                            onClick={() => toggleSpecialStream(item.id)}
                            className="text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer flex items-center gap-1"
                          >
                            <span>Collapse</span>
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* The 4 Golden Rules & The Waste Hierarchy (Compact Tab Switcher) */}
        <section className="bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-0.5 rounded-full text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mastery Best Practices</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight">
                The 4 Golden Rules & Waste Hierarchy
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 font-normal">
                Prioritize avoidance and clean sorting before binning to safeguard recycling streams.
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center bg-stone-800/90 p-1 rounded-2xl border border-stone-700/80 shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setActiveRulesTab('golden_rules')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeRulesTab === 'golden_rules'
                    ? 'bg-emerald-500 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <span>🧼 4 Golden Rules</span>
              </button>
              <button
                onClick={() => setActiveRulesTab('hierarchy')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeRulesTab === 'hierarchy'
                    ? 'bg-emerald-500 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <span>🔺 Waste Hierarchy</span>
              </button>
            </div>
          </div>

          {/* Tab Content: 4 Golden Rules */}
          {activeRulesTab === 'golden_rules' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">🧼</span>
                <h4 className="font-extrabold text-sm text-white">1. Empty & Quick Rinse</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Food residues breed mold and spoil dry cardboard fibers. Swish a dash of leftover wash-up water to ensure containers are empty and clean.
                </p>
              </div>

              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">🧴</span>
                <h4 className="font-extrabold text-sm text-white">2. Caps Screwed ON</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Loose caps fall through industrial conveyor trommels into landfill. Always leave screw caps firmly attached to clean plastic bottles.
                </p>
              </div>

              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">📦</span>
                <h4 className="font-extrabold text-sm text-white">3. Keep Items 100% Loose</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Never bag blue or yellow bin items in plastic bags! Automated sorting machinery cannot rip open plastic bags; workers must divert tied bags straight to landfill.
                </p>
              </div>

              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">🚫</span>
                <h4 className="font-extrabold text-sm text-white">4. No Wishcycling</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Putting non-recyclables into recycling in the &ldquo;hope&rdquo; they will be recycled contaminates entire truckloads. When in doubt, look it up or bin it out.
                </p>
              </div>
            </div>
          ) : (
            /* Tab Content: 5 Tiers of Waste Hierarchy */
            <div className="space-y-2.5 animate-in fade-in duration-200">
              <div className="bg-emerald-900/60 border border-emerald-500/60 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-emerald-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center font-black text-xs">1</span>
                  <span>Refuse & Avoid</span>
                </span>
                <span className="text-xs text-emerald-300 font-medium hidden sm:inline">Say no to single-use plastics, excessive packaging, and disposable cutlery.</span>
              </div>

              <div className="bg-emerald-950/60 border border-emerald-600/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-emerald-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs">2</span>
                  <span>Reduce & Reuse</span>
                </span>
                <span className="text-xs text-emerald-300/80 font-medium hidden sm:inline">Choose refillable containers, repair electronics, and repurpose glass jars.</span>
              </div>

              <div className="bg-teal-950/60 border border-teal-600/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-teal-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-xs">3</span>
                  <span>Recycle & Compost</span>
                </span>
                <span className="text-xs text-teal-300/80 font-medium hidden sm:inline">Properly separate organic waste, clean paper, bottles, and metals into designated bins.</span>
              </div>

              <div className="bg-amber-950/50 border border-amber-600/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-amber-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-stone-950 flex items-center justify-center font-black text-xs">4</span>
                  <span>Energy Recovery</span>
                </span>
                <span className="text-xs text-amber-300/80 font-medium hidden sm:inline">Thermal Waste-to-Energy (WtE) electricity generation from residual unrecyclable mass.</span>
              </div>

              <div className="bg-stone-800/60 border border-stone-700/60 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-stone-300">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-stone-700 text-white flex items-center justify-center font-black text-xs">5</span>
                  <span>Landfill Disposal (Last Resort)</span>
                </span>
                <span className="text-xs text-stone-400 font-medium hidden sm:inline">Engineered sanitary containment of unavoidable non-recoverable residues.</span>
              </div>
            </div>
          )}
        </section>

      {/* Interactive FAQ & Household Setup Accordion */}
      <section className="glass-strong rounded-3xl p-6 sm:p-10 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg text-lg">❓</span>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Frequently Asked Waste Management Questions
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Real solutions to everyday waste sorting dilemmas faced by households.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 'faq-1',
              q: 'Should I crush my plastic drink bottles before putting them in the recycling bin?',
              a: 'Do NOT crush plastic bottles completely flat. Optical sorting machines at Materials Recovery Facilities (MRFs) rely on infrared light reflecting off the three-dimensional curve of the bottle to detect the plastic resin type (PET #1 or HDPE #2). Completely flat bottles are often misidentified as 2D paper sheets and routed to paper pulpers where they spoil fiber batches. Giving them a light squeeze is fine, but leave some 3D shape!'
            },
            {
              id: 'faq-2',
              q: 'Can I put broken drinking glasses or ceramics in the yellow recycling bin?',
              a: 'No! Drinking glasses, window glass, mirrors, Pyrex cookware, and ceramic coffee mugs have different chemical formulations and significantly higher melting temperatures than container glass (wine bottles and jam jars). If even a tiny shard of ceramic or drinking glass enters the furnace batch, it will not melt properly, creating structural defects and cracks in newly blown bottles.'
            },
            {
              id: 'faq-3',
              q: 'What should I do with shiny metallic chip packets and foil snack wrappers?',
              a: 'Most chip bags are made of multi-laminate composite materials (a thin layer of aluminum bonded to polypropylene plastic film). Because the layers cannot be easily separated mechanically, they cannot go into your yellow commingled recycling bin. Place them in your Red General Waste bin, or take them to participating supermarket soft-plastic collection drop-offs.'
            },
            {
              id: 'faq-4',
              q: 'Where do pizza boxes and styrofoam meat trays go?',
              a: 'A clean and unused pizza box (or clean torn-off lid) goes directly into the Blue Lid Bin (Cardboard & Paper) because it is 100% clean kraft corrugated cardboard. However, once a pizza box is greasy or cheese-stained, food grease cannot be washed out and spoils compost—so greasy pizza boxes strictly belong in the Red General Waste bin (never in the green FOGO bin!). Meanwhile, styrofoam meat trays ONLY go to General Waste (Red Lid Bin); expanded polystyrene crumbles into microplastics and is forbidden from yellow recycling, orange meat, and green organic bins.'
            },
            {
              id: 'faq-5',
              q: 'How should I set up my kitchen bins for effortless separation?',
              a: 'The most effective household setup is having a dual-compartment under-sink or pantry bin: one for Commingled Recycling and one for General Waste. Keep a small kitchen caddy right next to your sink for FOGO food scraps (empty daily or every two days). Keep a designated glass jar in a utility closet for taped dead batteries, and keep a reusable tote bag for soft plastics to bring to the grocery store.'
            }
          ].map((faq) => {
            const isOpen = expandedFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className="border border-stone-200/70 rounded-2xl overflow-hidden transition-all bg-white/50"
              >
                <button
                  onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                  className="w-full p-4 sm:p-5 text-left hover:bg-white/60 flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-stone-900 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-700">Q:</span>
                    <span>{faq.q}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-5 pb-5 pt-2 bg-white/40 text-xs sm:text-sm text-stone-700 leading-relaxed font-normal border-t border-stone-100"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 Interactive Games Hub */}
      <section ref={gamesRef} className="space-y-6 scroll-mt-24 sm:scroll-mt-28">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-lg">🎮</span>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              3 Interactive Games
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Choose an interactive mode to earn XP, unlock Eco-badges, and become a certified Waste Management Master!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bin Master Card */}
          <div className="glass glass-hover rounded-3xl p-6 hover:border-emerald-400/60 flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <span className="text-4xl p-3 bg-emerald-50 rounded-2xl inline-block border border-emerald-200/80">🎯</span>
              <h3 className="font-black text-lg text-stone-900 group-hover:text-emerald-700 transition-colors">
                Bin Master Game
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-normal">
                Rapidly sort random household items into the correct 6-lid bins. Build combos, earn streak multipliers, and conquer tricky traps!
              </p>
            </div>
            <button
              onClick={() => onNavigate('bin_master')}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Play Game</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Contamination Detective Card */}
          <div className="glass glass-hover rounded-3xl p-6 hover:border-amber-400/60 flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <span className="text-4xl p-3 bg-amber-50 rounded-2xl inline-block border border-amber-200/80">🕵️</span>
              <h3 className="font-black text-lg text-stone-900 group-hover:text-amber-700 transition-colors">
                Contamination Detective
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-normal">
                Spot the batch-spoiling contaminants hiding in each waste stream before they jam machinery or ruin a whole load.
              </p>
            </div>
            <button
              onClick={() => onNavigate('contamination_detective')}
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Play Game</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Trivia Card */}
          <div className="glass glass-hover rounded-3xl p-6 hover:border-indigo-400/60 flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <span className="text-4xl p-3 bg-indigo-50 rounded-2xl inline-block border border-indigo-200/80">🧠</span>
              <h3 className="font-black text-lg text-stone-900 group-hover:text-indigo-700 transition-colors">
                Recycle IQ Trivia
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-normal">
                Test your knowledge against common recycling myths and mistakes, with a real explanation behind every answer.
              </p>
            </div>
            <button
              onClick={() => onNavigate('trivia')}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Play Game</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
