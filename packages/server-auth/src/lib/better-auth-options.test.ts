jest.mock('better-auth/plugins', () => ({
  anonymous: (options: unknown) => ({ id: 'anonymous', options }),
  bearer: () => ({ id: 'bearer' }),
}));

jest.mock('better-auth', () => ({
  APIError: class APIError extends Error {
    constructor(
      readonly status: string,
      readonly body: { code?: string; message?: string }
    ) {
      super(body.message);
    }
  },
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

  it.each([
    ['/sign-up/email', 'email'],
    ['/sign-in/email', 'email'],
    ['/callback/google', 'google'],
  ] as const)(
    'delegates %s to application account transition as %s',
    async (path, method) => {
      const transitionAnonymousAccount = jest.fn().mockResolvedValue(undefined);
      const options = createBetterAuthOptions({
        secret: 'secret',
        transitionAnonymousAccount,
      });
      const anonymousPlugin = options.plugins?.find(
        (plugin) => plugin.id === 'anonymous'
      ) as unknown as {
        options: {
          disableDeleteAnonymousUser?: boolean;
          onLinkAccount: (input: unknown) => Promise<void>;
        };
      };

      await anonymousPlugin.options.onLinkAccount({
        anonymousUser: { user: { id: 'anonymous-user' }, session: {} },
        newUser: { user: { id: 'authenticated-user' }, session: {} },
        ctx: { path },
      });

      expect(transitionAnonymousAccount).toHaveBeenCalledWith({
        sourceUserId: 'anonymous-user',
        targetUserId: 'authenticated-user',
        method,
      });
      expect(
        anonymousPlugin.options.disableDeleteAnonymousUser
      ).toBeUndefined();
    }
  );

  it('keeps schema-generation options side-effect free', () => {
    const options = createBetterAuthOptions({ secret: 'secret' });
    const anonymousPlugin = options.plugins?.find(
      (plugin) => plugin.id === 'anonymous'
    ) as unknown as { options: { onLinkAccount?: unknown } };

    expect(anonymousPlugin.options.onLinkAccount).toBeUndefined();
    expect(options.databaseHooks).toBeUndefined();
  });

  it('exposes only stable transition failures to the mobile client', async () => {
    const transitionAnonymousAccount = jest
      .fn()
      .mockRejectedValue({ code: 'target_has_application_state' });
    const options = createBetterAuthOptions({
      secret: 'secret',
      transitionAnonymousAccount,
    });
    const anonymousPlugin = options.plugins?.find(
      (plugin) => plugin.id === 'anonymous'
    ) as unknown as {
      options: { onLinkAccount: (input: unknown) => Promise<void> };
    };

    await expect(
      anonymousPlugin.options.onLinkAccount({
        anonymousUser: { user: { id: 'anonymous-user' }, session: {} },
        newUser: { user: { id: 'authenticated-user' }, session: {} },
        ctx: { path: '/sign-in/email' },
      })
    ).rejects.toEqual(
      expect.objectContaining({
        status: 'CONFLICT',
        body: expect.objectContaining({
          code: 'target_has_application_state',
        }),
      })
    );
  });
});
