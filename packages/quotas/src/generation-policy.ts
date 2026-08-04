import type {
  ModelCredentialSource,
  ModelProvider,
} from '@workout-agent-ce/metering';

export interface UpgradeMetadata {
  showUpgradeUi?: boolean;
  purchaseMethod?: 'none' | 'iap';
  entitlementId?: string;
  offeringId?: string;
  productIds?: string[];
}

export type GenerationOperation = 'generate' | 'regenerate';

export interface IncludedGenerationReservation {
  kind: 'included_generation';
  reservationId: string;
  accountId: string;
  operationId: string;
  expiresAt: string;
}

export interface IncludedGenerationReserveRequest {
  accountId: string;
  operationId: string;
  operation: GenerationOperation;
}

export type IncludedGenerationReserveResult =
  | { allowed: true; reservation?: IncludedGenerationReservation }
  | {
      allowed: false;
      code: 'quota_exceeded' | 'dependency_unavailable';
      reason?: string;
      statusCode?: number;
      upgrade?: UpgradeMetadata;
    };

export interface UsagePolicy {
  reserveGenerate(
    request: IncludedGenerationReserveRequest
  ): Promise<IncludedGenerationReserveResult>;
  commitGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void>;
  rollbackGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void>;
  getEntitlements?(accountId: string): Promise<unknown>;
}

/**
 * `x-request-id` is untrusted correlation metadata only. The server-owned
 * operation ID keys reservations, admission, and usage events.
 */
export interface GenerationOperationIdentity {
  operationId: string;
  correlationId?: string;
}

export interface GenerationControlPlan {
  providerAdmission: true;
  includedAllowance: boolean;
  spendCeiling: boolean;
}

export function generationControlPlan(
  credentialSource: ModelCredentialSource
): GenerationControlPlan {
  const selfFunded = credentialSource === 'byok';
  return {
    providerAdmission: true,
    includedAllowance: !selfFunded,
    spendCeiling: !selfFunded,
  };
}

export interface ProviderAdmissionLease {
  kind: 'provider_admission';
  leaseId: string;
  accountId: string;
  operationId: string;
  expiresAt: string;
}

export type ProviderAdmissionResult =
  | { allowed: true; lease: ProviderAdmissionLease }
  | {
      allowed: false;
      code:
        | 'account_rate_limited'
        | 'concurrency_limited'
        | 'dependency_unavailable';
      retryAfterSeconds?: number;
    };

/**
 * Per-account request-rate and active-generation concurrency admission.
 * Intentionally in-process for the single-instance deployment: counters may
 * reset on restart, and durable spend ceilings bound the money at risk.
 */
export interface ProviderAdmissionPolicy {
  acquireProviderAdmission(input: {
    accountId: string;
    operationId: string;
  }): Promise<ProviderAdmissionResult>;
  releaseProviderAdmission(lease: ProviderAdmissionLease): Promise<void>;
}

export type SpendCeilingDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | 'spend_limit_exceeded'
        | 'pricing_unavailable'
        | 'dependency_unavailable';
    };

/**
 * Settle-only daily spend ceilings for managed/Vertex credentials. Actual
 * provider cost is settled durably through the metering sink for every
 * upstream attempt; this check sums settled cost for the current day and
 * denies at the configured account or global ceiling. There is no
 * pre-invocation reservation, so ceilings are configured with headroom for
 * bounded in-flight overshoot. An unavailable spend source fails closed.
 */
export interface SpendCeilingPolicy {
  checkSpendCeiling(input: {
    accountId: string;
    provider: ModelProvider;
    credentialSource: Exclude<ModelCredentialSource, 'byok'>;
  }): Promise<SpendCeilingDecision>;
}
