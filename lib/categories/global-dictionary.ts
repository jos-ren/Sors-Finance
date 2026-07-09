/**
 * Global Merchant Dictionary
 *
 * A built-in, curated master list of common merchants → the *kind* of category
 * they belong to. This gives new users a "day one" categorization experience
 * before they've built up any of their own keyword rules.
 *
 * It's a static list here, expandable later (or eventually a shared
 * server-side database). Everything below is data — the resolution logic is a
 * few functions at the bottom.
 *
 * How it resolves to a user's categories:
 *   - `patterns` are `Keyword`s (text + match mode) checked against a
 *     transaction's matchField via the same `matchesKeyword` a user's own
 *     keywords use — "contains" by default, but an entry can use "startsWith"
 *     or "exact" when it needs to be more specific.
 *   - `categoryStems` are fuzzy-matched against the *names* of the user's own
 *     categories. A stem like "grocer" matches a user category named
 *     "Groceries", "Grocery", or "Grocer" (via includes-in-either-direction).
 *
 * The dictionary never creates categories. If the merchant is known but the
 * user has no matching-named category, there's simply no suggestion. Because of
 * that, entries can list *several* plausible stems ("stream", "entertain",
 * "subscription") — the first one that matches a real user category wins, and
 * the rest cost nothing.
 *
 * Precedence: the dictionary is only consulted for transactions the user's own
 * keywords left uncategorized (see the import pipeline). When a user approves a
 * dictionary suggestion in the review inbox, the matched pattern is promoted to
 * a real keyword (carrying the same match mode) on that category — so it stops
 * being a suggestion and starts auto-clearing on future imports.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO RULES WHEN EDITING THIS FILE
 *
 * 1. PRECEDENCE IS BY MATCH STRENGTH, NOT ARRAY ORDER. `matchGlobalDictionary`
 *    scores every matching entry with `patternRank` — the same mode tiering as
 *    the user's own keywords (exact > startsWith > contains), with the *longer*
 *    matched text winning ties within a mode — and keeps the best. So a specific
 *    merchant beats a generic parent on its own merits: "amazon prime"
 *    (Subscriptions) outranks "amazon" (Shopping) because it's a longer match,
 *    and "uber eats" (Restaurants) outranks "uber" (Rideshare) the same way —
 *    wherever the two entries sit. You do NOT need to hand-order specific-vs-
 *    generic pairs. (The BRAND SPLITS block below just groups them for reading.)
 *    Only genuine ties — same mode, same length, different category — fall back
 *    to array order, which is rare. One case no automatic rule fixes: a string
 *    like "MICROSOFT*XBOX" scores to Microsoft (longer match), not Xbox.
 *
 * 2. STEMS ARE SUBSTRING-MATCHED BOTH WAYS (see `nameMatchesStem`), so short or
 *    common stems create false positives. Landmines we deliberately avoid:
 *      - "fee"   → matches cof·FEE            (Bank fees stem is "bank")
 *      - "tax"   → matches TAX·i             (Taxes stem is "taxes")
 *      - "bar"   → matches BAR·ber           (Alcohol stem is "bars")
 *      - "air"   → matches h·AIR salon       (Flights stems are "flight"/"airline")
 *      - "car"   → matches child·CAR·e       (Auto stems are "auto"/"vehicle")
 *      - "app"   → matches APP·arel          (Software stem is "software")
 *    And in PATTERNS (matched against the bank description), we avoid bare
 *    tokens that live inside unrelated merchants:
 *      - "apple" → APPLE·bee's              (use "apple store"/"apple.com")
 *      - "gap"   → sin·GAP·ore              (use startsWith)
 *      - "express" → american EX·PRESS      (dropped)
 *      - "bell"  → taco BELL                (use "bell canada"/"bell mobility")
 *      - "shaw"  → SHAW·arma                (use "shaw mobile"/"shaw cable")
 *      - "united"/"american"/"delta"/"spirit"/"frontier"/"alaska" → too broad
 *        for airlines (use "…airlines"/"delta air"/"frontier air", etc.)
 */

import type { Keyword } from "@/lib/db/types";
import { matchesKeyword, MODE_SPECIFICITY } from "@/lib/categories/keyword";

export interface GlobalEntry {
  /** Matched (case-insensitive, mode-aware) against a transaction's matchField. */
  patterns: Keyword[];
  /** Lowercase category-name stems fuzzy-matched against the user's category names. */
  categoryStems: string[];
}

const contains = (text: string): Keyword => ({ text, mode: "contains" });
const startsWith = (text: string): Keyword => ({ text, mode: "startsWith" });

/** Build an entry from a stem list + any number of `contains` merchant strings. */
const c = (stems: readonly string[], ...texts: string[]): GlobalEntry => ({
  patterns: texts.map(contains),
  categoryStems: [...stems],
});

/**
 * Category-name stems, reused across entries. Each list is tried against the
 * user's category names in order; the first that resolves wins. Kept long
 * enough to dodge the substring landmines documented at the top of the file.
 */
const STEMS = {
  groceries: ["grocer", "supermarket"],
  restaurants: ["restaurant", "dining", "food"],
  coffee: ["coffee", "cafe", "dining", "restaurant"],
  gas: ["gas", "fuel", "gasoline", "transport"],
  rideshare: ["rideshare", "taxi", "transport"],
  transit: ["transit", "transport", "commut"],
  parking: ["parking", "transport"],
  tolls: ["toll", "transport", "commut"],
  auto: ["auto", "vehicle"],
  streaming: ["stream", "entertain", "subscription"],
  subscription: ["subscription", "software"],
  music: ["music", "subscription"],
  gaming: ["gaming", "game"],
  shopping: ["shopping", "retail", "merchandise"],
  clothing: ["cloth", "apparel", "shoe", "footwear"],
  electronics: ["electronic", "tech", "gadget"],
  hardware: ["hardware", "home improv", "renovation"],
  furniture: ["furnitur", "home decor", "home good", "household"],
  pharmacy: ["pharmac", "drug"],
  health: ["health", "medical", "doctor", "dental"],
  fitness: ["fitness", "gym", "workout"],
  utilities: ["utilit", "hydro", "electric"],
  telecom: ["internet", "phone", "mobile", "telecom", "cell", "wireless"],
  insurance: ["insurance"],
  banking: ["bank", "finance charge"],
  investments: ["invest", "brokerage", "trading", "crypto"],
  travel: ["travel", "vacation", "trip"],
  flights: ["flight", "airfare", "airline"],
  hotels: ["hotel", "lodging", "accommodation"],
  carRental: ["car rental", "rental car"],
  pets: ["pet"],
  kids: ["kid", "baby", "child", "toys"],
  education: ["education", "school", "tuition", "learning"],
  charity: ["charit", "donation", "giving"],
  beauty: ["beauty", "salon", "personal care", "cosmetic", "hair"],
  alcohol: ["alcohol", "liquor", "bars", "beer", "wine"],
  convenience: ["convenience"],
  warehouse: ["warehouse", "wholesale", "grocer", "shopping"],
  taxes: ["taxes", "government"],
  books: ["book"],
  office: ["office"],
  entertainment: ["entertain", "movie", "event"],
  homeServices: ["home service", "handyman", "home repair", "maintenance", "contractor"],
  shipping: ["shipping", "postage", "courier", "mail"],
  micromobility: ["bike share", "scooter", "micromobility", "rideshare", "transport"],
  legal: ["legal", "lawyer", "attorney", "accounting", "accountant", "notary"],
  laundry: ["laundry", "dry clean"],
  storage: ["storage", "self storage"],
} as const;

export const GLOBAL_DICTIONARY: GlobalEntry[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // BRAND SPLITS — one brand billing under several categories. Grouped here for
  // reading only; the matcher resolves them by longest match, so their position
  // relative to the generic parents (Amazon, Apple, Uber, …) does not matter.
  // ══════════════════════════════════════════════════════════════════════════
  c(STEMS.groceries, "amazon fresh", "amazon go"),
  c(STEMS.streaming, "amazon prime video", "prime video"),
  c(STEMS.subscription, "amazon prime", "amazon web services"),
  c(STEMS.music, "amazon music"),
  c(STEMS.subscription, "audible"),

  // Apple: subscription / media / hardware. "apple.com/bill" (the common
  // subscription descriptor) outscores the "apple.com" hardware pattern below
  // because it's the longer match, so both resolve correctly.
  c(STEMS.music, "apple music"),
  c(STEMS.streaming, "apple tv"),
  c(STEMS.gaming, "apple arcade"),
  c(STEMS.fitness, "apple fitness"),
  c(STEMS.subscription, "apple.com/bill", "apple one", "icloud", "itunes"),

  // Google: no bare "google" (would swallow everything). Specific products only.
  c(STEMS.gaming, "google play"),
  c(STEMS.subscription, "google one", "google storage", "google workspace", "youtube premium"),
  c(STEMS.streaming, "youtube tv"),
  c(STEMS.music, "youtube music"),
  c(STEMS.telecom, "google fi", "google fiber"),

  c(STEMS.gaming, "xbox", "microsoft store games"),

  // Uber Eats (food delivery) vs. "uber" (rideshare) — split by longest match.
  c(STEMS.restaurants, "uber eats"),

  // ══════════════════════════════════════════════════════════════════════════
  // GROCERIES
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.groceries,
    // US
    "trader joe", "whole foods", "kroger", "publix", "safeway", "albertsons",
    "vons", "ralphs", "food lion", "harris teeter", "stop & shop", "wegmans",
    "aldi", "sprouts", "winco", "h-e-b", "heb ", "meijer", "hy-vee", "hyvee",
    "food 4 less", "king soopers", "fred meyer", "the fresh market", "shoprite",
    "acme market", "giant eagle", "giant food", "food city", "smart & final",
    "piggly wiggly", "grocery outlet", "market basket", "stater bros", "weis markets",
    "ingles market", "winn-dixie", "winn dixie", "lucky supermarket", "save mart",
    "raley's", "raleys", "schnucks", "jewel-osco", "jewel osco", "brookshire's",
    "brookshires", "foodland",
    // Canada
    "loblaw", "no frills", "real canadian superstore", "superstore", "sobeys",
    "freshco", "food basics", "fortinos", "zehrs", "save-on-foods", "save on foods",
    "longo", "farm boy", "t&t supermarket", "provigo", "your independent grocer",
    "valu-mart", "your independent", "nofrills", "thrifty foods", "buy-low foods",
    "quality foods", "co-op food",
    // generic descriptors
    "supermarket", "grocery",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // WAREHOUSE CLUBS  (before generic Shopping; also resolve to grocer/shopping)
  // ══════════════════════════════════════════════════════════════════════════
  c(STEMS.warehouse, "costco", "sam's club", "sams club", "bj's wholesale", "bjs wholesale", "wholesale club"),

  // ══════════════════════════════════════════════════════════════════════════
  // RESTAURANTS / FAST FOOD  (food-delivery apps route here too)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.restaurants,
    // delivery apps
    "doordash", "grubhub", "seamless", "postmates", "skip the dishes", "skipthedishes", "just eat", "menulog",
    // fast food
    "mcdonald", "burger king", "wendy", "taco bell", "kfc", "chick-fil-a", "chick fil a",
    "chipotle", "subway", "domino", "pizza hut", "papa john", "little caesar", "popeyes",
    "arby", "sonic drive", "dairy queen", "five guys", "in-n-out", "in n out", "whataburger",
    "panera", "panda express", "jack in the box", "carl's jr", "carls jr", "hardee",
    "wingstop", "raising cane", "jimmy john", "jersey mike", "culver", "shake shack",
    "white castle", "del taco", "el pollo loco", "qdoba", "moe's southwest", "firehouse subs",
    "zaxby", "bojangle", "checkers", "church's chicken", "long john silver", "a&w",
    "boston pizza", "swiss chalet", "harvey's", "mary brown", "tim hortons",
    "noodles & company", "noodles and company", "jamba juice", "smoothie king",
    "potbelly", "taco time", "freshii", "mucho burrito", "mr. sub", "mr sub",
    "pizza pizza", "sweetgreen", "cava grill", "chopt",
    "captain d's", "wingstreet",
    // sit-down chains
    "applebee", "olive garden", "red lobster", "outback", "texas roadhouse",
    "cheesecake factory", "buffalo wild wings", "ihop", "denny", "cracker barrel",
    "chili's", "tgi friday", "red robin", "ruby tuesday", "waffle house", "first watch",
    "the keg", "montana's", "kelsey", "east side mario", "milestones", "earls kitchen",
    "cactus club", "jack astor", "p.f. chang", "pf chang", "corner bakery",
    "corelife eatery", "boston market", "bonefish grill", "carrabba's", "yard house",
    "bj's restaurant", "hooters",
    // generic descriptors
    "restaurant", "pizza", "sushi", "steakhouse", "diner", "bistro", "grill",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // COFFEE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.coffee,
    "starbucks", "dunkin", "peet's coffee", "peets coffee", "dutch bros", "caribou coffee",
    "costa coffee", "second cup", "tim horton", "philz coffee", "blue bottle",
    "biggby coffee", "scooter's coffee", "la colombe", "stumptown coffee",
    "country style", "coffee time", "the coffee bean",
    "coffee", "espresso", "cafe",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // GAS / FUEL
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.gas,
    "shell", "chevron", "exxon", "mobil", "texaco", "marathon petro", "sunoco",
    "valero", "phillips 66", "conoco", "citgo", "speedway", "wawa", "sheetz",
    "quiktrip", "casey's", "circle k", "arco", "sinclair", "kwik trip", "kwik star",
    "racetrac", "race trac", "flying j", "pilot travel", "love's travel", "loves travel",
    "petro-canada", "petro canada", "petrocan", "esso", "husky", "ultramar", "mobil gas",
    "76 gas", "irving oil", "murphy usa", "murphy express", "on the run", "pioneer gas",
    "gas station", "fuel", "gasoline",
  ),
  // "bp" as startsWith (not contains) so it doesn't fire inside unrelated words.
  { patterns: [startsWith("bp")], categoryStems: [...STEMS.gas] },

  // ══════════════════════════════════════════════════════════════════════════
  // RIDESHARE / TAXI   (uber eats is a BRAND SPLIT above)
  // ══════════════════════════════════════════════════════════════════════════
  c(STEMS.rideshare, "uber", "lyft", "curb taxi", "yellow cab", "taxi", " cab "),

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC TRANSIT
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.transit,
    "amtrak", "via rail", "greyhound", "megabus", "flixbus", "go transit",
    "metrolinx", "presto fare", "translink", "compass card", "clipper card",
    "septa", "wmata", "nj transit", "caltrain", "sound transit", "bart ",
    "mta ", "path train", "ttc ", "sto ", "stm ", "oc transpo",
    "trimet", "muni metro", "king county metro", "chicago transit", "cta ",
    "bc transit", "calgary transit", "edmonton transit", "winnipeg transit",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // PARKING & TOLLS
  // ══════════════════════════════════════════════════════════════════════════
  c(STEMS.parking, "parkmobile", "spothero", "paybyphone", "impark", "laz parking",
    "parkwhiz", "premium parking", "green p", "diamond parking", "republic parking",
    "sp+ parking", "indigo parking", "central parking", "parking"),
  c(STEMS.tolls, "e-zpass", "ez pass", "fastrak", "sunpass", "407 etr", "toll ", "tolls"),

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO (parts, service, wash)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.auto,
    "autozone", "o'reilly auto", "oreilly auto", "advance auto", "napa auto", "pep boys",
    "jiffy lube", "valvoline", "midas", "meineke", "firestone", "goodyear", "discount tire",
    "les schwab", "carmax", "mr lube", "kal tire", "tires plus", "big o tires",
    "national tire", "grease monkey", "econo lube",
    "car wash", "oil change", "auto parts",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // STREAMING  (Netflix, etc. — Amazon/Apple/YouTube are BRAND SPLITS above)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.streaming,
    "netflix", "hulu", "disney plus", "disney+", "disneyplus", "hbo max", "hbomax",
    "peacock", "paramount", "discovery+", "discovery plus", "crunchyroll", "sling tv",
    "fubo", "starz", "showtime", "espn+", "espn plus", "crave", "britbox", "tubi",
    "mubi", "curiositystream", "shudder", "dazn", "acorn tv", "philo", "vudu",
    "plex pass", "amc+", "amc plus",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // MUSIC  (Apple/Amazon/YouTube Music are BRAND SPLITS above)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.music,
    "spotify", "tidal", "pandora", "soundcloud", "siriusxm", "sirius xm",
    "deezer", "iheartradio", "audiomack", "napster", "qobuz", "boomplay",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS / SOFTWARE (SaaS, AI, productivity, cloud, news)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.subscription,
    "adobe", "microsoft 365", "office 365", "microsoft", "dropbox", "notion",
    "evernote", "1password", "lastpass", "nordvpn", "expressvpn", "canva", "grammarly",
    "zoom.us", "zoom video", "slack", "linkedin premium", "github", "gitlab", "figma",
    "atlassian", "squarespace", "wix.com", "godaddy", "namecheap", "mailchimp",
    "docusign", "quickbooks", "intuit", "norton", "mcafee", "malwarebytes",
    "asana", "trello", "monday.com", "airtable", "zapier", "hubspot", "salesforce",
    "shopify", "webflow", "typeform", "calendly", "loom", "miro", "intercom",
    "zendesk", "freshbooks", "xero", "wave apps", "gusto payroll", "bamboohr",
    "replit", "vercel", "netlify", "digitalocean", "heroku", "cloudflare",
    // AI
    "openai", "chatgpt", "anthropic", "claude.ai", "perplexity", "midjourney", "cursor",
    "github copilot", "gemini advanced",
    // news / reading / creators
    "patreon", "substack", "medium.com", "nytimes", "ny times", "wall street journal",
    "wsj ", "washington post", "the athletic", "the economist", "onlyfans",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // GAMING  (Xbox/Apple Arcade/Google Play are BRAND SPLITS above)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.gaming,
    "playstation", "nintendo", "steam games", "steampowered", "valve", "epic games",
    "epicgames", "riot games", "blizzard", "battle.net", "electronic arts", "ea games",
    "ubisoft", "roblox", "minecraft", "twitch", "discord", "gamestop", "humble bundle",
    "rockstar games", "game pass", "geforce now", "nintendo eshop", "2k games",
    "square enix", "bandai namco", "capcom", "sega games", "warner bros games",
    "take-two interactive",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // GENERAL SHOPPING / RETAIL  ("amazon" is the generic parent; the more
  // specific Amazon brands are split out above and outrank it by length)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.shopping,
    "amazon", "walmart", "target", "ebay", "etsy", "aliexpress", "alibaba",
    "wayfair", "overstock", "kohl's", "kohls", "macy's", "macys", "nordstrom",
    "jcpenney", "jc penney", "dillard", "marshalls", "tj maxx", "tjmaxx", "t.j. maxx",
    "ross store", "homegoods", "home goods", "burlington", "saks", "bloomingdale",
    "neiman marcus", "dollar general", "dollar tree", "dollarama", "family dollar",
    "five below", "big lots", "canadian tire", "hudson's bay", "the bay", "winners",
    "homesense", "giant tiger", "qvc", "hsn", "temu", "wish.com", "aliexpress",
    "zappos", "groupon", "living social", "michaels store", "joann fabric",
    "hobby lobby", "party city", "spencer's gifts", "hot topic", "claire's",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // CLOTHING / APPAREL / FOOTWEAR
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.clothing,
    "nike", "adidas", "under armour", "lululemon", "old navy", "banana republic",
    "athleta", "h&m", "zara", "uniqlo", "forever 21", "forever21", "urban outfitters",
    "anthropologie", "american eagle", "aeropostale", "abercrombie", "hollister",
    "j crew", "j.crew", "ann taylor", "chico's", "talbots", "victoria's secret",
    "gymshark", "patagonia", "the north face", "columbia sportswear", "levi", "wrangler",
    "tommy hilfiger", "calvin klein", "ralph lauren", "guess", "primark", "shein",
    "asos", "boohoo", "fashion nova", "aritzia", "torrid", "lane bryant",
    "eddie bauer", "l.l.bean", "llbean", "ll bean", "duluth trading", "carhartt",
    "dickies", "champion apparel", "fila", "supreme.com", "brooks brothers",
    "men's wearhouse", "mens wearhouse", "jos a bank", "moores clothing",
    "mark's work wearhouse",
    // footwear
    "foot locker", "footlocker", "dsw", "famous footwear", "shoe carnival", "journeys",
    "vans", "converse", "skechers", "crocs", "timberland", "dr martens", "birkenstock",
    "new balance", "puma", "reebok", "asics", "aldo shoes",
  ),
  // "gap" as startsWith so it matches "GAP #123"/"GAP.COM" but not "sinGAPore".
  { patterns: [startsWith("gap")], categoryStems: [...STEMS.clothing] },

  // ══════════════════════════════════════════════════════════════════════════
  // ELECTRONICS  ("apple store"/"apple.com"; Apple media/subscriptions split above)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.electronics,
    "best buy", "bestbuy", "apple store", "apple.com", "micro center", "microcenter",
    "newegg", "b&h photo", "canada computers", "the source", "memory express",
    "dell.com", "hp.com", "lenovo", "samsung", "logitech", "gopro", "bose", "sonos",
    "nvidia", "razer", "canon", "nikon", "visions electronics", "fry's electronics",
    "frys electronics", "microsoft store", "asus store", "acer store", "jbl.com",
    "beats by dre", "garmin", "fitbit", "roku",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // HOME IMPROVEMENT / HARDWARE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.hardware,
    "home depot", "homedepot", "lowe's", "lowes", "menards", "ace hardware",
    "harbor freight", "tractor supply", "true value", "rona", "home hardware",
    "lee valley", "sherwin williams", "sherwin-williams", "benjamin moore",
    "floor & decor", "orchard supply", "do it best", "kent building supplies",
    "windsor plywood", "hardware",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // HOME GOODS / FURNITURE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.furniture,
    "ikea", "west elm", "pottery barn", "crate & barrel", "crate and barrel", "cb2",
    "williams sonoma", "williams-sonoma", "bed bath", "the brick", "leon's", "leons",
    "ashley homestore", "ashley furniture", "restoration hardware", "structube",
    "la-z-boy", "ethan allen", "room & board", "at home", "the container store",
    "sur la table", "wayfair", "bouclair", "article furniture", "burrow.com",
    "joybird", "world market", "cost plus world market",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // PHARMACY / DRUGSTORE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.pharmacy,
    "cvs", "walgreens", "rite aid", "riteaid", "duane reade", "shoppers drug mart",
    "shoppers drug", "rexall", "london drugs", "pharmasave", "jean coutu", "pharmaprix",
    "medicine shoppe", "familymeds",
    "pharmacy", "drug mart", "drugstore",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // HEALTH / MEDICAL
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.health,
    "quest diagnostic", "labcorp", "kaiser permanente", "minuteclinic", "one medical",
    "teladoc", "goodrx", "lenscrafters", "warby parker", "pearle vision", "america's best",
    "davita", "zocdoc", "hims.com", "hers.com", "ro.co", "curology",
    "clinic", "dental", "dentist", "orthodont", "optometr", "physiotherapy",
    "chiropract", "urgent care", "medical center", "family practice",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // FITNESS / GYM  (Apple Fitness is a BRAND SPLIT above)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.fitness,
    "planet fitness", "la fitness", "anytime fitness", "crossfit", "gold's gym",
    "golds gym", "equinox", "orangetheory", "orange theory", "lifetime fitness",
    "life time", "24 hour fitness", "ymca", "snap fitness", "f45", "pure barre",
    "soulcycle", "club pilates", "peloton", "goodlife fitness", "goodlife", "fit4less",
    "movati", "world gym", "blink fitness", "crunch fitness", "esporta",
    "barry's bootcamp", "title boxing", "ufc gym", "chuze fitness", "in-shape fitness",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITIES (power, gas, water, waste)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.utilities,
    "pg&e", "con edison", "coned", "duke energy", "dominion energy", "national grid",
    "southern california edison", "socalgas", "xcel energy", "dte energy", "ameren",
    "entergy", "florida power", "georgia power", "pepco", "pseg", "eversource",
    "reliant energy", "constellation energy", "direct energy", "just energy",
    "hydro quebec", "hydro-quebec", "bc hydro", "hydro one", "enmax", "epcor",
    "fortisbc", "toronto hydro", "alectra", "waste management", "republic services",
    "we energies", "avista utilities", "puget sound energy", "national fuel gas",
    "atmos energy", "nicor gas", "peoples gas",
    "water bill", "sewer", "sanitation",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // TELECOM / PHONE / INTERNET  (Google Fi is a BRAND SPLIT above)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.telecom,
    "verizon", "at&t", "t-mobile", "tmobile", "sprint", "comcast", "xfinity",
    "spectrum", "centurylink", "frontier comm", "optimum", "mediacom", "windstream",
    "metropcs", "metro by t-mobile", "cricket wireless", "boost mobile", "straight talk",
    "mint mobile", "us cellular", "starlink", "hughesnet", "viasat",
    "rogers", "telus", "fido", "koodo", "virgin plus", "freedom mobile",
    "videotron", "chatr", "public mobile", "lucky mobile", "teksavvy",
    "bell canada", "bell mobility", "bell mts", "shaw mobile", "shaw cable", "shaw internet",
    "consumer cellular", "visible wireless", "ting mobile", "tello mobile", "red pocket",
    "simple mobile",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // INSURANCE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.insurance,
    "geico", "progressive", "state farm", "allstate", "liberty mutual", "nationwide",
    "farmers ins", "usaa", "travelers ins", "aflac", "metlife", "prudential", "aetna",
    "cigna", "humana", "anthem", "blue cross", "blue shield", "sun life", "manulife",
    "canada life", "intact ins", "aviva", "belairdirect", "the co-operators", "wawanesa",
    "td insurance", "esurance", "the hartford", "erie insurance", "amica insurance",
    "chubb insurance", "safeco",
    "insurance",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // BANKING / FEES / MONEY TRANSFER
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.banking,
    "overdraft", "nsf fee", "service charge", "monthly maintenance", "atm fee",
    "atm withdrawal", "wire fee", "foreign transaction fee", "annual fee",
    "interest charge", "finance charge", "overlimit",
    "paypal", "venmo", "zelle", "cash app", "cashapp", "wise transfer", "western union",
    "moneygram", "e-transfer", "interac", "remitly", "moneris", "chime bank",
    "varo bank", "current bank", "greenlight card",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // INVESTMENTS / BROKERAGE / CRYPTO
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.investments,
    "robinhood", "fidelity", "vanguard", "charles schwab", "schwab", "etrade", "e*trade",
    "td ameritrade", "merrill", "morgan stanley", "webull", "sofi invest", "acorns",
    "betterment", "wealthfront", "m1 finance", "interactive brokers", "wealthsimple",
    "questrade", "coinbase", "kraken", "binance", "gemini exchange", "crypto.com",
    "public.com", "stash invest", "ally invest", "tastyworks", "moomoo", "etoro",
    "ndax", "shakepay", "bitbuy",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // FLIGHTS  (use full "…airlines"/"…air" — bare carrier words are too broad)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.flights,
    "delta air", "united airlines", "american airlines", "southwest airlines",
    "jetblue", "alaska airlines", "spirit airlines", "frontier airlines",
    "hawaiian airlines", "allegiant air", "sun country", "air canada", "westjet",
    "porter airlines", "flair airlines", "lufthansa", "british airways", "air france",
    "klm", "emirates", "qatar airways", "ryanair", "easyjet", "aeromexico",
    "icelandair", "turkish airlines", "singapore airlines", "cathay pacific",
    "china eastern", "china southern", "copa airlines", "avianca", "latam airlines",
    "volaris",
    "airlines", "air lines", "airline",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // HOTELS / LODGING
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.hotels,
    "marriott", "hilton", "hyatt", "holiday inn", "hampton inn", "hampton by hilton",
    "courtyard", "sheraton", "westin", "doubletree", "embassy suites", "ritz carlton",
    "ritz-carlton", "four seasons", "wyndham", "ramada", "days inn", "super 8",
    "motel 6", "best western", "la quinta", "comfort inn", "quality inn", "fairfield inn",
    "residence inn", "intercontinental", "radisson", "crowne plaza", "kimpton",
    "airbnb", "vrbo", "travelodge", "econo lodge", "red roof", "extended stay",
    "oyo rooms", "the standard hotel", "1 hotels", "aloft hotel", "element hotel",
    "w hotel", "st regis",
    "hotel", "motel",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // TRAVEL / OTAs
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.travel,
    "expedia", "booking.com", "priceline", "kayak", "orbitz", "travelocity",
    "hotwire", "tripadvisor", "hopper", "trivago", "costco travel",
    "google flights", "skyscanner", "cheapoair", "getyourguide", "viator",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // CAR RENTAL  (use "…rent"/"…car rental" — bare "budget"/"national" too broad)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.carRental,
    "enterprise rent", "hertz", "avis", "budget rent", "budget car", "national car rental",
    "alamo rent", "thrifty car", "dollar rent", "sixt rent", "zipcar", "turo",
    "u-haul", "uhaul", "penske",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // PETS
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.pets,
    "petsmart", "petco", "chewy", "pet supplies plus", "pet valu", "petland",
    "global pet foods", "ren's pets", "barkbox", "bark box", "rover.com", "wag walking",
    "banfield", "vca ", "petflow", "only natural pet", "pet supermarket",
    "trupanion", "healthy paws",
    "veterinar", "animal hospital", "pet store",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // KIDS / BABY / CHILDCARE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.kids,
    "buybuy baby", "buy buy baby", "carter's", "carters", "oshkosh", "the children's place",
    "childrens place", "gymboree", "toys r us", "toysrus", "build-a-bear", "lego",
    "fisher price", "babylist", "kindercare", "la petite academy", "primrose school",
    "montessori", "melissa & doug", "step2", "kidkraft", "stride rite",
    "daycare", "childcare",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // EDUCATION
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.education,
    "coursera", "udemy", "udacity", "skillshare", "masterclass", "khan academy",
    "chegg", "duolingo", "pearson", "mcgraw hill", "nelnet", "sallie mae", "kaplan",
    "princeton review", "kumon", "sylvan learning", "quizlet", "brilliant.org",
    "codecademy", "outschool", "varsity tutors", "wyzant", "edx.org",
    "tuition", "university", "college", "student loan",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // CHARITY / DONATIONS
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.charity,
    "red cross", "salvation army", "unicef", "united way", "st jude", "st. jude",
    "doctors without borders", "world vision", "habitat for humanity", "feeding america",
    "aspca", "humane society", "planned parenthood", "world wildlife", "sierra club",
    "gofundme", "donorbox", "charity", "donation",
  ),
  c(["charit", "donation", "thrift", "shopping"], "goodwill", "value village", "savers thrift"),

  // ══════════════════════════════════════════════════════════════════════════
  // BEAUTY / PERSONAL CARE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.beauty,
    "sephora", "ulta beauty", "ulta ", "sally beauty", "mac cosmetics", "bath & body works",
    "bath and body works", "the body shop", "lush", "sport clips", "great clips",
    "supercuts", "fantastic sams", "european wax", "drybar", "massage envy",
    "hand & stone", "aveda", "glossier", "dermalogica", "olaplex", "e.l.f. cosmetics",
    "elf cosmetics", "nyx cosmetics", "fenty beauty", "the ordinary skincare",
    "salon", "barber", "nail salon", "day spa",
    "haircut",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // ALCOHOL / LIQUOR / BARS
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.alcohol,
    "total wine", "bevmo", "abc fine wine", "spec's", "binny's", "lcbo", "the beer store",
    "beer store", "saq ", "wine rack", "drizly", "minibar delivery", "party source",
    "liquor store", "liquor", "brewery", "brewing co",
    "distillery", "winery", "tavern", "taproom", "bottle shop",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE STORES
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.convenience,
    "7-eleven", "7 eleven", "seven eleven", "couche-tard", "couche tard", "cumberland farms",
    "royal farms", "am/pm", "ampm", "mac's convenience", "quickie", "loop neighborhood",
    "stripes convenience", "convenience store",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // TAXES / GOVERNMENT
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.taxes,
    "irs ", "internal revenue", "canada revenue", "revenue canada", "cra ", "us treasury",
    "franchise tax", "dept of revenue", "property tax", "turbotax", "h&r block", "hr block",
    "jackson hewitt", "liberty tax", "freetaxusa",
    "service ontario", "service canada", "dmv ", "passport",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // BOOKS
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.books,
    "barnes & noble", "barnes and noble", "books-a-million", "half price books",
    "indigo", "chapters", "coles books", "thriftbooks", "abebooks", "kobo",
    "powell's books", "strand book store", "waterstones", "book depository",
    "bookstore",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // OFFICE SUPPLIES
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.office,
    "staples", "office depot", "officemax", "office max", "quill.com", "uline",
    "w.b. mason", "grand & toy", "vistaprint", "moo.com",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // ENTERTAINMENT (movies, events, ticketing)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.entertainment,
    "amc theat", "regal cinema", "cinemark", "cineplex", "landmark cinema",
    "marcus theat", "alamo drafthouse", "fandango", "atom tickets", "ticketmaster",
    "stubhub", "live nation", "seatgeek", "eventbrite", "vivid seats", "dave & buster",
    "topgolf", "imax", "showclix", "axs.com", "bowlero", "main event entertainment",
    "chuck e cheese", "round1 entertainment",
    "cinema", "movie theat", "playhouse",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // HOME SERVICES / REPAIR (contractors, cleaning, pest control, security, movers)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.homeServices,
    "angi.com", "angie's list", "homeadvisor", "thumbtack", "taskrabbit",
    "adt security", "simplisafe", "vivint", "terminix", "orkin", "rentokil",
    "mr. rooter", "mr rooter", "roto-rooter", "rotorooter", "servicemaster",
    "molly maid", "merry maids", "the maids", "handy.com",
    "two men and a truck", "pods moving", "u-pack", "allied van lines",
    "north american van lines", "mayflower moving", "ars rescue rooter",
    "stanley steemer", "chem-dry", "trugreen", "lawn doctor", "scotts lawn",
    "1-800-got-junk", "1800gotjunk", "got junk", "junk removal", "puls tech",
    "porch.com", "networx",
    "plumbing", "plumber", "electrician", "hvac", "exterminator", "pest control",
    "landscaping", "lawn care", "locksmith", "roofing", "roofer",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // SHIPPING / POSTAGE / COURIER
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.shipping,
    "usps", "fedex", "ups store", "dhl", "canada post", "purolator",
    "the ups store", "stamps.com", "pitney bowes", "shipstation",
    "postage", "courier",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // BIKE / SCOOTER SHARE (micromobility — Uber/Lyft rideshare split above)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.micromobility,
    "citi bike", "citibike", "bixi", "lime bike", "limebike", "bird rides",
    "spin scooter", "veo ride", "jump bike", "capital bikeshare", "divvy bike",
    "helbiz",
    "bike share", "scooter share",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // LEGAL / PROFESSIONAL SERVICES  (H&R Block/TurboTax already under Taxes)
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.legal,
    "legalzoom", "rocket lawyer", "avvo.com", "legalshield", "law office", "law firm",
    "law group", "notary public", "cpa firm", "attorney at law",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // LAUNDRY / DRY CLEANING
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.laundry,
    "dry cleaners", "dry cleaning", "laundromat", "laundry service", "zips cleaners",
    "tide cleaners", "wash n fold",
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // SELF STORAGE
  // ══════════════════════════════════════════════════════════════════════════
  c(
    STEMS.storage,
    "public storage", "extra space storage", "cubesmart", "life storage",
    "u-haul storage", "storagemart", "simply self storage", "sparefoot",
  ),
];

/** A user category the dictionary can resolve a merchant to. */
export interface DictionaryTarget {
  uuid: string;
  name: string;
}

export interface GlobalMatch {
  /** uuid of the user category the merchant resolves to. */
  categoryUuid: string;
  /** The clean merchant pattern that matched — promoted to a keyword on approval. */
  pattern: string;
  /** The matched pattern's mode — carried over when promoting to a user keyword. */
  mode: Keyword["mode"];
}

/**
 * Fuzzy name match: true if either string contains the other (case-insensitive).
 * Stems are kept short (e.g. "grocer") so plural/variant names all match.
 */
function nameMatchesStem(categoryName: string, stem: string): boolean {
  const name = categoryName.toLowerCase();
  const s = stem.toLowerCase();
  return name.includes(s) || s.includes(name);
}

/**
 * A matched pattern's precedence, using the same tiering as the user's own
 * keywords (`MODE_SPECIFICITY` in `lib/categories/keyword.ts`): a more specific
 * *mode* wins first (exact > startsWith > contains), and ties within a mode
 * break on the *longer* matched text. Length is what separates same-mode
 * siblings like "amazon" / "amazon prime" / "amazon prime video" — the more
 * specific merchant is always the longer string.
 */
function patternRank(p: Keyword): [number, number] {
  return [MODE_SPECIFICITY[p.mode], p.text.length];
}

/** Strict "a outranks b" on (specificity, then length). */
function outranks(a: [number, number], b: [number, number]): boolean {
  return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
}

/**
 * Find a global-dictionary suggestion for a transaction.
 *
 * Scans every entry, and among all that both pattern-match the transaction and
 * resolve to a user category, returns the single highest-ranked match by
 * `patternRank` — NOT the first in array order. This is why the merchant lists
 * below don't need careful ordering: "amazon prime" beats "amazon" because it's
 * a longer match, wherever the two entries happen to sit. On an exact tie the
 * earlier entry wins (stable), so array order is only ever a last-resort
 * tiebreak. Returns null if the merchant is unknown or the user has no
 * matching-named category.
 */
export function matchGlobalDictionary(
  matchField: string,
  userCategories: DictionaryTarget[]
): GlobalMatch | null {
  let best: GlobalMatch | null = null;
  let bestRank: [number, number] | null = null;

  for (const entry of GLOBAL_DICTIONARY) {
    // The most specific / longest of this entry's own patterns that matches.
    let matched: Keyword | null = null;
    for (const p of entry.patterns) {
      if (matchesKeyword(matchField, p) && (!matched || outranks(patternRank(p), patternRank(matched)))) {
        matched = p;
      }
    }
    if (!matched) continue;

    // Merchant is known; only counts if it resolves to a user category.
    const target = userCategories.find((cat) =>
      entry.categoryStems.some((stem) => nameMatchesStem(cat.name, stem))
    );
    if (!target) continue;

    const rank = patternRank(matched);
    if (!bestRank || outranks(rank, bestRank)) {
      best = { categoryUuid: target.uuid, pattern: matched.text, mode: matched.mode };
      bestRank = rank;
    }
  }

  return best;
}
