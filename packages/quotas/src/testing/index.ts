import assert from 'node:assert/strict';
import type {
  BillingCustomerBootstrap,
  EntitlementEventProcessor,
  EntitlementLifecycleEvent,
  EntitlementProjection,
} from '../entitlements';
import type {
  ProviderAdmissionPolicy,
  SpendCeilingPolicy,
  UsagePolicy,
} from '../generation-policy';

function entitlementEvent(
  overrides: Partial<EntitlementLifecycleEvent> = {}
): EntitlementLifecycleEvent {
  return {
    source: 'revenuecat',
    eventId: 'contract-event-1',
    eventTimestamp: '2026-08-02T12:00:00.000Z',
    originalEventType: 'INITIAL_PURCHASE',
    kind: 'grant',
    appId: 'contract-app',
    environment: 'SANDBOX',
    customerIds: ['contract-customer'],
    entitlementIds: ['contract-pro'],
    productId: 'contract-monthly',
    expiresAt: '2026-09-02T12:00:00.000Z',
    normalizedHash: 'contract-hash-1',
    ...overrides,
  };
}

export async function verifyEntitlementProcessorContract(
  create: () => EntitlementEventProcessor &
    BillingCustomerBootstrap & {
      getProjection(
        accountId: string,
        now?: Date
      ): Promise<EntitlementProjection | null> | EntitlementProjection | null;
    }
): Promise<void> {
  const processor = create();
  await processor.bootstrapAuthenticatedCustomer({
    accountId: 'contract-user',
    externalCustomerId: 'contract-customer',
  });

  assert.equal(
    (await processor.process(entitlementEvent())).outcome,
    'applied'
  );
  assert.equal(
    (await processor.process(entitlementEvent())).outcome,
    'duplicate'
  );
  assert.equal(
    (
      await processor.process(
        entitlementEvent({ normalizedHash: 'conflicting-hash' })
      )
    ).outcome,
    'conflict'
  );
  assert.equal((await processor.getProjection('contract-user'))?.planId, 'pro');

  await assert.rejects(
    processor.bootstrapAuthenticatedCustomer({
      accountId: 'other-user',
      externalCustomerId: 'contract-customer',
    }),
    /billing_customer_conflict/
  );

  const reconcile = create();
  const pendingEvent = entitlementEvent({
    eventId: 'contract-unmapped-event',
    customerIds: ['contract-late-customer'],
    normalizedHash: 'contract-unmapped-hash',
  });
  assert.equal((await reconcile.process(pendingEvent)).outcome, 'unmapped');
  await reconcile.bootstrapAuthenticatedCustomer({
    accountId: 'contract-late-user',
    externalCustomerId: 'contract-late-customer',
  });
  assert.equal(
    (await reconcile.getProjection('contract-late-user'))?.planId,
    'pro'
  );
  assert.equal((await reconcile.process(pendingEvent)).outcome, 'duplicate');

  const aliases = create();
  await aliases.bootstrapAuthenticatedCustomer({
    accountId: 'contract-user',
    externalCustomerId: 'contract-customer',
  });
  assert.ok(
    ['applied', 'ignored', 'stale'].includes(
      (
        await aliases.process(
          entitlementEvent({
            eventId: 'contract-alias-event',
            eventTimestamp: '2026-08-03T12:00:00.000Z',
            normalizedHash: 'contract-alias-hash',
            customerIds: ['contract-customer', 'contract-customer-alias'],
          })
        )
      ).outcome
    )
  );
  await assert.rejects(
    aliases.bootstrapAuthenticatedCustomer({
      accountId: 'other-user',
      externalCustomerId: 'contract-customer-alias',
    }),
    /billing_customer_conflict/
  );

  const conflictingAliases = create();
  await conflictingAliases.bootstrapAuthenticatedCustomer({
    accountId: 'contract-user',
    externalCustomerId: 'contract-customer',
  });
  await conflictingAliases.bootstrapAuthenticatedCustomer({
    accountId: 'other-user',
    externalCustomerId: 'other-customer',
  });
  assert.equal(
    (
      await conflictingAliases.process(
        entitlementEvent({
          eventId: 'contract-conflicting-alias-event',
          normalizedHash: 'contract-conflicting-alias-hash',
          customerIds: ['contract-customer', 'other-customer'],
        })
      )
    ).outcome,
    'conflict'
  );
}

export async function verifyUsagePolicyContract(
  create: (limit: number) => UsagePolicy
): Promise<void> {
  const policy = create(1);
  const first = await policy.reserveGenerate({
    accountId: 'contract-user',
    operationId: 'contract-operation-1',
    operation: 'generate',
  });
  assert.ok(first.allowed && first.reservation);

  const replay = await policy.reserveGenerate({
    accountId: 'contract-user',
    operationId: 'contract-operation-1',
    operation: 'generate',
  });
  assert.deepEqual(replay, first);

  await policy.rollbackGenerateReservation(first.reservation);
  const retry = await policy.reserveGenerate({
    accountId: 'contract-user',
    operationId: 'contract-operation-1',
    operation: 'generate',
  });
  assert.ok(retry.allowed && retry.reservation);
  assert.notEqual(
    retry.reservation.reservationId,
    first.reservation.reservationId
  );

  await assert.rejects(
    policy.commitGenerateReservation({
      ...retry.reservation,
      accountId: 'other-user',
    }),
    /billing_reservation_not_found/
  );
  await assert.rejects(
    policy.rollbackGenerateReservation({
      ...retry.reservation,
      operationId: 'different-operation',
    }),
    /billing_reservation_not_found/
  );

  await policy.commitGenerateReservation(retry.reservation);
  await policy.commitGenerateReservation(retry.reservation);
  assert.deepEqual(
    await policy.reserveGenerate({
      accountId: 'contract-user',
      operationId: 'contract-operation-2',
      operation: 'generate',
    }),
    { allowed: false, code: 'quota_exceeded', statusCode: 429 }
  );
}

export interface SpendCeilingContractHarness {
  policy: SpendCeilingPolicy;
  /** Record settled cost as the durable implementation would observe it. */
  settle(accountId: string, actualCostNanoUsd: string): Promise<void> | void;
}

export async function verifyAdmissionAndSpendCeilingContract(input: {
  createAdmission(options: {
    accountRequestLimit: number;
    maxActivePerAccount: number;
  }): ProviderAdmissionPolicy;
  createSpendCeiling(options: {
    accountDailyLimitNanoUsd: string;
    globalDailyLimitNanoUsd: string;
  }): SpendCeilingContractHarness;
}): Promise<void> {
  const admission = input.createAdmission({
    accountRequestLimit: 2,
    maxActivePerAccount: 2,
  });
  const first = await admission.acquireProviderAdmission({
    accountId: 'contract-user',
    operationId: 'contract-operation-1',
  });
  assert.equal(first.allowed, true);
  assert.deepEqual(
    await admission.acquireProviderAdmission({
      accountId: 'contract-user',
      operationId: 'contract-operation-1',
    }),
    first
  );
  await admission.acquireProviderAdmission({
    accountId: 'contract-user',
    operationId: 'contract-operation-2',
  });
  assert.deepEqual(
    await admission.acquireProviderAdmission({
      accountId: 'contract-user',
      operationId: 'contract-operation-3',
    }),
    { allowed: false, code: 'account_rate_limited' }
  );

  const concurrencyAdmission = input.createAdmission({
    accountRequestLimit: 10,
    maxActivePerAccount: 1,
  });
  const active = await concurrencyAdmission.acquireProviderAdmission({
    accountId: 'contract-concurrent-user',
    operationId: 'contract-concurrent-operation-1',
  });
  assert.ok(active.allowed);
  assert.deepEqual(
    await concurrencyAdmission.acquireProviderAdmission({
      accountId: 'contract-concurrent-user',
      operationId: 'contract-concurrent-operation-2',
    }),
    { allowed: false, code: 'concurrency_limited' }
  );
  await concurrencyAdmission.releaseProviderAdmission(active.lease);
  assert.equal(
    (
      await concurrencyAdmission.acquireProviderAdmission({
        accountId: 'contract-concurrent-user',
        operationId: 'contract-concurrent-operation-2',
      })
    ).allowed,
    true
  );

  const accountCeiling = input.createSpendCeiling({
    accountDailyLimitNanoUsd: '1000',
    globalDailyLimitNanoUsd: '1000000',
  });
  assert.deepEqual(
    await accountCeiling.policy.checkSpendCeiling({
      accountId: 'contract-user',
      provider: 'openai',
    }),
    { allowed: true }
  );
  // Failed billable attempts settle their actual cost and count toward
  // ceilings; the check denies once the daily account ceiling is reached.
  await accountCeiling.settle('contract-user', '600');
  await accountCeiling.settle('contract-user', '400');
  assert.deepEqual(
    await accountCeiling.policy.checkSpendCeiling({
      accountId: 'contract-user',
      provider: 'openai',
    }),
    { allowed: false, code: 'spend_limit_exceeded' }
  );
  assert.deepEqual(
    await accountCeiling.policy.checkSpendCeiling({
      accountId: 'contract-other-user',
      provider: 'openai',
    }),
    { allowed: true }
  );

  const globalCeiling = input.createSpendCeiling({
    accountDailyLimitNanoUsd: '1000000',
    globalDailyLimitNanoUsd: '500',
  });
  await globalCeiling.settle('contract-user-a', '300');
  await globalCeiling.settle('contract-user-b', '300');
  assert.deepEqual(
    await globalCeiling.policy.checkSpendCeiling({
      accountId: 'contract-user-c',
      provider: 'gemini',
    }),
    { allowed: false, code: 'spend_limit_exceeded' }
  );
}
