/**
 * Structured error responses for API endpoints
 */

export type ApiErrorCode =
  | 'BYOK_REQUIRED'
  | 'AI_PROVIDER_NOT_CONFIGURED'
  | 'QUOTA_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'NOT_IMPLEMENTED'
  | 'INVALID_PROVIDER';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryAfter?: number; // seconds
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  status = 400,
  retryAfter?: number
): Response {
  const error: ApiError = { code, message };
  if (retryAfter !== undefined) {
    error.retryAfter = retryAfter;
  }
  return Response.json(error, { status });
}
