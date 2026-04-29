/**
 * Plaid-related type definitions
 */

import { PlaidEnvironments } from "plaid";

/**
 * Plaid environment configuration
 */
export type PlaidEnvironmentType = "sandbox" | "development" | "production";

/**
 * User's Plaid credentials stored in settings
 */
export interface PlaidCredentials {
  clientId: string;
  secret: string;
  environment: PlaidEnvironmentType;
}

/**
 * Plaid Item metadata (stored in plaid_items table)
 */
export interface PlaidItemData {
  id: number;
  uuid: string;
  userId: number;
  itemId: string; // Plaid's item_id
  accessToken: string; // Encrypted
  institutionId: string;
  institutionName: string;
  status: "active" | "login_required" | "error";
  lastSync?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plaid Account metadata (stored in plaid_accounts table)
 */
export interface PlaidAccountData {
  id: number;
  uuid: string;
  userId: number;
  plaidItemId: number; // Foreign key to plaid_items
  accountId: string; // Plaid's account_id
  name: string;
  officialName?: string;
  type: string; // 'depository', 'credit', 'investment', 'loan'
  subtype: string; // 'checking', 'savings', 'credit card', etc.
  mask?: string; // Last 4 digits
  portfolioAccountId?: number; // Foreign key to portfolio_accounts (nullable)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plaid transaction for import flow
 */
export interface PlaidTransactionImport {
  accountId: string;
  amount: number;
  date: string; // ISO date
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
  transactionId: string;
}

/**
 * Request body for fetching Plaid transactions
 */
export interface FetchPlaidTransactionsRequest {
  itemId: number; // Our internal plaid_items.id
  accountIds: string[]; // Plaid account IDs
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * Balance information from Plaid
 */
export interface PlaidBalance {
  accountId: string;
  current: number;
  available?: number;
  limit?: number;
  currency: string;
}

/**
 * Map Plaid account type to portfolio bucket
 */
export function mapPlaidTypeToPortfolioBucket(
  type: string,
  subtype: string,
  name?: string
): "Savings" | "Investments" | "Assets" | "Debt" {
  const nameLower = (name || "").toLowerCase();

  // Name-based keyword matching — catches cases where Plaid's type is too generic
  // (e.g. Canadian RRSP/TFSA returned as type="depository")
  const debtKeywords = [
    "credit card", "line of credit", "heloc", "mortgage", "loan",
    "visa", "mastercard", "amex", "american express",
  ];
  const investmentKeywords = [
    "rrsp", "tfsa", "resp", "fhsa", "rrif", "lira",
    "ira", "401k", "403b", "roth", "brokerage", "investment",
  ];
  const savingsKeywords = ["savings", "chequing", "checking", "hisa", "high interest"];

  if (debtKeywords.some((k) => nameLower.includes(k))) return "Debt";
  if (investmentKeywords.some((k) => nameLower.includes(k))) return "Investments";
  if (savingsKeywords.some((k) => nameLower.includes(k))) return "Savings";

  // Subtype-based mapping
  const subtypeLower = subtype.toLowerCase();
  if (["credit card", "paypal"].includes(subtypeLower)) return "Debt";
  if (["checking", "savings", "money market", "cd", "prepaid"].includes(subtypeLower)) return "Savings";
  if (["401k", "403b", "ira", "roth", "rrsp", "tfsa", "resp", "fhsa"].includes(subtypeLower)) return "Investments";

  // Type-based fallback
  switch (type) {
    case "depository":
      return "Savings";
    case "investment":
    case "brokerage":
      return "Investments";
    case "credit":
    case "loan":
      return "Debt";
    default:
      return "Assets";
  }
}

/**
 * Get Plaid environment URL
 */
export function getPlaidEnvironment(env: PlaidEnvironmentType): string {
  switch (env) {
    case "sandbox":
      return PlaidEnvironments.sandbox;
    case "development":
      return PlaidEnvironments.development;
    case "production":
      return PlaidEnvironments.production;
    default:
      return PlaidEnvironments.sandbox;
  }
}

/**
 * Settings keys for Plaid configuration
 */
export const PLAID_SETTINGS_KEYS = {
  // Single set of credentials (works for all environments)
  CLIENT_ID: "PLAID_CLIENT_ID",
  SECRET: "PLAID_SECRET",
  
  // Sync settings
  SYNC_WITH_SNAPSHOT: "PLAID_SYNC_WITH_SNAPSHOT", // New opt-in setting
  LAST_SYNC: "PLAID_LAST_SYNC",
} as const;

/**
 * Get settings keys (same for all environments now)
 */
export function getCredentialKeys(): {
  clientId: string;
  secret: string;
} {
  return {
    clientId: PLAID_SETTINGS_KEYS.CLIENT_ID,
    secret: PLAID_SETTINGS_KEYS.SECRET,
  };
}
