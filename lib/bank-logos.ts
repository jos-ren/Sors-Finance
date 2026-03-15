const BANK_LOGO_PATTERNS: Array<{ path: string; bg: string; patterns: RegExp[] }> = [
  {
    path: "/logos/banks/amex.png",
    bg: "bg-blue-500/10",
    patterns: [/american express/i, /amex/i],
  },
  {
    path: "/logos/banks/atb.png",
    bg: "bg-blue-500/10",
    patterns: [/atb financial/i, /\batb\b/i, /alberta treasury/i],
  },
  {
    path: "/logos/banks/bmo.png",
    bg: "bg-red-500/10",
    patterns: [/bank of montreal/i, /\bbmo\b/i],
  },
  {
    path: "/logos/banks/cibc.png",
    bg: "bg-red-500/10",
    patterns: [/\bcibc\b/i, /canadian imperial/i, /imperial bank of commerce/i],
  },
  {
    path: "/logos/banks/desjardins.jpg",
    bg: "bg-green-500/10",
    patterns: [/desjardins/i],
  },
  {
    path: "/logos/banks/nationalbank.png",
    bg: "bg-red-500/10",
    patterns: [/national bank/i, /banque nationale/i],
  },
  {
    path: "/logos/banks/rbc.png",
    bg: "bg-blue-500/10",
    patterns: [/\brbc\b/i, /royal bank/i],
  },
  {
    path: "/logos/banks/scotiabank.svg",
    bg: "bg-red-500/10",
    patterns: [/scotiabank/i, /bank of nova scotia/i, /\bscotia\b/i],
  },
  {
    path: "/logos/banks/tangerine.png",
    bg: "bg-orange-500/10",
    patterns: [/tangerine/i],
  },
  {
    path: "/logos/banks/td.png",
    bg: "bg-green-500/10",
    patterns: [/\btd\b/i, /toronto[\s-]dominion/i, /td canada trust/i, /td bank/i],
  },
  {
    path: "/logos/banks/vancity.jpg",
    bg: "bg-red-500/10",
    patterns: [/vancity/i, /vancouver city savings/i],
  },
  {
    path: "/logos/banks/wealthsimple.svg",
    bg: "bg-slate-500/10",
    patterns: [/wealthsimple/i],
  },
];

export const BANK_LOGOS_DISPLAY: Array<{ name: string; path: string; bg: string }> = [
  { name: "American Express", path: "/logos/banks/amex.png", bg: "bg-blue-500/10" },
  { name: "ATB Financial", path: "/logos/banks/atb.png", bg: "bg-blue-500/10" },
  { name: "BMO", path: "/logos/banks/bmo.png", bg: "bg-red-500/10" },
  { name: "CIBC", path: "/logos/banks/cibc.png", bg: "bg-red-500/10" },
  { name: "Desjardins", path: "/logos/banks/desjardins.jpg", bg: "bg-green-500/10" },
  { name: "National Bank", path: "/logos/banks/nationalbank.png", bg: "bg-red-500/10" },
  { name: "RBC", path: "/logos/banks/rbc.png", bg: "bg-blue-500/10" },
  { name: "Scotiabank", path: "/logos/banks/scotiabank.svg", bg: "bg-red-500/10" },
  { name: "Tangerine", path: "/logos/banks/tangerine.png", bg: "bg-orange-500/10" },
  { name: "TD Bank", path: "/logos/banks/td.png", bg: "bg-green-500/10" },
  { name: "Vancity", path: "/logos/banks/vancity.jpg", bg: "bg-red-500/10" },
  { name: "Wealthsimple", path: "/logos/banks/wealthsimple.svg", bg: "bg-slate-500/10" },
];

export function getBankLogo(institutionName: string): { path: string; bg: string } | null {
  for (const entry of BANK_LOGO_PATTERNS) {
    if (entry.patterns.some((p) => p.test(institutionName))) {
      return { path: entry.path, bg: entry.bg };
    }
  }
  return null;
}

/**
 * Normalize a bank source name to its canonical display name.
 * e.g. "amex" → "American Express", "td" → "TD Bank"
 * Returns the original name if no match is found.
 */
export function normalizeBankName(source: string): string {
  for (let i = 0; i < BANK_LOGO_PATTERNS.length; i++) {
    if (BANK_LOGO_PATTERNS[i].patterns.some((p) => p.test(source))) {
      return BANK_LOGOS_DISPLAY[i].name;
    }
  }
  return source;
}
