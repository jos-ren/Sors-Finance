import {
  Car,
  Home,
  Building,
  Landmark,
  Gem,
  Watch,
  Crown,
  Palette,
  Wine,
  Coins,
  CircleDollarSign,
  Bitcoin,
  TrendingUp,
  BarChart3,
  PiggyBank,
  Wallet,
  CreditCard,
  Receipt,
  Banknote,
  DollarSign,
  HandCoins,
  ShieldCheck,
  HeartPulse,
  GraduationCap,
  Baby,
  Plane,
  Ship,
  Bike,
  Briefcase,
  Store,
  ShoppingBag,
  Smartphone,
  Laptop,
  Monitor,
  HardDrive,
  Camera,
  Gamepad2,
  Music,
  Trophy,
  Dumbbell,
  Trees,
  Mountain,
  Tractor,
  Warehouse,
  Package,
  Hammer,
  Wrench,
  Zap,
  Flame,
  Droplets,
  Sun,
  Dog,
  Cat,
  Glasses,
  BookOpen,
  Cpu,
  type LucideIcon,
} from "lucide-react";

interface AccountIconMatch {
  icon: LucideIcon;
  bg: string;
  color: string;
  patterns: RegExp[];
}

const ACCOUNT_ICON_PATTERNS: AccountIconMatch[] = [
  // ── Vehicles ──
  {
    icon: Car,
    bg: "bg-slate-500/10",
    color: "text-slate-500",
    patterns: [/\bcar\b/i, /\bcars\b/i, /\bvehicle/i, /\bauto\b/i, /\btruck/i, /\bsuv\b/i, /\bjeep\b/i, /\btesla\b/i, /\bleasing/i],
  },
  {
    icon: Bike,
    bg: "bg-lime-500/10",
    color: "text-lime-500",
    patterns: [/\bbike/i, /\bbicycle/i, /\bmotorcycle/i, /\bscooter/i, /\be-bike/i],
  },
  {
    icon: Ship,
    bg: "bg-cyan-500/10",
    color: "text-cyan-500",
    patterns: [/\bboat/i, /\byacht/i, /\bship/i, /\bjet ski/i, /\bmarine/i],
  },
  {
    icon: Plane,
    bg: "bg-sky-500/10",
    color: "text-sky-500",
    patterns: [/\bplane/i, /\baircraft/i, /\baviation/i, /\bflight/i],
  },

  // ── Real estate & property ──
  {
    icon: Home,
    bg: "bg-amber-500/10",
    color: "text-amber-500",
    patterns: [/\bhome\b/i, /\bhouse/i, /\bcondo/i, /\bapartment/i, /\bmortgage/i, /\bresidence/i, /\btownhouse/i, /\bduplex/i, /\bprimary residence/i],
  },
  {
    icon: Building,
    bg: "bg-orange-500/10",
    color: "text-orange-500",
    patterns: [/\bproperty/i, /\bproperties/i, /\breal estate/i, /\brental/i, /\bland\b/i, /\bcommercial/i, /\btenant/i],
  },
  {
    icon: Warehouse,
    bg: "bg-stone-500/10",
    color: "text-stone-500",
    patterns: [/\bwarehouse/i, /\bstorage/i, /\bgarage/i, /\bparking/i, /\blocker/i],
  },
  {
    icon: Tractor,
    bg: "bg-green-700/10",
    color: "text-green-700",
    patterns: [/\bfarm/i, /\bagricult/i, /\branch/i, /\bcrop/i, /\bacreage/i, /\btimberland/i],
  },

  // ── Precious metals & commodities ──
  {
    icon: Coins,
    bg: "bg-yellow-500/10",
    color: "text-yellow-500",
    patterns: [/\bgold\b/i, /\bsilver\b/i, /\bplatinum\b/i, /\bpalladium\b/i, /\bmetal/i, /\bbullion/i, /\bbar\b/i, /\bingot/i],
  },
  {
    icon: Gem,
    bg: "bg-purple-500/10",
    color: "text-purple-500",
    patterns: [/\bgem/i, /\bdiamond/i, /\bjewel/i, /\bruby/i, /\bsapphire/i, /\bemerald\b/i],
  },

  // ── Luxury & collectibles ──
  {
    icon: Watch,
    bg: "bg-zinc-500/10",
    color: "text-zinc-500",
    patterns: [/\bwatch/i, /\brolex/i, /\bomega/i, /\bpatek/i, /\baudemars/i, /\btimepiece/i],
  },
  {
    icon: Crown,
    bg: "bg-amber-600/10",
    color: "text-amber-600",
    patterns: [/\bluxury/i, /\bdesigner/i, /\bhandbag/i, /\bhermes/i, /\blouis vuitton/i, /\bchanel\b/i],
  },
  {
    icon: Palette,
    bg: "bg-rose-500/10",
    color: "text-rose-500",
    patterns: [/\bart\b/i, /\bpainting/i, /\bsculpture/i, /\bantique/i, /\bcollect/i, /\bnft\b/i],
  },
  {
    icon: Wine,
    bg: "bg-red-800/10",
    color: "text-red-800",
    patterns: [/\bwine/i, /\bwhiskey/i, /\bwhisky/i, /\bspirits/i, /\bcellar/i, /\bvineyard/i],
  },
  {
    icon: Music,
    bg: "bg-violet-500/10",
    color: "text-violet-500",
    patterns: [/\bmusic/i, /\binstrument/i, /\bguitar/i, /\bpiano/i, /\bviolin/i, /\bvinyl\b/i, /\brecord/i],
  },
  {
    icon: Trophy,
    bg: "bg-yellow-600/10",
    color: "text-yellow-600",
    patterns: [/\btrophy/i, /\bmemorabil/i, /\bsports card/i, /\btrading card/i, /\bpokemon/i],
  },

  // ── Crypto & digital ──
  {
    icon: Bitcoin,
    bg: "bg-orange-500/10",
    color: "text-orange-500",
    patterns: [/\bcrypto/i, /\bbitcoin/i, /\bbtc\b/i, /\bethereum/i, /\beth\b/i, /\bdefi\b/i, /\bweb3/i, /\bblockchain/i, /\btoken/i, /\bcoinbase/i, /\bbinance/i, /\bkraken/i, /\bmetamask/i],
  },

  // ── Investments & markets ──
  {
    icon: TrendingUp,
    bg: "bg-blue-500/10",
    color: "text-blue-500",
    patterns: [/\bstock/i, /\bequit/i, /\bshares\b/i, /\bportfolio/i, /\bindex\b/i, /\betf\b/i, /\bmutual fund/i],
  },
  {
    icon: BarChart3,
    bg: "bg-indigo-500/10",
    color: "text-indigo-500",
    patterns: [/\bbond/i, /\bfixed income/i, /\btreasur/i, /\bgic\b/i, /\bterm deposit/i, /\bcertificate of deposit/i, /\bcd\b/i],
  },
  {
    icon: Briefcase,
    bg: "bg-slate-600/10",
    color: "text-slate-600",
    patterns: [/\bbrokerage/i, /\btrading/i, /\bfidelity/i, /\bvanguard/i, /\bschwab/i, /\binteractive broker/i, /\bquestrade/i, /\brobinhood/i],
  },
  {
    icon: Landmark,
    bg: "bg-blue-700/10",
    color: "text-blue-700",
    patterns: [/\b401k/i, /\brrsp/i, /\btfsa/i, /\bira\b/i, /\broth\b/i, /\bpension/i, /\bretirement/i, /\bresp\b/i, /\bfhsa\b/i],
  },

  // ── Savings & banking ──
  {
    icon: PiggyBank,
    bg: "bg-emerald-500/10",
    color: "text-emerald-500",
    patterns: [/\bsaving/i, /\brainy day/i, /\bemergency fund/i, /\bsinking fund/i],
  },
  {
    icon: Wallet,
    bg: "bg-teal-500/10",
    color: "text-teal-500",
    patterns: [/\bwallet/i, /\bcash\b/i, /\bchequ/i, /\bcheck/i, /\bdebit/i, /\bspending/i],
  },
  {
    icon: CircleDollarSign,
    bg: "bg-green-500/10",
    color: "text-green-500",
    patterns: [/\bhysa\b/i, /\bhigh.?interest/i, /\bmoney market/i, /\beq bank/i, /\bneo financial/i],
  },

  // ── Debt & credit ──
  {
    icon: CreditCard,
    bg: "bg-red-500/10",
    color: "text-red-500",
    patterns: [/\bcredit card/i, /\bvisa\b/i, /\bmastercard/i, /\bcc\b/i],
  },
  {
    icon: Receipt,
    bg: "bg-red-400/10",
    color: "text-red-400",
    patterns: [/\bloan\b/i, /\bline of credit/i, /\bloc\b/i, /\bheloc\b/i, /\bfinancing/i, /\binstallment/i],
  },
  {
    icon: GraduationCap,
    bg: "bg-indigo-500/10",
    color: "text-indigo-500",
    patterns: [/\bstudent/i, /\btuition/i, /\beducation/i, /\bschool/i, /\buniversity/i, /\bcollege/i, /\bscholarship/i],
  },
  {
    icon: Banknote,
    bg: "bg-red-600/10",
    color: "text-red-600",
    patterns: [/\bdebt\b/i, /\bowed\b/i, /\bpayable/i, /\bborrow/i],
  },

  // ── Insurance & protection ──
  {
    icon: ShieldCheck,
    bg: "bg-sky-600/10",
    color: "text-sky-600",
    patterns: [/\binsurance/i, /\bpolicy/i, /\blife insurance/i, /\bterm life/i, /\bwhole life/i, /\bannuity/i],
  },
  {
    icon: HeartPulse,
    bg: "bg-pink-500/10",
    color: "text-pink-500",
    patterns: [/\bhealth/i, /\bmedical/i, /\bhsa\b/i, /\bdental/i, /\bwellness/i],
  },

  // ── Life goals & funds ──
  {
    icon: Baby,
    bg: "bg-pink-400/10",
    color: "text-pink-400",
    patterns: [/\bbaby/i, /\bchild/i, /\bkid/i, /\bnewborn/i, /\bmaternity/i, /\b529\b/i],
  },
  {
    icon: Plane,
    bg: "bg-sky-500/10",
    color: "text-sky-500",
    patterns: [/\btravel/i, /\bvacation/i, /\bholiday/i, /\btrip\b/i],
  },
  {
    icon: DollarSign,
    bg: "bg-green-600/10",
    color: "text-green-600",
    patterns: [/\bside hustle/i, /\bfreelance/i, /\bincome/i, /\brevenue/i, /\bbusiness/i, /\bself.?employ/i],
  },
  {
    icon: HandCoins,
    bg: "bg-amber-500/10",
    color: "text-amber-500",
    patterns: [/\bdonat/i, /\bcharity/i, /\btithe/i, /\bgiving/i, /\bphilanthrop/i],
  },

  // ── Business & commerce ──
  {
    icon: Store,
    bg: "bg-violet-500/10",
    color: "text-violet-500",
    patterns: [/\bstore\b/i, /\bshop\b/i, /\bretail/i, /\be-?commerce/i, /\bshopify/i, /\betsy/i, /\bamazon\b/i],
  },
  {
    icon: ShoppingBag,
    bg: "bg-fuchsia-500/10",
    color: "text-fuchsia-500",
    patterns: [/\bshopping/i, /\bpurchase/i, /\bmerchandise/i],
  },

  // ── Tech & electronics ──
  {
    icon: Smartphone,
    bg: "bg-gray-500/10",
    color: "text-gray-500",
    patterns: [/\bphone/i, /\biphone/i, /\bandroid/i, /\bapple\b/i, /\bsamsung/i, /\bmobile/i],
  },
  {
    icon: Laptop,
    bg: "bg-gray-600/10",
    color: "text-gray-600",
    patterns: [/\blaptop/i, /\bcomputer/i, /\bmacbook/i, /\bpc\b/i, /\bdesktop\b/i],
  },
  {
    icon: Monitor,
    bg: "bg-blue-400/10",
    color: "text-blue-400",
    patterns: [/\bmonitor/i, /\bscreen/i, /\btv\b/i, /\btelevision/i, /\bdisplay/i],
  },
  {
    icon: HardDrive,
    bg: "bg-neutral-500/10",
    color: "text-neutral-500",
    patterns: [/\bhardware/i, /\bserver/i, /\bequipment/i, /\bmining rig/i],
  },
  {
    icon: Camera,
    bg: "bg-rose-400/10",
    color: "text-rose-400",
    patterns: [/\bcamera/i, /\bphoto/i, /\blens/i, /\bdrone/i, /\bvideo/i],
  },
  {
    icon: Gamepad2,
    bg: "bg-purple-400/10",
    color: "text-purple-400",
    patterns: [/\bgaming/i, /\bgame\b/i, /\bconsole/i, /\bplaystation/i, /\bxbox/i, /\bnintendo/i, /\bsteam\b/i],
  },
  {
    icon: Cpu,
    bg: "bg-slate-400/10",
    color: "text-slate-400",
    patterns: [/\belectronic/i, /\btech\b/i, /\bgadget/i, /\bdevice/i, /\btablet/i, /\bipad/i, /\bwearable/i, /\bsmart\s?watch/i, /\bheadphone/i, /\bspeaker/i, /\baudio/i, /\brouter/i, /\bcharger/i, /\baccessor/i],
  },

  // ── Outdoor & lifestyle ──
  {
    icon: Dumbbell,
    bg: "bg-orange-600/10",
    color: "text-orange-600",
    patterns: [/\bgym/i, /\bfitness/i, /\bexercise/i, /\bsport/i, /\bequipment/i],
  },
  {
    icon: Trees,
    bg: "bg-green-600/10",
    color: "text-green-600",
    patterns: [/\bgarden/i, /\blandscap/i, /\boutdoor/i, /\bpatio/i, /\bpool\b/i, /\bhot tub/i],
  },
  {
    icon: Mountain,
    bg: "bg-emerald-700/10",
    color: "text-emerald-700",
    patterns: [/\bcabin/i, /\bcottage/i, /\bchalet/i, /\blake house/i, /\bvacation home/i, /\bski\b/i],
  },

  // ── Pets ──
  {
    icon: Dog,
    bg: "bg-amber-400/10",
    color: "text-amber-400",
    patterns: [/\bdog\b/i, /\bpuppy/i, /\bpet\b/i, /\bpets\b/i, /\bvet\b/i, /\banimal/i],
  },
  {
    icon: Cat,
    bg: "bg-orange-400/10",
    color: "text-orange-400",
    patterns: [/\bcat\b/i, /\bkitten/i],
  },

  // ── Utilities & home ──
  {
    icon: Zap,
    bg: "bg-yellow-400/10",
    color: "text-yellow-400",
    patterns: [/\belectric/i, /\butility/i, /\butilities/i, /\bhydro\b/i, /\bpower\b/i, /\benergy/i, /\bsolar/i],
  },
  {
    icon: Flame,
    bg: "bg-red-500/10",
    color: "text-red-500",
    patterns: [/\bgas\b/i, /\bheating/i, /\bfurnace/i, /\bpropane/i],
  },
  {
    icon: Droplets,
    bg: "bg-blue-400/10",
    color: "text-blue-400",
    patterns: [/\bwater\b/i, /\bsewer/i, /\bplumb/i],
  },
  {
    icon: Sun,
    bg: "bg-yellow-500/10",
    color: "text-yellow-500",
    patterns: [/\bsolar panel/i, /\brenewable/i],
  },
  {
    icon: Hammer,
    bg: "bg-stone-600/10",
    color: "text-stone-600",
    patterns: [/\breno/i, /\bremodel/i, /\bconstruction/i, /\brepair/i, /\bmaintenance/i, /\bimprovement/i],
  },
  {
    icon: Wrench,
    bg: "bg-zinc-600/10",
    color: "text-zinc-600",
    patterns: [/\btool/i, /\bworkshop/i, /\bhardware store/i],
  },
  {
    icon: Package,
    bg: "bg-neutral-500/10",
    color: "text-neutral-500",
    patterns: [/\bsubscription/i, /\bmembership/i, /\bmonthly\b/i],
  },

  // ── Misc ──
  {
    icon: Glasses,
    bg: "bg-slate-500/10",
    color: "text-slate-500",
    patterns: [/\boptical/i, /\bglasses/i, /\beye\b/i, /\bvision/i, /\blasik/i],
  },
  {
    icon: BookOpen,
    bg: "bg-teal-600/10",
    color: "text-teal-600",
    patterns: [/\bbook/i, /\blibrary/i, /\breading/i, /\bcourse/i, /\blearning/i, /\btraining/i],
  },
];

export function getAccountIcon(
  accountName: string
): { icon: LucideIcon; bg: string; color: string } | null {
  for (const entry of ACCOUNT_ICON_PATTERNS) {
    if (entry.patterns.some((p) => p.test(accountName))) {
      return { icon: entry.icon, bg: entry.bg, color: entry.color };
    }
  }
  return null;
}
