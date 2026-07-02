/**
 * Quota enforcement for hosted edition
 */

import { MeteringService } from '@workout-agent-ce/metering';

export interface PlanLimits {
  planId: string;
  maxApiCallsPerMonth: number;
  maxWorkoutsGeneratedPerMonth: number;
  maxWorkoutsLoggedPerMonth: number;
  maxResourceUsagePerMonth: number;
}

export interface QuotaCheck {
  allowed: boolean;
  reason?: string;
  remaining?: {
    apiCalls: number;
    workoutsGenerated: number;
    workoutsLogged: number;
    resourceUsage: number;
  };
}

export class QuotaService {
  private plans: Map<string, PlanLimits> = new Map();
  private metering: MeteringService;

  constructor(metering: MeteringService) {
    this.metering = metering;
    // Default plans - in production, load from database
    this.plans.set('free', {
      planId: 'free',
      maxApiCallsPerMonth: 100,
      maxWorkoutsGeneratedPerMonth: 10,
      maxWorkoutsLoggedPerMonth: 50,
      maxResourceUsagePerMonth: 1000,
    });
    this.plans.set('pro', {
      planId: 'pro',
      maxApiCallsPerMonth: 10000,
      maxWorkoutsGeneratedPerMonth: 1000,
      maxWorkoutsLoggedPerMonth: 5000,
      maxResourceUsagePerMonth: 100000,
    });
    this.plans.set('enterprise', {
      planId: 'enterprise',
      maxApiCallsPerMonth: -1, // unlimited
      maxWorkoutsGeneratedPerMonth: -1,
      maxWorkoutsLoggedPerMonth: -1,
      maxResourceUsagePerMonth: -1,
    });
  }

  /**
   * Check if an action is allowed based on quota
   */
  async checkQuota(
    userId: string,
    planId: string,
    action: 'api_call' | 'workout_generated' | 'workout_logged' | 'resource_usage'
  ): Promise<QuotaCheck> {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { allowed: false, reason: 'Invalid plan' };
    }

    const usage = await this.metering.getCurrentPeriodUsage(userId);

    let allowed = true;
    const remaining: QuotaCheck['remaining'] = {
      apiCalls: 0,
      workoutsGenerated: 0,
      workoutsLogged: 0,
      resourceUsage: 0,
    };

    // Check API calls
    if (plan.maxApiCallsPerMonth >= 0) {
      remaining.apiCalls = Math.max(0, plan.maxApiCallsPerMonth - usage.apiCalls);
      if (action === 'api_call' && usage.apiCalls >= plan.maxApiCallsPerMonth) {
        allowed = false;
      }
    } else {
      remaining.apiCalls = -1; // unlimited
    }

    // Check workouts generated
    if (plan.maxWorkoutsGeneratedPerMonth >= 0) {
      remaining.workoutsGenerated = Math.max(
        0,
        plan.maxWorkoutsGeneratedPerMonth - usage.workoutsGenerated
      );
      if (
        action === 'workout_generated' &&
        usage.workoutsGenerated >= plan.maxWorkoutsGeneratedPerMonth
      ) {
        allowed = false;
      }
    } else {
      remaining.workoutsGenerated = -1;
    }

    // Check workouts logged
    if (plan.maxWorkoutsLoggedPerMonth >= 0) {
      remaining.workoutsLogged = Math.max(
        0,
        plan.maxWorkoutsLoggedPerMonth - usage.workoutsLogged
      );
      if (
        action === 'workout_logged' &&
        usage.workoutsLogged >= plan.maxWorkoutsLoggedPerMonth
      ) {
        allowed = false;
      }
    } else {
      remaining.workoutsLogged = -1;
    }

    // Check resource usage
    if (plan.maxResourceUsagePerMonth >= 0) {
      remaining.resourceUsage = Math.max(
        0,
        plan.maxResourceUsagePerMonth - usage.totalResourceUsage
      );
      if (
        action === 'resource_usage' &&
        usage.totalResourceUsage >= plan.maxResourceUsagePerMonth
      ) {
        allowed = false;
      }
    } else {
      remaining.resourceUsage = -1;
    }

    if (!allowed) {
      return {
        allowed: false,
        reason: `Quota exceeded for ${action}`,
        remaining,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Get plan limits
   */
  getPlanLimits(planId: string): PlanLimits | undefined {
    return this.plans.get(planId);
  }

  /**
   * Register a new plan
   */
  registerPlan(limits: PlanLimits): void {
    this.plans.set(limits.planId, limits);
  }
}
