import {
  buildGenerationUsageSummary,
  type ModelCallUsage,
  type UsageEvent,
} from '@leveza/metering';
import { verifyMeteringSinkContract } from '@leveza/metering/testing';
import {
  InMemoryProviderAdmission,
  type EntitlementLifecycleEvent,
} from '@leveza/quotas';
import {
  verifyAdmissionAndSpendCeilingContract,
  verifyEntitlementProcessorContract,
  verifyUsagePolicyContract,
} from '@leveza/quotas/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, sql } from 'drizzle-orm';
import path from 'node:path';
import { Pool } from 'pg';

import type { Database } from './client.js';
import {
  PostgresBillingRepository,
  PostgresSpendCeilingPolicy,
  type BillingRepositoryOutcome,
} from './billing.js';
import { transitionAnonymousAccount } from './auth-identity.js';
import { getAiUsageSummary, PostgresMeteringSink } from './ai-usage.js';
import * as schema from './schema.js';

let container: StartedPostgreSqlContainer | undefined;
let poolA: Pool | undefined;
let poolB: Pool | undefined;
let dbA: Database;
let dbB: Database;
const fixedNow = new Date('2026-08-03T12:00:00.000Z');

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function repository(
  db: Database,
  limit: number,
  overrides: {
    now?: () => Date;
    observe?: (outcome: BillingRepositoryOutcome) => void;
  } = {}
): PostgresBillingRepository {
  return new PostgresBillingRepository(db, {
    includedGenerationLimit: limit,
    quotaWindowDays: 30,
    reservationTtlMs: 5 * 60_000,
    now: overrides.now ?? (() => fixedNow),
    observe: overrides.observe,
  });
}

async function seedUser(
  db: Database,
  id: string,
  createdAt?: Date
): Promise<void> {
  await db
    .insert(schema.user)
    .values({
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: true,
      createdAt,
    })
    .onConflictDoNothing();
}

function event(
  overrides: Partial<EntitlementLifecycleEvent> = {}
): EntitlementLifecycleEvent {
  return {
    source: 'revenuecat',
    eventId: 'event-1',
    eventTimestamp: '2026-08-02T12:00:00.000Z',
    originalEventType: 'INITIAL_PURCHASE',
    kind: 'grant',
    appId: 'contract-app',
    environment: 'SANDBOX',
    customerIds: ['customer-1'],
    entitlementIds: ['pro'],
    productId: 'monthly',
    expiresAt: '2026-09-02T12:00:00.000Z',
    normalizedHash: 'hash-1',
    ...overrides,
  };
}

let meteringSequence = 0;
async function settleFailedCost(
  db: Database,
  accountId: string,
  amountNanoUsd: string
): Promise<void> {
  await seedUser(db, accountId);
  meteringSequence += 1;
  const call: ModelCallUsage = {
    phase: 'stage-two-generation',
    provider: 'openai',
    requestedModel: 'contract-model',
    status: 'error',
    startedAt: fixedNow.toISOString(),
    durationMs: 10,
    tokens: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
    cost: {
      currency: 'USD',
      source: 'provider_reported',
      amountNanoUsd,
    },
    upstreamAttemptCount: 1,
    errorCode: 'upstream_error',
  };
  const operationId = `failed-operation-${meteringSequence}`;
  await new PostgresMeteringSink(db).recordUsage({
    userId: accountId,
    operationId,
    eventId: 'generation-error',
    operation: 'generate',
    provider: 'openai',
    credentialSource: 'managed',
    byok: false,
    timestamp: fixedNow.toISOString(),
    result: 'error',
    modelCalls: [call],
    usage: buildGenerationUsageSummary([call], {
      credentialSource: 'managed',
      operationSucceeded: false,
    }),
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('leveza_test')
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

  poolA = new Pool({ connectionString, max: 5 });
  poolB = new Pool({ connectionString, max: 5 });
  dbA = drizzle(poolA, { schema });
  dbB = drizzle(poolB, { schema });
});

beforeEach(async () => {
  meteringSequence = 0;
  await dbA.execute(sql`
    TRUNCATE TABLE
      ${schema.billingWebhookEvent},
      ${schema.billingAccountIdentity},
      ${schema.billingCustomerMapping},
      ${schema.billingEntitlementProjection},
      ${schema.includedGenerationReservation},
      ${schema.includedGenerationWindow},
      ${schema.aiModelCall},
      ${schema.aiUsageEvent},
      ${schema.user}
    CASCADE
  `);
});

afterAll(async () => {
  await Promise.all([poolA?.end(), poolB?.end()]);
  await container?.stop();
});

describe('PostgreSQL billing repositories', () => {
  it('runs the reusable entitlement contract against durable storage', async () => {
    await Promise.all([
      seedUser(dbA, 'contract-user'),
      seedUser(dbA, 'contract-late-user'),
      seedUser(dbA, 'other-user'),
    ]);
    await verifyEntitlementProcessorContract(() => repository(dbA, 10));
  });

  it('creates one canonical customer identity idempotently under concurrency', async () => {
    await seedUser(dbA, 'canonical-user');

    const [first, second] = await Promise.all([
      repository(dbA, 10).getOrCreateCanonicalCustomerIdentity(
        'canonical-user'
      ),
      repository(dbB, 10).getOrCreateCanonicalCustomerIdentity(
        'canonical-user'
      ),
    ]);

    expect(first).toEqual(second);
    expect(first.externalCustomerId).toMatch(
      /^wa_[a-f0-9]{12}7[a-f0-9]{19}$/
    );
    await expect(
      dbA
        .select()
        .from(schema.billingAccountIdentity)
        .where(eq(schema.billingAccountIdentity.accountId, 'canonical-user'))
    ).resolves.toHaveLength(1);
    await expect(
      dbA
        .select({ accountId: schema.billingCustomerMapping.accountId })
        .from(schema.billingCustomerMapping)
        .where(
          eq(
            schema.billingCustomerMapping.externalCustomerId,
            first.externalCustomerId
          )
        )
    ).resolves.toEqual([{ accountId: 'canonical-user' }]);
  });

  it('reconciles an unmapped event after authenticated bootstrap', async () => {
    const outcomes: BillingRepositoryOutcome[] = [];
    const repo = repository(dbA, 10, {
      observe: (outcome) => outcomes.push(outcome),
    });
    expect((await repo.process(event())).outcome).toBe('unmapped');
    await seedUser(dbA, 'mapped-user');
    await repo.bootstrapAuthenticatedCustomer({
      accountId: 'mapped-user',
      externalCustomerId: 'customer-1',
    });

    expect(
      (await repository(dbB, 10).getProjection('mapped-user'))?.planId
    ).toBe('pro');
    const [stored] = await dbB
      .select({ outcome: schema.billingWebhookEvent.outcome })
      .from(schema.billingWebhookEvent)
      .where(eq(schema.billingWebhookEvent.eventId, 'event-1'));
    expect(stored?.outcome).toBe('applied');
    expect(outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'mapping', outcome: 'created' }),
        expect.objectContaining({
          operation: 'reconciliation',
          outcome: 'applied',
        }),
      ])
    );
    expect(JSON.stringify(outcomes)).not.toContain('customer-1');
  });

  it('serializes concurrent bootstrap and webhook reconciliation', async () => {
    await seedUser(dbA, 'racing-user');

    await Promise.all([
      repository(dbA, 10).process(
        event({
          eventId: 'racing-event',
          normalizedHash: 'racing-hash',
          customerIds: ['racing-customer'],
        })
      ),
      repository(dbB, 10).bootstrapAuthenticatedCustomer({
        accountId: 'racing-user',
        externalCustomerId: 'racing-customer',
      }),
    ]);

    expect(
      (await repository(dbA, 10).getProjection('racing-user'))?.planId
    ).toBe('pro');
    const [stored] = await dbA
      .select({ outcome: schema.billingWebhookEvent.outcome })
      .from(schema.billingWebhookEvent)
      .where(eq(schema.billingWebhookEvent.eventId, 'racing-event'));
    expect(stored?.outcome).toBe('applied');
  });

  it('binds RevenueCat app, original, and alias IDs to one owner idempotently', async () => {
    await seedUser(dbA, 'authenticated-b');
    const repo = repository(dbA, 10);
    const anonymousId = '$RCAnonymousID:device1234';
    await repo.bootstrapAuthenticatedCustomer({
      accountId: 'authenticated-b',
      externalCustomerId: anonymousId,
    });

    const aliases = [anonymousId, 'authenticated-b', 'install-alias'];
    await expect(
      repo.process(
        event({
          eventId: 'alias-event-1',
          normalizedHash: 'alias-hash-1',
          customerIds: aliases,
        })
      )
    ).resolves.toMatchObject({
      outcome: 'applied',
      accountId: 'authenticated-b',
    });
    await expect(
      repo.process(
        event({
          eventId: 'alias-event-2',
          eventTimestamp: '2026-08-02T13:00:00.000Z',
          normalizedHash: 'alias-hash-2',
          customerIds: [...aliases].reverse(),
        })
      )
    ).resolves.toMatchObject({ accountId: 'authenticated-b' });

    await expect(
      dbA
        .select({
          customerId: schema.billingCustomerMapping.externalCustomerId,
          accountId: schema.billingCustomerMapping.accountId,
        })
        .from(schema.billingCustomerMapping)
        .orderBy(schema.billingCustomerMapping.externalCustomerId)
    ).resolves.toEqual([
      { customerId: anonymousId, accountId: 'authenticated-b' },
      { customerId: 'authenticated-b', accountId: 'authenticated-b' },
      { customerId: 'install-alias', accountId: 'authenticated-b' },
    ]);
  });

  it('preserves canonical billing identity C through a fresh A-to-B transition', async () => {
    await dbA.insert(schema.user).values([
      {
        id: 'anonymous-a',
        name: 'Anonymous',
        email: 'anonymous-a@anonymous.leveza.local',
        emailVerified: false,
        isAnonymous: true,
      },
      {
        id: 'authenticated-b',
        name: 'Authenticated',
        email: 'authenticated-b@example.test',
        emailVerified: true,
        isAnonymous: false,
      },
    ]);
    const repo = repository(dbA, 10);
    const { externalCustomerId } =
      await repo.getOrCreateCanonicalCustomerIdentity('anonymous-a');
    await expect(
      repo.process(
        event({
          eventId: 'anonymous-purchase',
          normalizedHash: 'anonymous-purchase-hash',
          customerIds: [externalCustomerId],
        })
      )
    ).resolves.toMatchObject({ outcome: 'applied', accountId: 'anonymous-a' });
    await expect(repo.getProjection('anonymous-a')).resolves.toMatchObject({
      planId: 'pro',
      status: 'active',
    });

    await transitionAnonymousAccount(dbA, {
      sourceUserId: 'anonymous-a',
      targetUserId: 'authenticated-b',
      method: 'google',
    });

    await expect(repo.getProjection('anonymous-a')).resolves.toBeNull();
    await expect(repo.getProjection('authenticated-b')).resolves.toMatchObject({
      planId: 'pro',
      status: 'active',
    });
    await expect(
      dbA
        .select({ accountId: schema.billingCustomerMapping.accountId })
        .from(schema.billingCustomerMapping)
        .where(
          eq(
            schema.billingCustomerMapping.externalCustomerId,
            externalCustomerId
          )
        )
    ).resolves.toEqual([{ accountId: 'authenticated-b' }]);
    await expect(
      dbA
        .select({
          accountId: schema.billingAccountIdentity.accountId,
          externalCustomerId: schema.billingAccountIdentity.externalCustomerId,
        })
        .from(schema.billingAccountIdentity)
    ).resolves.toEqual([
      { accountId: 'authenticated-b', externalCustomerId },
    ]);
  });

  it('fails a RevenueCat alias webhook closed when any alias has another owner', async () => {
    await Promise.all([
      seedUser(dbA, 'authenticated-b'),
      seedUser(dbA, 'unrelated-account'),
    ]);
    const repo = repository(dbA, 10);
    await repo.bootstrapAuthenticatedCustomer({
      accountId: 'authenticated-b',
      externalCustomerId: '$RCAnonymousID:device1234',
    });
    await repo.bootstrapAuthenticatedCustomer({
      accountId: 'unrelated-account',
      externalCustomerId: 'conflicting-alias',
    });

    await expect(
      repo.process(
        event({
          eventId: 'alias-conflict',
          normalizedHash: 'alias-conflict-hash',
          customerIds: [
            '$RCAnonymousID:device1234',
            'authenticated-b',
            'conflicting-alias',
          ],
        })
      )
    ).resolves.toEqual({ outcome: 'conflict' });
    await expect(repo.getProjection('authenticated-b')).resolves.toBeNull();
    await expect(
      dbA
        .select({ accountId: schema.billingCustomerMapping.accountId })
        .from(schema.billingCustomerMapping)
        .where(
          eq(
            schema.billingCustomerMapping.externalCustomerId,
            'authenticated-b'
          )
        )
    ).resolves.toHaveLength(0);
  });

  it('persists stale events without regressing a newer projection', async () => {
    await seedUser(dbA, 'stale-user');
    const repo = repository(dbA, 10);
    await repo.bootstrapAuthenticatedCustomer({
      accountId: 'stale-user',
      externalCustomerId: 'customer-1',
    });
    await repo.process(
      event({
        eventId: 'newer',
        eventTimestamp: '2026-08-03T10:00:00.000Z',
        expiresAt: '2026-10-01T00:00:00.000Z',
        normalizedHash: 'newer-hash',
      })
    );
    expect(
      (
        await repo.process(
          event({
            eventId: 'older',
            eventTimestamp: '2026-08-02T10:00:00.000Z',
            kind: 'expire',
            originalEventType: 'EXPIRATION',
            normalizedHash: 'older-hash',
          })
        )
      ).outcome
    ).toBe('stale');
    expect((await repo.getProjection('stale-user'))?.paidThrough).toBe(
      '2026-10-01T00:00:00.000Z'
    );
  });

  it('derives inactive access after the stored paid boundary elapses', async () => {
    await seedUser(dbA, 'expired-user');
    const repo = repository(dbA, 10);
    await repo.bootstrapAuthenticatedCustomer({
      accountId: 'expired-user',
      externalCustomerId: 'customer-1',
    });
    await repo.process(event({ expiresAt: '2026-08-04T00:00:00.000Z' }));
    expect(
      (
        await repository(dbB, 10).getProjection(
          'expired-user',
          new Date('2026-08-05T00:00:00.000Z')
        )
      )?.status
    ).toBe('inactive');
  });

  it('runs the reusable reservation contract against durable storage', async () => {
    await seedUser(dbA, 'contract-user');
    await verifyUsagePolicyContract((limit) => repository(dbA, limit));
  });

  it('reports durable quota state and billing schema health after recreation', async () => {
    await seedUser(dbA, 'state-user');
    const first = repository(dbA, 2);
    const reserved = await first.reserveGenerate({
      accountId: 'state-user',
      operationId: 'operation-a',
      operation: 'generate',
    });
    expect(reserved.allowed).toBe(true);

    const recreated = repository(dbB, 2);
    await expect(recreated.checkHealth()).resolves.toBeUndefined();
    await expect(
      recreated.getIncludedGenerationUsage('state-user')
    ).resolves.toMatchObject({ used: 0, reserved: 1, remaining: 1 });

    if (!reserved.allowed || !reserved.reservation) {
      throw new Error('expected reservation');
    }
    await recreated.commitGenerateReservation(reserved.reservation);
    await expect(
      repository(dbA, 2).getIncludedGenerationUsage('state-user')
    ).resolves.toMatchObject({ used: 1, reserved: 0, remaining: 1 });
  });

  it('anchors an initial quota window before BYOK usage is summarized', async () => {
    const accountCreatedAt = new Date('2026-07-15T12:00:00.000Z');
    await seedUser(dbA, 'byok-window-user', accountCreatedAt);
    const usageEvent: UsageEvent = {
      userId: 'byok-window-user',
      operationId: 'byok-operation',
      eventId: 'generation-success',
      operation: 'generate',
      provider: 'openai',
      credentialSource: 'byok',
      byok: true,
      timestamp: '2026-08-02T12:00:00.000Z',
      result: 'success',
      modelCalls: [],
      usage: buildGenerationUsageSummary([], {
        credentialSource: 'byok',
        operationSucceeded: true,
      }),
    };
    await new PostgresMeteringSink(dbA).recordUsage(usageEvent);

    const repo = repository(dbA, 2);
    const first = await repo.getIncludedGenerationUsage('byok-window-user');
    const second = await repository(dbB, 2).getIncludedGenerationUsage(
      'byok-window-user'
    );
    expect(first).toEqual(second);
    expect(first.startsAt).toBe(accountCreatedAt.toISOString());

    const summary = await getAiUsageSummary(dbA, {
      userId: 'byok-window-user',
      startsAt: new Date(first.startsAt),
      endsAt: new Date(first.endsAt),
    });
    expect(summary.totals.requestCount).toBe(1);
  });

  it('serializes the concurrent last quota slot across repository instances', async () => {
    await seedUser(dbA, 'concurrent-user');
    const first = repository(dbA, 1).reserveGenerate({
      accountId: 'concurrent-user',
      operationId: 'operation-a',
      operation: 'generate',
    });
    const second = repository(dbB, 1).reserveGenerate({
      accountId: 'concurrent-user',
      operationId: 'operation-b',
      operation: 'generate',
    });
    const results = await Promise.all([first, second]);
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toEqual([
      { allowed: false, code: 'quota_exceeded', statusCode: 429 },
    ]);
  });

  it('does not let one account billing lock block another account', async () => {
    await Promise.all([
      seedUser(dbA, 'locked-account'),
      seedUser(dbA, 'independent-account'),
    ]);
    const acquired = deferred();
    const release = deferred();
    const blocker = dbA.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${'billing-account:locked-account'}, 0))`
      );
      acquired.resolve();
      await release.promise;
    });

    try {
      await acquired.promise;
      await expect(
        repository(dbB, 1).reserveGenerate({
          accountId: 'independent-account',
          operationId: 'independent-operation',
          operation: 'generate',
        })
      ).resolves.toMatchObject({ allowed: true });
    } finally {
      release.resolve();
      await blocker;
    }
  });

  it('bounds same-account lock waits and reports the timeout', async () => {
    await seedUser(dbA, 'timed-lock-account');
    const acquired = deferred();
    const release = deferred();
    const blocker = dbA.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${'billing-account:timed-lock-account'}, 0))`
      );
      acquired.resolve();
      await release.promise;
    });
    const outcomes: BillingRepositoryOutcome[] = [];

    try {
      await acquired.promise;
      await expect(
        repository(dbB, 1, {
          observe: (outcome) => outcomes.push(outcome),
        }).reserveGenerate({
          accountId: 'timed-lock-account',
          operationId: 'timed-operation',
          operation: 'generate',
        })
      ).resolves.toEqual({
        allowed: false,
        code: 'dependency_unavailable',
      });
      expect(outcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'reserve',
            outcome: 'lock_timeout',
            durationMs: expect.any(Number),
          }),
        ])
      );
    } finally {
      release.resolve();
      await blocker;
    }
  });

  it('does not couple quota reservation to non-key user updates', async () => {
    await seedUser(dbA, 'auth-update-account');
    const acquired = deferred();
    const release = deferred();
    const blocker = dbA.transaction(async (transaction) => {
      await transaction.execute(sql`
        select id
        from ${schema.user}
        where ${schema.user.id} = ${'auth-update-account'}
        for no key update
      `);
      acquired.resolve();
      await release.promise;
    });

    try {
      await acquired.promise;
      await expect(
        repository(dbB, 1).reserveGenerate({
          accountId: 'auth-update-account',
          operationId: 'auth-update-operation',
          operation: 'generate',
        })
      ).resolves.toMatchObject({ allowed: true });
    } finally {
      release.resolve();
      await blocker;
    }
  });

  it('persists an idempotent commit across repository recreation', async () => {
    await seedUser(dbA, 'committed-user');
    const firstRepository = repository(dbA, 1);
    const reserved = await firstRepository.reserveGenerate({
      accountId: 'committed-user',
      operationId: 'operation-a',
      operation: 'generate',
    });
    if (!reserved.allowed || !reserved.reservation) {
      throw new Error('reserve failed');
    }
    await firstRepository.commitGenerateReservation(reserved.reservation);
    await repository(dbB, 1).commitGenerateReservation(reserved.reservation);
    await expect(
      repository(dbB, 1).reserveGenerate({
        accountId: 'committed-user',
        operationId: 'operation-b',
        operation: 'generate',
      })
    ).resolves.toEqual({
      allowed: false,
      code: 'quota_exceeded',
      statusCode: 429,
    });
  });

  it('evaluates the configured limit from the current durable entitlement', async () => {
    await seedUser(dbA, 'plan-user');
    const planAwareRepository = new PostgresBillingRepository(dbA, {
      includedGenerationLimit: (_accountId, entitlement) =>
        entitlement?.status === 'active' ? 2 : 1,
      quotaWindowDays: 30,
      reservationTtlMs: 5 * 60_000,
      now: () => fixedNow,
    });
    expect(
      (
        await planAwareRepository.reserveGenerate({
          accountId: 'plan-user',
          operationId: 'free-operation',
          operation: 'generate',
        })
      ).allowed
    ).toBe(true);
    await expect(
      planAwareRepository.reserveGenerate({
        accountId: 'plan-user',
        operationId: 'free-over-limit',
        operation: 'generate',
      })
    ).resolves.toEqual({
      allowed: false,
      code: 'quota_exceeded',
      statusCode: 429,
    });

    await planAwareRepository.bootstrapAuthenticatedCustomer({
      accountId: 'plan-user',
      externalCustomerId: 'customer-1',
    });
    await planAwareRepository.process(event());
    expect(
      (
        await planAwareRepository.reserveGenerate({
          accountId: 'plan-user',
          operationId: 'pro-operation',
          operation: 'generate',
        })
      ).allowed
    ).toBe(true);
  });

  it('stops counting expired pending reservations but charges completed work', async () => {
    await seedUser(dbA, 'expiry-user');
    let now = new Date(fixedNow);
    const repo = repository(dbA, 1, { now: () => now });
    const first = await repo.reserveGenerate({
      accountId: 'expiry-user',
      operationId: 'operation-a',
      operation: 'generate',
    });
    if (!first.allowed || !first.reservation) throw new Error('reserve failed');
    now = new Date(now.getTime() + 5 * 60_000 + 1);
    const second = await repository(dbB, 1, {
      now: () => now,
    }).reserveGenerate({
      accountId: 'expiry-user',
      operationId: 'operation-b',
      operation: 'generate',
    });
    expect(second.allowed).toBe(true);

    await expect(
      repo.commitGenerateReservation(first.reservation)
    ).resolves.toBeUndefined();
    const [window] = await dbA
      .select({
        committedCount: schema.includedGenerationWindow.committedCount,
      })
      .from(schema.includedGenerationWindow)
      .where(eq(schema.includedGenerationWindow.accountId, 'expiry-user'));
    expect(window?.committedCount).toBe(1);
  });

  it('runs admission and settle-only ceiling contracts over failed usage', async () => {
    await verifyAdmissionAndSpendCeilingContract({
      createAdmission: (options) => new InMemoryProviderAdmission(options),
      createSpendCeiling: (options) => ({
        policy: new PostgresSpendCeilingPolicy(dbA, {
          ...options,
          now: () => fixedNow,
          isPricingAvailable: () => true,
        }),
        settle: (accountId, actualCostNanoUsd) =>
          settleFailedCost(dbA, accountId, actualCostNanoUsd),
      }),
    });
  });

  it('fails closed for unknown pricing or an unavailable spend query', async () => {
    const pricing = new PostgresSpendCeilingPolicy(dbA, {
      accountDailyLimitNanoUsd: '1000',
      globalDailyLimitNanoUsd: '1000',
      isPricingAvailable: () => false,
    });
    await expect(
      pricing.checkSpendCeiling({
        accountId: 'user',
        provider: 'openai',
        credentialSource: 'managed',
      })
    ).resolves.toEqual({ allowed: false, code: 'pricing_unavailable' });

    const unavailable = new PostgresSpendCeilingPolicy(
      {
        select: () => {
          throw new Error('database unavailable');
        },
      } as unknown as Database,
      {
        accountDailyLimitNanoUsd: '1000',
        globalDailyLimitNanoUsd: '1000',
        isPricingAvailable: () => true,
      }
    );
    await expect(
      unavailable.checkSpendCeiling({
        accountId: 'user',
        provider: 'openai',
        credentialSource: 'managed',
      })
    ).resolves.toEqual({ allowed: false, code: 'dependency_unavailable' });
  });

  it('deduplicates by account, operation, and event without cross-account collision', async () => {
    await Promise.all([seedUser(dbA, 'user-a'), seedUser(dbA, 'user-b')]);
    const sink = new PostgresMeteringSink(dbA);
    const record = async (accountId: string, eventId: string) => {
      const call: ModelCallUsage = {
        phase: 'stage-two-generation',
        provider: 'openai',
        requestedModel: 'contract-model',
        status: 'success',
        startedAt: fixedNow.toISOString(),
        durationMs: 1,
        tokens: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        cost: {
          currency: 'USD',
          amountNanoUsd: '10',
          source: 'provider_reported',
        },
        upstreamAttemptCount: 1,
      };
      await sink.recordUsage({
        userId: accountId,
        operationId: 'shared-operation',
        eventId,
        operation: 'generate',
        provider: 'openai',
        credentialSource: 'managed',
        byok: false,
        timestamp: fixedNow.toISOString(),
        result: 'success',
        modelCalls: [call],
        usage: buildGenerationUsageSummary([call], {
          credentialSource: 'managed',
        }),
      });
    };

    await record('user-a', 'success');
    await record('user-a', 'success');
    await record('user-a', 'failure');
    await record('user-b', 'success');
    const rows = await dbA
      .select({
        userId: schema.aiUsageEvent.userId,
        eventId: schema.aiUsageEvent.eventId,
      })
      .from(schema.aiUsageEvent)
      .where(
        and(
          eq(schema.aiUsageEvent.operationId, 'shared-operation'),
          eq(schema.aiUsageEvent.provider, 'openai')
        )
      );
    expect(rows).toHaveLength(3);
  });

  it('runs the reusable metering contract against durable storage', async () => {
    await seedUser(dbA, 'contract-user');
    const contractEvent: UsageEvent = {
      userId: 'contract-user',
      operationId: 'contract-operation',
      eventId: 'generation-success',
      operation: 'generate',
      provider: 'openai',
      credentialSource: 'managed',
      byok: false,
      timestamp: fixedNow.toISOString(),
      result: 'success',
      modelCalls: [],
      usage: buildGenerationUsageSummary([], {
        credentialSource: 'managed',
      }),
    };
    await verifyMeteringSinkContract(() => ({
      sink: new PostgresMeteringSink(dbA),
      list: async () => {
        const rows = await dbA
          .select({ id: schema.aiUsageEvent.id })
          .from(schema.aiUsageEvent)
          .where(eq(schema.aiUsageEvent.userId, 'contract-user'));
        return rows.map(() => contractEvent);
      },
    }));
  });
});
