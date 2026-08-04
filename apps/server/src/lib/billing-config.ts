import { z } from 'zod';

import type { RevenueCatDomainConfig } from './revenuecat';
import { getBillingProvider } from './deployment';

const MAX_CONFIG_JSON_LENGTH = 32_768;
const MAX_LIST_ITEMS = 32;
const MAX_IDENTIFIER_LENGTH = 160;
const MAX_SECRET_LENGTH = 4_096;
const MAX_NANO_USD = 10n ** 24n;

const identifierSchema = z.string().trim().min(1).max(MAX_IDENTIFIER_LENGTH);

function uniqueIdentifierList() {
  return z
    .array(identifierSchema)
    .min(1)
    .max(MAX_LIST_ITEMS)
    .refine((values) => new Set(values).size === values.length, {
      message: 'Identifiers must be unique.',
    });
}

const nanoUsdSchema = z
  .string()
  .refine(
    (value) => /^\d+$/.test(value) && BigInt(value) <= MAX_NANO_USD,
    {
      message: 'Expected a bounded non-negative nano-USD integer string.',
    }
  );

export const revenueCatBillingConfigDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    revenueCat: z
      .object({
        appIds: uniqueIdentifierList(),
        environments: z
          .array(z.enum(['SANDBOX', 'PRODUCTION']))
          .min(1)
          .max(2)
          .refine((values) => new Set(values).size === values.length, {
            message: 'Environments must be unique.',
          }),
        entitlementIds: uniqueIdentifierList(),
        productIds: uniqueIdentifierList(),
        defaultOfferingId: identifierSchema.optional(),
      })
      .strict(),
    plans: z
      .object({
        freeGenerations: z.number().int().min(0).max(1_000_000_000),
        proGenerations: z.number().int().min(0).max(1_000_000_000),
        windowDays: z.number().int().min(1).max(3_660),
      })
      .strict(),
    guardrails: z
      .object({
        accountRequestsPerMinute: z.number().int().min(1).max(10_000),
        accountMaxActiveGenerations: z.number().int().min(1).max(100),
        accountDailySpendLimitNanoUsd: nanoUsdSchema,
        globalDailySpendLimitNanoUsd: nanoUsdSchema,
        pendingReservationTtlSeconds: z.number().int().min(1).max(86_400),
      })
      .strict(),
    capabilities: z
      .object({
        showUpgradeUi: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type RevenueCatBillingConfigDocument = z.infer<
  typeof revenueCatBillingConfigDocumentSchema
>;

export interface RevenueCatBillingConfig {
  provider: 'revenuecat';
  schemaVersion: 1;
  webhookSecret: string;
  domainConfig: RevenueCatDomainConfig;
  freeGenerationLimit: number;
  proGenerationLimit: number;
  quotaWindowDays: number;
  accountRequestsPerMinute: number;
  accountMaxActiveGenerations: number;
  accountDailySpendLimitNanoUsd: string;
  globalDailySpendLimitNanoUsd: string;
  pendingReservationTtlMs: number;
  defaultOfferingId?: string;
  showUpgradeUi: boolean;
}

export type BillingConfig =
  | { provider: 'none' }
  | RevenueCatBillingConfig;

function requiredValue(key: string, maxLength: number): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required when BILLING_PROVIDER=revenuecat.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${key} exceeds the maximum length of ${maxLength}.`);
  }
  return value;
}

function requiredConfigDocumentRaw(): string {
  const raw = process.env.BILLING_CONFIG_JSON;
  if (!raw?.trim()) {
    throw new Error(
      'BILLING_CONFIG_JSON is required when BILLING_PROVIDER=revenuecat.'
    );
  }
  if (raw.length > MAX_CONFIG_JSON_LENGTH) {
    throw new Error(
      `BILLING_CONFIG_JSON exceeds the maximum length of ${MAX_CONFIG_JSON_LENGTH}.`
    );
  }
  return raw;
}

export function parseRevenueCatBillingConfigDocument(
  raw: string
): RevenueCatBillingConfigDocument {
  if (raw.length > MAX_CONFIG_JSON_LENGTH) {
    throw new Error(
      `BILLING_CONFIG_JSON exceeds the maximum length of ${MAX_CONFIG_JSON_LENGTH}.`
    );
  }

  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch {
    throw new Error('BILLING_CONFIG_JSON must be valid JSON.');
  }

  const result = revenueCatBillingConfigDocumentSchema.safeParse(document);
  if (result.success) return result.data;

  const schemaVersion =
    typeof document === 'object' && document !== null
      ? (document as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (schemaVersion !== 1) {
    throw new Error(
      'BILLING_CONFIG_JSON uses an unsupported or missing schemaVersion.'
    );
  }

  throw new Error(
    'BILLING_CONFIG_JSON does not match billing configuration schema version 1.'
  );
}

export function getBillingConfig(): BillingConfig {
  if (getBillingProvider() === 'none') {
    return { provider: 'none' };
  }

  const webhookSecret = requiredValue(
    'REVENUECAT_WEBHOOK_SECRET',
    MAX_SECRET_LENGTH
  );
  const document = parseRevenueCatBillingConfigDocument(
    requiredConfigDocumentRaw()
  );

  return {
    provider: 'revenuecat',
    schemaVersion: document.schemaVersion,
    webhookSecret,
    domainConfig: {
      allowedAppIds: new Set(document.revenueCat.appIds),
      allowedEnvironments: new Set(document.revenueCat.environments),
      allowedEntitlementIds: new Set(document.revenueCat.entitlementIds),
      allowedProductIds: new Set(document.revenueCat.productIds),
    },
    freeGenerationLimit: document.plans.freeGenerations,
    proGenerationLimit: document.plans.proGenerations,
    quotaWindowDays: document.plans.windowDays,
    accountRequestsPerMinute:
      document.guardrails.accountRequestsPerMinute,
    accountMaxActiveGenerations:
      document.guardrails.accountMaxActiveGenerations,
    accountDailySpendLimitNanoUsd:
      document.guardrails.accountDailySpendLimitNanoUsd,
    globalDailySpendLimitNanoUsd:
      document.guardrails.globalDailySpendLimitNanoUsd,
    pendingReservationTtlMs:
      document.guardrails.pendingReservationTtlSeconds * 1_000,
    defaultOfferingId: document.revenueCat.defaultOfferingId,
    showUpgradeUi: document.capabilities.showUpgradeUi,
  };
}
