/**
 * Better Auth instance (CLI-friendly)
 *
 * Better Auth's CLI (`npx @better-auth/cli ... --config <path>`) expects this file to export
 * an auth instance either as:
 * - a named export `auth`, or
 * - a default export
 *
 * IMPORTANT:
 * - This file is intentionally self-contained (no workspace import aliases) to keep the CLI happy.
 * - Runtime server wiring uses `auth-context.ts` for auth-mode selection and dependency injection.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

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

// Create a minimal Drizzle instance for the adapter (no query is executed during CLI generate).
const client = postgres(DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(client);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    anonymous({
      emailDomainName: 'anonymous.workout-agent.local',
    }),
  ],
});

export default auth;

