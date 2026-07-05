/**
 * Default Budget Hierarchy — pure data (no DB imports).
 *
 * The zero-based starter budget seeded for new users (structure + keywords +
 * first-month planned amounts summing to $5,500). The same structure (without
 * amounts) is seeded for existing users during the hierarchy data migration.
 *
 * Kept dependency-free so it can be imported by both the seed (Drizzle) and the
 * data migration (raw better-sqlite3) without pulling in the DB connection.
 *
 * See docs/budget-system-strategy.md → "Default Budget for New Users".
 */

import type { BudgetItemType } from "./types";

export interface SeedBudgetItem {
  name: string;
  keywords: string[];
  /** First-month planned amount (only inserted when seeding with amounts). */
  defaultAmount: number;
  itemType?: BudgetItemType; // default 'expense'
  targetAmount?: number;
}

export interface SeedBudgetSubcategory {
  name: string;
  items: SeedBudgetItem[];
}

export interface SeedBudgetGroup {
  name: string;
  subcategories: SeedBudgetSubcategory[];
}

/**
 * The complete default budget. Amounts sum to $5,500 across all items.
 * Goal items (Savings → Emergency Fund and everything under Goals) carry an
 * `itemType: 'goal'` and an illustrative `targetAmount`.
 */
export const DEFAULT_BUDGET_HIERARCHY: SeedBudgetGroup[] = [
  {
    name: "Housing",
    subcategories: [
      {
        name: "Rent",
        items: [
          { name: "Apartment Rent", keywords: ["RENT", "LANDLORD", "PROPERTY MGMT"], defaultAmount: 1500 },
        ],
      },
      {
        name: "Utilities",
        items: [
          { name: "Hydro", keywords: ["HYDRO", "ELECTRIC", "PG&E", "POWER"], defaultAmount: 70 },
          { name: "Internet", keywords: ["COMCAST", "XFINITY", "SPECTRUM", "INTERNET", "FIBER"], defaultAmount: 80 },
          { name: "Tenant Insurance", keywords: ["TENANT INSURANCE", "RENTERS INSURANCE"], defaultAmount: 70 },
        ],
      },
    ],
  },
  {
    name: "Food",
    subcategories: [
      {
        name: "Groceries",
        items: [
          { name: "Groceries", keywords: ["WHOLE FOODS", "TRADER JOE", "KROGER", "WALMART", "COSTCO", "SAFEWAY", "PUBLIX", "ALDI"], defaultAmount: 500 },
        ],
      },
      {
        name: "Dining Out",
        items: [
          { name: "Restaurants", keywords: ["RESTAURANT", "MCDONALD", "CHIPOTLE", "DOORDASH", "UBER EATS", "GRUBHUB", "CHEESECAKE"], defaultAmount: 150 },
        ],
      },
      {
        name: "Coffee",
        items: [
          { name: "Coffee Shops", keywords: ["STARBUCKS", "DUNKIN", "TIM HORTONS", "COFFEE", "PEET"], defaultAmount: 50 },
        ],
      },
    ],
  },
  {
    name: "Transportation",
    subcategories: [
      {
        name: "Vehicle",
        items: [
          { name: "Fuel", keywords: ["CHEVRON", "EXXON", "SHELL", "BP", "PETRO", "ESSO", "GAS"], defaultAmount: 180 },
          { name: "Car Insurance", keywords: ["GEICO", "PROGRESSIVE", "ALLSTATE", "STATE FARM"], defaultAmount: 170 },
          { name: "Maintenance", keywords: ["AUTO", "JIFFY LUBE", "MIDAS", "MECHANIC", "TIRE"], defaultAmount: 80 },
        ],
      },
      {
        name: "Transit",
        items: [
          { name: "Public Transit", keywords: ["METRO TRANSIT", "TRANSIT", "UBER", "LYFT"], defaultAmount: 50 },
        ],
      },
    ],
  },
  {
    name: "Bills",
    subcategories: [
      {
        name: "Phone",
        items: [
          { name: "Cell Phone", keywords: ["VERIZON", "AT&T", "T-MOBILE", "ROGERS", "BELL", "TELUS"], defaultAmount: 80 },
        ],
      },
      {
        name: "Subscriptions",
        items: [
          { name: "Netflix", keywords: ["NETFLIX"], defaultAmount: 20 },
          { name: "Spotify", keywords: ["SPOTIFY"], defaultAmount: 15 },
          { name: "ChatGPT", keywords: ["OPENAI", "CHATGPT"], defaultAmount: 30 },
          { name: "iCloud", keywords: ["APPLE.COM", "ICLOUD"], defaultAmount: 15 },
        ],
      },
      {
        name: "Banking",
        items: [
          { name: "Credit Card Fee", keywords: ["ANNUAL FEE", "CARD FEE", "BANK FEE"], defaultAmount: 80 },
        ],
      },
    ],
  },
  {
    name: "Health",
    subcategories: [
      {
        name: "Fitness",
        items: [
          { name: "Gym Membership", keywords: ["GYM", "FITNESS", "PLANET FITNESS", "EQUINOX"], defaultAmount: 60 },
          { name: "Supplements", keywords: ["SUPPLEMENT", "GNC", "VITAMIN", "PHARMACY", "CVS", "WALGREENS"], defaultAmount: 40 },
        ],
      },
    ],
  },
  {
    name: "Pets",
    subcategories: [
      {
        name: "Dog",
        items: [
          { name: "Dog Food", keywords: ["PETSMART", "PETCO", "CHEWY", "DOG FOOD"], defaultAmount: 70 },
          { name: "Toys & Treats", keywords: ["PET TOY", "TREATS"], defaultAmount: 20 },
        ],
      },
      {
        name: "Vet",
        items: [
          { name: "Vet & Medication", keywords: ["VET", "VETERINARY", "ANIMAL HOSPITAL"], defaultAmount: 30 },
        ],
      },
    ],
  },
  {
    name: "Savings",
    subcategories: [
      {
        name: "Emergency Fund",
        items: [
          { name: "Emergency Fund", keywords: [], defaultAmount: 300, itemType: "goal", targetAmount: 10000 },
        ],
      },
      {
        name: "Retirement",
        items: [
          { name: "TFSA", keywords: ["TFSA"], defaultAmount: 300 },
          { name: "RRSP", keywords: ["RRSP"], defaultAmount: 200 },
        ],
      },
      {
        name: "Investing",
        items: [
          { name: "Index Funds", keywords: ["VANGUARD", "FIDELITY", "WEALTHSIMPLE", "INDEX"], defaultAmount: 300 },
        ],
      },
    ],
  },
  {
    name: "Goals",
    subcategories: [
      {
        name: "Travel",
        items: [
          { name: "Japan Trip", keywords: [], defaultAmount: 250, itemType: "goal", targetAmount: 4000 },
        ],
      },
      {
        name: "Electronics",
        items: [
          { name: "Mirrorless Camera", keywords: [], defaultAmount: 150, itemType: "goal", targetAmount: 2500 },
        ],
      },
      {
        name: "Home",
        items: [
          { name: "New Desk", keywords: [], defaultAmount: 160, itemType: "goal", targetAmount: 800 },
        ],
      },
    ],
  },
  {
    name: "Flexible Spending",
    subcategories: [
      {
        name: "Personal",
        items: [
          { name: "Personal Spending", keywords: ["TARGET", "BEST BUY", "IKEA", "NORDSTROM"], defaultAmount: 200 },
        ],
      },
      {
        name: "Fun",
        items: [
          { name: "Fun Money", keywords: ["STEAM", "PLAYSTATION", "CINEMA", "MOVIE"], defaultAmount: 150 },
        ],
      },
      {
        name: "Miscellaneous",
        items: [
          { name: "Misc Purchases", keywords: ["AMAZON", "AMZN MKTP", "HOME DEPOT", "LOWES"], defaultAmount: 80 },
        ],
      },
      {
        name: "Buffer",
        items: [
          { name: "Unexpected Expenses", keywords: [], defaultAmount: 50 },
        ],
      },
    ],
  },
];
