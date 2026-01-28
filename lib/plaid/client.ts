/**
 * Plaid Client Utility
 * 
 * Creates and configures Plaid client instances with user credentials
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { getPlaidEnvironment, type PlaidCredentials } from "./types";

/**
 * Create a Plaid client instance with user credentials
 */
export function createPlaidClient(credentials: PlaidCredentials): PlaidApi {
  const configuration = new Configuration({
    basePath: getPlaidEnvironment(credentials.environment),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": credentials.clientId,
        "PLAID-SECRET": credentials.secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

/**
 * Test Plaid credentials by making a simple API call
 */
export async function testPlaidCredentials(
  credentials: PlaidCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createPlaidClient(credentials);
    
    // Use getCategories as a simple test call (doesn't require auth)
    await client.categoriesGet({});
    
    return { success: true };
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error_message || error.message || "Unknown error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
