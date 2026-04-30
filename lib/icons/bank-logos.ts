interface BankEntry {
  domain: string;
  bg: string;
  country: "CA" | "US" | "INTL" | "CRYPTO";
  patterns: RegExp[];
}

const BANK_LOGO_PATTERNS: BankEntry[] = [
  // ── Canadian: Big 6 ──────────────────────────────────────────────────────────
  {
    domain: "rbc.com",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/\brbc\b/i, /royal bank/i],
  },
  {
    domain: "td.com",
    bg: "bg-green-500/10",
    country: "CA",
    patterns: [/\btd\b/i, /toronto[\s-]dominion/i, /td canada trust/i, /td bank/i],
  },
  {
    domain: "bmo.com",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/bank of montreal/i, /\bbmo\b/i],
  },
  {
    domain: "scotiabank.com",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/scotiabank/i, /bank of nova scotia/i, /\bscotia\b/i],
  },
  {
    domain: "cibccm.com",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/\bcibc\b/i, /canadian imperial/i, /imperial bank of commerce/i],
  },
  {
    domain: "nbc.ca",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/national bank/i, /banque nationale/i],
  },
  // ── Canadian: Other banks ─────────────────────────────────────────────────────
  {
    domain: "tangerine.ca",
    bg: "bg-orange-500/10",
    country: "CA",
    patterns: [/tangerine/i],
  },
  {
    domain: "simplii.com",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/simplii/i],
  },
  {
    domain: "hsbc.ca",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/\bhsbc\b/i],
  },
  {
    domain: "atb.com",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/atb financial/i, /\batb\b/i, /alberta treasury/i],
  },
  {
    domain: "laurentianbank.ca",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/laurentian/i],
  },
  {
    domain: "cwbank.com",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/canadian western bank/i, /\bcwb\b/i],
  },
  {
    domain: "icicibank.ca",
    bg: "bg-orange-500/10",
    country: "CA",
    patterns: [/icici/i],
  },
  {
    domain: "manulifebank.ca",
    bg: "bg-green-500/10",
    country: "CA",
    patterns: [/manulife bank/i],
  },
  {
    domain: "pcfinancial.ca",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/pc financial/i, /president.s choice/i],
  },
  {
    domain: "oaken.com",
    bg: "bg-amber-500/10",
    country: "CA",
    patterns: [/oaken/i, /home bank/i],
  },
  {
    domain: "eqbank.ca",
    bg: "bg-purple-500/10",
    country: "CA",
    patterns: [/\beq bank\b/i, /\beqb\b/i],
  },
  // ── Canadian: Credit unions ───────────────────────────────────────────────────
  {
    domain: "desjardins.com",
    bg: "bg-green-500/10",
    country: "CA",
    patterns: [/desjardins/i],
  },
  {
    domain: "vancity.com",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/vancity/i, /vancouver city savings/i],
  },
  {
    domain: "meridiancu.ca",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/meridian/i],
  },
  {
    domain: "coastcapitalsavings.com",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/coast capital/i],
  },
  {
    domain: "servus.ca",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/servus/i],
  },
  {
    domain: "affinitycu.ca",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/affinity credit union/i, /\baffinity\b/i],
  },
  {
    domain: "conexus.ca",
    bg: "bg-green-500/10",
    country: "CA",
    patterns: [/conexus/i],
  },
  {
    domain: "alterna.ca",
    bg: "bg-green-500/10",
    country: "CA",
    patterns: [/alterna/i],
  },
  {
    domain: "libro.ca",
    bg: "bg-green-500/10",
    country: "CA",
    patterns: [/libro/i],
  },
  {
    domain: "firstwestcu.ca",
    bg: "bg-blue-500/10",
    country: "CA",
    patterns: [/first west/i, /envision financial/i, /valley first/i],
  },
  // ── Canadian: Investing ───────────────────────────────────────────────────────
  {
    domain: "wealthsimple.com",
    bg: "bg-slate-500/10",
    country: "CA",
    patterns: [/wealthsimple/i],
  },
  {
    domain: "questrade.com",
    bg: "bg-red-500/10",
    country: "CA",
    patterns: [/questrade/i],
  },
  // ── US: Big banks ─────────────────────────────────────────────────────────────
  {
    domain: "chase.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/\bchase\b/i, /jpmorgan/i, /jp morgan/i],
  },
  {
    domain: "bankofamerica.com",
    bg: "bg-red-500/10",
    country: "US",
    patterns: [/bank of america/i, /\bbofa\b/i, /\bbof a\b/i],
  },
  {
    domain: "wellsfargo.com",
    bg: "bg-red-500/10",
    country: "US",
    patterns: [/wells fargo/i],
  },
  {
    domain: "citi.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/\bciti(bank)?\b/i],
  },
  {
    domain: "usbank.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/\bus bank\b/i, /u\.s\. bank/i],
  },
  {
    domain: "goldmansachs.com",
    bg: "bg-slate-500/10",
    country: "US",
    patterns: [/goldman sachs/i, /\bmarcus\b/i],
  },
  {
    domain: "morganstanley.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/morgan stanley/i],
  },
  // ── US: Regional banks ────────────────────────────────────────────────────────
  {
    domain: "truist.com",
    bg: "bg-purple-500/10",
    country: "US",
    patterns: [/truist/i, /\bbb&t\b/i, /suntrust/i],
  },
  {
    domain: "pnc.com",
    bg: "bg-orange-500/10",
    country: "US",
    patterns: [/\bpnc\b/i],
  },
  {
    domain: "capitalone.com",
    bg: "bg-red-500/10",
    country: "US",
    patterns: [/capital one/i],
  },
  {
    domain: "key.com",
    bg: "bg-red-500/10",
    country: "US",
    patterns: [/\bkeybank\b/i, /key bank/i],
  },
  {
    domain: "regions.com",
    bg: "bg-green-500/10",
    country: "US",
    patterns: [/regions bank/i, /\bregions\b/i],
  },
  {
    domain: "53.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/fifth third/i, /5\/3 bank/i],
  },
  {
    domain: "huntington.com",
    bg: "bg-green-500/10",
    country: "US",
    patterns: [/huntington/i],
  },
  {
    domain: "citizensbank.com",
    bg: "bg-green-500/10",
    country: "US",
    patterns: [/citizens bank/i],
  },
  {
    domain: "mtb.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/m&t bank/i, /\bmtb\b/i],
  },
  {
    domain: "comerica.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/comerica/i],
  },
  {
    domain: "zionsbank.com",
    bg: "bg-red-500/10",
    country: "US",
    patterns: [/zions bank/i],
  },
  {
    domain: "firstrepublic.com",
    bg: "bg-slate-500/10",
    country: "US",
    patterns: [/first republic/i],
  },
  // ── US: Investing & brokerage ─────────────────────────────────────────────────
  {
    domain: "schwab.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/\bschwab\b/i, /charles schwab/i],
  },
  {
    domain: "fidelity.com",
    bg: "bg-green-500/10",
    country: "US",
    patterns: [/fidelity/i],
  },
  {
    domain: "vanguard.com",
    bg: "bg-red-500/10",
    country: "US",
    patterns: [/vanguard/i],
  },
  {
    domain: "etrade.com",
    bg: "bg-purple-500/10",
    country: "US",
    patterns: [/e\*?trade/i],
  },
  {
    domain: "ibkr.com",
    bg: "bg-red-500/10",
    country: "US",
    patterns: [/interactive brokers/i, /\bibkr\b/i],
  },
  {
    domain: "robinhood.com",
    bg: "bg-emerald-500/10",
    country: "US",
    patterns: [/robinhood/i],
  },
  {
    domain: "wealthfront.com",
    bg: "bg-green-500/10",
    country: "US",
    patterns: [/wealthfront/i],
  },
  {
    domain: "betterment.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/betterment/i],
  },
  // ── US: Online / neobanks ─────────────────────────────────────────────────────
  {
    domain: "ally.com",
    bg: "bg-purple-500/10",
    country: "US",
    patterns: [/\bally\b/i],
  },
  {
    domain: "discover.com",
    bg: "bg-orange-500/10",
    country: "US",
    patterns: [/discover/i],
  },
  {
    domain: "synchronybank.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/synchrony/i],
  },
  {
    domain: "navyfederal.org",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/navy federal/i],
  },
  {
    domain: "usaa.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/\busaa\b/i],
  },
  {
    domain: "sofi.com",
    bg: "bg-slate-500/10",
    country: "US",
    patterns: [/\bsofi\b/i],
  },
  {
    domain: "chime.com",
    bg: "bg-green-500/10",
    country: "US",
    patterns: [/chime/i],
  },
  // ── US: Cards ─────────────────────────────────────────────────────────────────
  {
    domain: "americanexpress.com",
    bg: "bg-blue-500/10",
    country: "US",
    patterns: [/american express/i, /amex/i],
  },
  // ── International: UK ─────────────────────────────────────────────────────────
  {
    domain: "hsbc.com",
    bg: "bg-red-500/10",
    country: "INTL",
    patterns: [/hsbc uk/i, /hsbc bank plc/i],
  },
  {
    domain: "barclays.com",
    bg: "bg-blue-500/10",
    country: "INTL",
    patterns: [/barclays/i],
  },
  {
    domain: "lloyds.com",
    bg: "bg-green-500/10",
    country: "INTL",
    patterns: [/lloyds/i],
  },
  {
    domain: "natwest.com",
    bg: "bg-purple-500/10",
    country: "INTL",
    patterns: [/natwest/i, /nat west/i],
  },
  {
    domain: "standardchartered.com",
    bg: "bg-blue-500/10",
    country: "INTL",
    patterns: [/standard chartered/i],
  },
  // ── International: Europe ─────────────────────────────────────────────────────
  {
    domain: "santander.com",
    bg: "bg-red-500/10",
    country: "INTL",
    patterns: [/santander/i],
  },
  {
    domain: "db.com",
    bg: "bg-blue-500/10",
    country: "INTL",
    patterns: [/deutsche bank/i],
  },
  {
    domain: "ing.com",
    bg: "bg-orange-500/10",
    country: "INTL",
    patterns: [/\bing\b/i],
  },
  {
    domain: "ubs.com",
    bg: "bg-red-500/10",
    country: "INTL",
    patterns: [/\bubs\b/i],
  },
  {
    domain: "bnpparibas.com",
    bg: "bg-green-500/10",
    country: "INTL",
    patterns: [/bnp paribas/i, /\bbnp\b/i],
  },
  // ── International: Australia ──────────────────────────────────────────────────
  {
    domain: "commbank.com.au",
    bg: "bg-yellow-500/10",
    country: "INTL",
    patterns: [/commonwealth bank/i, /\bcommbank\b/i, /\bcba\b/i],
  },
  {
    domain: "anz.com",
    bg: "bg-blue-500/10",
    country: "INTL",
    patterns: [/\banz\b/i],
  },
  {
    domain: "westpac.com.au",
    bg: "bg-red-500/10",
    country: "INTL",
    patterns: [/westpac/i],
  },
  {
    domain: "nab.com.au",
    bg: "bg-red-500/10",
    country: "INTL",
    patterns: [/\bnab\b/i, /national australia/i],
  },
  // ── International: Asia ───────────────────────────────────────────────────────
  {
    domain: "dbs.com",
    bg: "bg-red-500/10",
    country: "INTL",
    patterns: [/\bdbs\b/i],
  },
  {
    domain: "ocbc.com",
    bg: "bg-red-500/10",
    country: "INTL",
    patterns: [/\bocbc\b/i],
  },
  // ── International: Neobanks / fintech ────────────────────────────────────────
  {
    domain: "revolut.com",
    bg: "bg-slate-500/10",
    country: "INTL",
    patterns: [/revolut/i],
  },
  {
    domain: "wise.com",
    bg: "bg-green-500/10",
    country: "INTL",
    patterns: [/\bwise\b/i, /transferwise/i],
  },
  {
    domain: "monzo.com",
    bg: "bg-orange-500/10",
    country: "INTL",
    patterns: [/monzo/i],
  },
  {
    domain: "n26.com",
    bg: "bg-slate-500/10",
    country: "INTL",
    patterns: [/\bn26\b/i],
  },
  // ── Crypto: Canadian ─────────────────────────────────────────────────────────
  {
    domain: "newton.co",
    bg: "bg-slate-500/10",
    country: "CRYPTO",
    patterns: [/\bnewton\b/i],
  },
  {
    domain: "shakepay.com",
    bg: "bg-green-500/10",
    country: "CRYPTO",
    patterns: [/shakepay/i],
  },
  {
    domain: "ndax.io",
    bg: "bg-blue-500/10",
    country: "CRYPTO",
    patterns: [/\bndax\b/i],
  },
  {
    domain: "netcoins.ca",
    bg: "bg-blue-500/10",
    country: "CRYPTO",
    patterns: [/netcoins/i],
  },
  {
    domain: "wonderfi.com",
    bg: "bg-purple-500/10",
    country: "CRYPTO",
    patterns: [/wonderfi/i, /bitbuy/i],
  },
  // ── Crypto: Global ────────────────────────────────────────────────────────────
  {
    domain: "coinbase.com",
    bg: "bg-blue-500/10",
    country: "CRYPTO",
    patterns: [/coinbase/i],
  },
  {
    domain: "binance.com",
    bg: "bg-yellow-500/10",
    country: "CRYPTO",
    patterns: [/\bbinance\b/i],
  },
  {
    domain: "kraken.com",
    bg: "bg-purple-500/10",
    country: "CRYPTO",
    patterns: [/\bkraken\b/i],
  },
  {
    domain: "gemini.com",
    bg: "bg-slate-500/10",
    country: "CRYPTO",
    patterns: [/\bgemini\b/i],
  },
  {
    domain: "crypto.com",
    bg: "bg-blue-500/10",
    country: "CRYPTO",
    patterns: [/\bcrypto\.com\b/i],
  },
  {
    domain: "okx.com",
    bg: "bg-slate-500/10",
    country: "CRYPTO",
    patterns: [/\bokx\b/i],
  },
  {
    domain: "bybit.com",
    bg: "bg-yellow-500/10",
    country: "CRYPTO",
    patterns: [/\bbybit\b/i],
  },
  {
    domain: "kucoin.com",
    bg: "bg-emerald-500/10",
    country: "CRYPTO",
    patterns: [/kucoin/i],
  },
  {
    domain: "bitstamp.net",
    bg: "bg-green-500/10",
    country: "CRYPTO",
    patterns: [/bitstamp/i],
  },
  {
    domain: "bitfinex.com",
    bg: "bg-green-500/10",
    country: "CRYPTO",
    patterns: [/bitfinex/i],
  },
];

const BANK_DISPLAY_NAMES: string[] = [
  // Canadian: Big 6
  "RBC",
  "TD Bank",
  "BMO",
  "Scotiabank",
  "CIBC",
  "National Bank",
  // Canadian: Other banks
  "Tangerine",
  "Simplii Financial",
  "HSBC",
  "ATB Financial",
  "Laurentian Bank",
  "Canadian Western Bank",
  "ICICI Bank Canada",
  "Manulife Bank",
  "PC Financial",
  "Oaken Financial",
  "EQ Bank",
  // Canadian: Credit unions
  "Desjardins",
  "Vancity",
  "Meridian",
  "Coast Capital Savings",
  "Servus Credit Union",
  "Affinity Credit Union",
  "Conexus Credit Union",
  "Alterna Savings",
  "Libro Credit Union",
  "First West Credit Union",
  // Canadian: Investing
  "Wealthsimple",
  "Questrade",
  // US: Big banks
  "Chase",
  "Bank of America",
  "Wells Fargo",
  "Citibank",
  "US Bank",
  "Goldman Sachs",
  "Morgan Stanley",
  // US: Regional
  "Truist",
  "PNC Bank",
  "Capital One",
  "KeyBank",
  "Regions Bank",
  "Fifth Third Bank",
  "Huntington Bank",
  "Citizens Bank",
  "M&T Bank",
  "Comerica",
  "Zions Bank",
  "First Republic",
  // US: Investing & brokerage
  "Charles Schwab",
  "Fidelity",
  "Vanguard",
  "E*TRADE",
  "Interactive Brokers",
  "Robinhood",
  "Wealthfront",
  "Betterment",
  // US: Online / neobanks
  "Ally Bank",
  "Discover",
  "Synchrony Bank",
  "Navy Federal",
  "USAA",
  "SoFi",
  "Chime",
  // US: Cards
  "American Express",
  // International: UK
  "HSBC",
  "Barclays",
  "Lloyds Bank",
  "NatWest",
  "Standard Chartered",
  // International: Europe
  "Santander",
  "Deutsche Bank",
  "ING",
  "UBS",
  "BNP Paribas",
  // International: Australia
  "Commonwealth Bank",
  "ANZ",
  "Westpac",
  "NAB",
  // International: Asia
  "DBS Bank",
  "OCBC Bank",
  // International: Neobanks
  "Revolut",
  "Wise",
  "Monzo",
  "N26",
  // Crypto: Canadian
  "Newton",
  "Shakepay",
  "NDAX",
  "Netcoins",
  "WonderFi",
  // Crypto: Global
  "Coinbase",
  "Binance",
  "Kraken",
  "Gemini",
  "Crypto.com",
  "OKX",
  "Bybit",
  "KuCoin",
  "Bitstamp",
  "Bitfinex",
];

export const BANK_LOGOS_DISPLAY: Array<{
  name: string;
  domain: string;
  bg: string;
  country: "CA" | "US" | "INTL" | "CRYPTO";
}> = BANK_LOGO_PATTERNS.map((entry, i) => ({
  name: BANK_DISPLAY_NAMES[i],
  domain: entry.domain,
  bg: entry.bg,
  country: entry.country,
}));

const FALLBACK_COLORS = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
];

export function getBankFallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function getBankLogo(institutionName: string): { domain: string; bg: string } | null {
  for (const entry of BANK_LOGO_PATTERNS) {
    if (entry.patterns.some((p) => p.test(institutionName))) {
      return { domain: entry.domain, bg: entry.bg };
    }
  }
  return null;
}

const LOGO_DEV_DEMO_TOKEN = "live_6a1a28fd-6420-4492-aeb0-b297461d9de2";

export function getBankOnlineLogoUrl(domain: string): string {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN ?? LOGO_DEV_DEMO_TOKEN;
  return `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
}

export function resolveBankLogoSrc(logoData: { domain: string }): string {
  return getBankOnlineLogoUrl(logoData.domain);
}

export function getTickerLogoUrl(symbol: string): string {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN ?? LOGO_DEV_DEMO_TOKEN;
  return `https://img.logo.dev/ticker/${encodeURIComponent(symbol)}?token=${token}&size=128&format=png`;
}

const CRYPTO_QUOTE_CURRENCIES = [
  "USDT", "USDC", "BUSD", "TUSD", "USDP", "DAI",
  "USD", "EUR", "GBP", "BTC", "ETH", "BNB",
];

function parseCryptoSymbol(raw: string): string {
  // Strip exchange prefix: "BINANCE:BTCUSDT" → "BTCUSDT"
  const symbol = raw.includes(":") ? raw.split(":")[1] : raw;
  // Strip quote currency suffix (longest match first to avoid "USD" eating "USDT")
  for (const quote of CRYPTO_QUOTE_CURRENCIES) {
    if (symbol.length > quote.length && symbol.endsWith(quote)) {
      return symbol.slice(0, symbol.length - quote.length).toLowerCase();
    }
  }
  return symbol.toLowerCase();
}

export function getCryptoLogoUrl(symbol: string): string {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN ?? LOGO_DEV_DEMO_TOKEN;
  const parsed = parseCryptoSymbol(symbol);
  return `https://img.logo.dev/crypto/${encodeURIComponent(parsed)}?token=${token}&size=128&format=png`;
}

export function normalizeBankName(source: string): string {
  for (let i = 0; i < BANK_LOGO_PATTERNS.length; i++) {
    if (BANK_LOGO_PATTERNS[i].patterns.some((p) => p.test(source))) {
      return BANK_DISPLAY_NAMES[i];
    }
  }
  return source;
}
