import type { MeteringSink } from '../types';

/**
 * No-op metering sink for OSS deployments.
 * Discards usage events without recording them.
 *
 * Hosted overlays can replace this to send events to analytics/billing systems.
 */
export class NoOpMeteringSink implements MeteringSink {
  async recordUsage(): Promise<void> {
    // No-op: OSS doesn't track usage
  }
}
