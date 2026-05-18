import type { AuthProvider, GenerationStore } from '../types';

import { createLogWorkoutHandler } from './log-workout';

function createAuthMock(): jest.Mocked<AuthProvider> {
  return {
    authenticate: jest.fn().mockResolvedValue({
      userId: 'user-123',
      principalId: 'device-123',
    }),
  };
}

function createStoreMock(): jest.Mocked<GenerationStore> {
  return {
    getState: jest.fn(),
    markPending: jest.fn(),
    persistPlan: jest.fn(),
    setError: jest.fn(),
    clearPlan: jest.fn(),
  } as unknown as jest.Mocked<GenerationStore>;
}

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/workouts/plan-123/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('createLogWorkoutHandler', () => {
  it('returns NOT_IMPLEMENTED for valid payloads without mutating generation state', async () => {
    const store = createStoreMock();
    const handler = createLogWorkoutHandler({ auth: createAuthMock(), store });

    const response = await handler(
      createRequest({ completedAt: '2026-05-17T02:00:00.000Z' }),
      'plan-123'
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(501);
    expect(json.code).toBe('NOT_IMPLEMENTED');
    expect(store.clearPlan).not.toHaveBeenCalled();
  });

  it('keeps validation errors ahead of the unimplemented response', async () => {
    const store = createStoreMock();
    const handler = createLogWorkoutHandler({ auth: createAuthMock(), store });

    const response = await handler(createRequest('{not json'), 'plan-123');
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(store.clearPlan).not.toHaveBeenCalled();
  });
});
