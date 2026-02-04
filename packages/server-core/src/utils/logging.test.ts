import {
  redactSecrets,
  redactSecretsAndPii,
  redactSensitiveStrings,
  getLogger,
  createLogger,
  getOrCreateRequestId,
  attachRequestId,
  resetLoggerForTest,
  getUrlPath,
  createRequestContext,
} from './logging';
import { createErrorResponse } from './errors';

afterEach(() => {
  resetLoggerForTest();
  delete process.env.LOG_LEVEL;
  delete process.env.LOG_PII;
  delete process.env.LOG_COMPONENT;
});

describe('logging redaction', () => {
  it('redacts Authorization headers and tokens', () => {
    const redacted = redactSecrets({
      headers: {
        Authorization: 'Bearer secret-token',
        Cookie: 'better-auth.session_token=super-secret-cookie',
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
    expect(redacted.headers.Cookie).toBe('[REDACTED]');
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
    const json = (await response.json()) as { message: string };
    expect(json.message).toContain('[REDACTED]');
    expect(json.message).not.toContain('secret-token');
  });

  it('redacts sk- style API keys', () => {
    const value = redactSensitiveStrings('key is sk-abc123_DEF-456');
    expect(value).not.toContain('sk-abc123');
    expect(value).toContain('[REDACTED]');
  });

  it('redacts Google AI keys (AIza...)', () => {
    const value = redactSensitiveStrings('key=AIzaSyB1234567890abcdef');
    expect(value).not.toContain('AIzaSy');
    expect(value).toContain('[REDACTED]');
  });
});

describe('redactSecretsAndPii', () => {
  it('redacts PII fields alongside secrets', () => {
    const redacted = redactSecretsAndPii({
      userId: 'u123',
      principalId: 'p456',
      email: 'user@example.com',
      feedback: 'my workout was great',
      provider: 'openai',
      password: 'secret',
    });

    expect(redacted.userId).toBe('[REDACTED]');
    expect(redacted.principalId).toBe('[REDACTED]');
    expect(redacted.email).toBe('[REDACTED]');
    expect(redacted.feedback).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.provider).toBe('openai');
  });

  it('does not redact PII when using redactSecrets', () => {
    const redacted = redactSecrets({
      userId: 'u123',
      email: 'user@example.com',
      password: 'secret',
    });

    expect(redacted.userId).toBe('u123');
    expect(redacted.email).toBe('user@example.com');
    expect(redacted.password).toBe('[REDACTED]');
  });
});

describe('Logger', () => {
  it('getLogger returns a singleton', () => {
    const a = getLogger();
    const b = getLogger();
    expect(a).toBe(b);
  });

  it('resetLoggerForTest clears the singleton', () => {
    const a = getLogger();
    resetLoggerForTest();
    const b = getLogger();
    expect(a).not.toBe(b);
  });

  it('createLogger returns a child logger', () => {
    const logger = createLogger({ route: 'test.route' });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('emits JSON to console.log at info level', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.info('hello world', { key: 'value' });

      expect(spy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.level).toBe('info');
      expect(parsed.msg).toBe('hello world');
      expect(parsed.context.route).toBe('test');
      expect(parsed.data.key).toBe('value');
      expect(parsed.ts).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('emits to console.error at error level', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.error('something broke');

      expect(spy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.level).toBe('error');
    } finally {
      spy.mockRestore();
    }
  });

  it('emits to console.warn at warn level', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.warn('careful');

      expect(spy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.level).toBe('warn');
    } finally {
      spy.mockRestore();
    }
  });

  it('respects LOG_LEVEL filtering', () => {
    process.env.LOG_LEVEL = 'warn';
    resetLoggerForTest();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.info('should be suppressed');
      logger.warn('should appear');

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('normalizes error objects in data', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.error('failed', { error: new Error('boom') });

      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.error.name).toBe('Error');
      expect(parsed.error.message).toBe('boom');
      expect(parsed.data).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('prefixes reserved field names in data', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.info('test', { level: 'custom', msg: 'custom', safe: 'ok' });

      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.data._level).toBe('custom');
      expect(parsed.data._msg).toBe('custom');
      expect(parsed.data.safe).toBe('ok');
    } finally {
      spy.mockRestore();
    }
  });

  it('redacts secrets from logged data', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.info('test', { password: 'secret123', safe: 'ok' });

      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.data.password).toBe('[REDACTED]');
      expect(parsed.data.safe).toBe('ok');
    } finally {
      spy.mockRestore();
    }
  });

  it('redacts PII from logged data by default', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.info('test', { userId: 'u123', provider: 'openai' });

      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.data.userId).toBe('[REDACTED]');
      expect(parsed.data.provider).toBe('openai');
    } finally {
      spy.mockRestore();
    }
  });

  it('includes PII when LOG_PII is enabled', () => {
    process.env.LOG_PII = 'true';
    resetLoggerForTest();

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const logger = createLogger({ route: 'test' });
      logger.info('test', { userId: 'u123', provider: 'openai' });

      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.data.userId).toBe('u123');
      expect(parsed.data.provider).toBe('openai');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('getOrCreateRequestId', () => {
  it('returns x-request-id header when present', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-request-id': 'test-id-123' },
    });
    expect(getOrCreateRequestId(request)).toBe('test-id-123');
  });

  it('returns x-correlation-id as fallback', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-correlation-id': 'corr-456' },
    });
    expect(getOrCreateRequestId(request)).toBe('corr-456');
  });

  it('returns x-amzn-trace-id as fallback', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-amzn-trace-id': 'Root=1-abc' },
    });
    expect(getOrCreateRequestId(request)).toBe('Root=1-abc');
  });

  it('truncates long header values to 128 chars', () => {
    const longId = 'a'.repeat(200);
    const request = new Request('http://localhost', {
      headers: { 'x-request-id': longId },
    });
    expect(getOrCreateRequestId(request)).toHaveLength(128);
  });

  it('generates an ID when no header is present', () => {
    const request = new Request('http://localhost');
    const id = getOrCreateRequestId(request);
    expect(id).toBeDefined();
    expect(id.length).toBeGreaterThan(0);
  });

  it('prefers x-request-id over x-correlation-id', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-request-id': 'primary',
        'x-correlation-id': 'secondary',
      },
    });
    expect(getOrCreateRequestId(request)).toBe('primary');
  });
});

describe('attachRequestId', () => {
  it('sets x-request-id header on response', () => {
    const response = new Response('ok');
    attachRequestId(response, 'test-123');
    expect(response.headers.get('x-request-id')).toBe('test-123');
  });

  it('returns the same response object', () => {
    const response = new Response('ok');
    const result = attachRequestId(response, 'test-123');
    expect(result).toBe(response);
  });
});

describe('getUrlPath', () => {
  it('extracts pathname from a valid URL', () => {
    const request = new Request('http://localhost:3000/api/hello?foo=bar');
    expect(getUrlPath(request)).toBe('/api/hello');
  });

  it('returns "unknown" for invalid URLs', () => {
    const request = { url: 'not-a-url' } as Request;
    expect(getUrlPath(request)).toBe('unknown');
  });
});

describe('createRequestContext', () => {
  it('returns requestId, urlPath, startedAt, and log', () => {
    const request = new Request('http://localhost:3000/api/test', {
      headers: { 'x-request-id': 'ctx-test-id' },
    });
    const ctx = createRequestContext(request, 'test.route');

    expect(ctx.requestId).toBe('ctx-test-id');
    expect(ctx.urlPath).toBe('/api/test');
    expect(typeof ctx.startedAt).toBe('number');
    expect(ctx.startedAt).toBeLessThanOrEqual(Date.now());
    expect(typeof ctx.log.info).toBe('function');
  });

  it('generates requestId when no header is present', () => {
    const request = new Request('http://localhost:3000/api/test');
    const ctx = createRequestContext(request, 'test.route');
    expect(ctx.requestId).toBeDefined();
    expect(ctx.requestId.length).toBeGreaterThan(0);
  });
});
