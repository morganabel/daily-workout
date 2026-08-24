jest.mock('@workout-agent-ce/server-db', () => ({
  getCompletedAccountTransitionForTarget: jest.fn(),
}));
jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));

import { getCompletedAccountTransitionForTarget } from '@workout-agent-ce/server-db';
import { getAuthContext } from '@/lib/auth-context';

import { GET } from './route';

const mockedGetAuthContext = getAuthContext as jest.Mock;
const mockedGetTransition = getCompletedAccountTransitionForTarget as jest.Mock;

describe('GET /api/account-transition/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAuthContext.mockResolvedValue({
      db: { name: 'db' },
      provider: {
        authenticate: jest.fn().mockResolvedValue({ userId: 'target-b' }),
      },
    });
  });

  it('rejects unauthenticated requests', async () => {
    mockedGetAuthContext.mockResolvedValue({
      db: { name: 'db' },
      provider: { authenticate: jest.fn().mockResolvedValue(null) },
    });

    const response = await GET(
      new Request(
        'http://localhost/api/account-transition/status?sourceUserId=source-a'
      )
    );

    expect(response.status).toBe(401);
    expect(mockedGetTransition).not.toHaveBeenCalled();
  });

  it('does not expose transition status without Better Auth database state', async () => {
    mockedGetAuthContext.mockResolvedValue({
      db: null,
      provider: {
        authenticate: jest.fn().mockResolvedValue({ userId: 'target-b' }),
      },
    });

    const response = await GET(
      new Request(
        'http://localhost/api/account-transition/status?sourceUserId=source-a'
      )
    );
    expect(response.status).toBe(404);
    expect(mockedGetTransition).not.toHaveBeenCalled();
  });

  it('returns only a completed transition targeting the current user', async () => {
    mockedGetTransition.mockResolvedValue({
      sourceUserId: 'source-a',
      targetUserId: 'target-b',
      method: 'google',
      state: 'completed',
    });

    const response = await GET(
      new Request(
        'http://localhost/api/account-transition/status?sourceUserId=source-a'
      )
    );

    expect(response.status).toBe(200);
    expect(mockedGetTransition).toHaveBeenCalledWith(
      { name: 'db' },
      'source-a',
      'target-b'
    );
    await expect(response.json()).resolves.toEqual({
      sourceUserId: 'source-a',
      targetUserId: 'target-b',
      method: 'google',
      state: 'completed',
    });
  });

  it('does not reveal a transition belonging to another target', async () => {
    mockedGetTransition.mockResolvedValue(null);

    const response = await GET(
      new Request(
        'http://localhost/api/account-transition/status?sourceUserId=source-a'
      )
    );

    expect(response.status).toBe(404);
  });

  it('rejects malformed source identifiers', async () => {
    const response = await GET(
      new Request('http://localhost/api/account-transition/status')
    );

    expect(response.status).toBe(400);
    expect(mockedGetTransition).not.toHaveBeenCalled();
  });
});
