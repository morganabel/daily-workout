import type { UsagePolicy, PolicyResult } from '../types';

/**
 * No-op usage policy for OSS deployments.
 * Allows all operations without quota/rate limiting.
 *
 * Hosted overlays can replace this to enforce subscriptions, quotas, and rate limits.
 */
export class NoOpUsagePolicy implements UsagePolicy {
  async canGenerate(): Promise<PolicyResult> {
    return { allowed: true };
  }

  // Optional getEntitlements not implemented - OSS has no entitlements
}
