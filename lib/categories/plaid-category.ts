/**
 * Plaid personal finance categories → the user's own categories.
 *
 * Plaid tags each transaction with a category such as
 * FOOD_AND_DRINK / FOOD_AND_DRINK_FAST_FOOD. The import pipeline uses it as a
 * last-resort suggestion (after the user's keywords and the global merchant
 * dictionary), resolved by fuzzy category-name stems exactly like the
 * dictionary. Suggestions always land in the review inbox, never auto-clear.
 *
 * Transfers and loan payments are left out: Plaid can't tell a TFSA top-up
 * from a credit card payment, so a guess would do more harm than good.
 */

import { STEMS, resolveStems, type DictionaryTarget } from "@/lib/categories/global-dictionary";
import type { TransactionDetails } from "@/lib/db/types";

type PlaidCategory = NonNullable<TransactionDetails["plaidCategory"]>;

/** Detailed category → stems. Checked before the primary fallback. */
const DETAILED: Record<string, readonly string[]> = {
  FOOD_AND_DRINK_GROCERIES: STEMS.groceries,
  FOOD_AND_DRINK_COFFEE: STEMS.coffee,
  FOOD_AND_DRINK_FAST_FOOD: STEMS.restaurants,
  FOOD_AND_DRINK_RESTAURANT: STEMS.restaurants,
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: STEMS.alcohol,
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: STEMS.clothing,
  GENERAL_MERCHANDISE_ELECTRONICS: STEMS.electronics,
  GENERAL_MERCHANDISE_PHARMACIES_AND_SUPPLEMENTS: STEMS.pharmacy,
  GENERAL_MERCHANDISE_PET_SUPPLIES: STEMS.pets,
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: STEMS.books,
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: STEMS.office,
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: STEMS.convenience,
  GENERAL_MERCHANDISE_SUPERSTORES: STEMS.warehouse,
  HOME_IMPROVEMENT_HARDWARE: STEMS.hardware,
  HOME_IMPROVEMENT_FURNITURE: STEMS.furniture,
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: STEMS.homeServices,
  ENTERTAINMENT_TV_AND_MOVIES: STEMS.streaming,
  ENTERTAINMENT_MUSIC_AND_AUDIO: STEMS.music,
  ENTERTAINMENT_VIDEO_GAMES: STEMS.gaming,
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: STEMS.fitness,
  PERSONAL_CARE_HAIR_AND_BEAUTY: STEMS.beauty,
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: STEMS.laundry,
  GENERAL_SERVICES_INSURANCE: STEMS.insurance,
  GENERAL_SERVICES_EDUCATION: STEMS.education,
  GENERAL_SERVICES_POSTAGE_AND_SHIPPING: STEMS.shipping,
  GENERAL_SERVICES_STORAGE: STEMS.storage,
  GENERAL_SERVICES_AUTOMOTIVE: STEMS.auto,
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: STEMS.charity,
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: STEMS.taxes,
  TRANSPORTATION_GAS: STEMS.gas,
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: STEMS.rideshare,
  TRANSPORTATION_PUBLIC_TRANSIT: STEMS.transit,
  TRANSPORTATION_PARKING: STEMS.parking,
  TRANSPORTATION_TOLLS: STEMS.tolls,
  TRAVEL_FLIGHTS: STEMS.flights,
  TRAVEL_LODGING: STEMS.hotels,
  TRAVEL_RENTAL_CARS: STEMS.carRental,
  RENT_AND_UTILITIES_TELEPHONE: STEMS.telecom,
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: STEMS.telecom,
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: STEMS.utilities,
  RENT_AND_UTILITIES_WATER: STEMS.utilities,
  RENT_AND_UTILITIES_RENT: ["rent", "housing"],
  BANK_FEES_OVERDRAFT_FEES: STEMS.banking,
  BANK_FEES_ATM_FEES: STEMS.banking,
  BANK_FEES_INTEREST_CHARGE: STEMS.banking,
  BANK_FEES_OTHER_BANK_FEES: STEMS.banking,
};

/** Primary category → stems, used when the detailed one has no mapping. */
const PRIMARY: Record<string, readonly string[]> = {
  INCOME: ["income", "salary", "paycheck"],
  FOOD_AND_DRINK: STEMS.restaurants,
  ENTERTAINMENT: STEMS.entertainment,
  GENERAL_MERCHANDISE: STEMS.shopping,
  HOME_IMPROVEMENT: STEMS.hardware,
  MEDICAL: STEMS.health,
  PERSONAL_CARE: STEMS.beauty,
  TRANSPORTATION: ["transport", ...STEMS.gas],
  TRAVEL: STEMS.travel,
  RENT_AND_UTILITIES: STEMS.utilities,
  BANK_FEES: STEMS.banking,
};

/** Plaid's guesses below these levels are too noisy to suggest. */
const TRUSTED_CONFIDENCE = new Set(["VERY_HIGH", "HIGH"]);

/** Suggest a user category for a Plaid category, or null when unsure. */
export function matchPlaidCategory(
  category: PlaidCategory | null | undefined,
  userCategories: DictionaryTarget[]
): DictionaryTarget | null {
  if (!category) return null;
  if (category.confidence && !TRUSTED_CONFIDENCE.has(category.confidence)) return null;
  const detailed = DETAILED[category.detailed];
  const fromDetailed = detailed ? resolveStems(detailed, userCategories) : null;
  if (fromDetailed) return fromDetailed;
  const primary = PRIMARY[category.primary];
  return primary ? resolveStems(primary, userCategories) : null;
}

/** "FOOD_AND_DRINK_FAST_FOOD" under "FOOD_AND_DRINK" → "Fast food". */
export function formatPlaidCategory(category: PlaidCategory): string {
  const tail = category.detailed.startsWith(`${category.primary}_`)
    ? category.detailed.slice(category.primary.length + 1)
    : category.detailed || category.primary;
  const words = tail.toLowerCase().replace(/_/g, " ").replace(/\band\b/g, "&");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
