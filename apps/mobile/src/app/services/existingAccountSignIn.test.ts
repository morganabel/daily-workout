import { retryExistingAccountSignIn } from './existingAccountSignIn';

describe('existing-account sign-in', () => {
  it('discards anonymous A and retries after the stable existing-target conflict', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValueOnce({
        error: { code: 'target_has_application_state' },
      })
      .mockResolvedValueOnce({ data: { user: { id: 'account-b' } } });
    const discard = jest.fn().mockResolvedValue(undefined);
    const anonymous = { id: 'anonymous-a', isAnonymous: true };

    await expect(
      retryExistingAccountSignIn(anonymous, attempt, discard)
    ).resolves.toEqual({
      result: { data: { user: { id: 'account-b' } } },
      previousUser: null,
    });
    expect(discard).toHaveBeenCalledWith(anonymous);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('does not discard A for an ordinary authentication failure', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValue({ error: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
    const discard = jest.fn();
    const anonymous = { id: 'anonymous-a', isAnonymous: true };

    await expect(
      retryExistingAccountSignIn(anonymous, attempt, discard)
    ).resolves.toEqual({
      result: { error: { code: 'INVALID_EMAIL_OR_PASSWORD' } },
      previousUser: anonymous,
    });
    expect(discard).not.toHaveBeenCalled();
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('does not retry the conflict without an anonymous source', async () => {
    const result = { error: { code: 'target_has_application_state' } };
    const attempt = jest.fn().mockResolvedValue(result);
    const discard = jest.fn();

    await expect(
      retryExistingAccountSignIn(null, attempt, discard)
    ).resolves.toEqual({ result, previousUser: null });
    expect(discard).not.toHaveBeenCalled();
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
