/**
 * Session Cookie Utilities
 *
 * Handles setting, reading, and clearing session cookies for authentication.
 */

import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "sors_session";

/**
 * Cookie options for the session cookie.
 * @param expiresAt - If provided, creates a persistent cookie. If undefined, creates a session cookie.
 */
function getCookieOptions(expiresAt?: Date) {
  const options: {
    httpOnly: boolean;
    sameSite: "lax";
    path: string;
    expires?: Date;
  } = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  };

  // Only set expires for persistent cookies ("Remember me")
  // Without expires, it becomes a session cookie that expires when browser closes
  if (expiresAt) {
    options.expires = expiresAt;
  }

  return options;
}

/**
 * Set the session cookie on a response.
 * @param response - The NextResponse to set the cookie on
 * @param token - The session token
 * @param expiresAt - When the session expires. If undefined, creates a session cookie.
 */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt?: Date
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions(expiresAt));
}

/**
 * Get the session cookie value from a request.
 * @param request - The NextRequest to read the cookie from
 * @returns The session token if present, undefined otherwise
 */
export function getSessionCookie(request: NextRequest): string | undefined {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Clear the session cookie on a response.
 * @param response - The NextResponse to clear the cookie on
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
  });
}
