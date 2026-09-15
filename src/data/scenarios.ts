import { ContaminationScenario } from '../types';

export const CONTAMINATION_SCENARIOS: ContaminationScenario[] = [
  {
    id: 'blue_bin_nightmare',
    title: 'Curbside Recyclables Inspector',
    binTarget: 'recycling',
    description: 'This municipal blue recycling bin contains 6 items. Some are great recyclables, but some are disastrous contaminants! Tap ONLY the items that should NOT be in this bin.',
    tips: 'Watch out for "tanglers", fire hazards, and food grease traps!',
    items: [
      {
        id: 'item_c1',
        name: 'Plastic Grocery Bag',
        emoji: '🛍️',
        isContaminant: true,
        explanation: 'Plastic bags are "tanglers" that wrap around mechanical sorting disc screens, halting MRF operations for hours!',
        consequence: 'Spins around mechanical axles; workers must stop the plant and cut them out with box cutters.'
      },
      {
        id: 'item_c2',
        name: 'Clean Aluminum Soda Can',
        emoji: '🥫',
        isContaminant: false,
        explanation: 'Perfect! Aluminum cans are 100% endlessly recyclable and belong in the blue bin.',
        consequence: 'Legitimate recyclable.'
      },
      {
        id: 'item_c3',
        name: 'Lithium AA Rechargeable Battery',
        emoji: '🔋',
        isContaminant: true,
        explanation: 'Critical fire hazard! When crushed by truck compactors or sorting screens, lithium batteries spark and cause explosive facility fires.',
        consequence: 'Leading cause of waste facility and garbage truck fires nationwide.'
      },
      {
        id: 'item_c4',
        name: 'Clear PET Water Bottle (Cap On)',
        emoji: '🧴',
        isContaminant: false,
        explanation: 'Great recyclable! Empty water bottles with caps on belong in the blue bin.',
        consequence: 'Legitimate recyclable.'
      },
      {
        id: 'item_c5',
        name: 'Paper Coffee Cup with Plastic Lining',
        emoji: '☕',
        isContaminant: true,
        explanation: 'Hot paper coffee cups have a polyethylene moisture liner that turns to gum in standard water-based paper pulpers.',
        consequence: 'Clogs paper recycling pulper screens.'
      },
      {
        id: 'item_c6',
        name: 'Clean Cardboard Shipping Box',
        emoji: '📦',
        isContaminant: false,
        explanation: 'Cardboard is high-value fiber! Flatten it and put it in recycling.',
        consequence: 'Legitimate recyclable.'
      }
    ]
  },
  {
    id: 'green_bin_organics',
    title: 'Compost Stream Quality Audit',
    binTarget: 'compost',
    description: 'A municipal organic green bin was dropped off at the industrial composting facility. Uncover the non-compostable culprits contaminating the soil amendment batch!',
    tips: 'Look out for non-biodegradable plastics and toxic materials masquerading as organics.',
    items: [
      {
        id: 'org_1',
        name: 'Apple Core with Plastic Brand Sticker',
        emoji: '🍎',
        isContaminant: true,
        explanation: 'Fruit scraps are great, but the tiny PLU sticker is vinyl plastic! It does not break down and creates visible microplastic flakes in the finished compost soil.',
        consequence: 'Contaminates organic farmer compost with non-degradable microplastics.'
      },
      {
        id: 'org_2',
        name: 'Used Coffee Grounds & Paper Filter',
        emoji: '☕',
        isContaminant: false,
        explanation: 'Rich in nitrogen and beneficial minerals; paper filters decompose within weeks.',
        consequence: 'Beneficial compost ingredient.'
      },
      {
        id: 'org_3',
        name: 'Standard Plastic Chip Bag',
        emoji: '🥔',
        isContaminant: true,
        explanation: 'Chip bags are made of multi-layer metallized polypropylene and plastic film. They will never decompose in compost.',
        consequence: 'Shreds into static plastic foil fragments.'
      },
      {
        id: 'org_4',
        name: 'Greasy Bottom of Pizza Box',
        emoji: '🍕',
        isContaminant: true,
        explanation: 'Greasy pizza boxes and pizza box bottoms do NOT belong in the green organic or FOGO bin. Food oils, cheese grease, and chemical adhesives disrupt composting processes. Greasy pizza boxes belong strictly in the Red General Waste bin.',
        consequence: 'Contaminates organic compost soil; pizza boxes strictly belong in the Red General Waste bin (never in the green bin).'
      },
      {
        id: 'org_5',
        name: 'Traditional Polystyrene Foam Tray',
        emoji: '🍱',
        isContaminant: true,
        explanation: 'Expanded polystyrene foam does not biodegrade. It crumbles into millions of microplastic spheres that poison soil ecosystems.',
        consequence: 'Severe soil contaminant.'
      },
      {
        id: 'org_6',
        name: 'Yard Grass Clippings & Leaves',
        emoji: '🍂',
        isContaminant: false,
        explanation: 'Ideal organic matter providing balanced nitrogen (green) and carbon (brown).',
        consequence: 'Foundational compost material.'
      }
    ]
  },
  {
    id: 'glass_stream_audit',
    title: 'Glass Recovery Purity Check',
    binTarget: 'recycling',
    description: 'Glass cullet furnaces operate at precise temperatures for soda-lime bottle glass. Find the ceramic and high-temp glass materials that crack and destroy furnace batches!',
    tips: 'Not all glass is created equal! Container glass vs tempered/pyroceramic glass have vastly different melting points.',
    items: [
      {
        id: 'gl_1',
        name: 'Glass Jam Jar (Rinsed)',
        emoji: '🫙',
        isContaminant: false,
        explanation: 'Container soda-lime glass is 100% recyclable into new jars indefinitely.',
        consequence: 'Legitimate container glass.'
      },
      {
        id: 'gl_2',
        name: 'Broken Ceramic Coffee Mug',
        emoji: '☕',
        isContaminant: true,
        explanation: 'Ceramics do NOT melt at container glass temperatures. Ceramic specks remain solid, creating structural defects and cracks in newly blown bottles.',
        consequence: 'Creates fatal weak points in newly formed bottles, causing them to shatter under bottling pressure.'
      },
      {
        id: 'gl_3',
        name: 'Green Wine Bottle',
        emoji: '🍾',
        isContaminant: false,
        explanation: 'Standard wine bottle glass is an essential source of recycled cullet.',
        consequence: 'Legitimate container glass.'
      },
      {
        id: 'gl_4',
        name: 'Broken Mirror Shards',
        emoji: '🪞',
        isContaminant: true,
        explanation: 'Mirrors have chemical reflective coatings (silvering) and tempered properties that ruin container glass furnaces.',
        consequence: 'Disrupts chemical composition of cullet batch.'
      },
      {
        id: 'gl_5',
        name: 'Pyrex / Heat-Resistant Ovenware',
        emoji: '🥘',
        isContaminant: true,
        explanation: 'Borosilicate glassware (Pyrex) is engineered specifically NOT to melt in high heat! In a recycling furnace, it stays solid and ruins the entire molten batch.',
        consequence: 'Forms solid un-melted lumps in glass batch.'
      },
      {
        id: 'gl_6',
        name: 'Amber Beer Bottle',
        emoji: '🍺',
        isContaminant: false,
        explanation: 'Amber glass melts cleanly and protects future bottled beverages from UV degradation.',
        consequence: 'Legitimate container glass.'
      }
    ]
  },
  {
    id: 'grey_bin_ewaste',
    title: 'Designated E-Waste Drop-Off Safety Inspection',
    binTarget: 'e_waste',
    description: 'An incoming batch of electronics and computer parts has arrived at the designated e-waste drop-off recovery facility. Detectives must locate dangerous fire traps, gas canisters, and non-electronic municipal debris before the shredder starts!',
    tips: "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. Putting it in regular household bins is a fire hazard and illegal in many areas.",
    items: [
      {
        id: 'ew_sc_1',
        name: 'Broken Smartphone with Battery',
        emoji: '📱',
        isContaminant: false,
        explanation: 'Smartphones are accepted for safe disassembly, cobalt/lithium reclamation, and gold contact smelting.',
        consequence: 'Legitimate e-waste component.'
      },
      {
        id: 'ew_sc_2',
        name: 'Frayed USB-C Power Cable',
        emoji: '🔌',
        isContaminant: false,
        explanation: 'Copper cables are mechanically granulated into pure copper pellets for wire re-extrusion.',
        consequence: 'Legitimate e-waste component.'
      },
      {
        id: 'ew_sc_3',
        name: 'Pressurized Butane Cigarette Lighter',
        emoji: '🔥',
        isContaminant: true,
        explanation: 'Pressurized butane containers detonate and ignite fires when struck by electronic shredder hammer mills!',
        consequence: 'Explosion and catastrophic fireball inside dry electronic shredder chamber.'
      },
      {
        id: 'ew_sc_4',
        name: 'Obsolete Computer Motherboard & RAM',
        emoji: '🖥️',
        isContaminant: false,
        explanation: 'Printed circuit boards contain recoverable copper, silver, gold, and tin.',
        consequence: 'Legitimate e-waste component.'
      },
      {
        id: 'ew_sc_5',
        name: 'Half-Eaten Greasy Hamburger',
        emoji: '🍔',
        isContaminant: true,
        explanation: 'Food waste produces biological mold and moisture that shorts sorting equipment and corrupts clean e-scrap.',
        consequence: 'Biological sludge fouling dry eddy current separators; belongs in green organic bin.'
      },
      {
        id: 'ew_sc_6',
        name: 'Ceramic Drinkware Shards',
        emoji: '☕',
        isContaminant: true,
        explanation: 'Hard ceramics blunt shredder cutting heads and cannot be refined in electronic metal smelters.',
        consequence: 'Dulls industrial copper chopper teeth; belongs in red general waste.'
      }
    ]
  },
  {
    id: 'white_bin_medical',
    title: 'White Lid Medical Waste & Sharps Audit',
    binTarget: 'medical_waste',
    description: 'Specialists are auditing an incoming container of residential medical waste. Verify that specialized autoclave biohazard sterilization is reserved strictly for hazardous clinical materials—and not everyday household recyclables!',
    tips: 'Clean cardboard boxes and aluminum cans belong in curbside bins, not high-energy medical autoclaves.',
    items: [
      {
        id: 'mw_sc_1',
        name: 'Disposable Insulin Needle (in Safety Guard)',
        emoji: '💉',
        isContaminant: false,
        explanation: 'Sharps and hypodermic needles pose dangerous bloodborne pathogen risks and must be sterilized in medical waste.',
        consequence: 'Legitimate medical biohazard material.'
      },
      {
        id: 'mw_sc_2',
        name: 'Empty Aluminum Soda Can',
        emoji: '🥤',
        isContaminant: true,
        explanation: 'Clean beverage cans are 100% recyclable commodities. Routing them to medical autoclaves wastes high-energy sterilization capacity.',
        consequence: 'Unnecessarily diverts clean recyclables from yellow bins into high-cost biohazard autoclaves.'
      },
      {
        id: 'mw_sc_3',
        name: 'Expired Antibiotic Capsules in Blister Pack',
        emoji: '💊',
        isContaminant: false,
        explanation: 'Potent pharmaceuticals must undergo specialized thermal destruction so active ingredients never seep into municipal aquifers.',
        consequence: 'Legitimate pharmaceutical waste.'
      },
      {
        id: 'mw_sc_4',
        name: 'Blood-Soiled Surgical Wound Gauze',
        emoji: '🩹',
        isContaminant: false,
        explanation: 'Biohazard dressings saturated with bodily fluids require high-temperature sterilization or medical incineration.',
        consequence: 'Legitimate biohazard material.'
      },
      {
        id: 'mw_sc_5',
        name: 'Clean Cardboard Pill Medicine Box',
        emoji: '📦',
        isContaminant: true,
        explanation: 'The outer retail paperboard packaging is clean and unsoiled. It should be flattened and placed in the blue paper & cardboard bin.',
        consequence: 'Wastes expensive biohazard processing volume on clean recyclable paperboard.'
      },
      {
        id: 'mw_sc_6',
        name: 'Standard AA Alkaline Battery',
        emoji: '🔋',
        isContaminant: true,
        explanation: 'Alkaline batteries rupture and release caustic potassium hydroxide under intense medical autoclave steam pressure.',
        consequence: 'Caustic rupture hazard inside clinical pressure chambers; belongs in designated e-waste drop-off locations (never household bins).'
      }
    ]
  },
  {
    id: 'blue_bin_paper_cardboard',
    title: 'Blue Lid Paper & Cardboard Hydrapulper Audit',
    binTarget: 'paper_cardboard',
    description: 'Technicians at the recycled paper mill are inspecting a batch of fiber before dumping it into the water hydrapulper vat. Spot the plastic adhesives and wax barriers that ruin recycled paper sheets.',
    tips: 'Wax-coated hot drink cups and plastic mailers do not break down in water baths.',
    items: [
      {
        id: 'pc_sc_1',
        name: 'Corrugated Shipping Box (Flattened)',
        emoji: '📦',
        isContaminant: false,
        explanation: 'Clean corrugated kraft fibers provide essential structural tensile strength for new shipping boxes.',
        consequence: 'Legitimate paper and cardboard stream.'
      },
      {
        id: 'pc_sc_2',
        name: 'Polyethylene-Lined Takeaway Coffee Cup',
        emoji: '☕',
        isContaminant: true,
        explanation: 'Coffee cups are lined with bonded plastic film that turns into sticky gum balls in the hydrapulper vat.',
        consequence: 'Gums up fine hydrapulper screen meshes; belongs in red general waste.'
      },
      {
        id: 'pc_sc_3',
        name: 'Clean Morning Newspaper & Paper Bags',
        emoji: '📰',
        isContaminant: false,
        explanation: 'Newsprint and kraft bags dissolve quickly and are remade into new newsprint or paper towels.',
        consequence: 'Legitimate paper stream.'
      },
      {
        id: 'pc_sc_4',
        name: 'Plastic Bubble-Wrap Padded Shipping Envelope',
        emoji: '✉️',
        isContaminant: true,
        explanation: 'Poly bubble mailers are composed of LDPE plastic that does not dissolve in water.',
        consequence: 'Plastic floats in hydrapulper vats and ruins paper web forming; belongs in red general waste.'
      },
      {
        id: 'pc_sc_5',
        name: 'Clean Cereal and Pasta Boxes',
        emoji: '🥣',
        isContaminant: false,
        explanation: 'Uncoated folding carton paperboard repulps smoothly into new packaging.',
        consequence: 'Legitimate paperboard stream.'
      },
      {
        id: 'pc_sc_6',
        name: 'Greasy Melted-Cheese Pizza Box Bottom',
        emoji: '🍕',
        isContaminant: true,
        explanation: 'Heavy food oils cannot be washed out with water and create transparent grease holes in new paper.',
        consequence: 'Oil destroys recycled pulp batches; belongs in the Red General Waste bin.'
      }
    ]
  },
  {
    id: 'orange_bin_meat_bones',
    title: 'Orange Lid Meat & Bones Bio-Rendering Audit',
    binTarget: 'meat_bones',
    description: 'An inspector is evaluating an incoming batch at an industrial thermal rendering facility. Meat trimmings, marrow bones, poultry carcasses, and seafood shells are welcome—but plastic butcher trays, absorbent cellulose pads, and metal barbecue skewers must be weeded out!',
    tips: 'Ensure all plastic butcher trays, plastic wrap, and soaker pads are removed. Plain bone and meat only!',
    items: [
      {
        id: 'mb_sc_1',
        name: 'Rotisserie Chicken Bones & Carcass',
        emoji: '🍗',
        isContaminant: false,
        explanation: 'Poultry carcasses and wing bones are rich in calcium and pasteurize safely in high-heat thermal digesters.',
        consequence: 'Legitimate meat & bones stream item.'
      },
      {
        id: 'mb_sc_2',
        name: 'Expanded Polystyrene Butcher Meat Tray',
        emoji: '🥩',
        isContaminant: true,
        explanation: 'Styrofoam and plastic butcher trays melt and contaminate organic bone-meal fertilizer with microplastics.',
        consequence: 'Plastic micro-debris pollutes organic fertilizer; belongs in red general waste.'
      },
      {
        id: 'mb_sc_3',
        name: 'Beef T-Bone & Lamb Chop Scraps',
        emoji: '🍖',
        isContaminant: false,
        explanation: 'Dense mammal bones are hammer-milled into high-grade phosphorus agricultural fertilizer after heat treatment.',
        consequence: 'Legitimate meat & bones stream item.'
      },
      {
        id: 'mb_sc_4',
        name: 'Blood-Soaked Absorbent Meat Pad',
        emoji: '🩸',
        isContaminant: true,
        explanation: 'Meat soaker pads contain synthetic non-woven polymer fibers and superabsorbent gels that do not decompose in biological digesters.',
        consequence: 'Synthetic polymers contaminate the rendering sludge; belongs in red general waste.'
      },
      {
        id: 'mb_sc_5',
        name: 'Fish Heads, Bones & Oyster Shells',
        emoji: '🐟',
        isContaminant: false,
        explanation: 'Fish remains and shellfish shells supply valuable calcium carbonate and minerals for soil amendment.',
        consequence: 'Legitimate meat & bones stream item.'
      },
      {
        id: 'mb_sc_6',
        name: 'Stainless Steel Barbecue Kebab Skewer',
        emoji: '🍢',
        isContaminant: true,
        explanation: 'Rigid metal skewers shatter commercial bio-grinder teeth and jam conveyor chutes.',
        consequence: 'Severe mechanical damage to industrial rendering shredders; belongs in metal scrap or red waste.'
      }
    ]
  },
  {
    id: 'hard_rubbish_collection',
    title: 'Council Hard Rubbish & Bulky Waste Safety Audit',
    binTarget: 'hard_rubbish',
    description: 'A municipal bulky waste collection truck has unloaded items at the resource recovery depot. Operators must separate recyclable steel, mattresses, and timber from dangerous contaminants like asbestos, chemicals, and daily food organics!',
    tips: 'Bulky furniture, mattresses, and scrap metal are accepted. Watch out for lethal asbestos sheets, liquid chemical hazard cans, and regular kitchen trash.',
    items: [
      {
        id: 'hr_sc_1',
        name: 'Broken Timber Dining Table & Chairs',
        emoji: '🪑',
        isContaminant: false,
        explanation: 'Clean timber furniture is shredded for industrial woodchip mulch and composite particle board manufacturing.',
        consequence: 'Legitimate bulky waste stream.'
      },
      {
        id: 'hr_sc_2',
        name: 'Weathered Fibro Cement Asbestos Sheet',
        emoji: '☣️',
        isContaminant: true,
        explanation: 'STRICTLY ILLEGAL AND DEADLY HAZARD! Asbestos fibers cause incurable mesothelioma and pulmonary asbestosis when handled or crushed by excavators. Must ONLY be handled by licensed hazardous asbestos abatement specialists.',
        consequence: 'Severe toxic airborne cancer hazard; entire sorting depot must be evacuated and shut down for decontamination.'
      },
      {
        id: 'hr_sc_3',
        name: 'Used Queen Pocket-Spring Mattress',
        emoji: '🛏️',
        isContaminant: false,
        explanation: 'Mattresses are mechanically deconstructed at circular facilities: steel springs are melted into 100% recycled steel, and foam is upcycled into carpet underlay.',
        consequence: 'Legitimate bulky waste stream.'
      },
      {
        id: 'hr_sc_4',
        name: 'Open Can of Liquid Oil-Based Enamel Paint',
        emoji: '🎨',
        isContaminant: true,
        explanation: 'Liquid chemical paints and solvent thinners spill across the recovery pad and contaminate clean salvageable timber and scrap metal. Belong in specialized Chemical CleanOut / Paintback programs.',
        consequence: 'Hazardous chemical spill and volatile flammable vapor risk.'
      },
      {
        id: 'hr_sc_5',
        name: 'De-energized Washing Machine & Metal Gutters',
        emoji: '🧺',
        isContaminant: false,
        explanation: 'Scrap whitegoods and metal gutters are sent to high-power hydraulic metal shredders for 100% steel and copper reclamation.',
        consequence: 'Legitimate bulky metal stream.'
      },
      {
        id: 'hr_sc_6',
        name: 'Bag of Rotting Kitchen Food Organics',
        emoji: '🥦',
        isContaminant: true,
        explanation: 'Daily kitchen food scraps and rotting organic food belong exclusively in the green FOGO wheelie bin, NOT on curbside hard rubbish piles.',
        consequence: 'Rotting putrescible waste creating biological odors and vector infestations on the metal sorting pad.'
      }
    ]
  },
  {
    id: 'red_bin_general_waste',
    title: 'Red Lid General Waste Landfill Safety Audit',
    binTarget: 'general_waste',
    description: 'An inspector is auditing incoming curbside red lid bins before compacting. While broken ceramics, greasy pizza boxes, chip packets, and composite packaging belong here, dangerous fire starters, loose medical sharps, and recyclable aluminum cans must be intercepted!',
    tips: 'Watch out for explosive lithium batteries, high-value clean aluminum cans, and unprotected hypodermic needles.',
    items: [
      {
        id: 'gw_sc_1',
        name: 'Greasy Melted-Cheese Pizza Box Bottom',
        emoji: '🍕',
        isContaminant: false,
        explanation: 'Heavy food oils, saturated grease, and melted dairy cannot be pulped into clean paper and cannot decompose cleanly in FOGO without attracting pests; it belongs in red general waste.',
        consequence: 'Legitimate general waste stream.'
      },
      {
        id: 'gw_sc_2',
        name: 'Lithium-Ion Rechargeable Battery Cell',
        emoji: '🔋',
        isContaminant: true,
        explanation: 'CRITICAL FIRE HAZARD! Lithium batteries ignite and explode under the massive pressure of landfill compaction trucks and transfer shredders.',
        consequence: 'Leading cause of garbage truck and waste depot fires; belongs strictly in designated e-waste drop-off locations.'
      },
      {
        id: 'gw_sc_3',
        name: 'Crushed Ceramic Dinner Plate Shards',
        emoji: '🍽️',
        isContaminant: false,
        explanation: 'Kiln-fired earthenware and vitreous porcelain do not melt in glass container furnaces; they belong in general waste.',
        consequence: 'Legitimate general waste stream.'
      },
      {
        id: 'gw_sc_4',
        name: 'Clean Empty Aluminum Beverage Cans',
        emoji: '🥫',
        isContaminant: true,
        explanation: 'Aluminum cans are infinitely recyclable (100% circular) with huge energy savings. Sending them to landfill wastes valuable non-renewable resources.',
        consequence: 'Diverts circular high-value metals to landfill; belongs in yellow commingled recycling.'
      },
      {
        id: 'gw_sc_5',
        name: 'Empty Foil Potato Chip Bag & Snack Wrapper',
        emoji: '🥔',
        isContaminant: false,
        explanation: 'Metallized polymer multi-layer packaging cannot be mechanically separated or composted, so it belongs in the red bin.',
        consequence: 'Legitimate general waste stream.'
      },
      {
        id: 'gw_sc_6',
        name: 'Unprotected Hypodermic Syringe Needle',
        emoji: '💉',
        isContaminant: true,
        explanation: 'Lethal puncture and bloodborne pathogen hazard! Loose needles pierce workers through protective gloves and footwear.',
        consequence: 'Severe needlestick biohazard for sanitation crews; belongs strictly in puncture-proof white medical waste sharps containers.'
      }
    ]
  }
];
