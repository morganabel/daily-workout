import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { jest } from '@jest/globals';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { Pool } from 'pg';

import {
  AccountTransitionError,
  transitionAnonymousAccount,
  type Database,
} from '@leveza/server-db';
import { schema } from '@leveza/server-db';

import { createBetterAuthOptions } from './better-auth-options.js';
import { createAuth } from './auth.js';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let db: Database;

const baseURL = 'http://localhost:3000';
const secret = 'integration-secret-integration-secret-1234';

type AuthInstance = {
  handler(request: Request): Promise<Response>;
};

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/(?:^|,\s*)(better-auth\.session_token=[^;]+)/);
  if (!match?.[1]) throw new Error('session cookie missing');
  return match[1];
}

function allCookiesFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie') ?? '';
  if (!setCookie) throw new Error('cookies missing');
  return setCookie
    .split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .map((cookie) => cookie.trim().split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function authRequest(
  auth: AuthInstance,
  pathName: string,
  body: Record<string, unknown>,
  cookie?: string
): Promise<Response> {
  return auth.handler(
    new Request(`${baseURL}/api/auth${pathName}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseURL,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

async function getSession(
  auth: AuthInstance,
  cookie: string
): Promise<Response> {
  return auth.handler(
    new Request(`${baseURL}/api/auth/get-session`, {
      headers: { cookie, origin: baseURL },
    })
  );
}

async function signInAnonymous(auth: AuthInstance): Promise<{
  userId: string;
  cookie: string;
}> {
  const response = await authRequest(auth, '/sign-in/anonymous', {});
  expect(response.status).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  return { userId: body.user.id, cookie: cookieFrom(response) };
}

function createTestAuth(
  callback: (input: {
    sourceUserId: string;
    targetUserId: string;
    method: 'email' | 'google';
  }) => Promise<void> = async (input) => {
    await transitionAnonymousAccount(db, input);
  }
): AuthInstance {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    ...createBetterAuthOptions({
      secret,
      baseURL,
      trustedOrigins: [baseURL],
      transitionAnonymousAccount: callback,
    }),
    rateLimit: { enabled: false },
  });
}

function createGoogleTestAuth(
  callback: (input: {
    sourceUserId: string;
    targetUserId: string;
    method: 'email' | 'google';
  }) => Promise<void>
): AuthInstance {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    ...createBetterAuthOptions({
      secret,
      baseURL,
      trustedOrigins: [baseURL],
      transitionAnonymousAccount: callback,
    }),
    socialProviders: {
      google: {
        clientId: 'google-client',
        clientSecret: 'google-secret',
        getUserInfo: async () => ({
          user: {
            name: 'Google Person',
            email: 'google@example.test',
            image: 'https://example.test/avatar.png',
            emailVerified: true,
          },
          data: {
            aud: 'google-client',
            azp: 'google-client',
            email: 'google@example.test',
            email_verified: true,
            exp: 2_000_000_000,
            family_name: 'Person',
            given_name: 'Google',
            iat: 1_999_999_000,
            iss: 'https://accounts.google.com',
            locale: 'en',
            name: 'Google Person',
            nbf: 1_999_999_000,
            picture: 'https://example.test/avatar.png',
            sub: 'google-subject',
          },
        }),
      },
    },
    rateLimit: { enabled: false },
  });
}

async function runGoogleOAuth(
  auth: AuthInstance,
  anonymousCookie: string
): Promise<Response> {
  const started = await authRequest(
    auth,
    '/sign-in/social',
    { provider: 'google', callbackURL: `${baseURL}/done` },
    anonymousCookie
  );
  expect(started.status).toBe(200);
  const body = (await started.json()) as { url: string };
  const authorizationURL = new URL(body.url);
  const state = authorizationURL.searchParams.get('state');
  if (!state) throw new Error('oauth state missing');
  const stateCookies = allCookiesFrom(started);

  return auth.handler(
    new Request(
      `${baseURL}/api/auth/callback/google?code=test-code&state=${encodeURIComponent(
        state
      )}`,
      {
        method: 'GET',
        // Deliberately omit A's session cookie. Better Auth 1.7 must recover
        // the trusted anonymous identity from server-only OAuth state.
        headers: { cookie: stateCookies },
      }
    )
  );
}

async function resetDatabase(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      ${schema.accountTransition},
      ${schema.aiModelCall},
      ${schema.aiUsageEvent},
      ${schema.billingWebhookEvent},
      ${schema.billingCustomerMapping},
      ${schema.billingEntitlementProjection},
      ${schema.includedGenerationReservation},
      ${schema.includedGenerationWindow},
      ${schema.verification},
      ${schema.account},
      ${schema.session},
      ${schema.user}
    CASCADE
  `);
}

async function seedUsage(userId: string): Promise<void> {
  await db.insert(schema.aiUsageEvent).values({
    id: `usage-${userId}`,
    operationId: `operation-${userId}`,
    eventId: 'event',
    userId,
    operation: 'generate',
    provider: 'openai',
    result: 'success',
    byok: false,
    occurredAt: new Date('2026-08-24T00:00:00.000Z'),
    callCount: 1,
    successfulCallCount: 1,
    failedCallCount: 0,
    unknownCostCallCount: 0,
    inputTokens: 1,
    outputTokens: 1,
    cachedInputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 2,
    accountedCostNanoUsd: 1n,
    platformCostNanoUsd: 1n,
    byokEstimatedCostNanoUsd: 0n,
    allowanceChargeNanoUsd: 1n,
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('leveza_auth_contract_test')
    .withUsername('test')
    .withPassword('test')
    .start();
  const connectionString = container.getConnectionUri();
  const migrationPool = new Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(migrationPool, { schema }), {
      migrationsFolder: path.resolve(process.cwd(), '../server-db/drizzle'),
    });
  } finally {
    await migrationPool.end();
  }
  pool = new Pool({ connectionString, max: 5 });
  db = drizzle(pool, { schema });
});

beforeEach(resetDatabase);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('Better Auth 1.7 anonymous account transition contract', () => {
  it('enables account transition in the production auth factory', async () => {
    const auth = createAuth({
      db,
      secret,
      baseURL,
      trustedOrigins: [baseURL],
    });
    const anonymous = await signInAnonymous(auth);
    await seedUsage(anonymous.userId);

    const response = await authRequest(
      auth,
      '/sign-up/email',
      {
        name: 'Always On',
        email: 'always-on@example.test',
        password: 'password123',
      },
      anonymous.cookie
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(0);
    await expect(
      db
        .select({ userId: schema.aiUsageEvent.userId })
        .from(schema.aiUsageEvent)
    ).resolves.toEqual([{ userId: body.user.id }]);
    await expect(db.select().from(schema.accountTransition)).resolves.toEqual([
      expect.objectContaining({
        sourceUserId: anonymous.userId,
        targetUserId: body.user.id,
        state: 'completed',
      }),
    ]);
  });

  it('passes A and B to the callback, moves application state, and deletes A', async () => {
    const transitions: Array<{ sourceUserId: string; targetUserId: string }> =
      [];
    const auth = createTestAuth(async (input) => {
      transitions.push(input);
      await transitionAnonymousAccount(db, input);
    });
    const anonymous = await signInAnonymous(auth);
    await seedUsage(anonymous.userId);

    const response = await authRequest(
      auth,
      '/sign-up/email',
      { name: 'Person', email: 'person@example.test', password: 'password123' },
      anonymous.cookie
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).not.toBe(anonymous.userId);
    expect(transitions).toEqual([
      {
        sourceUserId: anonymous.userId,
        targetUserId: body.user.id,
        method: 'email',
      },
    ]);
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(0);
    await expect(
      db
        .select({ userId: schema.aiUsageEvent.userId })
        .from(schema.aiUsageEvent)
    ).resolves.toEqual([{ userId: body.user.id }]);
  });

  it('retains A and retries email after B was created and migration failed', async () => {
    const auth = createTestAuth();
    const anonymous = await signInAnonymous(auth);
    await seedUsage(anonymous.userId);
    await db.execute(sql`
      CREATE FUNCTION fail_auth_transition_usage() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'injected auth transition failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.execute(sql`
      CREATE TRIGGER fail_auth_transition_usage
      BEFORE UPDATE ON ai_usage_event
      FOR EACH ROW EXECUTE FUNCTION fail_auth_transition_usage()
    `);

    try {
      const failed = await authRequest(
        auth,
        '/sign-up/email',
        { name: 'Retry', email: 'retry@example.test', password: 'password123' },
        anonymous.cookie
      );
      expect(failed.status).toBeGreaterThanOrEqual(400);
    } finally {
      await db.execute(
        sql`DROP TRIGGER fail_auth_transition_usage ON ai_usage_event`
      );
      await db.execute(sql`DROP FUNCTION fail_auth_transition_usage()`);
    }

    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(1);
    const retry = await authRequest(
      auth,
      '/sign-in/email',
      { email: 'retry@example.test', password: 'password123' },
      anonymous.cookie
    );
    expect(retry.status).toBe(200);
    const retryBody = (await retry.json()) as { user: { id: string } };
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(0);
    await expect(db.select().from(schema.accountTransition)).resolves.toEqual([
      expect.objectContaining({
        targetUserId: retryBody.user.id,
        state: 'completed',
        attemptCount: 2,
      }),
    ]);
  });

  it('discards A and signs in independently when existing B owns state', async () => {
    const auth = createTestAuth();
    const existingResponse = await authRequest(auth, '/sign-up/email', {
      name: 'Existing',
      email: 'existing@example.test',
      password: 'password123',
    });
    expect(existingResponse.status).toBe(200);
    const existingBody = (await existingResponse.json()) as {
      user: { id: string };
    };
    await seedUsage(existingBody.user.id);

    const anonymous = await signInAnonymous(auth);
    await seedUsage(anonymous.userId);
    const conflict = await authRequest(
      auth,
      '/sign-in/email',
      { email: 'existing@example.test', password: 'password123' },
      anonymous.cookie
    );
    expect(conflict.status).toBe(409);
    const conflictSession = await getSession(auth, cookieFrom(conflict));
    await expect(conflictSession.json()).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: existingBody.user.id }),
      })
    );
    await expect(conflict.json()).resolves.toEqual(
      expect.objectContaining({ code: 'target_has_application_state' })
    );

    const discarded = await authRequest(
      auth,
      '/delete-anonymous-user',
      {},
      anonymous.cookie
    );
    expect(discarded.status).toBe(200);
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(0);
    await expect(
      db
        .select({ userId: schema.aiUsageEvent.userId })
        .from(schema.aiUsageEvent)
    ).resolves.toEqual([{ userId: existingBody.user.id }]);

    const signedIn = await authRequest(auth, '/sign-in/email', {
      email: 'existing@example.test',
      password: 'password123',
    });
    expect(signedIn.status).toBe(200);
    await expect(signedIn.json()).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: existingBody.user.id }),
      })
    );
  });

  it('retries idempotently after migration committed but Better Auth cleanup failed', async () => {
    let failAfterCommit = true;
    const auth = createTestAuth(async (input) => {
      await transitionAnonymousAccount(db, input);
      if (failAfterCommit) {
        failAfterCommit = false;
        throw new AccountTransitionError('migration_failed');
      }
    });
    const anonymous = await signInAnonymous(auth);
    const failed = await authRequest(
      auth,
      '/sign-up/email',
      {
        name: 'Committed',
        email: 'committed@example.test',
        password: 'password123',
      },
      anonymous.cookie
    );
    expect(failed.status).toBeGreaterThanOrEqual(400);
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(1);
    await expect(db.select().from(schema.accountTransition)).resolves.toEqual([
      expect.objectContaining({ state: 'completed', attemptCount: 1 }),
    ]);

    const retry = await authRequest(
      auth,
      '/sign-in/email',
      { email: 'committed@example.test', password: 'password123' },
      anonymous.cookie
    );
    expect(retry.status).toBe(200);
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(0);
    await expect(db.select().from(schema.accountTransition)).resolves.toEqual([
      expect.objectContaining({ state: 'completed', attemptCount: 2 }),
    ]);
  });

  it('rejects a Better Auth retry that pairs A with a different target', async () => {
    let keepAnonymous = true;
    const auth = createTestAuth(async (input) => {
      await transitionAnonymousAccount(db, input);
      if (keepAnonymous) {
        keepAnonymous = false;
        throw new AccountTransitionError('migration_failed');
      }
    });
    const anonymous = await signInAnonymous(auth);
    const first = await authRequest(
      auth,
      '/sign-up/email',
      { name: 'First', email: 'first@example.test', password: 'password123' },
      anonymous.cookie
    );
    expect(first.status).toBeGreaterThanOrEqual(400);
    const [paired] = await db.select().from(schema.accountTransition);
    expect(paired).toEqual(
      expect.objectContaining({
        sourceUserId: anonymous.userId,
        state: 'completed',
      })
    );

    const conflicting = await authRequest(
      auth,
      '/sign-up/email',
      { name: 'Second', email: 'second@example.test', password: 'password123' },
      anonymous.cookie
    );
    expect(conflicting.status).toBe(409);
    await expect(db.select().from(schema.accountTransition)).resolves.toEqual([
      expect.objectContaining({
        targetUserId: paired?.targetUserId,
        state: 'completed',
      }),
    ]);
    await expect(
      db.select().from(schema.user).where(eq(schema.user.id, anonymous.userId))
    ).resolves.toHaveLength(1);
  });

  it('recovers trusted A from Google state and retries after B creation', async () => {
    let failFirstCallback = true;
    const transitions: Array<{
      sourceUserId: string;
      targetUserId: string;
      method: string;
    }> = [];
    const auth = createGoogleTestAuth(async (input) => {
      transitions.push(input);
      if (failFirstCallback) {
        failFirstCallback = false;
        throw new AccountTransitionError('migration_failed');
      }
      await transitionAnonymousAccount(db, input);
    });
    const anonymous = await signInAnonymous(auth);
    await seedUsage(anonymous.userId);
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        if (String(input) === 'https://oauth2.googleapis.com/token') {
          return Response.json({
            access_token: 'google-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
          });
        }
        return originalFetch(input, init);
      });

    try {
      const failed = await runGoogleOAuth(auth, anonymous.cookie);
      expect(failed.status).toBeGreaterThanOrEqual(300);
      await expect(
        db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, anonymous.userId))
      ).resolves.toHaveLength(1);

      const retried = await runGoogleOAuth(auth, anonymous.cookie);
      expect(retried.status).toBeGreaterThanOrEqual(300);
      await expect(
        db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, anonymous.userId))
      ).resolves.toHaveLength(0);
      expect(transitions).toHaveLength(2);
      expect(transitions[0]).toEqual(
        expect.objectContaining({
          sourceUserId: anonymous.userId,
          method: 'google',
        })
      );
      expect(transitions[1]).toEqual(transitions[0]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
