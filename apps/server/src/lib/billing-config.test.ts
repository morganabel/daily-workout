import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getBillingConfig,
  parseRevenueCatBillingConfigDocument,
} from './billing-config';

describe('getBillingConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'revenuecat';
    process.env.REVENUECAT_WEBHOOK_SECRET = 'webhook-secret';
    process.env.BILLING_CONFIG_JSON = JSON.stringify({
      schemaVersion: 1,
      revenueCat: {
        appIds: ['app.ios', 'app.android'],
        environments: ['PRODUCTION'],
        entitlementIds: ['OpenLift Pro'],
        productIds: ['monthly', 'yearly'],
        defaultOfferingId: 'default',
      },
      plans: {
        freeGenerations: 25,
        proGenerations: 1000,
        windowDays: 30,
      },
      guardrails: {
        accountRequestsPerMinute: 30,
        accountMaxActiveGenerations: 2,
        accountDailySpendLimitNanoUsd: '5000000000',
        globalDailySpendLimitNanoUsd: '50000000000',
        pendingReservationTtlSeconds: 300,
      },
      capabilities: {
        showUpgradeUi: true,
      },
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('maps the versioned deployment document to the internal runtime config', () => {
    const config = getBillingConfig();
    expect(config.provider).toBe('revenuecat');
    if (config.provider !== 'revenuecat') throw new Error('unexpected provider');

    expect(config).toMatchObject({
      schemaVersion: 1,
      webhookSecret: 'webhook-secret',
      freeGenerationLimit: 25,
      proGenerationLimit: 1000,
      quotaWindowDays: 30,
      accountRequestsPerMinute: 30,
      accountMaxActiveGenerations: 2,
      accountDailySpendLimitNanoUsd: '5000000000',
      globalDailySpendLimitNanoUsd: '50000000000',
      pendingReservationTtlMs: 300_000,
      defaultOfferingId: 'default',
      showUpgradeUi: true,
    });
    expect([...config.domainConfig.allowedAppIds]).toEqual([
      'app.ios',
      'app.android',
    ]);
    expect([...config.domainConfig.allowedEnvironments]).toEqual([
      'PRODUCTION',
    ]);
  });

  it('keeps the checked-in self-host example aligned with the public schema', () => {
    const raw = readFileSync(
      resolve(__dirname, '../../../../billing-config.example.json'),
      'utf8'
    );
    expect(parseRevenueCatBillingConfigDocument(raw).schemaVersion).toBe(1);
  });
});
