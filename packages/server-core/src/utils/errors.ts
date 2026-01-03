/**
 * Structured error responses for API endpoints
 */

export type ApiErrorCode =
  | 'BYOK_REQUIRED'
  | 'QUOTA_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_PROVIDER';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryAfter?: number; // seconds
}

/**
 * Redact any secrets in error messages before returning to clients.
 */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/gi, '[REDACTED]');
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  status = 400,
  retryAfter?: number
): Response {
  const error: ApiError = { code, message: sanitizeErrorMessage(message) };
  if (retryAfter !== undefined) {
    error.retryAfter = retryAfter;
  }
  return Response.json(error, { status });
}
