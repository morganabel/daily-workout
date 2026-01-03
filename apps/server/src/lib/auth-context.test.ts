/**
 * Tests for auth-context.ts
 *
 * Verifies:
 * - Auth mode selection algorithm
 * - Fail-closed behavior for HOSTED mode
 * - Stub fallback only works in CE/no-DB mode
 */

// Mock external dependencies to avoid ESM import issues in Jest
jest.mock('@workout-agent-ce/server-db', () => ({
  createDb: jest.fn(),
}));

jest.mock('@workout-agent-ce/server-auth', () => ({
  createAuth: jest.fn(),
  BetterAuthProvider: jest.fn(),
}));

import {
  resolveAuthMode,
  validateAuthConfig,
  resetAuthContext,
} from './auth-context';

describe('auth-context', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment and cached context before each test
    jest.resetModules();
    resetAuthContext();
    process.env = { ...originalEnv };
    // Clear auth-related env vars
    delete process.env.AUTH_MODE;
    delete process.env.DATABASE_URL;
    delete process.env.EDITION;
    delete process.env.BETTER_AUTH_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('resolveAuthMode', () => {
    it('should return stub when no DATABASE_URL is set', () => {
      expect(resolveAuthMode()).toBe('stub');
    });

    it('should return better-auth when DATABASE_URL is set', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      expect(resolveAuthMode()).toBe('better-auth');
    });

    it('should respect explicit AUTH_MODE=stub override', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.AUTH_MODE = 'stub';
      expect(resolveAuthMode()).toBe('stub');
    });

    it('should respect explicit AUTH_MODE=better-auth override', () => {
      process.env.AUTH_MODE = 'better-auth';
      expect(resolveAuthMode()).toBe('better-auth');
    });

    it('should be case-insensitive for AUTH_MODE', () => {
      process.env.AUTH_MODE = 'BETTER-AUTH';
      expect(resolveAuthMode()).toBe('better-auth');

      process.env.AUTH_MODE = 'STUB';
      expect(resolveAuthMode()).toBe('stub');
    });
  });

  describe('validateAuthConfig', () => {
    it('should pass for CE mode with stub auth', () => {
      process.env.EDITION = 'CE';
      expect(() => validateAuthConfig('stub')).not.toThrow();
    });

    it('should pass for CE mode with better-auth', () => {
      process.env.EDITION = 'CE';
      expect(() => validateAuthConfig('better-auth')).not.toThrow();
    });

    it('should pass for HOSTED mode with better-auth', () => {
      process.env.EDITION = 'HOSTED';
      expect(() => validateAuthConfig('better-auth')).not.toThrow();
    });

    it('should throw for HOSTED mode with stub auth (fail-closed)', () => {
      process.env.EDITION = 'HOSTED';
      expect(() => validateAuthConfig('stub')).toThrow(
        'EDITION=HOSTED requires Better Auth'
      );
    });

    it('should treat OSS as alias for CE', () => {
      process.env.EDITION = 'OSS';
      expect(() => validateAuthConfig('stub')).not.toThrow();
    });

    it('should pass when EDITION is not set (defaults to CE behavior)', () => {
      expect(() => validateAuthConfig('stub')).not.toThrow();
    });
  });

  describe('fail-closed hosted auth', () => {
    it('should fail fast at startup when HOSTED but no DATABASE_URL', () => {
      process.env.EDITION = 'HOSTED';
      // DATABASE_URL is not set, so resolveAuthMode returns 'stub'
      const mode = resolveAuthMode();
      expect(() => validateAuthConfig(mode)).toThrow(
        'EDITION=HOSTED requires Better Auth'
      );
    });
  });
});
