import {
  InMemoryProviderAdmission,
  InMemorySpendCeilingPolicy,
  InMemoryUsagePolicy,
  generationControlPlan,
} from '.';
import {
  verifyAdmissionAndSpendCeilingContract,
  verifyUsagePolicyContract,
} from './testing';

describe('canonical generation policy contracts', () => {
  it('keeps BYOK under provider-work admission while bypassing billing controls', () => {
    expect(generationControlPlan('byok')).toEqual({
      providerAdmission: true,
      includedAllowance: false,
      spendCeiling: false,
    });
    expect(generationControlPlan('managed')).toEqual({
      providerAdmission: true,
      includedAllowance: true,
      spendCeiling: true,
    });
    expect(generationControlPlan('vertex')).toEqual({
      providerAdmission: true,
      includedAllowance: true,
      spendCeiling: true,
    });
  });

  it('passes the reusable exact-reservation contract', async () => {
    await verifyUsagePolicyContract(
      (limit) => new InMemoryUsagePolicy({ limit })
    );
  });

  it('passes the reusable admission and spend-ceiling contract', async () => {
    await verifyAdmissionAndSpendCeilingContract({
      createAdmission: (options) => new InMemoryProviderAdmission(options),
      createSpendCeiling: (options) => {
        const policy = new InMemorySpendCeilingPolicy({
          accountDailyLimitNanoUsd: BigInt(options.accountDailyLimitNanoUsd),
          globalDailyLimitNanoUsd: BigInt(options.globalDailyLimitNanoUsd),
        });
        return {
          policy,
          settle: (accountId, actualCostNanoUsd) =>
            policy.settleActualCost({ accountId, actualCostNanoUsd }),
        };
      },
    });
  });

  it('commits and rolls back only exact included-generation reservations', async () => {
    const policy = new InMemoryUsagePolicy({ limit: 2 });
    const first = await policy.reserveGenerate({
      accountId: 'user-1',
      operationId: 'operation-1',
      operation: 'generate',
    });
    const second = await policy.reserveGenerate({
      accountId: 'user-1',
      operationId: 'operation-2',
      operation: 'generate',
    });
    if (
      !first.allowed ||
      !first.reservation ||
      !second.allowed ||
      !second.reservation
    ) {
      throw new Error('expected reservations');
    }
    expect(first.reservation.reservationId).toMatch(
      /^allowance_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    await policy.rollbackGenerateReservation(first.reservation);
    const retried = await policy.reserveGenerate({
      accountId: 'user-1',
      operationId: 'operation-1',
      operation: 'generate',
    });
    if (!retried.allowed || !retried.reservation) {
      throw new Error('expected retry reservation');
    }
    expect(retried.reservation.reservationId).not.toBe(
      first.reservation.reservationId
    );
    await policy.rollbackGenerateReservation(retried.reservation);
    await policy.commitGenerateReservation(second.reservation);
    await policy.commitGenerateReservation(second.reservation);

    expect(policy.getCommitted('user-1')).toBe(1);
    await expect(
      policy.reserveGenerate({
        accountId: 'user-1',
        operationId: 'operation-3',
        operation: 'generate',
      })
    ).resolves.toMatchObject({ allowed: true });
  });

  it('replays matching admission and limits unique operations independently of keys', async () => {
    const admission = new InMemoryProviderAdmission({
      accountRequestLimit: 2,
      maxActivePerAccount: 2,
    });
    const first = await admission.acquireProviderAdmission({
      accountId: 'user-1',
      operationId: 'operation-1',
    });
    const replay = await admission.acquireProviderAdmission({
      accountId: 'user-1',
      operationId: 'operation-1',
    });
    expect(replay).toEqual(first);

    await admission.acquireProviderAdmission({
      accountId: 'user-1',
      operationId: 'operation-2',
    });
    await expect(
      admission.acquireProviderAdmission({
        accountId: 'user-1',
        operationId: 'operation-3',
      })
    ).resolves.toEqual({ allowed: false, code: 'account_rate_limited' });
  });

  it('expires temporary request windows, leases, and allowance reservations', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-08-02T12:00:00.000Z'));
      const admission = new InMemoryProviderAdmission({
        accountRequestLimit: 1,
        maxActivePerAccount: 1,
        windowMs: 100,
        leaseTtlMs: 100,
      });
      await expect(
        admission.acquireProviderAdmission({
          accountId: 'user-1',
          operationId: 'operation-1',
        })
      ).resolves.toMatchObject({ allowed: true });

      jest.advanceTimersByTime(101);
      await expect(
        admission.acquireProviderAdmission({
          accountId: 'user-1',
          operationId: 'operation-2',
        })
      ).resolves.toMatchObject({ allowed: true });

      const usage = new InMemoryUsagePolicy({
        limit: 1,
        reservationTtlMs: 100,
      });
      const expiredReservation = await usage.reserveGenerate({
        accountId: 'user-1',
        operationId: 'operation-1',
        operation: 'generate',
      });
      jest.advanceTimersByTime(101);
      await expect(
        usage.reserveGenerate({
          accountId: 'user-1',
          operationId: 'operation-2',
          operation: 'generate',
        })
      ).resolves.toMatchObject({ allowed: true });
      if (!expiredReservation.allowed || !expiredReservation.reservation) {
        throw new Error('expected expiring reservation');
      }
      await usage.commitGenerateReservation(expiredReservation.reservation);
      expect(usage.getCommitted('user-1')).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts settled cost from failed billable attempts toward daily ceilings', async () => {
    const ceiling = new InMemorySpendCeilingPolicy({
      accountDailyLimitNanoUsd: 1_000n,
      globalDailyLimitNanoUsd: 10_000n,
    });
    // A failed attempt still settles its actual provider cost.
    ceiling.settleActualCost({
      accountId: 'user-1',
      actualCostNanoUsd: '600',
    });
    await expect(
      ceiling.checkSpendCeiling({
        accountId: 'user-1',
        provider: 'openai',
        credentialSource: 'managed',
      })
    ).resolves.toEqual({ allowed: true });

    ceiling.settleActualCost({
      accountId: 'user-1',
      actualCostNanoUsd: '400',
    });
    await expect(
      ceiling.checkSpendCeiling({
        accountId: 'user-1',
        provider: 'openai',
        credentialSource: 'managed',
      })
    ).resolves.toEqual({ allowed: false, code: 'spend_limit_exceeded' });
    await expect(
      ceiling.checkSpendCeiling({
        accountId: 'user-2',
        provider: 'openai',
        credentialSource: 'managed',
      })
    ).resolves.toEqual({ allowed: true });
    expect(ceiling.totals()).toEqual({ globalSettledNanoUsd: '1000' });
  });
});
