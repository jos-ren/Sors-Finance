/**
 * Encryption Utility Module
 * 
 * Provides AES-256-GCM encryption/decryption for sensitive data like Plaid credentials.
 * Uses a single encryption key from environment variables.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variables
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PLAID_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      "PLAID_ENCRYPTION_KEY not found in environment variables. " +
      "Generate one with: openssl rand -hex 32"
    );
  }

  // Key should be 32 bytes (64 hex characters) for AES-256
  if (key.length !== 64) {
    throw new Error(
      "PLAID_ENCRYPTION_KEY must be 32 bytes (64 hex characters). " +
      "Generate with: openssl rand -hex 32"
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Encrypt a string value
 * @param plaintext - The value to encrypt
 * @returns Base64-encoded string in format: {iv}:{encryptedData}:{authTag}
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, encrypted data, and auth tag
  const combined = `${iv.toString("base64")}:${encrypted}:${authTag.toString("base64")}`;
  
  return combined;
}

/**
 * Decrypt a string value
 * @param encryptedValue - Base64-encoded string in format: {iv}:{encryptedData}:{authTag}
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedValue: string): string {
  const key = getEncryptionKey();
  
  // Split the combined value
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }
  
  const iv = Buffer.from(parts[0], "base64");
  const encryptedData = parts[1];
  const authTag = Buffer.from(parts[2], "base64");
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Check if encryption is configured properly
 * @returns true if PLAID_ENCRYPTION_KEY is set and valid
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
