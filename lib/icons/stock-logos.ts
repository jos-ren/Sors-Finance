const STOCK_BG: Record<string, string> = {
  // ── Tech: US ──────────────────────────────────────────────────────────────────
  AAPL:  "bg-white/10",
  MSFT:  "bg-blue-500/10",
  GOOGL: "bg-blue-500/10",
  GOOG:  "bg-blue-500/10",
  AMZN:  "bg-amber-500/10",
  NVDA:  "bg-green-500/10",
  META:  "bg-blue-500/10",
  TSLA:  "bg-red-500/10",
  AVGO:  "bg-red-500/10",
  ORCL:  "bg-red-500/10",
  ADBE:  "bg-red-500/10",
  CRM:   "bg-blue-500/10",
  AMD:   "bg-red-500/10",
  INTC:  "bg-blue-500/10",
  QCOM:  "bg-blue-500/10",
  TXN:   "bg-red-500/10",
  IBM:   "bg-blue-500/10",
  CSCO:  "bg-blue-500/10",
  NOW:   "bg-green-500/10",
  UBER:  "bg-white/10",
  LYFT:  "bg-rose-500/10",
  SPOT:  "bg-green-500/10",
  NFLX:  "bg-red-500/10",
  // ── Tech: Canadian ────────────────────────────────────────────────────────────
  SHOP:  "bg-green-500/10",
  BB:    "bg-slate-500/10",
  // ── Finance ───────────────────────────────────────────────────────────────────
  JPM:   "bg-blue-500/10",
  BAC:   "bg-red-500/10",
  WFC:   "bg-red-500/10",
  GS:    "bg-slate-500/10",
  MS:    "bg-blue-500/10",
  V:     "bg-blue-500/10",
  MA:    "bg-orange-500/10",
  AXP:   "bg-blue-500/10",
  BRK_A: "bg-slate-500/10",
  BRK_B: "bg-slate-500/10",
  // ── Healthcare ────────────────────────────────────────────────────────────────
  UNH:   "bg-blue-500/10",
  LLY:   "bg-red-500/10",
  JNJ:   "bg-red-500/10",
  MRK:   "bg-blue-500/10",
  ABBV:  "bg-purple-500/10",
  PFE:   "bg-blue-500/10",
  // ── Consumer ──────────────────────────────────────────────────────────────────
  WMT:   "bg-blue-500/10",
  HD:    "bg-orange-500/10",
  COST:  "bg-blue-500/10",
  MCD:   "bg-yellow-500/10",
  SBUX:  "bg-green-500/10",
  KO:    "bg-red-500/10",
  PEP:   "bg-blue-500/10",
  PG:    "bg-blue-500/10",
  NKE:   "bg-white/10",
  // ── Energy ────────────────────────────────────────────────────────────────────
  XOM:   "bg-red-500/10",
  CVX:   "bg-blue-500/10",
  // ── Canadian equities ─────────────────────────────────────────────────────────
  CNR:   "bg-red-500/10",
  CP:    "bg-red-500/10",
  ENB:   "bg-red-500/10",
  SU:    "bg-amber-500/10",
  BCE:   "bg-blue-500/10",
  T:     "bg-green-500/10",
  MFC:   "bg-green-500/10",
  SLF:   "bg-blue-500/10",
  POW:   "bg-red-500/10",
  ATD:   "bg-red-500/10",

  // ── ETFs: US broad market ─────────────────────────────────────────────────────
  SPY:   "bg-red-500/10",   // SPDR / State Street
  VOO:   "bg-red-500/10",   // Vanguard
  IVV:   "bg-slate-500/10", // iShares / BlackRock
  VTI:   "bg-red-500/10",   // Vanguard
  QQQ:   "bg-blue-500/10",  // Invesco
  DIA:   "bg-red-500/10",   // SPDR
  IWM:   "bg-slate-500/10", // iShares
  MDY:   "bg-red-500/10",   // SPDR

  // ── ETFs: US sector (SPDR XL series) ─────────────────────────────────────────
  XLF:   "bg-red-500/10",
  XLK:   "bg-red-500/10",
  XLE:   "bg-red-500/10",
  XLV:   "bg-red-500/10",
  XLY:   "bg-red-500/10",
  XLP:   "bg-red-500/10",
  XLI:   "bg-red-500/10",
  XLU:   "bg-red-500/10",
  XLB:   "bg-red-500/10",
  XLRE:  "bg-red-500/10",
  XLC:   "bg-red-500/10",

  // ── ETFs: US dividend & income ────────────────────────────────────────────────
  SCHD:  "bg-blue-500/10",  // Schwab
  VYM:   "bg-red-500/10",   // Vanguard
  VIG:   "bg-red-500/10",   // Vanguard
  DGRO:  "bg-slate-500/10", // iShares
  HDV:   "bg-slate-500/10", // iShares
  DVY:   "bg-slate-500/10", // iShares
  JEPI:  "bg-blue-500/10",  // JPMorgan
  JEPQ:  "bg-blue-500/10",  // JPMorgan

  // ── ETFs: US bond ─────────────────────────────────────────────────────────────
  BND:   "bg-red-500/10",   // Vanguard
  AGG:   "bg-slate-500/10", // iShares
  TLT:   "bg-slate-500/10", // iShares
  TIP:   "bg-slate-500/10", // iShares
  LQD:   "bg-slate-500/10", // iShares
  HYG:   "bg-slate-500/10", // iShares
  SHY:   "bg-slate-500/10", // iShares
  IEF:   "bg-slate-500/10", // iShares
  EMB:   "bg-slate-500/10", // iShares

  // ── ETFs: US real estate ──────────────────────────────────────────────────────
  VNQ:   "bg-red-500/10",   // Vanguard

  // ── ETFs: US commodities ──────────────────────────────────────────────────────
  GLD:   "bg-amber-500/10", // SPDR
  IAU:   "bg-amber-500/10", // iShares
  SLV:   "bg-slate-500/10", // iShares
  USO:   "bg-amber-500/10", // US Oil Fund

  // ── ETFs: US thematic / ARK ───────────────────────────────────────────────────
  ARKK:  "bg-purple-500/10",
  ARKW:  "bg-purple-500/10",
  ARKG:  "bg-purple-500/10",
  ARKF:  "bg-purple-500/10",
  ARKX:  "bg-purple-500/10",

  // ── ETFs: US leveraged ────────────────────────────────────────────────────────
  TQQQ:  "bg-blue-500/10",  // ProShares
  SQQQ:  "bg-red-500/10",   // ProShares
  UPRO:  "bg-blue-500/10",  // ProShares
  SPXU:  "bg-red-500/10",   // ProShares

  // ── ETFs: US crypto ───────────────────────────────────────────────────────────
  BITO:  "bg-amber-500/10", // ProShares Bitcoin
  IBIT:  "bg-amber-500/10", // iShares Bitcoin
  FBTC:  "bg-amber-500/10", // Fidelity Bitcoin
  BITB:  "bg-amber-500/10", // Bitwise Bitcoin
  ETHA:  "bg-indigo-500/10",// iShares Ethereum
  FETH:  "bg-indigo-500/10",// Fidelity Ethereum

  // ── ETFs: International / world ───────────────────────────────────────────────
  VT:    "bg-red-500/10",   // Vanguard Total World
  VXUS:  "bg-red-500/10",   // Vanguard Intl
  VEA:   "bg-red-500/10",   // Vanguard Developed
  VWO:   "bg-red-500/10",   // Vanguard Emerging
  EFA:   "bg-slate-500/10", // iShares EAFE
  EEM:   "bg-slate-500/10", // iShares Emerging
  IEMG:  "bg-slate-500/10", // iShares EM IMI
  ACWI:  "bg-slate-500/10", // iShares ACWI
  IXUS:  "bg-slate-500/10", // iShares Intl
  // Europe-listed equivalents
  IWDA:  "bg-slate-500/10", // iShares Core MSCI World
  CSPX:  "bg-slate-500/10", // iShares Core S&P 500
  EIMI:  "bg-slate-500/10", // iShares Core MSCI EM
  SSAC:  "bg-slate-500/10", // iShares MSCI ACWI
  VWRL:  "bg-red-500/10",   // Vanguard FTSE All-World
  VWCE:  "bg-red-500/10",   // Vanguard FTSE All-World Acc
  SWRD:  "bg-red-500/10",   // SPDR MSCI World

  // ── ETFs: Canadian broad market ───────────────────────────────────────────────
  XIU:   "bg-slate-500/10", // iShares S&P/TSX 60
  XIC:   "bg-slate-500/10", // iShares TSX Composite
  XSP:   "bg-slate-500/10", // iShares S&P 500 CAD-hedged
  ZSP:   "bg-blue-500/10",  // BMO S&P 500
  ZCN:   "bg-blue-500/10",  // BMO TSX Composite
  VFV:   "bg-red-500/10",   // Vanguard S&P 500 CAD
  VCN:   "bg-red-500/10",   // Vanguard TSX
  HXT:   "bg-green-500/10", // Horizons S&P/TSX 60
  HXS:   "bg-green-500/10", // Horizons S&P 500

  // ── ETFs: Canadian all-in-one ─────────────────────────────────────────────────
  XEQT:  "bg-slate-500/10", // iShares all-equity
  XGRO:  "bg-slate-500/10", // iShares growth
  XBAL:  "bg-slate-500/10", // iShares balanced
  XCNS:  "bg-slate-500/10", // iShares conservative
  VEQT:  "bg-red-500/10",   // Vanguard all-equity
  VGRO:  "bg-red-500/10",   // Vanguard growth
  VBAL:  "bg-red-500/10",   // Vanguard balanced
  VCNS:  "bg-red-500/10",   // Vanguard conservative
  ZGRO:  "bg-blue-500/10",  // BMO growth
  ZBAL:  "bg-blue-500/10",  // BMO balanced
  ZEQT:  "bg-blue-500/10",  // BMO all-equity

  // ── ETFs: Canadian bond & cash ────────────────────────────────────────────────
  ZAG:   "bg-blue-500/10",  // BMO Aggregate Bond
  XBB:   "bg-slate-500/10", // iShares Canadian Universe Bond
  CASH:  "bg-green-500/10", // Horizons High Interest Savings
  PSA:   "bg-purple-500/10",// Purpose High Interest Savings
  ZMMK:  "bg-blue-500/10",  // BMO Money Market

  // ── ETFs: Canadian sector ─────────────────────────────────────────────────────
  ZEB:   "bg-blue-500/10",  // BMO Equal Weight Banks
  XFN:   "bg-slate-500/10", // iShares Financials
  TEC:   "bg-green-500/10", // TD Global Technology Leaders
  HMAX:  "bg-blue-500/10",  // Hamilton Canadian Financials
};

export function getStockBg(ticker: string): string | null {
  const symbol = ticker.includes(":") ? ticker.split(":")[1] : ticker;
  return STOCK_BG[symbol.toUpperCase()] ?? null;
}
