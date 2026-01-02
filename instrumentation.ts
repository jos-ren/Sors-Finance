/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js on startup.
 * It runs database migrations and initializes the scheduler.
 */

export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Import dynamically to avoid issues in edge runtime
      const { runMigrations } = await import("./lib/db/migrate");
      const { initScheduler } = await import("./lib/scheduler");

      // Run migrations
      await runMigrations();

      // Initialize scheduler (only in production)
      await initScheduler();
    } catch (error) {
      console.error("[Instrumentation] Failed to initialize:", error);
    }
  }
}
