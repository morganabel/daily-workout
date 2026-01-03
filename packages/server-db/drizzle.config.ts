import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for database migrations
 *
 * Usage:
 *   npx drizzle-kit generate  # Generate migration files
 *   npx drizzle-kit migrate   # Run migrations
 *   npx drizzle-kit studio    # Open Drizzle Studio
 *
 * Requires DATABASE_URL environment variable.
 */
export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
