/**
 * Usage event recorded after model calls
 */
export interface UsageEvent {
  /**
   * User who made the request
   */
  userId: string;

  /**
   * Type of operation
   */
  operation: 'generate' | 'regenerate';

  /**
   * Provider used
   */
  provider: 'openai' | 'gemini';

  /**
   * Model used (optional)
   */
  model?: string;

  /**
   * Whether this was a BYOK call
   */
  byok: boolean;

  /**
   * Timestamp of the event
   */
  timestamp: string;

  /**
   * Duration in milliseconds (optional)
   */
  durationMs?: number;

  /**
   * Any additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * MeteringSink defines how the server records usage.
 * OSS default is a no-op; hosted overlays can send to analytics/billing.
 */
export interface MeteringSink {
  /**
   * Record a usage event
   */
  recordUsage(event: UsageEvent): Promise<void>;
}
