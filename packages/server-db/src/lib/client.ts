/**
 * Drizzle ORM client factory for PostgreSQL
 *
 * Exports factory functions to create a database client. No side effects at
 * import time. Supports both a standard connection string (local / self-hosted)
 * and the Google Cloud SQL Connector (Cloud Run), with autodetection via
 * createDbFromEnv().
 *
 * The Cloud SQL Connector is imported lazily so deployments that only use
 * DATABASE_URL never pull the GCP library into their module graph.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import type { Connector as CloudSqlConnector } from '@google-cloud/cloud-sql-connector';
import * as schema from './schema.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Options for creating a database connection from a connection string.
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

/** Alias of CreateDbOptions for local / self-hosted connections. */
export type LocalDbOptions = CreateDbOptions;

/**
 * Options for Cloud SQL connections (used on Cloud Run).
 */
export interface CloudSqlOptions {
  /**
   * Cloud SQL instance connection name (project:region:instance)
   */
  instanceConnectionName: string;

  /**
   * Database name
   */
  database: string;

  /**
   * Database user
   */
  user: string;

  /**
   * Database password
   */
  password: string;

  /**
   * Maximum number of connections in the pool (default: 10)
   */
  maxConnections?: number;
}

/**
 * Creates a Drizzle ORM database client connected to PostgreSQL via a
 * connection string.
 *
 * This is a factory function with no side effects at import time.
 *
 * @example
 * ```ts
 * const db = createDb({ connectionString: process.env.DATABASE_URL! });
 * ```
 */
export function createDb(options: CreateDbOptions): Database {
  const { connectionString, maxConnections = 10 } = options;

  const pool = new Pool({
    connectionString,
    max: maxConnections,
  });

  return drizzle(pool, { schema });
}

/** Alias of {@link createDb} for symmetry with {@link createCloudSqlDb}. */
export const createLocalDb = createDb;

// Singleton Cloud SQL connector - reused across connections.
let connectorInstance: CloudSqlConnector | null = null;

async function getConnector(): Promise<CloudSqlConnector> {
  if (!connectorInstance) {
    const { Connector } = await import('@google-cloud/cloud-sql-connector');
    connectorInstance = new Connector();
  }
  return connectorInstance;
}

/**
 * Creates a Drizzle ORM database client connected to Cloud SQL via the Google
 * Cloud SQL Connector. Use this when deploying to Cloud Run.
 *
 * @example
 * ```ts
 * const db = await createCloudSqlDb({
 *   instanceConnectionName: 'project:region:instance',
 *   database: 'mydb',
 *   user: 'myuser',
 *   password: 'mypassword',
 * });
 * ```
 */
export async function createCloudSqlDb(
  options: CloudSqlOptions
): Promise<Database> {
  const { IpAddressTypes, AuthTypes } = await import(
    '@google-cloud/cloud-sql-connector'
  );
  const connector = await getConnector();

  const clientOpts = await connector.getOptions({
    instanceConnectionName: options.instanceConnectionName,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.PASSWORD,
  });

  const poolConfig: PoolConfig = {
    ...clientOpts,
    user: options.user,
    password: options.password,
    database: options.database,
    max: options.maxConnections ?? 10,
  };

  return drizzle(new Pool(poolConfig), { schema });
}

/**
 * Creates a database client from environment variables, autodetecting the
 * deployment target:
 * - If INSTANCE_CONNECTION_NAME is set, uses the Cloud SQL Connector and reads
 *   DB_NAME / DB_USER / DB_PASSWORD.
 * - Otherwise, uses DATABASE_URL.
 *
 * @throws Error if the required environment variables are not set.
 */
export async function createDbFromEnv(): Promise<Database> {
  const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;

  if (instanceConnectionName) {
    // Cloud Run mode - use Cloud SQL Connector
    const database = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;

    if (!database || !user || !password) {
      throw new Error(
        'DB_NAME, DB_USER, and DB_PASSWORD environment variables are required when using INSTANCE_CONNECTION_NAME'
      );
    }

    return createCloudSqlDb({
      instanceConnectionName,
      database,
      user,
      password,
    });
  }

  // Local mode - use connection string
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL or INSTANCE_CONNECTION_NAME environment variable is required'
    );
  }

  return createDb({ connectionString });
}

/**
 * Closes the Cloud SQL Connector.
 * Call this during graceful shutdown to clean up resources.
 */
export function closeConnector(): void {
  if (connectorInstance) {
    connectorInstance.close();
    connectorInstance = null;
  }
}
