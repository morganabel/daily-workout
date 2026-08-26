import { z } from 'zod';
import {
  billingCapabilitiesSchema,
  createBillingCapabilities,
  type BillingCapabilities,
} from './billing';

/**
 * Auth capabilities schema
 */
export const authCapabilitiesSchema = z.object({
  enabled: z.boolean(),
  methods: z.array(z.enum(['anonymous', 'email'])),
  anonymousAvailable: z.boolean(),
  emailAvailable: z.boolean(),
  /** Optional provider capability so older servers remain parseable. */
  googleAvailable: z.boolean().default(false),
});

export type AuthCapabilities = z.infer<typeof authCapabilitiesSchema>;

/**
 * Server capabilities discovery response schema
 *
 * Clients can fetch /api/meta to detect backend capabilities
 * before attempting auth. This enables graceful degradation
 * and backend-switching logic.
 */
export const metaResponseSchema = z.object({
  /**
   * Protocol version for API compatibility checking
   */
  protocolVersion: z.string(),

  /**
   * Authentication capabilities
   */
  auth: authCapabilitiesSchema,

  /**
   * Server edition (CE = Community Edition, HOSTED = managed service)
   */
  edition: z.enum(['CE', 'HOSTED']),

  /**
   * Billing capabilities for upgrade UX gating.
   * Optional so newer clients can still parse older servers.
   */
  billing: billingCapabilitiesSchema.optional(),
});

export type MetaResponse = z.infer<typeof metaResponseSchema>;

/**
 * Creates a MetaResponse for CE mode with stub auth
 */
export function createStubMetaResponse(protocolVersion: string): MetaResponse {
  return {
    protocolVersion,
    auth: {
      enabled: false,
      methods: [],
      anonymousAvailable: false,
      emailAvailable: false,
      googleAvailable: false,
    },
    edition: 'CE',
    billing: createBillingCapabilities(),
  };
}

/**
 * Creates a MetaResponse for Better Auth mode
 */
export function createBetterAuthMetaResponse(
  protocolVersion: string,
  edition: 'CE' | 'HOSTED' = 'CE',
  billing: BillingCapabilities = createBillingCapabilities(),
  googleAvailable = false
): MetaResponse {
  return {
    protocolVersion,
    auth: {
      enabled: true,
      methods: ['anonymous', 'email'],
      anonymousAvailable: true,
      emailAvailable: true,
      googleAvailable,
    },
    edition,
    billing,
  };
}
