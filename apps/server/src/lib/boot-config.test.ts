/**
 * Tests for validateBootConfig (boot-time configuration validation).
 */

import { validateBootConfig } from './boot-config';

describe('validateBootConfig', () => {
  const originalEnv = process.env;

  const billingDocument = () => ({
    schemaVersion: 1,
    revenueCat: {
      appIds: ['app.test'],
      environments: ['SANDBOX', 'PRODUCTION'],
      entitlementIds: ['OpenLift Pro'],
      productIds: ['weekly', 'monthly', 'yearly'],
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

  const configureRevenueCat = (document: unknown = billingDocument()): void => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.BILLING_PROVIDER = 'revenuecat';
    process.env.REVENUECAT_WEBHOOK_SECRET = 'whsec';
    process.env.BILLING_CONFIG_JSON = JSON.stringify(document);
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    for (const key of [
      'DEPLOYMENT_MODE',
      'BILLING_PROVIDER',
      'AUTH_MODE',
      'DATABASE_URL',
      'INSTANCE_CONNECTION_NAME',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'BETTER_AUTH_SECRET',
      'REVENUECAT_WEBHOOK_SECRET',
      'BILLING_CONFIG_JSON',
      'EDITION',
      'HOSTED_BILLING_ENABLED',
    ]) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('passes for self-hosted (no config)', () => {
    expect(() => validateBootConfig()).not.toThrow();
  });

  it('leaves billing provider config permissive in self-hosted mode', () => {
    process.env.DEPLOYMENT_MODE = 'self-hosted';
    process.env.BILLING_PROVIDER = 'bogus';
    expect(() => validateBootConfig()).not.toThrow();
  });

  it('throws on an invalid DEPLOYMENT_MODE value', () => {
    process.env.DEPLOYMENT_MODE = 'bogus';
    expect(() => validateBootConfig()).toThrow('Invalid DEPLOYMENT_MODE');
  });

  it('rejects legacy hosted mode instead of silently starting self-hosted', () => {
    process.env.EDITION = 'HOSTED';
    expect(() => validateBootConfig()).toThrow(
      'Legacy hosted configuration detected'
    );
  });

  it('rejects legacy billing enablement without the canonical mode', () => {
    process.env.HOSTED_BILLING_ENABLED = 'true';
    expect(() => validateBootConfig()).toThrow(
      'Legacy hosted configuration detected'
    );
  });

  it('throws on an invalid BILLING_PROVIDER value in hosted mode', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'bogus';
    expect(() => validateBootConfig()).toThrow('Invalid BILLING_PROVIDER');
  });

  it('rejects legacy billing enablement without BILLING_PROVIDER', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.HOSTED_BILLING_ENABLED = 'true';
    expect(() => validateBootConfig()).toThrow(
      'Legacy hosted billing configuration detected'
    );
  });

  it('passes for a fully configured hosted deployment (DATABASE_URL)', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    expect(() => validateBootConfig()).not.toThrow();
  });

  it('accepts Cloud SQL connector config in hosted mode', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.INSTANCE_CONNECTION_NAME = 'project:region:instance';
    process.env.DB_NAME = 'workout_agent';
    process.env.DB_USER = 'workout_agent';
    process.env.DB_PASSWORD = 'secret-password';
    process.env.BETTER_AUTH_SECRET = 'secret';
    expect(() => validateBootConfig()).not.toThrow();
  });

  it('throws for hosted Cloud SQL config without companion database vars', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.INSTANCE_CONNECTION_NAME = 'project:region:instance';
    process.env.BETTER_AUTH_SECRET = 'secret';
    expect(() => validateBootConfig()).toThrow(
      'Hosted mode with INSTANCE_CONNECTION_NAME requires DB_NAME, DB_USER, DB_PASSWORD'
    );
  });

  it('throws for hosted Cloud SQL config with a blank instance name', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.INSTANCE_CONNECTION_NAME = ' ';
    process.env.DB_NAME = 'workout_agent';
    process.env.DB_USER = 'workout_agent';
    process.env.DB_PASSWORD = 'secret-password';
    process.env.BETTER_AUTH_SECRET = 'secret';
    expect(() => validateBootConfig()).toThrow(
      'Hosted mode with INSTANCE_CONNECTION_NAME requires INSTANCE_CONNECTION_NAME'
    );
  });

  it('throws for hosted mode without a database', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BETTER_AUTH_SECRET = 'secret';
    expect(() => validateBootConfig()).toThrow('requires a database');
  });

  it('throws for hosted mode without BETTER_AUTH_SECRET', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    expect(() => validateBootConfig()).toThrow('BETTER_AUTH_SECRET');
  });

  it('throws for hosted revenuecat billing without a webhook secret', () => {
    configureRevenueCat();
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    expect(() => validateBootConfig()).toThrow('REVENUECAT_WEBHOOK_SECRET');
  });

  it('passes for fully configured hosted revenuecat billing', () => {
    configureRevenueCat();
    expect(() => validateBootConfig()).not.toThrow();
  });

  it('rejects missing billing configuration instead of applying defaults', () => {
    configureRevenueCat();
    delete process.env.BILLING_CONFIG_JSON;
    expect(() => validateBootConfig()).toThrow(
      'BILLING_CONFIG_JSON is required'
    );
  });

  it('rejects malformed billing configuration JSON', () => {
    configureRevenueCat();
    process.env.BILLING_CONFIG_JSON = '{';
    expect(() => validateBootConfig()).toThrow('must be valid JSON');
  });

  it('rejects oversized billing configuration before parsing', () => {
    configureRevenueCat();
    process.env.BILLING_CONFIG_JSON = `{"padding":"${'x'.repeat(33_000)}"}`;
    expect(() => validateBootConfig()).toThrow('exceeds the maximum length');
  });

  it('rejects an unknown billing configuration schema version', () => {
    configureRevenueCat({ ...billingDocument(), schemaVersion: 2 });
    expect(() => validateBootConfig()).toThrow('unsupported');
  });

  it('rejects unknown billing configuration properties', () => {
    configureRevenueCat({ ...billingDocument(), webhookSecret: 'embedded' });
    expect(() => validateBootConfig()).toThrow(
      'does not match billing configuration schema version 1'
    );
  });

  it('does not include rejected configuration contents in boot errors', () => {
    const sensitiveMarker = 'deployment-private-marker';
    configureRevenueCat({
      ...billingDocument(),
      unexpected: sensitiveMarker,
    });

    let message = '';
    try {
      validateBootConfig();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('does not match');
    expect(message).not.toContain(sensitiveMarker);
  });

  it('rejects duplicate configured identifiers', () => {
    const document = billingDocument();
    document.revenueCat.productIds = ['monthly', 'monthly'];
    configureRevenueCat(document);
    expect(() => validateBootConfig()).toThrow('does not match');
  });

  it('rejects unknown RevenueCat environments', () => {
    const document = billingDocument();
    document.revenueCat.environments = ['SANDBOX', 'STAGING'];
    configureRevenueCat(document);
    expect(() => validateBootConfig()).toThrow('does not match');
  });

  it('rejects invalid numeric billing settings', () => {
    const document = billingDocument();
    document.guardrails.accountMaxActiveGenerations = 0;
    configureRevenueCat(document);
    expect(() => validateBootConfig()).toThrow('does not match');
  });

  it('does not require or parse billing configuration when billing is disabled', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.BILLING_PROVIDER = 'none';
    process.env.BILLING_CONFIG_JSON = '{';
    expect(() => validateBootConfig()).not.toThrow();
  });
});
