/**
 * Usage metering and tracking for hosted edition
 */

export interface UsageEvent {
  userId: string;
  eventType: 'api_call' | 'workout_generated' | 'workout_logged' | 'resource_usage';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UsageMetrics {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  apiCalls: number;
  workoutsGenerated: number;
  workoutsLogged: number;
  totalResourceUsage: number;
}

export class MeteringService {
  private events: UsageEvent[] = [];

  /**
   * Record a usage event
   */
  async recordEvent(event: UsageEvent): Promise<void> {
    this.events.push({
      ...event,
      timestamp: new Date(),
    });
    // In production, this would persist to a database
  }

  /**
   * Get usage metrics for a user in a time period
   */
  async getUsageMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageMetrics> {
    const userEvents = this.events.filter(
      (e) =>
        e.userId === userId &&
        e.timestamp >= startDate &&
        e.timestamp <= endDate
    );

    return {
      userId,
      period: { start: startDate, end: endDate },
      apiCalls: userEvents.filter((e) => e.eventType === 'api_call').length,
      workoutsGenerated: userEvents.filter(
        (e) => e.eventType === 'workout_generated'
      ).length,
      workoutsLogged: userEvents.filter(
        (e) => e.eventType === 'workout_logged'
      ).length,
      totalResourceUsage: userEvents.reduce(
        (sum, e) => sum + ((e.metadata?.resourceUsage as number) || 0),
        0
      ),
    };
  }

  /**
   * Get current period usage (this month)
   */
  async getCurrentPeriodUsage(userId: string): Promise<UsageMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.getUsageMetrics(userId, startOfMonth, now);
  }

  /**
   * Count API calls for a user
   */
  async countApiCalls(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const metrics = await this.getUsageMetrics(userId, startDate, endDate);
    return metrics.apiCalls;
  }
}
