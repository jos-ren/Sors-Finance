// Dummy data for development and demonstration purposes

export interface ImportRecord {
  id: string;
  date: Date;
  source: string;
  fileName: string;
  transactionCount: number;
  totalAmount: number;
}

export interface MonthlySpending {
  month: string;
  income: number;
  expenses: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
  budget: number;
}

export interface BudgetItem {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  icon: string;
}

// Past import records for transactions page
export const dummyImports: ImportRecord[] = [
  {
    id: "1",
    date: new Date("2025-12-15"),
    source: "My Bank",
    fileName: "december-2025.csv",
    transactionCount: 45,
    totalAmount: 3250.75,
  },
  {
    id: "2",
    date: new Date("2025-12-01"),
    source: "Credit Card",
    fileName: "Summary-Nov-2025.xlsx",
    transactionCount: 32,
    totalAmount: 2180.50,
  },
  {
    id: "3",
    date: new Date("2025-11-15"),
    source: "My Bank",
    fileName: "november-2025.csv",
    transactionCount: 52,
    totalAmount: 4125.00,
  },
  {
    id: "4",
    date: new Date("2025-11-01"),
    source: "Credit Card",
    fileName: "Summary-Oct-2025.xlsx",
    transactionCount: 28,
    totalAmount: 1890.25,
  },
  {
    id: "5",
    date: new Date("2025-10-15"),
    source: "My Bank",
    fileName: "october-2025.csv",
    transactionCount: 61,
    totalAmount: 5200.00,
  },
];

// Monthly spending data for charts
export const monthlySpendingData: MonthlySpending[] = [
  { month: "Jul", income: 5200, expenses: 3800 },
  { month: "Aug", income: 5200, expenses: 4200 },
  { month: "Sep", income: 5400, expenses: 3600 },
  { month: "Oct", income: 5200, expenses: 4100 },
  { month: "Nov", income: 5600, expenses: 3900 },
  { month: "Dec", income: 5200, expenses: 4500 },
];

// Category spending for pie/bar charts
export const categorySpendingData: CategorySpending[] = [
  { category: "Groceries", amount: 650, budget: 800 },
  { category: "Dining", amount: 420, budget: 400 },
  { category: "Transport", amount: 280, budget: 300 },
  { category: "Shopping", amount: 520, budget: 200 },
  { category: "Subscriptions", amount: 180, budget: 200 },
  { category: "Utilities", amount: 350, budget: 400 },
];

// Budget items for budget page
export const budgetItems: BudgetItem[] = [
  {
    id: "1",
    category: "Groceries",
    budgeted: 800,
    spent: 650,
    icon: "ShoppingCart",
  },
  {
    id: "2",
    category: "Dining & Restaurants",
    budgeted: 400,
    spent: 420,
    icon: "UtensilsCrossed",
  },
  {
    id: "3",
    category: "Transportation",
    budgeted: 300,
    spent: 280,
    icon: "Car",
  },
  {
    id: "4",
    category: "Shopping",
    budgeted: 500,
    spent: 520,
    icon: "ShoppingBag",
  },
  {
    id: "5",
    category: "Subscriptions",
    budgeted: 200,
    spent: 180,
    icon: "Tv",
  },
  {
    id: "6",
    category: "Utilities & Bills",
    budgeted: 400,
    spent: 350,
    icon: "Lightbulb",
  },
  {
    id: "7",
    category: "Healthcare",
    budgeted: 150,
    spent: 85,
    icon: "Heart",
  },
  {
    id: "8",
    category: "Entertainment",
    budgeted: 250,
    spent: 190,
    icon: "Film",
  },
];

// Dashboard summary stats
export const dashboardStats = {
  totalIncome: 5200,
  totalExpenses: 4500,
  netSavings: 700,
  transactionCount: 127,
  topCategory: "Groceries",
  savingsRate: 13.5,
};
