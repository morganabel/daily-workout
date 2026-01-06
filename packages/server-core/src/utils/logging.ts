/**
 * Logging utilities with secret redaction.
 *
 * Never log raw tokens, passwords, or Authorization headers.
 */

const SECRET_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /^x-.*key$/i,
  /token/i,
  /password/i,
  /secret/i,
];

const TOKEN_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /sk-[A-Za-z0-9_-]+/gi,
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
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return redactSensitiveStrings(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSecrets(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const isSecretKey = SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
      redacted[key] = isSecretKey ? '[REDACTED]' : redactSecrets(value);
    }
    return redacted as unknown as T;
  }

  return input;
}

/**
 * Safe logger that redacts secrets before logging.
 */
export function safeLog(message?: unknown, data?: unknown): void {
  if (data === undefined) {
    console.log(message);
  } else {
    console.log(message, redactSecrets(data));
  }
}
