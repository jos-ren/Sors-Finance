/**
 * Plaid Client Utility
 * 
 * Creates and configures Plaid client instances from environment variables
 */

import { Configuration, PlaidApi } from "plaid";
import { getPlaidEnvironment, type PlaidEnvironmentType } from "./types";

/**
 * Get Plaid credentials from environment variables
 * @throws Error if credentials are not configured
 */
export function getPlaidCredentialsFromEnv(): {
  clientId: string;
  secret: string;
} {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error(
      "Plaid credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in your .env file."
    );
  }

  return { clientId, secret };
}

/**
 * Check if Plaid is configured
 */
export function isPlaidConfigured(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

/**
 * Create a Plaid client instance from environment variables
 * @param environment - Plaid environment (sandbox, development, production)
 */
export function createPlaidClient(
  environment: PlaidEnvironmentType = "sandbox"
): PlaidApi {
  const { clientId, secret } = getPlaidCredentialsFromEnv();

  const configuration = new Configuration({
    basePath: getPlaidEnvironment(environment),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

/**
 * Test Plaid credentials by making a simple API call
 */
export async function testPlaidCredentials(
  environment: PlaidEnvironmentType = "sandbox"
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPlaidConfigured()) {
      return {
        success: false,
        error: "Plaid credentials not configured in environment variables",
      };
    }

    const client = createPlaidClient(environment);
    
    // Use getCategories as a simple test call (doesn't require auth)
    await client.categoriesGet({});
    
    return { success: true };
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error_message?: string } }; message?: string };
    const errorMessage = err?.response?.data?.error_message || err.message || "Unknown error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
