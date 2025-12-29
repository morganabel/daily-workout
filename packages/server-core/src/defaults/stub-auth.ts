import type { AuthProvider, AuthResult } from '../types';

/**
 * Stub authentication provider for OSS deployments.
 * Accepts any non-empty Bearer token and returns a stub user ID.
 *
 * Production deployments should replace this with Better Auth or a database-backed provider.
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
    // In production, this would query the DeviceToken table or validate via Better Auth
    return {
      userId: 'user-stub',
      deviceToken: token,
    };
  }
}
