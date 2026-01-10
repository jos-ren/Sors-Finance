import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { seedDefaultCategoriesForUser, seedDefaultSettingsForUser } from "@/lib/db/seed";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Username validation: 3-50 chars, alphanumeric + underscore only
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;

// POST /api/auth/register
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Validate username
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required", success: false },
        { status: 400 }
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-50 characters and contain only letters, numbers, and underscores",
          success: false,
        },
        { status: 400 }
      );
    }

    // Validate password
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required", success: false },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters", success: false },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .get();

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists", success: false },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate UUID and timestamps
    const uuid = randomUUID();
    const now = new Date();

    // Insert user
    const result = db
      .insert(schema.users)
      .values({
        uuid,
        username,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: schema.users.id,
        uuid: schema.users.uuid,
        username: schema.users.username,
      })
      .get();

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create user", success: false },
        { status: 500 }
      );
    }

    // Seed default categories and settings for the new user
    await seedDefaultCategoriesForUser(result.id);
    await seedDefaultSettingsForUser(result.id);

    // Create session
    const { token, expiresAt } = await createSession(db, result.id);

    // Create response and set cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: result.id,
        uuid: result.uuid,
        username: result.username,
      },
    });

    setSessionCookie(response, token, expiresAt);

    return response;
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Failed to register user", success: false },
      { status: 500 }
    );
  }
}
