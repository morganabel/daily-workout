import type { GenerationRequest } from '@workout-agent/shared';

/**
 * Result of a policy check
 */
export interface PolicyResult {
  /**
   * Whether the action is allowed
   */
  allowed: boolean;

  /**
   * Reason for denial (if not allowed)
   */
  reason?: string;

  /**
   * HTTP status code to return (if not allowed)
   */
  statusCode?: number;
}

/**
 * Optional entitlements information that can be queried
 * Hosted overlays can extend this with subscription tiers, quotas, etc.
 */
export interface Entitlements {
  [key: string]: unknown;
}

/**
 * UsagePolicy defines authorization and quota enforcement.
 * OSS default allows all operations; hosted overlays can enforce limits.
 */
export interface UsagePolicy {
  /**
   * Check if a user can generate a workout
   */
  canGenerate(userId: string, request: GenerationRequest): Promise<PolicyResult>;

  /**
   * Optional: Get full entitlements for a user
   * Hosted overlays can implement this for detailed entitlement queries
   */
  getEntitlements?(userId: string): Promise<Entitlements>;
}
