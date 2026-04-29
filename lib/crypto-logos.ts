const CRYPTO_BG: Record<string, string> = {
  // ── Major ─────────────────────────────────────────────────────────────────────
  BTC:   "bg-amber-500/10",
  ETH:   "bg-indigo-500/10",
  BNB:   "bg-yellow-500/10",
  SOL:   "bg-purple-500/10",
  XRP:   "bg-blue-500/10",
  ADA:   "bg-blue-500/10",
  DOGE:  "bg-yellow-500/10",
  TRX:   "bg-red-500/10",
  AVAX:  "bg-red-500/10",
  MATIC: "bg-purple-500/10",
  POL:   "bg-purple-500/10",
  DOT:   "bg-pink-500/10",
  LINK:  "bg-blue-500/10",
  UNI:   "bg-rose-500/10",
  LTC:   "bg-slate-500/10",
  BCH:   "bg-green-500/10",
  ATOM:  "bg-indigo-500/10",
  XLM:   "bg-blue-500/10",
  ALGO:  "bg-slate-500/10",
  NEAR:  "bg-slate-500/10",
  APT:   "bg-blue-500/10",
  ARB:   "bg-blue-500/10",
  OP:    "bg-red-500/10",
  FIL:   "bg-blue-500/10",
  ICP:   "bg-purple-500/10",
  VET:   "bg-blue-500/10",
  HBAR:  "bg-slate-500/10",
  IMX:   "bg-slate-500/10",
  // ── Stablecoins ───────────────────────────────────────────────────────────────
  USDT:  "bg-green-500/10",
  USDC:  "bg-blue-500/10",
  BUSD:  "bg-yellow-500/10",
  DAI:   "bg-amber-500/10",
  // ── Exchange tokens ───────────────────────────────────────────────────────────
  CRO:   "bg-blue-500/10",
  OKB:   "bg-blue-500/10",
  FTT:   "bg-blue-500/10",
  // ── DeFi ──────────────────────────────────────────────────────────────────────
  AAVE:  "bg-purple-500/10",
  MKR:   "bg-teal-500/10",
  COMP:  "bg-green-500/10",
  CRV:   "bg-amber-500/10",
  SNX:   "bg-blue-500/10",
};

const QUOTE_CURRENCIES = [
  "USDT", "USDC", "BUSD", "TUSD", "USDP", "DAI",
  "USD", "EUR", "GBP", "BTC", "ETH", "BNB",
];

function parseCryptoSymbol(raw: string): string {
  const symbol = raw.includes(":") ? raw.split(":")[1] : raw;
  for (const quote of QUOTE_CURRENCIES) {
    if (symbol.length > quote.length && symbol.endsWith(quote)) {
      return symbol.slice(0, symbol.length - quote.length).toUpperCase();
    }
  }
  return symbol.toUpperCase();
}

export function getCryptoBg(ticker: string): string | null {
  return CRYPTO_BG[parseCryptoSymbol(ticker)] ?? null;
}
