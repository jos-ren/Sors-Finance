/**
 * Plaid connection health.
 *
 * Plaid refreshes each Item in the background and records a failed login on
 * the Item itself. `/item/get` reads that state and is free (not tied to a
 * billed product), so we can learn a bank needs reconnecting before an import
 * or a billed `/accounts/balance/get` call fails.
 *
 * Checks are gated on the age of the user's last check, not on a clock: a
 * check missed while the app was closed simply runs on the next app load.
 */

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/connection";
import { createPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";

export type PlaidItemStatus = "active" | "login_required" | "error";

export interface PlaidItemHealth {
  id: number;
  institutionName: string;
  status: PlaidItemStatus;
  errorMessage: string | null;
}

export interface PlaidHealth {
  items: PlaidItemHealth[];
  /** When Plaid was last asked, or null if never. */
  checkedAt: string | null;
}

const CHECKED_AT_KEY = "PLAID_HEALTH_CHECKED_AT";

/** Background checks (app load, scheduler). */
export const HEALTH_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Right before an import or a balance sync. */
export const HEALTH_PRE_ACTION_MAX_AGE_MS = 30 * 60 * 1000;

/** One check per user at a time; app load and the import dialog can overlap. */
const inFlight = new Map<number, Promise<PlaidHealth>>();

/** Error codes that a Link update-mode login fixes. */
const LOGIN_CODES = new Set(["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "PENDING_DISCONNECT"]);

function toStatus(value: string): PlaidItemStatus {
  return value === "login_required" || value === "error" ? value : "active";
}

/** Map a Plaid error code to our status. */
export function statusForPlaidError(code: string | null | undefined): PlaidItemStatus {
  if (!code) return "active";
  return LOGIN_CODES.has(code) ? "login_required" : "error";
}

async function getCheckedAt(userId: number): Promise<string | null> {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(eq(schema.settings.userId, userId), eq(schema.settings.key, CHECKED_AT_KEY)))
    .limit(1);
  return row?.value ?? null;
}

async function setCheckedAt(userId: number, value: string): Promise<void> {
  const where = and(eq(schema.settings.userId, userId), eq(schema.settings.key, CHECKED_AT_KEY));
  const [row] = await db.select({ id: schema.settings.id }).from(schema.settings).where(where).limit(1);
  if (row) {
    await db.update(schema.settings).set({ value }).where(eq(schema.settings.id, row.id));
  } else {
    await db.insert(schema.settings).values({ userId, key: CHECKED_AT_KEY, value });
  }
}

/** Stored statuses only; no Plaid call. */
export async function getPlaidHealth(userId: number): Promise<PlaidHealth> {
  const items = await db
    .select({
      id: schema.plaidItems.id,
      institutionName: schema.plaidItems.institutionName,
      status: schema.plaidItems.status,
      errorMessage: schema.plaidItems.errorMessage,
    })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, userId));
  return {
    items: items.map((i) => ({ ...i, status: toStatus(i.status) })),
    checkedAt: await getCheckedAt(userId),
  };
}

async function runCheck(userId: number): Promise<PlaidHealth> {
  const items = await db.select().from(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));

  for (const item of items) {
    let status: PlaidItemStatus;
    let errorMessage: string | null = null;
    try {
      const client = createPlaidClient(item.environment as "sandbox" | "production");
      const { data } = await client.itemGet({ access_token: item.accessToken });
      status = statusForPlaidError(data.item.error?.error_code);
      errorMessage = data.item.error?.error_message ?? null;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error_code?: string; error_message?: string } }; message?: string };
      const plaidError = err.response?.data;
      if (!plaidError) {
        // Network trouble on our side says nothing about the bank; keep what we had
        continue;
      }
      status = statusForPlaidError(plaidError.error_code ?? "UNKNOWN");
      errorMessage = plaidError.error_message ?? err.message ?? null;
    }

    if (status !== item.status || errorMessage !== item.errorMessage) {
      await db
        .update(schema.plaidItems)
        .set({ status, errorMessage, updatedAt: new Date() })
        .where(eq(schema.plaidItems.id, item.id));
    }
  }

  await setCheckedAt(userId, new Date().toISOString());
  return getPlaidHealth(userId);
}

/**
 * Ask Plaid for each of the user's banks when the last check is older than
 * `maxAgeMs` (or always with `force`); otherwise return the stored statuses.
 */
export async function checkPlaidHealth(
  userId: number,
  { maxAgeMs = HEALTH_MAX_AGE_MS, force = false }: { maxAgeMs?: number; force?: boolean } = {}
): Promise<PlaidHealth> {
  const current = await getPlaidHealth(userId);
  if (current.items.length === 0 || !isPlaidConfigured()) return current;

  const age = current.checkedAt ? Date.now() - new Date(current.checkedAt).getTime() : Infinity;
  if (!force && age < maxAgeMs) return current;

  const running = inFlight.get(userId);
  if (running) return running;

  const promise = runCheck(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, promise);
  return promise;
}
