import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

let container: StartedPostgreSqlContainer;

async function applySqlFile(pool: Pool, filename: string): Promise<void> {
  const contents = await readFile(
    path.resolve(process.cwd(), 'drizzle', filename),
    'utf8'
  );
  for (const statement of contents.split('--> statement-breakpoint')) {
    if (statement.trim()) await pool.query(statement);
  }
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('leveza_upgrade_test')
    .withUsername('test')
    .withPassword('test')
    .start();
});

afterAll(async () => {
  await container?.stop();
});

describe('Better Auth 1.4.10 to 1.7 schema migration', () => {
  it('backfills issuer identities without losing auth state or Google linkage', async () => {
    const pool = new Pool({ connectionString: container.getConnectionUri() });
    try {
      await applySqlFile(pool, '0000_init.sql');
      await applySqlFile(pool, '0001_schema.sql');
      await applySqlFile(pool, '0002_durable_billing.sql');

      await pool.query(`
        INSERT INTO "user"
          (id, name, email, email_verified, is_anonymous)
        VALUES
          ('anonymous-user', 'Anonymous', 'anon@example.test', false, true),
          ('authenticated-user', 'Person', 'person@example.test', true, false)
      `);
      await pool.query(`
        INSERT INTO "account"
          (id, account_id, provider_id, user_id, password, updated_at)
        VALUES
          ('credential', 'legacy-credential-key', 'credential',
           'authenticated-user', 'hash', now()),
          ('google', 'google-subject', 'google',
           'authenticated-user', null, now())
      `);
      await pool.query(`
        INSERT INTO "session"
          (id, expires_at, token, updated_at, user_id)
        VALUES
          ('anonymous-session', now() + interval '1 day', 'anon-token', now(),
           'anonymous-user'),
          ('authenticated-session', now() + interval '1 day', 'auth-token', now(),
           'authenticated-user')
      `);

      await applySqlFile(pool, '0003_schema.sql');

      const users = await pool.query(
        'SELECT id, is_anonymous FROM "user" ORDER BY id'
      );
      expect(users.rows).toEqual([
        { id: 'anonymous-user', is_anonymous: true },
        { id: 'authenticated-user', is_anonymous: false },
      ]);
      const accounts = await pool.query(`
        SELECT id, issuer, account_id, provider_id, user_id
        FROM "account"
        ORDER BY id
      `);
      expect(accounts.rows).toEqual([
        {
          id: 'credential',
          issuer: 'local:credential',
          account_id: 'authenticated-user',
          provider_id: 'credential',
          user_id: 'authenticated-user',
        },
        {
          id: 'google',
          issuer: 'https://accounts.google.com',
          account_id: 'google-subject',
          provider_id: 'google',
          user_id: 'authenticated-user',
        },
      ]);
      const sessions = await pool.query(
        'SELECT id, user_id FROM "session" ORDER BY id'
      );
      expect(sessions.rows).toEqual([
        { id: 'anonymous-session', user_id: 'anonymous-user' },
        { id: 'authenticated-session', user_id: 'authenticated-user' },
      ]);
    } finally {
      await pool.end();
    }
  });
});
