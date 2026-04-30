const STORAGE_KEY = "sors-settings";

// ISO 4217 Currency Codes
export type Currency =
  | "AED" | "AFN" | "ALL" | "AMD" | "ANG" | "AOA" | "ARS" | "AUD" | "AWG" | "AZN"
  | "BAM" | "BBD" | "BDT" | "BGN" | "BHD" | "BIF" | "BMD" | "BND" | "BOB" | "BRL" | "BSD" | "BTN" | "BWP" | "BYN" | "BZD"
  | "CAD" | "CDF" | "CHF" | "CLP" | "CNY" | "COP" | "CRC" | "CUP" | "CVE" | "CZK"
  | "DJF" | "DKK" | "DOP" | "DZD"
  | "EGP" | "ERN" | "ETB" | "EUR"
  | "FJD" | "FKP"
  | "GBP" | "GEL" | "GHS" | "GIP" | "GMD" | "GNF" | "GTQ" | "GYD"
  | "HKD" | "HNL" | "HRK" | "HTG" | "HUF"
  | "IDR" | "ILS" | "INR" | "IQD" | "IRR" | "ISK"
  | "JMD" | "JOD" | "JPY"
  | "KES" | "KGS" | "KHR" | "KMF" | "KPW" | "KRW" | "KWD" | "KYD" | "KZT"
  | "LAK" | "LBP" | "LKR" | "LRD" | "LSL" | "LYD"
  | "MAD" | "MDL" | "MGA" | "MKD" | "MMK" | "MNT" | "MOP" | "MRU" | "MUR" | "MVR" | "MWK" | "MXN" | "MYR" | "MZN"
  | "NAD" | "NGN" | "NIO" | "NOK" | "NPR" | "NZD"
  | "OMR"
  | "PAB" | "PEN" | "PGK" | "PHP" | "PKR" | "PLN" | "PYG"
  | "QAR"
  | "RON" | "RSD" | "RUB" | "RWF"
  | "SAR" | "SBD" | "SCR" | "SDG" | "SEK" | "SGD" | "SHP" | "SLE" | "SOS" | "SRD" | "SSP" | "STN" | "SYP" | "SZL"
  | "THB" | "TJS" | "TMT" | "TND" | "TOP" | "TRY" | "TTD" | "TWD" | "TZS"
  | "UAH" | "UGX" | "USD" | "UYU" | "UZS"
  | "VES" | "VND" | "VUV"
  | "WST"
  | "XAF" | "XCD" | "XOF" | "XPF"
  | "YER"
  | "ZAR" | "ZMW" | "ZWL";

export const SUPPORTED_CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  // Major currencies first
  { value: "USD", label: "US Dollar", symbol: "$" },
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "GBP", label: "British Pound", symbol: "£" },
  { value: "JPY", label: "Japanese Yen", symbol: "¥" },
  { value: "CAD", label: "Canadian Dollar", symbol: "$" },
  { value: "AUD", label: "Australian Dollar", symbol: "$" },
  { value: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { value: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { value: "HKD", label: "Hong Kong Dollar", symbol: "$" },
  { value: "NZD", label: "New Zealand Dollar", symbol: "$" },
  { value: "SEK", label: "Swedish Krona", symbol: "kr" },
  { value: "KRW", label: "South Korean Won", symbol: "₩" },
  { value: "SGD", label: "Singapore Dollar", symbol: "$" },
  { value: "NOK", label: "Norwegian Krone", symbol: "kr" },
  { value: "MXN", label: "Mexican Peso", symbol: "$" },
  { value: "INR", label: "Indian Rupee", symbol: "₹" },
  { value: "RUB", label: "Russian Ruble", symbol: "₽" },
  { value: "ZAR", label: "South African Rand", symbol: "R" },
  { value: "TRY", label: "Turkish Lira", symbol: "₺" },
  { value: "BRL", label: "Brazilian Real", symbol: "R$" },
  // Rest alphabetically
  { value: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { value: "AFN", label: "Afghan Afghani", symbol: "؋" },
  { value: "ALL", label: "Albanian Lek", symbol: "L" },
  { value: "AMD", label: "Armenian Dram", symbol: "֏" },
  { value: "ANG", label: "Netherlands Antillean Guilder", symbol: "ƒ" },
  { value: "AOA", label: "Angolan Kwanza", symbol: "Kz" },
  { value: "ARS", label: "Argentine Peso", symbol: "$" },
  { value: "AWG", label: "Aruban Florin", symbol: "ƒ" },
  { value: "AZN", label: "Azerbaijani Manat", symbol: "₼" },
  { value: "BAM", label: "Bosnia-Herzegovina Convertible Mark", symbol: "KM" },
  { value: "BBD", label: "Barbadian Dollar", symbol: "$" },
  { value: "BDT", label: "Bangladeshi Taka", symbol: "৳" },
  { value: "BGN", label: "Bulgarian Lev", symbol: "лв" },
  { value: "BHD", label: "Bahraini Dinar", symbol: ".د.ب" },
  { value: "BIF", label: "Burundian Franc", symbol: "FBu" },
  { value: "BMD", label: "Bermudan Dollar", symbol: "$" },
  { value: "BND", label: "Brunei Dollar", symbol: "$" },
  { value: "BOB", label: "Bolivian Boliviano", symbol: "Bs." },
  { value: "BSD", label: "Bahamian Dollar", symbol: "$" },
  { value: "BTN", label: "Bhutanese Ngultrum", symbol: "Nu." },
  { value: "BWP", label: "Botswanan Pula", symbol: "P" },
  { value: "BYN", label: "Belarusian Ruble", symbol: "Br" },
  { value: "BZD", label: "Belize Dollar", symbol: "$" },
  { value: "CDF", label: "Congolese Franc", symbol: "FC" },
  { value: "CLP", label: "Chilean Peso", symbol: "$" },
  { value: "COP", label: "Colombian Peso", symbol: "$" },
  { value: "CRC", label: "Costa Rican Colón", symbol: "₡" },
  { value: "CUP", label: "Cuban Peso", symbol: "$" },
  { value: "CVE", label: "Cape Verdean Escudo", symbol: "$" },
  { value: "CZK", label: "Czech Koruna", symbol: "Kč" },
  { value: "DJF", label: "Djiboutian Franc", symbol: "Fdj" },
  { value: "DKK", label: "Danish Krone", symbol: "kr" },
  { value: "DOP", label: "Dominican Peso", symbol: "$" },
  { value: "DZD", label: "Algerian Dinar", symbol: "د.ج" },
  { value: "EGP", label: "Egyptian Pound", symbol: "£" },
  { value: "ERN", label: "Eritrean Nakfa", symbol: "Nfk" },
  { value: "ETB", label: "Ethiopian Birr", symbol: "Br" },
  { value: "FJD", label: "Fijian Dollar", symbol: "$" },
  { value: "FKP", label: "Falkland Islands Pound", symbol: "£" },
  { value: "GEL", label: "Georgian Lari", symbol: "₾" },
  { value: "GHS", label: "Ghanaian Cedi", symbol: "₵" },
  { value: "GIP", label: "Gibraltar Pound", symbol: "£" },
  { value: "GMD", label: "Gambian Dalasi", symbol: "D" },
  { value: "GNF", label: "Guinean Franc", symbol: "FG" },
  { value: "GTQ", label: "Guatemalan Quetzal", symbol: "Q" },
  { value: "GYD", label: "Guyanaese Dollar", symbol: "$" },
  { value: "HNL", label: "Honduran Lempira", symbol: "L" },
  { value: "HRK", label: "Croatian Kuna", symbol: "kn" },
  { value: "HTG", label: "Haitian Gourde", symbol: "G" },
  { value: "HUF", label: "Hungarian Forint", symbol: "Ft" },
  { value: "IDR", label: "Indonesian Rupiah", symbol: "Rp" },
  { value: "ILS", label: "Israeli New Shekel", symbol: "₪" },
  { value: "IQD", label: "Iraqi Dinar", symbol: "ع.د" },
  { value: "IRR", label: "Iranian Rial", symbol: "﷼" },
  { value: "ISK", label: "Icelandic Króna", symbol: "kr" },
  { value: "JMD", label: "Jamaican Dollar", symbol: "$" },
  { value: "JOD", label: "Jordanian Dinar", symbol: "د.ا" },
  { value: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { value: "KGS", label: "Kyrgystani Som", symbol: "сом" },
  { value: "KHR", label: "Cambodian Riel", symbol: "៛" },
  { value: "KMF", label: "Comorian Franc", symbol: "CF" },
  { value: "KPW", label: "North Korean Won", symbol: "₩" },
  { value: "KWD", label: "Kuwaiti Dinar", symbol: "د.ك" },
  { value: "KYD", label: "Cayman Islands Dollar", symbol: "$" },
  { value: "KZT", label: "Kazakhstani Tenge", symbol: "₸" },
  { value: "LAK", label: "Laotian Kip", symbol: "₭" },
  { value: "LBP", label: "Lebanese Pound", symbol: "ل.ل" },
  { value: "LKR", label: "Sri Lankan Rupee", symbol: "₨" },
  { value: "LRD", label: "Liberian Dollar", symbol: "$" },
  { value: "LSL", label: "Lesotho Loti", symbol: "L" },
  { value: "LYD", label: "Libyan Dinar", symbol: "ل.د" },
  { value: "MAD", label: "Moroccan Dirham", symbol: "د.م." },
  { value: "MDL", label: "Moldovan Leu", symbol: "L" },
  { value: "MGA", label: "Malagasy Ariary", symbol: "Ar" },
  { value: "MKD", label: "Macedonian Denar", symbol: "ден" },
  { value: "MMK", label: "Myanmar Kyat", symbol: "K" },
  { value: "MNT", label: "Mongolian Tugrik", symbol: "₮" },
  { value: "MOP", label: "Macanese Pataca", symbol: "MOP$" },
  { value: "MRU", label: "Mauritanian Ouguiya", symbol: "UM" },
  { value: "MUR", label: "Mauritian Rupee", symbol: "₨" },
  { value: "MVR", label: "Maldivian Rufiyaa", symbol: "Rf" },
  { value: "MWK", label: "Malawian Kwacha", symbol: "MK" },
  { value: "MYR", label: "Malaysian Ringgit", symbol: "RM" },
  { value: "MZN", label: "Mozambican Metical", symbol: "MT" },
  { value: "NAD", label: "Namibian Dollar", symbol: "$" },
  { value: "NGN", label: "Nigerian Naira", symbol: "₦" },
  { value: "NIO", label: "Nicaraguan Córdoba", symbol: "C$" },
  { value: "NPR", label: "Nepalese Rupee", symbol: "₨" },
  { value: "OMR", label: "Omani Rial", symbol: "ر.ع." },
  { value: "PAB", label: "Panamanian Balboa", symbol: "B/." },
  { value: "PEN", label: "Peruvian Sol", symbol: "S/" },
  { value: "PGK", label: "Papua New Guinean Kina", symbol: "K" },
  { value: "PHP", label: "Philippine Peso", symbol: "₱" },
  { value: "PKR", label: "Pakistani Rupee", symbol: "₨" },
  { value: "PLN", label: "Polish Zloty", symbol: "zł" },
  { value: "PYG", label: "Paraguayan Guarani", symbol: "₲" },
  { value: "QAR", label: "Qatari Rial", symbol: "ر.ق" },
  { value: "RON", label: "Romanian Leu", symbol: "lei" },
  { value: "RSD", label: "Serbian Dinar", symbol: "дин." },
  { value: "RWF", label: "Rwandan Franc", symbol: "FRw" },
  { value: "SAR", label: "Saudi Riyal", symbol: "ر.س" },
  { value: "SBD", label: "Solomon Islands Dollar", symbol: "$" },
  { value: "SCR", label: "Seychellois Rupee", symbol: "₨" },
  { value: "SDG", label: "Sudanese Pound", symbol: "ج.س." },
  { value: "SHP", label: "Saint Helena Pound", symbol: "£" },
  { value: "SLE", label: "Sierra Leonean Leone", symbol: "Le" },
  { value: "SOS", label: "Somali Shilling", symbol: "S" },
  { value: "SRD", label: "Surinamese Dollar", symbol: "$" },
  { value: "SSP", label: "South Sudanese Pound", symbol: "£" },
  { value: "STN", label: "São Tomé and Príncipe Dobra", symbol: "Db" },
  { value: "SYP", label: "Syrian Pound", symbol: "£" },
  { value: "SZL", label: "Swazi Lilangeni", symbol: "L" },
  { value: "THB", label: "Thai Baht", symbol: "฿" },
  { value: "TJS", label: "Tajikistani Somoni", symbol: "ЅМ" },
  { value: "TMT", label: "Turkmenistani Manat", symbol: "T" },
  { value: "TND", label: "Tunisian Dinar", symbol: "د.ت" },
  { value: "TOP", label: "Tongan Paʻanga", symbol: "T$" },
  { value: "TTD", label: "Trinidad and Tobago Dollar", symbol: "$" },
  { value: "TWD", label: "New Taiwan Dollar", symbol: "NT$" },
  { value: "TZS", label: "Tanzanian Shilling", symbol: "TSh" },
  { value: "UAH", label: "Ukrainian Hryvnia", symbol: "₴" },
  { value: "UGX", label: "Ugandan Shilling", symbol: "USh" },
  { value: "UYU", label: "Uruguayan Peso", symbol: "$" },
  { value: "UZS", label: "Uzbekistan Som", symbol: "сўм" },
  { value: "VES", label: "Venezuelan Bolívar", symbol: "Bs." },
  { value: "VND", label: "Vietnamese Dong", symbol: "₫" },
  { value: "VUV", label: "Vanuatu Vatu", symbol: "VT" },
  { value: "WST", label: "Samoan Tala", symbol: "T" },
  { value: "XAF", label: "CFA Franc BEAC", symbol: "FCFA" },
  { value: "XCD", label: "East Caribbean Dollar", symbol: "$" },
  { value: "XOF", label: "CFA Franc BCEAO", symbol: "CFA" },
  { value: "XPF", label: "CFP Franc", symbol: "₣" },
  { value: "YER", label: "Yemeni Rial", symbol: "﷼" },
  { value: "ZMW", label: "Zambian Kwacha", symbol: "ZK" },
  { value: "ZWL", label: "Zimbabwean Dollar", symbol: "$" },
];

export interface AppSettings {
  finnhubApiKey?: string;
  currency?: Currency;
  timezone?: string;
}

/**
 * Load settings from localStorage
 */
export function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }

    return JSON.parse(stored) as AppSettings;
  } catch (error) {
    console.error("Error loading settings from localStorage:", error);
    return {};
  }
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Error saving settings to localStorage:", error);
  }
}

/**
 * Get Finnhub API key
 */
export function getFinnhubApiKey(): string | undefined {
  return loadSettings().finnhubApiKey;
}

/**
 * Set Finnhub API key
 */
export function setFinnhubApiKey(apiKey: string | undefined): void {
  const settings = loadSettings();
  if (apiKey) {
    settings.finnhubApiKey = apiKey;
  } else {
    delete settings.finnhubApiKey;
  }
  saveSettings(settings);
}

/**
 * Check if Finnhub API key is configured
 */
export function hasFinnhubApiKey(): boolean {
  const key = getFinnhubApiKey();
  return Boolean(key && key.trim().length > 0);
}

/**
 * Get user's currency preference (defaults to USD)
 */
export function getCurrency(): Currency {
  return loadSettings().currency || "USD";
}

/**
 * Set user's currency preference
 */
export function setCurrency(currency: Currency): void {
  const settings = loadSettings();
  settings.currency = currency;
  saveSettings(settings);
}

/**
 * Get user's timezone preference (defaults to browser timezone on first launch)
 */
export function getTimezone(): string {
  const settings = loadSettings();
  if (!settings.timezone) {
    // Set default timezone on first access
    const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(defaultTimezone);
    return defaultTimezone;
  }
  return settings.timezone;
}

/**
 * Set user's timezone preference
 */
export function setTimezone(timezone: string): void {
  const settings = loadSettings();
  settings.timezone = timezone;
  saveSettings(settings);
}
