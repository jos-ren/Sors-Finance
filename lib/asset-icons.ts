import {
  // Home & Property
  Home, Building, Building2, Warehouse, Trees, Sprout, Waves, TreePine, Anchor,
  // Vehicles
  Car, Truck, Van, Bike, Sailboat, Plane, Caravan, Snowflake, Helicopter, Fish,
  // Kitchen & Appliances
  Refrigerator, Microwave, WashingMachine, Coffee, Flame, Wind, Blend, Soup,
  // Electronics & Tech
  Smartphone, Laptop, Monitor, Tablet, Tv, Gamepad2, Watch, Headphones,
  Speaker, Camera, Printer, Bot, HardDrive, Router, BookOpen,
  Keyboard, Mouse, Cpu, Server, Mic,
  // Furniture
  Sofa, BedDouble, UtensilsCrossed, Table, Armchair, Shirt, Sun,
  // Tools & Equipment
  Scissors, Drill, Axe, Droplets, Wrench, Zap, Shovel, MoveVertical,
  // Personal Valuables
  Gem, ShoppingBag, Glasses, Luggage, Palette, Crown,
  // Sports, Fitness & Hobbies
  Dumbbell, Flag, Mountain, Target, Music, Guitar,
  // Miscellaneous
  LockKeyhole, Stamp, PawPrint, Disc3,
  type LucideIcon,
  Box,
} from "lucide-react";

interface AssetIconEntry {
  patterns: RegExp[];
  icon: LucideIcon;
  bg: string;
  color: string;
}

// Order matters: more specific patterns must appear before broader ones that could false-match.
const ASSET_ICON_PATTERNS: AssetIconEntry[] = [

  // ── Electronics & Tech (before Home/Property to avoid "smart home" → Home) ─────
  { patterns: [/smart.?home/i, /\balexa\b/i, /google.?home/i, /echo.?dot/i, /smart.?hub/i], icon: Bot, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/e.?reader/i, /\bkindle\b/i, /\bkobo\b/i, /\bebook\b/i], icon: BookOpen, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/home.?theater/i, /surround.?sound/i, /soundbar/i, /\bspeaker\b/i, /stereo/i], icon: Speaker, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\brouter\b/i, /networking/i, /\bwifi\b/i, /\bnetwork\b/i, /\bmodem\b/i], icon: Router, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/hard.?drive/i, /\bssd\b/i, /\bhdd\b/i, /\bnas\b/i, /external.?drive/i], icon: HardDrive, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bcpu\b/i, /processor/i, /\bgpu\b/i, /graphics.?card/i], icon: Cpu, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bserver\b/i], icon: Server, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/camera/i, /\bdslr\b/i, /mirrorless/i, /gopro/i, /\blens\b/i, /lens.?kit/i], icon: Camera, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/headphone/i, /earphone/i, /airpod/i, /earbud/i], icon: Headphones, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bmic\b/i, /microphone/i], icon: Mic, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/smartwatch/i, /fitness.?tracker/i, /apple.?watch/i, /\bwatch\b/i, /\bwearable\b/i], icon: Watch, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/gaming.?console/i, /\bconsole\b/i, /playstation/i, /\bxbox\b/i, /nintendo/i], icon: Gamepad2, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/\btv\b/i, /television/i, /smart.?tv/i, /projector/i], icon: Tv, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\btablet\b/i, /\bipad\b/i], icon: Tablet, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/laptop/i, /\bnotebook\b/i, /macbook/i, /chromebook/i, /\bultrabook\b/i], icon: Laptop, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [
    /\bdesktop\b/i, /\bimac\b/i, /mac.?mini/i, /mac.?pro\b/i, /mac.?studio\b/i,
    /monitor/i, /\bscreen\b/i, /\bdisplay\b/i,
    /\bpc\b/i, /computer/i, /\bworkstation\b/i, /custom.?build/i,
  ], icon: Monitor, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bkeyboard\b/i, /\bmouse\b/i, /trackpad/i], icon: Keyboard, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\b3d.?printer\b/i, /\bbambulabs\b/i], icon: Box, bg: "bg-amber-500/10", color: "text-amber-600" },
  { patterns: [/printer/i], icon: Printer, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [
    /phone/i, /iphone/i, /\bmobile\b/i, /\bandroid\b/i, /\bpixel\b/i, /galaxy/i, /smartphone/i,
    // Phone-specific brands/models (unambiguous — not bare Samsung/LG/Sony/Apple)
    /\bxperia\b/i,   // Sony Xperia
    /\boneplus\b/i,  // OnePlus
    /\bnokia\b/i,    // Nokia
    /\bmotorola\b/i, // Motorola
  ], icon: Smartphone, bg: "bg-slate-500/10", color: "text-slate-500" },

  // ── Home & Property ───────────────────────────────────────────────────────────
  // Specific subtypes before generic "home"
  { patterns: [/vacation.?home/i, /holiday.?home/i, /\bcabin\b/i, /\bcottage\b/i, /\bchalet\b/i, /beach.?house/i], icon: TreePine, bg: "bg-emerald-500/10", color: "text-emerald-600" },
  { patterns: [/apartment/i, /\bcondo\b/i, /\bflat\b/i], icon: Building2, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/rental.?prop/i, /investment.?prop/i], icon: Building, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/\bgarage\b/i, /storage.?unit/i, /\bshed\b/i, /outbuilding/i, /\bwarehouse\b/i], icon: Warehouse, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bland\b/i, /\blot\b/i, /\bacreage\b/i, /\bplot\b/i, /\bparcel\b/i], icon: Trees, bg: "bg-green-500/10", color: "text-green-600" },
  // Raised garden patterns checked before generic \bgarden\b to avoid Sprout false-match
  { patterns: [/raised.?bed/i, /raised.?garden/i, /vegetable.?garden/i, /garden.?bed/i], icon: Shovel, bg: "bg-green-500/10", color: "text-green-600" },
  { patterns: [/greenhouse/i, /\bgarden\b/i, /\bplanter\b/i], icon: Sprout, bg: "bg-green-500/10", color: "text-green-600" },
  { patterns: [/swimming.?pool/i, /\bpool\b/i, /hot.?tub/i, /\bjacuzzi\b/i, /\bspa\b/i], icon: Waves, bg: "bg-cyan-500/10", color: "text-cyan-600" },
  { patterns: [/\bhouse\b/i, /\bhome\b/i, /property/i, /real.?estate/i, /primary.?resid/i], icon: Home, bg: "bg-amber-500/10", color: "text-amber-500" },

  // Generator & mower hoisted here so "Honda generator" / "Honda lawn mower" don't match car brands below
  { patterns: [/generator/i], icon: Zap, bg: "bg-yellow-500/10", color: "text-yellow-500" },
  { patterns: [/lawn.?mower/i, /\bmower\b/i], icon: Scissors, bg: "bg-slate-500/10", color: "text-slate-500" },

  // ── Vehicles ──────────────────────────────────────────────────────────────────
  { patterns: [/minivan/i, /\bvan\b/i], icon: Van, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [
    /\btruck\b/i, /\bsuv\b/i, /\bpickup\b/i,
    // Truck model names — before car brands so "Ford F-150" → Truck not Car
    /\bf.?1[5-9]0\b/i, /\bf.?2[0-9]0\b/i, /\bf.?3[0-9]0\b/i, // Ford F-series
    /silverado/i, /\bsierra\b/i,  // Chevy/GMC
    /\bram\s*\d/i,                // Ram 1500/2500/3500
    /\btundra\b/i, /\btacoma\b/i, // Toyota trucks
    /\bnavara\b/i, /\bhilux\b/i,  // Nissan/Toyota global trucks
  ], icon: Truck, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\brv\b/i, /\bcamper\b/i, /motorhome/i, /recreational.?vehicle/i], icon: Caravan, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/jet.?ski/i, /watercraft/i, /\bpwc\b/i], icon: Waves, bg: "bg-cyan-500/10", color: "text-cyan-600" },
  { patterns: [/boat/i, /\byacht\b/i, /sailboat/i, /\bkayak\b/i, /\bcanoe\b/i, /\bdinghy\b/i, /\bpontoon\b/i], icon: Sailboat, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/\bdock\b/i, /mooring/i, /\bmarina\b/i, /\banchor\b/i], icon: Anchor, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/snowmobile/i, /\bsnowcat\b/i], icon: Snowflake, bg: "bg-sky-500/10", color: "text-sky-500" },
  { patterns: [/motorcycle/i, /motorbike/i, /\batv\b/i, /all.terrain/i, /quad.?bike/i, /e.?bike/i, /e.?scooter/i, /\bscooter\b/i, /\bbicycle\b/i, /\bbike\b/i], icon: Bike, bg: "bg-green-500/10", color: "text-green-500" },
  { patterns: [/helicopter/i, /\bchopper\b/i], icon: Helicopter, bg: "bg-sky-500/10", color: "text-sky-500" },
  { patterns: [/\bplane\b/i, /aircraft/i, /private.?jet/i, /\bjet\b/i, /\bdrone\b/i, /\buav\b/i, /quadcopter/i], icon: Plane, bg: "bg-sky-500/10", color: "text-sky-500" },
  // Car brands — after truck models so "Ford F-150" still hits Truck first
  { patterns: [
    // Japanese
    /\btoyota\b/i, /\bhonda\b/i, /\bnissan\b/i, /\bhyundai\b/i, /\bkia\b/i,
    /\bsubaru\b/i, /\bmazda\b/i, /\bmitsubishi\b/i,
    /\blexus\b/i, /\bacura\b/i, /\binfiniti\b/i,
    // German
    /\bbmw\b/i, /\baudi\b/i, /\bvolkswagen\b/i, /\bvw\b/i, /\bporsche\b/i, /\bmercedes\b/i,
    // Swedish / British / European
    /\bvolvo\b/i, /\bjaguar\b/i, /\bland.?rover\b/i, /\brange.?rover\b/i,
    /\bbentley\b/i, /\brolls.?royce\b/i, /\baston.?martin\b/i,
    /\bfiat\b/i, /\balfa.?romeo\b/i, /\bpeugeot\b/i, /\brenault\b/i, /\bcitro[eë]n\b/i, /\bskoda\b/i,
    // Italian / Supercar
    /\bferrari\b/i, /\blamborghini\b/i, /\bmaserati\b/i, /\bbugatti\b/i,
    // American
    /\bchevrolet\b/i, /\bchevy\b/i, /\bgmc\b/i, /\bcadillac\b/i, /\bbuick\b/i,
    /\blincoln\b/i, /\bdodge\b/i, /\bchrysler\b/i,
  ], icon: Car, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/\btrailer\b/i, /\bcar\b/i, /\bvehicle\b/i, /\bauto\b/i, /\btesla\b/i, /\bsedan\b/i, /\bjeep\b/i, /\bcoupe\b/i, /hatchback/i], icon: Car, bg: "bg-blue-500/10", color: "text-blue-500" },

  // ── Kitchen & Appliances ──────────────────────────────────────────────────────
  { patterns: [/refrigerator/i, /\bfridge\b/i], icon: Refrigerator, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/microwave/i], icon: Microwave, bg: "bg-slate-500/10", color: "text-slate-500" },
  // Pressure washer before \bwasher\b to avoid false-match
  { patterns: [/pressure.?washer/i, /power.?washer/i], icon: Droplets, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/dishwasher/i, /washing.?machine/i, /\bwasher\b/i, /\blaundry\b/i], icon: WashingMachine, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/\bdryer\b/i, /air.?fryer/i, /leaf.?blower/i, /shop.?vac/i, /\bvacuum\b/i], icon: Wind, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bfreezer\b/i], icon: Snowflake, bg: "bg-sky-500/10", color: "text-sky-500" },
  // Bare "coffee" excluded for "coffee table" — that's caught in furniture as Table
  { patterns: [/coffee.?maker/i, /coffee.?machine/i, /coffee.?grinder/i, /coffee.?press/i, /espresso/i, /\bnespresso\b/i, /\bkeurig\b/i, /\bcoffee(?! table)\b/i], icon: Coffee, bg: "bg-amber-500/10", color: "text-amber-600" },
  { patterns: [/instant.?pot/i, /slow.?cooker/i, /crock.?pot/i], icon: Soup, bg: "bg-orange-500/10", color: "text-orange-500" },
  { patterns: [/stand.?mixer/i, /\bblender\b/i, /\bmixer\b/i, /kitchenaid/i], icon: Blend, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\boven\b/i, /\bstove\b/i, /\brange\b/i, /cooktop/i, /\btoaster\b/i, /\bgrill\b/i, /\bbbq\b/i, /barbecue/i, /barbeque/i, /fire.?pit/i, /fireplace/i, /patio.?heater/i, /chiminea/i], icon: Flame, bg: "bg-orange-500/10", color: "text-orange-500" },

  // ── Furniture (coffee table before \bcoffee\b appliance) ──────────────────────
  { patterns: [/\bsofa\b/i, /\bcouch\b/i], icon: Sofa, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/bed.?frame/i, /\bmattress\b/i, /\bbedroom\b/i, /\bbed\b/i], icon: BedDouble, bg: "bg-indigo-500/10", color: "text-indigo-500" },
  { patterns: [/dining.?table/i, /dining.?set/i, /dinner.?table/i], icon: UtensilsCrossed, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/coffee.?table/i, /end.?table/i, /side.?table/i, /\bdesk\b/i, /\btable\b/i], icon: Table, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/\bdresser\b/i, /\bwardrobe\b/i, /\bcloset\b/i, /\barmoire\b/i], icon: Shirt, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/bookshelf/i, /bookcase/i], icon: BookOpen, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/recliner/i, /armchair/i, /lounge.?chair/i, /office.?chair/i], icon: Armchair, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/patio.?furniture/i, /outdoor.?furniture/i, /garden.?furniture/i], icon: Sun, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/\bfurniture\b/i], icon: Sofa, bg: "bg-amber-500/10", color: "text-amber-500" },

  // ── Tools & Equipment ─────────────────────────────────────────────────────────
  { patterns: [/\bdrill\b/i, /power.?drill/i], icon: Drill, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/chainsaw/i, /circular.?saw/i, /table.?saw/i, /\baxe\b/i], icon: Axe, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/trampoline/i, /bounce/i], icon: Zap, bg: "bg-yellow-500/10", color: "text-yellow-500" },
  { patterns: [/sewing.?machine/i, /\bserger\b/i], icon: Scissors, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bshovel\b/i, /\bspade\b/i, /garden.?tool/i, /\bpruner\b/i], icon: Shovel, bg: "bg-green-500/10", color: "text-green-600" },
  { patterns: [/\bladder\b/i], icon: MoveVertical, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/tool.?set/i, /toolbox/i, /tool.?kit/i, /\bwrench\b/i, /\bhammer\b/i, /\bsaw\b/i, /\btool\b/i], icon: Wrench, bg: "bg-amber-500/10", color: "text-amber-500" },

  // ── Personal Valuables ────────────────────────────────────────────────────────
  { patterns: [/vinyl.?record/i, /\bvinyl\b/i, /\brecord\b.*collect/i], icon: Disc3, bg: "bg-purple-500/10", color: "text-purple-500" },
  { patterns: [/sports.?card/i, /\bcomics?\b/i, /collectible/i, /\bcollection\b/i, /antique/i, /heirloom/i], icon: Stamp, bg: "bg-amber-500/10", color: "text-amber-500" },
  { patterns: [/handbag/i, /designer/i, /\bpurse\b/i, /\bbag\b/i], icon: ShoppingBag, bg: "bg-rose-500/10", color: "text-rose-500" },
  { patterns: [/sunglasses/i, /eyewear/i, /\bglasses\b/i], icon: Glasses, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bluggage\b/i, /\bsuitcase\b/i, /\bbaggage\b/i], icon: Luggage, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/\bcoat\b/i, /\bjacket\b/i, /\bfur\b/i, /leather.?coat/i, /\bclothing\b/i, /\bapparel\b/i], icon: Shirt, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/fine.?china/i, /silverware/i, /dinnerware/i, /cutlery/i], icon: UtensilsCrossed, bg: "bg-slate-500/10", color: "text-slate-500" },
  { patterns: [/wedding.?ring/i, /engagement.?ring/i, /jewel/i, /jewellery/i, /necklace/i, /bracelet/i, /earring/i, /\bring\b/i, /\bgem\b/i, /diamond/i], icon: Gem, bg: "bg-rose-500/10", color: "text-rose-500" },
  { patterns: [/artwork/i, /painting/i, /\bart\b/i, /sculpture/i, /\bcanvas\b/i], icon: Palette, bg: "bg-rose-500/10", color: "text-rose-500" },
  { patterns: [/\bsafe\b/i, /lockbox/i, /lock.?box/i], icon: LockKeyhole, bg: "bg-slate-500/10", color: "text-slate-500" },

  // ── Sports, Fitness & Hobbies ─────────────────────────────────────────────────
  { patterns: [/fishing/i, /\brod\b/i, /\bfish\b/i, /angling/i, /\btackle\b/i, /\blure\b/i], icon: Fish, bg: "bg-blue-500/10", color: "text-blue-500" },
  { patterns: [/\bgolf\b/i, /golf.?club/i, /golf.?bag/i], icon: Flag, bg: "bg-green-500/10", color: "text-green-600" },
  { patterns: [/surfboard/i, /wakeboard/i, /paddleboard/i, /kiteboard/i], icon: Waves, bg: "bg-cyan-500/10", color: "text-cyan-600" },
  { patterns: [/\bski\b/i, /\bskis\b/i, /snowboard/i, /ski.?equipment/i], icon: Mountain, bg: "bg-sky-500/10", color: "text-sky-500" },
  { patterns: [/tennis/i, /pickleball/i, /badminton/i, /\bsquash\b/i, /racket/i], icon: Target, bg: "bg-green-500/10", color: "text-green-500" },
  { patterns: [/treadmill/i, /exercise.?bike/i, /elliptical/i, /rowing.?machine/i, /dumbbell/i, /free.?weight/i, /barbell/i, /weight.?set/i, /\bgym\b/i, /fitness/i], icon: Dumbbell, bg: "bg-green-500/10", color: "text-green-500" },
  { patterns: [/\bguitar\b/i, /\bpiano\b/i, /\bviolin\b/i, /\bdrums?\b/i, /\bsynth\b/i, /\bbass\b/i, /instrument/i], icon: Guitar, bg: "bg-purple-500/10", color: "text-purple-500" },

  // ── Books & Media ─────────────────────────────────────────────────────────────
  { patterns: [/\bbook\b/i, /library/i], icon: BookOpen, bg: "bg-amber-500/10", color: "text-amber-500" },

  // ── Pets ──────────────────────────────────────────────────────────────────────
  { patterns: [/\bdog\b/i, /\bcat\b/i, /\bhorse\b/i, /\bpet\b/i, /\bpuppy\b/i, /\bkitten\b/i], icon: PawPrint, bg: "bg-amber-500/10", color: "text-amber-600" },
];

export function getAssetIcon(name: string): { icon: LucideIcon; bg: string; color: string } | null {
  for (const entry of ASSET_ICON_PATTERNS) {
    if (entry.patterns.some((p) => p.test(name))) {
      return { icon: entry.icon, bg: entry.bg, color: entry.color };
    }
  }
  return null;
}
