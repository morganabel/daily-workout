import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { Pool } from 'pg';

import type { Database } from './client.js';
import { promoteAnonymousUserIdentity } from './auth-identity.js';
import * as schema from './schema.js';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let db: Database;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('workout_agent_auth_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionString = container.getConnectionUri();
  const migrationPool = new Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(migrationPool, { schema }), {
      migrationsFolder: path.resolve(process.cwd(), 'drizzle'),
    });
  } finally {
    await migrationPool.end();
  }

  pool = new Pool({ connectionString, max: 2 });
  db = drizzle(pool, { schema });
});

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE ${schema.account}, ${schema.session}, ${schema.user} CASCADE
  `);
});

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

async function seedIdentity(): Promise<void> {
  await db.insert(schema.user).values([
    {
      id: 'anonymous-user',
      name: 'Anonymous',
      email: 'anonymous@anonymous.workout-agent.local',
      emailVerified: false,
      isAnonymous: true,
    },
    {
      id: 'temporary-user',
      name: 'New User',
      email: 'new@example.test',
      emailVerified: true,
      isAnonymous: false,
    },
  ]);
  await db.insert(schema.account).values({
    id: 'credential-account',
    accountId: 'temporary-user',
    providerId: 'credential',
    userId: 'temporary-user',
    password: 'hashed-password',
  });
  await db.insert(schema.session).values({
    id: 'temporary-session',
    token: 'temporary-session-token',
    userId: 'temporary-user',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-04T00:00:00.000Z'),
  });
}

describe('anonymous auth identity promotion', () => {
  it('moves the credential and session while preserving the anonymous user id', async () => {
    await seedIdentity();

    const promoted = await promoteAnonymousUserIdentity(db, {
      anonymousUserId: 'anonymous-user',
      temporaryUserId: 'temporary-user',
      email: 'new@example.test',
      name: 'New User',
      emailVerified: true,
    });

    expect(promoted).toEqual(
      expect.objectContaining({
        id: 'anonymous-user',
        email: 'new@example.test',
        isAnonymous: false,
      })
    );
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, 'temporary-user'))
    ).resolves.toHaveLength(0);
    await expect(
      db
        .select({ userId: schema.account.userId })
        .from(schema.account)
        .where(eq(schema.account.id, 'credential-account'))
    ).resolves.toEqual([{ userId: 'anonymous-user' }]);
    await expect(
      db
        .select({ userId: schema.session.userId })
        .from(schema.session)
        .where(eq(schema.session.id, 'temporary-session'))
    ).resolves.toEqual([{ userId: 'anonymous-user' }]);
  });

  it('rolls back every reassignment when the final promotion fails', async () => {
    await seedIdentity();
    await db.insert(schema.user).values({
      id: 'email-owner',
      name: 'Email Owner',
      email: 'owned@example.test',
      emailVerified: true,
    });

    await expect(
      promoteAnonymousUserIdentity(db, {
        anonymousUserId: 'anonymous-user',
        temporaryUserId: 'temporary-user',
        email: 'owned@example.test',
        name: 'New User',
        emailVerified: true,
      })
    ).rejects.toThrow();

    await expect(
      db
        .select({ id: schema.user.id, isAnonymous: schema.user.isAnonymous })
        .from(schema.user)
        .where(eq(schema.user.id, 'anonymous-user'))
    ).resolves.toEqual([{ id: 'anonymous-user', isAnonymous: true }]);
    await expect(
      db
        .select({ id: schema.user.id, email: schema.user.email })
        .from(schema.user)
        .where(eq(schema.user.id, 'temporary-user'))
    ).resolves.toEqual([{ id: 'temporary-user', email: 'new@example.test' }]);
    await expect(
      db
        .select({ userId: schema.account.userId })
        .from(schema.account)
        .where(eq(schema.account.id, 'credential-account'))
    ).resolves.toEqual([{ userId: 'temporary-user' }]);
    await expect(
      db
        .select({ userId: schema.session.userId })
        .from(schema.session)
        .where(eq(schema.session.id, 'temporary-session'))
    ).resolves.toEqual([{ userId: 'temporary-user' }]);
  });
});
