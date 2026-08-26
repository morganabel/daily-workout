import { hasCompletedGoogleSignIn } from './google-auth-verification';

describe('Google OAuth completion verification', () => {
  it('rejects a cancelled anonymous upgrade', () => {
    const anonymousUser = { id: 'anonymous-user', isAnonymous: true };

    expect(hasCompletedGoogleSignIn(anonymousUser, anonymousUser, [])).toBe(
      false
    );
  });

  it('rejects a callback that did not establish a session', () => {
    expect(hasCompletedGoogleSignIn(undefined, undefined, [])).toBe(false);
  });

  it('accepts an anonymous A to authenticated Google B session change', () => {
    expect(
      hasCompletedGoogleSignIn(
        { id: 'anonymous-user', isAnonymous: true },
        { id: 'google-user', isAnonymous: false },
        [{ providerId: 'google', userId: 'google-user' }]
      )
    ).toBe(true);
  });

  it('accepts a signed-out user only after Google establishes a session and account', () => {
    expect(
      hasCompletedGoogleSignIn(
        undefined,
        { id: 'google-user', isAnonymous: false },
        [{ providerId: 'google', userId: 'google-user' }]
      )
    ).toBe(true);
  });
});
