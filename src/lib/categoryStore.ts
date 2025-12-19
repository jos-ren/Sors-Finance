import { Category, CategoryStore } from "./types";

const STORAGE_KEY = "bank-categorizer-categories";

/**
 * Default sample categories for first-time users
 */
const DEFAULT_CATEGORIES: Category[] = [
  {
    id: crypto.randomUUID(),
    name: "Groceries",
    keywords: ["LOBLAWS", "METRO", "SOBEYS", "FARM BOY", "WALMART", "COSTCO"],
  },
  {
    id: crypto.randomUUID(),
    name: "Dining & Restaurants",
    keywords: [
      "RESTAURANT",
      "MCDONALD",
      "TIM HORTONS",
      "STARBUCKS",
      "SUBWAY",
      "PIZZA",
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "Gas & Transportation",
    keywords: [
      "SHELL",
      "ESSO",
      "PETRO",
      "CANADIAN TIRE GAS",
      "UBER",
      "LYFT",
      "PRESTO",
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "Subscriptions",
    keywords: [
      "NETFLIX",
      "SPOTIFY",
      "DISNEY",
      "AMAZON PRIME",
      "APPLE.COM",
      "GOOGLE",
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "Shopping",
    keywords: ["AMAZON", "AMZN MKTP", "BEST BUY", "HOME DEPOT", "IKEA"],
  },
  {
    id: crypto.randomUUID(),
    name: "Utilities & Bills",
    keywords: [
      "ROGERS",
      "BELL",
      "TELUS",
      "HYDRO",
      "ENBRIDGE",
      "INSURANCE",
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "Healthcare",
    keywords: [
      "PHARMACY",
      "SHOPPERS",
      "REXALL",
      "MEDICAL",
      "DENTAL",
      "CLINIC",
    ],
  },
];

/**
 * Load categories from localStorage
 * Returns default categories if none exist
 */
export function loadCategories(): Category[] {
  if (typeof window === "undefined") {
    return DEFAULT_CATEGORIES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First time user - save and return defaults
      saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }

    const data: CategoryStore = JSON.parse(stored);
    return data.categories || DEFAULT_CATEGORIES;
  } catch (error) {
    console.error("Error loading categories from localStorage:", error);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Save categories to localStorage
 */
export function saveCategories(categories: Category[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const data: CategoryStore = { categories };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving categories to localStorage:", error);
  }
}

/**
 * Add a new category
 */
export function addCategory(
  categories: Category[],
  name: string,
  keywords: string[] = []
): Category[] {
  const newCategory: Category = {
    id: crypto.randomUUID(),
    name,
    keywords,
  };

  const updated = [...categories, newCategory];
  saveCategories(updated);
  return updated;
}

/**
 * Update an existing category
 */
export function updateCategory(
  categories: Category[],
  id: string,
  updates: Partial<Omit<Category, "id">>
): Category[] {
  const updated = categories.map((cat) =>
    cat.id === id ? { ...cat, ...updates } : cat
  );
  saveCategories(updated);
  return updated;
}

/**
 * Delete a category
 */
export function deleteCategory(categories: Category[], id: string): Category[] {
  const updated = categories.filter((cat) => cat.id !== id);
  saveCategories(updated);
  return updated;
}

/**
 * Add a keyword to a category
 */
export function addKeywordToCategory(
  categories: Category[],
  categoryId: string,
  keyword: string
): Category[] {
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) return categories;

  const updated = categories.map((cat) => {
    if (cat.id === categoryId) {
      // Avoid duplicates (case-insensitive)
      const exists = cat.keywords.some(
        (k) => k.toLowerCase() === trimmedKeyword.toLowerCase()
      );
      if (!exists) {
        return {
          ...cat,
          keywords: [...cat.keywords, trimmedKeyword],
        };
      }
    }
    return cat;
  });

  saveCategories(updated);
  return updated;
}

/**
 * Remove a keyword from a category
 */
export function removeKeywordFromCategory(
  categories: Category[],
  categoryId: string,
  keyword: string
): Category[] {
  const updated = categories.map((cat) => {
    if (cat.id === categoryId) {
      return {
        ...cat,
        keywords: cat.keywords.filter((k) => k !== keyword),
      };
    }
    return cat;
  });

  saveCategories(updated);
  return updated;
}

/**
 * Reorder categories
 */
export function reorderCategories(
  categories: Category[],
  activeId: string,
  overId: string
): Category[] {
  const oldIndex = categories.findIndex((cat) => cat.id === activeId);
  const newIndex = categories.findIndex((cat) => cat.id === overId);

  if (oldIndex === -1 || newIndex === -1) {
    return categories;
  }

  const updated = [...categories];
  const [removed] = updated.splice(oldIndex, 1);
  updated.splice(newIndex, 0, removed);

  saveCategories(updated);
  return updated;
}
