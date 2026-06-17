/**
 * Tests for BetterAuthProvider
 *
 * Verifies:
 * - Identity comes only from validated sessions, not arbitrary headers
 * - x-user-id header is ignored
 * - Missing/invalid tokens return null
 */

import { BetterAuthProvider } from './provider.js';
import type { Auth } from './auth.js';

describe('BetterAuthProvider', () => {
  // Mock Auth instance
  const createMockAuth = (sessionResult: unknown) =>
    ({
      api: {
        getSession: jest.fn().mockResolvedValue(sessionResult),
      },
    }) as unknown as Auth;

  describe('authenticate', () => {
    it('should return null when no session headers are present', async () => {
      const auth = createMockAuth(null);
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test');
      const result = await provider.authenticate(request);

      expect(result).toBeNull();
      expect(auth.api.getSession).not.toHaveBeenCalled();
    });

    it('should return null when Cookie header is empty', async () => {
      const auth = createMockAuth(null);
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Cookie: '   ' },
      });
      const result = await provider.authenticate(request);

      expect(result).toBeNull();
      expect(auth.api.getSession).not.toHaveBeenCalled();
    });

    it('should return null when Authorization header is not Bearer', async () => {
      const auth = createMockAuth(null);
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      const result = await provider.authenticate(request);

      expect(result).toBeNull();
      expect(auth.api.getSession).not.toHaveBeenCalled();
    });

    it('should return null when Bearer token is empty', async () => {
      const auth = createMockAuth(null);
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer ' },
      });
      const result = await provider.authenticate(request);

      expect(result).toBeNull();
      expect(auth.api.getSession).not.toHaveBeenCalled();
    });

    it('should return userId and principalId from valid cookie session', async () => {
      const auth = createMockAuth({
        session: { id: 'session-123' },
        user: { id: 'user-456' },
      });
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Cookie: 'better-auth.session_token=token-abc' },
      });
      const result = await provider.authenticate(request);

      expect(result).toEqual({
        userId: 'user-456',
        principalId: 'session-123',
      });
    });

    it('should return userId and principalId from valid session', async () => {
      const auth = createMockAuth({
        session: { id: 'session-123' },
        user: { id: 'user-456' },
      });
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await provider.authenticate(request);

      expect(result).toEqual({
        userId: 'user-456',
        principalId: 'session-123',
      });
    });

    it('should return null when session validation fails', async () => {
      const auth = createMockAuth(null);
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      const result = await provider.authenticate(request);

      expect(result).toBeNull();
    });

    it('should return null when session is missing user', async () => {
      const auth = createMockAuth({
        session: { id: 'session-123' },
        user: null,
      });
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await provider.authenticate(request);

      expect(result).toBeNull();
    });

    it('should ignore x-user-id header (identity from session only)', async () => {
      // This test verifies that arbitrary headers cannot override session identity
      const auth = createMockAuth({
        session: { id: 'session-123' },
        user: { id: 'real-user-id' },
      });
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: {
          Authorization: 'Bearer valid-token',
          'x-user-id': 'attacker-id', // This should be ignored
        },
      });
      const result = await provider.authenticate(request);

      // Should return the real user ID from the session, not the header
      expect(result?.userId).toBe('real-user-id');
      expect(result?.userId).not.toBe('attacker-id');
    });

    it('should not grant access with x-user-id header but no valid session', async () => {
      const auth = createMockAuth(null);
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-user-id': 'attacker-id', // Cannot bypass auth
        },
      });
      const result = await provider.authenticate(request);

      // Should return null - header alone does not grant access
      expect(result).toBeNull();
    });

    it('should handle session validation exceptions gracefully', async () => {
      const auth = {
        api: {
          getSession: jest.fn().mockRejectedValue(new Error('Database error')),
        },
      } as unknown as Auth;
      const provider = new BetterAuthProvider(auth);

      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      // Should not throw, should return null
      const result = await provider.authenticate(request);
      expect(result).toBeNull();
    });
  });
});
