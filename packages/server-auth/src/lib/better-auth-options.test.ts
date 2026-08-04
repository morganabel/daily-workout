jest.mock('better-auth/plugins', () => ({
  anonymous: (options: unknown) => ({ id: 'anonymous', options }),
  bearer: () => ({ id: 'bearer' }),
}));

jest.mock('@better-auth/expo', () => ({
  expo: () => ({ id: 'expo' }),
}));

import {
  createBetterAuthOptions,
  getGoogleAuthConfig,
} from './better-auth-options.js';

describe('Better Auth options', () => {
  it('only registers Google when both credentials are configured', () => {
    const withoutGoogle = createBetterAuthOptions({ secret: 'secret' });
    expect(withoutGoogle.socialProviders).toBeUndefined();

    const withGoogle = createBetterAuthOptions({
      secret: 'secret',
      google: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
      },
    });

    expect(withGoogle.socialProviders).toEqual({
      google: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
      },
    });
    expect(withGoogle.account?.encryptOAuthTokens).toBe(true);
    expect(withGoogle.account?.accountLinking?.trustedProviders).toEqual([
      'google',
    ]);
  });

  it('resolves and trims Google environment values', () => {
    expect(
      getGoogleAuthConfig({
        GOOGLE_CLIENT_ID: '  client-id ',
        GOOGLE_CLIENT_SECRET: ' client-secret ',
      })
    ).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    expect(getGoogleAuthConfig({})).toBeUndefined();
  });

  it('keeps Google unavailable when either credential is missing', () => {
    expect(
      getGoogleAuthConfig({ GOOGLE_CLIENT_ID: 'client-id' })
    ).toBeUndefined();
    expect(
      getGoogleAuthConfig({ GOOGLE_CLIENT_SECRET: 'client-secret' })
    ).toBeUndefined();
  });

  it('moves a fresh account upgrade onto the anonymous user id', async () => {
    const promoteAnonymousUser = jest.fn().mockResolvedValue({
      id: 'anonymous-user',
      email: 'new@example.com',
      name: 'New User',
      emailVerified: true,
      image: null,
      isAnonymous: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const options = createBetterAuthOptions({
      secret: 'secret',
      promoteAnonymousUser,
    });
    const setNewSession = jest.fn();
    const anonymousPlugin = options.plugins?.find(
      (plugin) => plugin.id === 'anonymous'
    ) as unknown as {
      options: {
        onLinkAccount: (input: unknown) => Promise<void>;
      };
    };

    await anonymousPlugin.options.onLinkAccount({
      anonymousUser: { user: { id: 'anonymous-user' }, session: {} },
      newUser: {
        user: {
          id: 'fresh-user',
          email: 'new@example.com',
          name: 'New User',
          emailVerified: true,
        },
        session: { token: 'session-token', userId: 'fresh-user' },
      },
      ctx: {
        path: '/sign-up/email',
        context: {
          setNewSession,
        },
      },
    });

    expect(promoteAnonymousUser).toHaveBeenCalledWith({
      anonymousUserId: 'anonymous-user',
      temporaryUserId: 'fresh-user',
      email: 'new@example.com',
      name: 'New User',
      emailVerified: true,
    });
    expect(setNewSession).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ userId: 'anonymous-user' }),
      })
    );
  });

  it('persists the verified Google profile when link-social promotes an anonymous user', async () => {
    const clientId = 'client-id.apps.googleusercontent.com';
    const payload = Buffer.from(
      JSON.stringify({
        iss: 'https://accounts.google.com',
        aud: clientId,
        sub: 'google-account-id',
        exp: Math.floor(Date.now() / 1000) + 300,
        email: 'person@example.com',
        email_verified: true,
        name: 'Google Person',
        picture: 'https://example.com/person.jpg',
      })
    ).toString('base64url');
    const options = createBetterAuthOptions({
      secret: 'secret',
      google: { clientId, clientSecret: 'client-secret' },
    });
    const accountCreateAfter = options.databaseHooks?.account?.create?.after;
    const updateUser = jest.fn().mockResolvedValue(undefined);
    const adapter = {
      findUserById: jest
        .fn()
        .mockResolvedValue({ id: 'anonymous-user', isAnonymous: true }),
      updateUser,
    };

    await accountCreateAfter?.(
      {
        providerId: 'google',
        userId: 'anonymous-user',
        accountId: 'google-account-id',
        idToken: `header.${payload}.signature`,
      } as never,
      { context: { internalAdapter: adapter } } as never
    );

    expect(updateUser).toHaveBeenCalledWith('anonymous-user', {
      email: 'person@example.com',
      emailVerified: true,
      name: 'Google Person',
      image: 'https://example.com/person.jpg',
      isAnonymous: false,
    });
  });
});
