/**
 * Structured error responses for API endpoints
 */

import { redactSensitiveStrings } from './logging';

export type ApiErrorCode =
  | 'BYOK_REQUIRED'
  | 'AI_PROVIDER_NOT_CONFIGURED'
  | 'QUOTA_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'NOT_IMPLEMENTED'
  | 'INVALID_PROVIDER'
  | 'AI_GENERATION_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryAfter?: number; // seconds
}

/**
 * Redact any secrets in error messages before returning to clients.
 */
function sanitizeErrorMessage(message: string): string {
  return redactSensitiveStrings(message);
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
