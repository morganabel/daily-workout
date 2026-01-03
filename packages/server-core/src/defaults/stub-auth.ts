import type { AuthProvider, AuthResult } from '../types';

/**
 * Stub authentication provider for CE deployments without a database.
 * Accepts any non-empty Bearer token and returns a stub user identity.
 *
 * For stub auth, the token itself serves as both userId and principalId since
 * there's no server-side session management. This allows development and
 * self-hosted deployments to work without database configuration.
 *
 * Production hosted deployments should use BetterAuthProvider from @workout-agent-ce/server-auth.
 */
export class StubAuthProvider implements AuthProvider {
  async authenticate(request: Request): Promise<AuthResult | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7).trim();
    if (token.length === 0) {
      return null;
    }

    // Stub: accept any non-empty token
    // Use the token as both userId and principalId for stub mode
    // In production, BetterAuthProvider validates sessions against the database
    return {
      userId: `stub-${token}`,
      principalId: token,
    };
  }
}
