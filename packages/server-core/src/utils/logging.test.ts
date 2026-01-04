import { redactSecrets, redactSensitiveStrings } from './logging';
import { createErrorResponse } from './errors';

describe('logging redaction', () => {
  it('redacts Authorization headers and tokens', () => {
    const redacted = redactSecrets({
      headers: {
        Authorization: 'Bearer secret-token',
        'x-api-key': 'sk-test-123',
        'x-safe': 'ok',
      },
      password: 'supersecret',
      token: 'abc123',
      nested: {
        refreshToken: 'r1',
      },
    });

    expect(redacted.headers.Authorization).toBe('[REDACTED]');
    expect(redacted.headers['x-api-key']).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.nested.refreshToken).toBe('[REDACTED]');
    expect(redacted.headers['x-safe']).toBe('ok');
  });

  it('redacts bearer tokens inside strings', () => {
    const value = redactSensitiveStrings('Authorization: Bearer abc.def-123');
    expect(value).toBe('Authorization: [REDACTED]');
  });

  it('redacts secrets from error responses', async () => {
    const response = createErrorResponse(
      'UNAUTHORIZED',
      'Invalid Authorization: Bearer secret-token',
      401
    );
    const json = await response.json();
    expect(json.message).toContain('[REDACTED]');
    expect(json.message).not.toContain('secret-token');
  });
});
