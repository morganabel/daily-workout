/**
 * Better Auth instance (CLI-friendly)
 *
 * Better Auth's CLI (`npx @better-auth/cli ... --config <path>`) expects this file to export
 * an auth instance either as:
 * - a named export `auth`, or
 * - a default export
 *
 * IMPORTANT:
 * - Shared auth settings are imported from `@workout-agent-ce/server-auth` to prevent drift.
 * - If you run the Better Auth CLI directly, ensure `server-auth` is built first, or use:
 *   `npm run better-auth:generate`
 * - Runtime server wiring uses `auth-context.ts` for auth-mode selection and dependency injection.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  createBetterAuthOptions,
  getGoogleAuthConfig,
} from '@workout-agent-ce/server-auth';

// Provide sane defaults so the CLI can run without requiring a full env.
// (Better Auth requires a 32+ char secret.)
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://user:password@localhost:5432/workout_agent';
const BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  'dev-secret-dev-secret-dev-secret-dev-secret';
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

const trustedOrigins =
  process.env.TRUSTED_ORIGINS?.split(',').map((s) => s.trim()) ?? [];
const google = getGoogleAuthConfig();

// Create a minimal Drizzle instance for the adapter (no query is executed during CLI generate).
const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
const db = drizzle(pool);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  ...createBetterAuthOptions({
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    trustedOrigins,
    google,
  }),
});

export default auth;
