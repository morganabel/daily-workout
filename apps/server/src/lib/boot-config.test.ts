/**
 * Tests for validateBootConfig (boot-time configuration validation).
 */

// Mock external packages to avoid ESM import issues in Jest (mirrors auth-context.test.ts).
jest.mock('@workout-agent-ce/server-db', () => ({
  createDbFromEnv: jest.fn(),
}));

jest.mock('@workout-agent-ce/server-auth', () => ({
  createAuth: jest.fn(),
  BetterAuthProvider: jest.fn(),
}));

import { validateBootConfig } from './boot-config';

describe('validateBootConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    for (const key of [
      'DEPLOYMENT_MODE',
      'BILLING_PROVIDER',
      'EDITION',
      'HOSTED_BILLING_ENABLED',
      'AUTH_MODE',
      'DATABASE_URL',
      'INSTANCE_CONNECTION_NAME',
      'BETTER_AUTH_SECRET',
      'REVENUECAT_WEBHOOK_SECRET',
      'REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS',
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

  it('throws on an invalid DEPLOYMENT_MODE value', () => {
    process.env.DEPLOYMENT_MODE = 'bogus';
    expect(() => validateBootConfig()).toThrow('Invalid DEPLOYMENT_MODE');
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
    process.env.BETTER_AUTH_SECRET = 'secret';
    expect(() => validateBootConfig()).not.toThrow();
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
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.BILLING_PROVIDER = 'revenuecat';
    expect(() => validateBootConfig()).toThrow('REVENUECAT_WEBHOOK_SECRET');
  });

  it('passes for hosted revenuecat billing with a webhook secret', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.BILLING_PROVIDER = 'revenuecat';
    process.env.REVENUECAT_WEBHOOK_SECRET = 'whsec';
    expect(() => validateBootConfig()).not.toThrow();
  });

  it('allows revenuecat billing without a secret when unsigned webhooks are permitted', () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.BILLING_PROVIDER = 'revenuecat';
    process.env.REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS = 'true';
    expect(() => validateBootConfig()).not.toThrow();
  });

  it('honors EDITION=HOSTED as a backward-compatible alias', () => {
    process.env.EDITION = 'HOSTED';
    expect(() => validateBootConfig()).toThrow('requires a database');
  });
});
