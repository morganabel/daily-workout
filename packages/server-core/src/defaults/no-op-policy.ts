import type {
  IncludedGenerationReservation,
  UsagePolicy,
} from '@leveza/quotas';

/** Billing-neutral policy for self-hosted deployments. */
export class NoOpUsagePolicy implements UsagePolicy {
  async reserveGenerate(): Promise<{ allowed: true }> {
    return { allowed: true };
  }

  async commitGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    void reservation;
  }

  async rollbackGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    void reservation;
  }
}
