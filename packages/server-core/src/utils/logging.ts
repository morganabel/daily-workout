/**
 * Logging utilities with secret redaction.
 *
 * Never log raw tokens, passwords, or Authorization headers.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const SECRET_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /^x-.*key$/i,
  /token/i,
  /password/i,
  /secret/i,
];

const PII_KEY_PATTERNS = [
  // Identifiers
  /^user(id)?$/i,
  /^principal(id)?$/i,
  /^session(id)?$/i,
  /^device(token)?$/i,

  // Common personal fields
  /email/i,
  /phone/i,
  /first.?name/i,
  /last.?name/i,

  // Free-form / likely-sensitive
  /feedback/i,
  /^context$/i,
];

const TOKEN_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /sk-[A-Za-z0-9_-]+/gi,
  /AIza[a-zA-Z0-9_-]+/g,
  /\b[a-f0-9]{32,}\b/gi,
];

/**
 * Redacts known secret-looking substrings within a string.
 */
export function redactSensitiveStrings(value: string): string {
  let result = value;
  for (const pattern of TOKEN_VALUE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Recursively redacts secret fields from an object/array/string.
 */
export function redactSecrets<T>(input: T): T {
  return redactInternal(input, { redactPii: false });
}

/**
 * Recursively redacts secrets and PII-ish fields from an object/array/string.
 *
 * Note: This relies on field names (keys), not content inspection. Avoid logging
 * free-form user content (e.g. feedback) unless you have a strong reason.
 */
export function redactSecretsAndPii<T>(input: T): T {
  return redactInternal(input, { redactPii: true });
}

function redactInternal<T>(
  input: T,
  opts: { redactPii: boolean },
  seen: WeakSet<object> = new WeakSet<object>(),
): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return redactSensitiveStrings(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    if (seen.has(input)) {
      return '[Circular]' as unknown as T;
    }
    seen.add(input);
    return input.map((item) => redactInternal(item, opts, seen)) as unknown as T;
  }

  if (typeof input === 'object') {
    if (seen.has(input as object)) {
      return '[Circular]' as unknown as T;
    }
    seen.add(input as object);

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const normalizedKey = key.replace(/^_+/, '');
      const isSecretKey = SECRET_KEY_PATTERNS.some((pattern) =>
        pattern.test(normalizedKey),
      );
      const isPiiKey = opts.redactPii
        ? PII_KEY_PATTERNS.some((pattern) => pattern.test(normalizedKey))
        : false;
      redacted[key] =
        isSecretKey || isPiiKey
          ? '[REDACTED]'
          : redactInternal(value, opts, seen);
    }
    return redacted as unknown as T;
  }

  return input;
}

/**
 * Safe logger that redacts secrets (and optionally PII-ish fields) before logging.
 */
export function safeLog(message: string, data?: Record<string, unknown>): void {
  const log = getLogger();
  log.info(message, data);
}

export interface LoggerContext {
  component?: string;
  route?: string;
  requestId?: string;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  child(context: LoggerContext): Logger;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const RESERVED_FIELDS = new Set(['ts', 'level', 'msg', 'context', 'data', 'error']);

let cachedLogLevel: LogLevel | null = null;
let cachedAllowPii: boolean | null = null;

function resolveLogLevel(): LogLevel {
  if (cachedLogLevel !== null) return cachedLogLevel;
  const raw = (process.env.LOG_LEVEL ?? '').trim().toLowerCase();
  if (
    raw === 'debug' ||
    raw === 'info' ||
    raw === 'warn' ||
    raw === 'error' ||
    raw === 'silent'
  ) {
    cachedLogLevel = raw;
  } else {
    cachedLogLevel = 'info';
  }
  return cachedLogLevel;
}

function shouldLog(level: LogLevel): boolean {
  const configured = resolveLogLevel();
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[configured];
}

function shouldIncludePii(): boolean {
  if (cachedAllowPii !== null) return cachedAllowPii;
  const raw = (process.env.LOG_PII ?? '').trim().toLowerCase();
  cachedAllowPii = raw === '1' || raw === 'true' || raw === 'yes';
  return cachedAllowPii;
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    const message = redactSensitiveStrings(error.message);
    const base = { name: error.name || 'Error', message };
    if (shouldLog('debug') && error.stack) {
      return { ...base, stack: redactSensitiveStrings(error.stack) };
    }
    return base;
  }

  return { name: 'Error', message: redactSensitiveStrings(String(error)) };
}

function splitReservedData(data: Record<string, unknown> | undefined): {
  data?: Record<string, unknown>;
  error?: unknown;
} {
  if (!data) return {};

  const result: Record<string, unknown> = {};
  let error: unknown;

  for (const [key, value] of Object.entries(data)) {
    if (key === 'error') {
      error = value;
      continue;
    }
    if (RESERVED_FIELDS.has(key)) {
      result[`_${key}`] = value;
      continue;
    }
    result[key] = value;
  }

  return { data: result, error };
}

function sanitizeContext(
  context: LoggerContext,
  allowPii: boolean
): Record<string, unknown> {
  const raw = context as unknown as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    sanitized[key] = typeof value === 'string' ? redactSensitiveStrings(value) : value;
  }
  return allowPii ? redactSecrets(sanitized) : redactSecretsAndPii(sanitized);
}

function safeJsonStringify(value: unknown): string | null {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, innerValue) => {
      if (typeof innerValue === 'bigint') {
        return innerValue.toString();
      }
      if (typeof innerValue === 'object' && innerValue !== null) {
        if (seen.has(innerValue)) {
          return '[Circular]';
        }
        seen.add(innerValue);
      }
      return innerValue;
    });
  } catch {
    return null;
  }
}

function emitLog(
  level: Exclude<LogLevel, 'silent'>,
  message: string,
  context: LoggerContext,
  data?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  try {
    const { data: cleanedData, error } = splitReservedData(data);
    const allowPii = shouldIncludePii();

    const redactedMessage = redactSensitiveStrings(message);
    const redactedContext = sanitizeContext(context, allowPii);

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg: redactedMessage,
      context: redactedContext,
      ...(cleanedData && Object.keys(cleanedData).length > 0
        ? { data: allowPii ? redactSecrets(cleanedData) : redactSecretsAndPii(cleanedData) }
        : {}),
      ...(error !== undefined ? { error: normalizeError(error) } : {}),
    };

    const line = safeJsonStringify(entry);
    if (!line) {
      return;
    }

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  } catch {
    // Last resort: never allow logging to crash request handling.
    try {
      const fallback = safeJsonStringify({
        ts: new Date().toISOString(),
        level,
        msg: redactSensitiveStrings(message),
      });
      if (fallback) {
        console.log(fallback);
      }
    } catch {
      // ignore
    }
  }
}

class BaseLogger implements Logger {
  constructor(private readonly context: LoggerContext) {}

  debug(message: string, data?: Record<string, unknown>): void {
    emitLog('debug', message, this.context, data);
  }
  info(message: string, data?: Record<string, unknown>): void {
    emitLog('info', message, this.context, data);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    emitLog('warn', message, this.context, data);
  }
  error(message: string, data?: Record<string, unknown>): void {
    emitLog('error', message, this.context, data);
  }

  child(context: LoggerContext): Logger {
    return new BaseLogger({ ...this.context, ...context });
  }
}

let rootLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!rootLogger) {
    rootLogger = new BaseLogger({
      component: process.env.LOG_COMPONENT ?? 'server',
    });
  }
  return rootLogger;
}

export function createLogger(context: LoggerContext): Logger {
  return getLogger().child(context);
}

function createFallbackRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSafeRequestId(candidate: string): boolean {
  if (!candidate) return false;
  if (candidate.length > 128) return false;
  if (candidate.includes('\n') || candidate.includes('\r') || candidate.includes('\t')) {
    return false;
  }
  // Allow conservative set and common AWS trace format ("Root=1-...").
  if (!/^[A-Za-z0-9\-_.:/=]+$/.test(candidate)) {
    return false;
  }
  // Reject values that look like secrets/tokens (including sk-/Bearer/AIZA and hex blobs).
  if (redactSensitiveStrings(candidate) !== candidate) {
    return false;
  }
  return true;
}

export function getOrCreateRequestId(request: Request): string {
  const header =
    request.headers.get('x-request-id') ??
    request.headers.get('x-correlation-id') ??
    request.headers.get('x-amzn-trace-id');
  const trimmed = header?.trim();
  if (trimmed) {
    const candidate = trimmed.slice(0, 128);
    if (isSafeRequestId(candidate)) {
      return candidate;
    }
  }

  const maybeUuid = globalThis.crypto?.randomUUID?.();
  return maybeUuid ?? createFallbackRequestId();
}

export function attachRequestId(response: Response, requestId: string): Response {
  try {
    response.headers.set('x-request-id', requestId);
  } catch {
    // Ignore if headers are immutable in a given runtime.
  }
  return response;
}

/**
 * Reset cached config and the root logger singleton.
 * Only intended for tests — never call in production.
 */
export function resetLoggerForTest(): void {
  rootLogger = null;
  cachedLogLevel = null;
  cachedAllowPii = null;
}

export function getUrlPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return 'unknown';
  }
}

export interface RequestContext {
  requestId: string;
  urlPath: string;
  startedAt: number;
  log: Logger;
}

export function createRequestContext(request: Request, route: string): RequestContext {
  const requestId = getOrCreateRequestId(request);
  const urlPath = getUrlPath(request);
  const startedAt = Date.now();
  const log = createLogger({ route, requestId });
  return { requestId, urlPath, startedAt, log };
}
