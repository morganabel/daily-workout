/**
 * Drizzle ORM client factory for PostgreSQL
 *
 * This module exports a factory function to create a database client.
 * No side effects at import time - EE can call the factory at runtime.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Options for creating a database connection
 */
export interface CreateDbOptions {
  /**
   * PostgreSQL connection string (e.g., postgres://user:pass@host:5432/db)
   */
  connectionString: string;

  /**
   * Maximum number of connections in the pool (default: 10)
   */
  maxConnections?: number;
}

/**
 * Creates a Drizzle ORM database client connected to PostgreSQL.
 *
 * This is a factory function with no side effects at import time.
 * Call this function at application startup to initialize the database connection.
 *
 * @example
 * ```ts
 * const db = createDb({ connectionString: process.env.DATABASE_URL! });
 * ```
 */
export function createDb(options: CreateDbOptions): Database {
  const { connectionString, maxConnections = 10 } = options;

  const client = postgres(connectionString, {
    max: maxConnections,
    // Disable prepare statements for serverless environments
    prepare: false,
  });

  return drizzle(client, { schema });
}

/**
 * Creates a database client from environment variables.
 *
 * Requires DATABASE_URL to be set.
 *
 * @throws Error if DATABASE_URL is not set
 */
export function createDbFromEnv(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return createDb({ connectionString });
}
