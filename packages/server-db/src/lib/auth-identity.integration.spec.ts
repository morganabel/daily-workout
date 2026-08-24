import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { Pool } from 'pg';

import type { Database } from './client.js';
import {
  AccountOwnershipTransitionError,
  assertAccountAcceptsWrites,
  getAccountTransitionDiagnostics,
  getCompletedAccountTransitionForTarget,
  transitionAnonymousAccount,
  type AccountTransitionPhase,
} from './auth-identity.js';
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

  pool = new Pool({ connectionString, max: 4 });
  db = drizzle(pool, { schema });
});

async function resetDatabase(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      ${schema.accountTransition},
      ${schema.aiModelCall},
      ${schema.aiUsageEvent},
      ${schema.billingWebhookEvent},
      ${schema.billingAccountIdentity},
      ${schema.billingCustomerMapping},
      ${schema.billingEntitlementProjection},
      ${schema.includedGenerationReservation},
      ${schema.includedGenerationWindow},
      ${schema.account},
      ${schema.session},
      ${schema.user}
    CASCADE
  `);
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

async function seedPrincipals(targetId = 'authenticated-user'): Promise<void> {
  await db.insert(schema.user).values([
    {
      id: 'anonymous-user',
      name: 'Anonymous',
      email: 'anonymous@anonymous.workout-agent.local',
      emailVerified: false,
      isAnonymous: true,
    },
    {
      id: targetId,
      name: 'New User',
      email: `${targetId}@example.test`,
      emailVerified: true,
      isAnonymous: false,
    },
  ]);
  await db.insert(schema.account).values({
    id: `${targetId}-credential`,
    issuer: 'local:credential',
    accountId: targetId,
    providerId: 'credential',
    userId: targetId,
    password: 'hashed-password',
  });
  await db.insert(schema.session).values({
    id: 'anonymous-session',
    token: 'anonymous-session-token',
    userId: 'anonymous-user',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  });
}

async function seedAnonymousApplicationState(): Promise<void> {
  await db.insert(schema.aiUsageEvent).values({
    id: 'usage-event',
    operationId: 'operation',
    eventId: 'event',
    userId: 'anonymous-user',
    operation: 'generate',
    provider: 'openai',
    result: 'success',
    byok: false,
    occurredAt: new Date('2026-08-24T00:00:00.000Z'),
    callCount: 1,
    successfulCallCount: 1,
    failedCallCount: 0,
    unknownCostCallCount: 0,
    inputTokens: 1,
    outputTokens: 1,
    cachedInputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 2,
    accountedCostNanoUsd: 1n,
    platformCostNanoUsd: 1n,
    byokEstimatedCostNanoUsd: 0n,
    allowanceChargeNanoUsd: 1n,
  });
  await db.insert(schema.includedGenerationWindow).values({
    id: 'window',
    accountId: 'anonymous-user',
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2026-09-01T00:00:00.000Z'),
  });
  await db.insert(schema.includedGenerationReservation).values({
    id: 'reservation',
    accountId: 'anonymous-user',
    operationKey: 'operation',
    windowId: 'window',
    operation: 'generate',
    status: 'committed',
    expiresAt: new Date('2026-08-25T00:00:00.000Z'),
  });
  await db.insert(schema.billingAccountIdentity).values({
    accountId: 'anonymous-user',
    externalCustomerId: 'wa_1234567890ab7def8abc1234567890ab',
  });
  await db.insert(schema.billingCustomerMapping).values({
    source: 'revenuecat',
    externalCustomerId: 'wa_1234567890ab7def8abc1234567890ab',
    accountId: 'anonymous-user',
  });
  await db.insert(schema.billingEntitlementProjection).values({
    accountId: 'anonymous-user',
    planId: 'pro',
    entitlementId: 'OpenLift Pro',
    productId: 'pro.monthly',
    status: 'active',
    willRenew: true,
    paidThrough: new Date('2026-09-24T00:00:00.000Z'),
    lastEventTimestamp: new Date('2026-08-24T00:00:00.000Z'),
    lastEventId: 'revenuecat-event',
  });
  await db.insert(schema.billingWebhookEvent).values({
    source: 'revenuecat',
    eventId: 'revenuecat-event',
    normalizedHash: 'hash',
    eventTimestamp: new Date('2026-08-24T00:00:00.000Z'),
    originalEventType: 'INITIAL_PURCHASE',
    lifecycleKind: 'activate',
    appId: 'app',
    environment: 'sandbox',
    customerIds: ['wa_1234567890ab7def8abc1234567890ab'],
    entitlementIds: ['OpenLift Pro'],
    outcome: 'applied',
    accountId: 'anonymous-user',
  });
}

describe('anonymous account transition', () => {
  it('moves every application-owned row to B and leaves auth rows to Better Auth', async () => {
    await seedPrincipals();
    await seedAnonymousApplicationState();

    const transition = await transitionAnonymousAccount(db, {
      sourceUserId: 'anonymous-user',
      targetUserId: 'authenticated-user',
      method: 'email',
    });

    expect(transition).toEqual(
      expect.objectContaining({
        sourceUserId: 'anonymous-user',
        targetUserId: 'authenticated-user',
        state: 'completed',
        failureCode: null,
      })
    );
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, 'anonymous-user'))
    ).resolves.toHaveLength(1);
    await expect(
      db
        .select({ userId: schema.session.userId })
        .from(schema.session)
        .where(eq(schema.session.id, 'anonymous-session'))
    ).resolves.toEqual([{ userId: 'anonymous-user' }]);

    const ownership = await Promise.all([
      db.select({ id: schema.aiUsageEvent.userId }).from(schema.aiUsageEvent),
      db
        .select({ id: schema.includedGenerationWindow.accountId })
        .from(schema.includedGenerationWindow),
      db
        .select({ id: schema.includedGenerationReservation.accountId })
        .from(schema.includedGenerationReservation),
      db
        .select({ id: schema.billingAccountIdentity.accountId })
        .from(schema.billingAccountIdentity),
      db
        .select({ id: schema.billingCustomerMapping.accountId })
        .from(schema.billingCustomerMapping),
      db
        .select({ id: schema.billingEntitlementProjection.accountId })
        .from(schema.billingEntitlementProjection),
      db
        .select({ id: schema.billingWebhookEvent.accountId })
        .from(schema.billingWebhookEvent),
    ]);
    for (const rows of ownership) {
      expect(rows).toEqual([{ id: 'authenticated-user' }]);
    }
  });

  it('is idempotent for the same pair and authorizes status only for B', async () => {
    await seedPrincipals();
    const input = {
      sourceUserId: 'anonymous-user',
      targetUserId: 'authenticated-user',
      method: 'google' as const,
    };

    await transitionAnonymousAccount(db, input);
    await expect(transitionAnonymousAccount(db, input)).resolves.toEqual(
      expect.objectContaining({ state: 'completed' })
    );
    await expect(
      getCompletedAccountTransitionForTarget(
        db,
        'anonymous-user',
        'authenticated-user'
      )
    ).resolves.toEqual(expect.objectContaining({ state: 'completed' }));
    await expect(
      getCompletedAccountTransitionForTarget(
        db,
        'anonymous-user',
        'unrelated-user'
      )
    ).resolves.toBeNull();
  });

  it('rejects application state already owned by B before moving A', async () => {
    await seedPrincipals();
    await seedAnonymousApplicationState();
    await db.insert(schema.aiUsageEvent).values({
      ...(await db.select().from(schema.aiUsageEvent))[0],
      id: 'target-usage',
      operationId: 'target-operation',
      eventId: 'target-event',
      userId: 'authenticated-user',
    });

    await expect(
      transitionAnonymousAccount(db, {
        sourceUserId: 'anonymous-user',
        targetUserId: 'authenticated-user',
        method: 'email',
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'target_has_application_state',
      })
    );
    await expect(
      db
        .select({ id: schema.aiUsageEvent.userId })
        .from(schema.aiUsageEvent)
        .where(eq(schema.aiUsageEvent.id, 'usage-event'))
    ).resolves.toEqual([{ id: 'anonymous-user' }]);
  });

  it('rejects a target that already owns another RevenueCat identity', async () => {
    await seedPrincipals();
    await seedAnonymousApplicationState();
    await db.insert(schema.billingCustomerMapping).values({
      source: 'revenuecat',
      externalCustomerId: '$RCAnonymousID:existing-target',
      accountId: 'authenticated-user',
    });

    await expect(
      transitionAnonymousAccount(db, {
        sourceUserId: 'anonymous-user',
        targetUserId: 'authenticated-user',
        method: 'google',
      })
    ).rejects.toEqual(
      expect.objectContaining({ code: 'target_has_application_state' })
    );
    await expect(
      db
        .select({
          customerId: schema.billingCustomerMapping.externalCustomerId,
          accountId: schema.billingCustomerMapping.accountId,
        })
        .from(schema.billingCustomerMapping)
        .orderBy(schema.billingCustomerMapping.externalCustomerId)
    ).resolves.toEqual([
      {
        customerId: '$RCAnonymousID:existing-target',
        accountId: 'authenticated-user',
      },
      {
        customerId: 'wa_1234567890ab7def8abc1234567890ab',
        accountId: 'anonymous-user',
      },
    ]);
  });

  it('rolls back all moves and records a redacted failure', async () => {
    await seedPrincipals();
    await seedAnonymousApplicationState();
    await db.execute(sql`
      CREATE FUNCTION fail_transition_mapping_update() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'injected transition failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.execute(sql`
      CREATE TRIGGER fail_transition_mapping_update
      BEFORE UPDATE ON billing_customer_mapping
      FOR EACH ROW EXECUTE FUNCTION fail_transition_mapping_update()
    `);

    try {
      await expect(
        transitionAnonymousAccount(db, {
          sourceUserId: 'anonymous-user',
          targetUserId: 'authenticated-user',
          method: 'google',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'migration_failed',
        })
      );
    } finally {
      await db.execute(
        sql`DROP TRIGGER fail_transition_mapping_update ON billing_customer_mapping`
      );
      await db.execute(sql`DROP FUNCTION fail_transition_mapping_update()`);
    }

    await expect(
      db.select({ id: schema.aiUsageEvent.userId }).from(schema.aiUsageEvent)
    ).resolves.toEqual([{ id: 'anonymous-user' }]);
    await expect(db.select().from(schema.accountTransition)).resolves.toEqual([
      expect.objectContaining({
        state: 'failed',
        failureCode: 'migration_failed',
        attemptCount: 1,
      }),
    ]);

    await expect(
      transitionAnonymousAccount(db, {
        sourceUserId: 'anonymous-user',
        targetUserId: 'authenticated-user',
        method: 'google',
      })
    ).resolves.toEqual(
      expect.objectContaining({ state: 'completed', attemptCount: 2 })
    );
  });

  it.each<AccountTransitionPhase>([
    'validated',
    'ledger_started',
    'usage_moved',
    'quota_moved',
    'billing_moved',
    'completed',
  ])('rolls back a failure after the %s phase', async (failingPhase) => {
    await seedPrincipals();
    await seedAnonymousApplicationState();

    await expect(
      transitionAnonymousAccount(
        db,
        {
          sourceUserId: 'anonymous-user',
          targetUserId: 'authenticated-user',
          method: 'email',
        },
        {
          afterPhase: (phase) => {
            if (phase === failingPhase) throw new Error('injected failure');
          },
        }
      )
    ).rejects.toEqual(expect.objectContaining({ code: 'migration_failed' }));

    const ownership = await Promise.all([
      db.select({ id: schema.aiUsageEvent.userId }).from(schema.aiUsageEvent),
      db
        .select({ id: schema.includedGenerationWindow.accountId })
        .from(schema.includedGenerationWindow),
      db
        .select({ id: schema.includedGenerationReservation.accountId })
        .from(schema.includedGenerationReservation),
      db
        .select({ id: schema.billingAccountIdentity.accountId })
        .from(schema.billingAccountIdentity),
      db
        .select({ id: schema.billingCustomerMapping.accountId })
        .from(schema.billingCustomerMapping),
      db
        .select({ id: schema.billingEntitlementProjection.accountId })
        .from(schema.billingEntitlementProjection),
      db
        .select({ id: schema.billingWebhookEvent.accountId })
        .from(schema.billingWebhookEvent),
    ]);
    for (const rows of ownership) {
      expect(rows).toEqual([{ id: 'anonymous-user' }]);
    }
    await expect(db.select().from(schema.accountTransition)).resolves.toEqual([
      expect.objectContaining({
        state: 'failed',
        failureCode: 'migration_failed',
        attemptCount: 1,
      }),
    ]);
  });

  it('blocks late writes after completion and conflicting target retries', async () => {
    await seedPrincipals();
    await db.insert(schema.user).values({
      id: 'other-user',
      name: 'Other',
      email: 'other@example.test',
      emailVerified: true,
      isAnonymous: false,
    });
    await transitionAnonymousAccount(db, {
      sourceUserId: 'anonymous-user',
      targetUserId: 'authenticated-user',
      method: 'email',
    });

    await expect(
      db.transaction((transaction) =>
        assertAccountAcceptsWrites(transaction, 'anonymous-user')
      )
    ).rejects.toBeInstanceOf(AccountOwnershipTransitionError);
    await expect(
      transitionAnonymousAccount(db, {
        sourceUserId: 'anonymous-user',
        targetUserId: 'other-user',
        method: 'email',
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'source_target_conflict',
      })
    );
  });

  it('returns aggregate retry and delayed-cleanup diagnostics without IDs', async () => {
    await seedPrincipals();
    const input = {
      sourceUserId: 'anonymous-user',
      targetUserId: 'authenticated-user',
      method: 'email' as const,
    };
    await transitionAnonymousAccount(db, input);
    await transitionAnonymousAccount(db, input);
    await db
      .update(schema.accountTransition)
      .set({ completedAt: new Date('2026-08-24T00:00:00.000Z') })
      .where(eq(schema.accountTransition.sourceUserId, 'anonymous-user'));

    const diagnostics = await getAccountTransitionDiagnostics(db, {
      now: new Date('2026-08-24T01:00:00.000Z'),
      cleanupThresholdMs: 15 * 60_000,
    });
    expect(diagnostics).toEqual({
      total: 1,
      byState: { transitioning: 0, completed: 1, blocked: 0, failed: 0 },
      byFailureCode: {},
      retried: 1,
      completedButNotCleanedUp: 1,
    });
    expect(JSON.stringify(diagnostics)).not.toContain('anonymous-user');
    expect(JSON.stringify(diagnostics)).not.toContain('authenticated-user');

    await db
      .delete(schema.session)
      .where(eq(schema.session.userId, 'anonymous-user'));
    await db.delete(schema.user).where(eq(schema.user.id, 'anonymous-user'));
    await expect(
      getAccountTransitionDiagnostics(db, {
        now: new Date('2026-08-24T01:00:00.000Z'),
        cleanupThresholdMs: 15 * 60_000,
      })
    ).resolves.toEqual(
      expect.objectContaining({ completedButNotCleanedUp: 0 })
    );
  });

  it('inventories every application-owned direct user foreign key', async () => {
    const result = await db.execute<{
      table_name: string;
      column_name: string;
    }>(
      sql`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'user'
          AND tc.table_schema = 'public'
          AND tc.table_name NOT IN ('account', 'session')
        ORDER BY tc.table_name, kcu.column_name
      `
    );

    expect(result.rows).toEqual([
      { table_name: 'ai_usage_event', column_name: 'user_id' },
      {
        table_name: 'billing_account_identity',
        column_name: 'account_id',
      },
      {
        table_name: 'billing_customer_mapping',
        column_name: 'account_id',
      },
      {
        table_name: 'billing_entitlement_projection',
        column_name: 'account_id',
      },
      { table_name: 'billing_webhook_event', column_name: 'account_id' },
      {
        table_name: 'included_generation_reservation',
        column_name: 'account_id',
      },
      { table_name: 'included_generation_window', column_name: 'account_id' },
    ]);
  });
});
