import {
  MOBILE_DEBUG_MCP_PROTOCOL_VERSION,
  MOBILE_DEBUG_MCP_RESET_CONFIRMATION,
  REDACTED_SECRET,
  mobileDebugBridgeHelloSchema,
  mobileDebugGenerationInputSchema,
  mobileDebugResetInputSchema,
  mobileDebugSeedPlannedEventsInputSchema,
  mobileDebugSetProfilePreferencesInputSchema,
  mobileDebugToolNameSchema,
  redactDebugValue,
  redactSecret,
  redactSensitiveString,
} from './mobile-debug-mcp';

describe('mobile debug MCP contracts', () => {
  it('keeps stable tool names parseable', () => {
    expect(mobileDebugToolNameSchema.parse('get_app_state')).toBe(
      'get_app_state',
    );
    expect(mobileDebugToolNameSchema.parse('generate_workout')).toBe(
      'generate_workout',
    );
    expect(mobileDebugToolNameSchema.safeParse('run_javascript').success).toBe(
      false,
    );
  });

  it('validates bridge hello metadata', () => {
    const parsed = mobileDebugBridgeHelloSchema.parse({
      type: 'hello',
      token: 'debug-token',
      session: {
        sessionId: 'ios-sim-1',
        protocolVersion: MOBILE_DEBUG_MCP_PROTOCOL_VERSION,
        appName: 'Mobile',
        platform: 'ios',
      },
    });

    expect(parsed.session.sessionId).toBe('ios-sim-1');
  });

  it('validates generation tool input', () => {
    const parsed = mobileDebugGenerationInputSchema.parse({
      request: {
        timeMinutes: 30,
        focus: 'Smart',
        energy: 'moderate',
      },
      scheduledDate: 1_719_000_000_000,
    });

    expect(parsed.request.timeMinutes).toBe(30);
  });

  it('accepts blueprint preferences for profile seeding', () => {
    const parsed = mobileDebugSetProfilePreferencesInputSchema.parse({
      preferences: {
        equipment: ['Gym'],
        injuries: [],
        focusBias: [],
        avoid: [],
        onboardingSetupStatus: 'completed',
        onboardingAnswers: {
          goal: 'build-muscle',
          experienceLevel: 'intermediate',
          environment: 'gym',
          equipment: ['Gym'],
        },
        trainingBlueprint: {
          templateId: 'ppl-conditioning',
          onboardingAnswers: {
            goal: 'build-muscle',
            experienceLevel: 'intermediate',
            environment: 'gym',
            equipment: ['Gym'],
          },
          weeklyRhythm: '3 lift days plus one sprint day',
          durationAssumptions: {
            targetMinutes: 50,
            minimumUsefulMinutes: 35,
          },
          equipmentLocationAssumptions: {
            environment: 'gym',
            equipment: ['Gym'],
          },
          slotSequence: [
            {
              id: 'day-1-full-body',
              role: 'full-body',
              label: 'Lift',
              dayOffset: 0,
              targetDurationMinutes: 50,
            },
          ],
          setupStatus: 'completed',
          editStatus: 'accepted',
          horizonDays: 7,
        },
      },
    });

    expect(parsed.preferences.trainingBlueprint?.templateId).toBe(
      'ppl-conditioning',
    );
  });

  it('accepts planned-slot metadata for calendar seeding', () => {
    const parsed = mobileDebugSeedPlannedEventsInputSchema.parse({
      events: [
        {
          kind: 'workout',
          title: 'Pull',
          localDate: '2026-04-15',
          createdAtTimezone: 'UTC',
          durationMinutes: 45,
          metadata: {
            schemaVersion: 1,
            ownership: 'app',
            source: 'training-blueprint',
            templateId: 'ppl-conditioning',
            slotId: 'day-2-pull',
            slotRole: 'pull',
            slotLabel: 'Pull',
            plannedDate: '2026-04-15',
            targetDurationMinutes: 45,
            equipmentLocationAssumptions: {
              environment: 'gym',
              equipment: ['Gym'],
            },
            detailState: 'not-generated',
          },
        },
      ],
    });

    expect(parsed.events[0].metadata?.source).toBe('training-blueprint');
  });

  it('rejects planned-slot intent for generation', () => {
    const result = mobileDebugGenerationInputSchema.safeParse({
      request: {
        focus: 'Pull',
        plannedSlotIntent: {
          role: 'pull',
          label: 'Pull',
          targetDurationMinutes: 45,
          plannedDate: '2026-04-15',
          templateId: 'ppl-conditioning',
          slotId: 'day-2-pull',
          equipmentLocationAssumptions: {
            environment: 'gym',
            equipment: ['Gym'],
          },
        },
      },
      scheduledDate: 1_776_218_400_000,
    });

    expect(result.success).toBe(false);
  });

  it('requires explicit reset confirmation', () => {
    expect(
      mobileDebugResetInputSchema.safeParse({
        confirm: MOBILE_DEBUG_MCP_RESET_CONFIRMATION,
      }).success,
    ).toBe(true);
    expect(
      mobileDebugResetInputSchema.safeParse({ confirm: 'yes' }).success,
    ).toBe(false);
  });
});

describe('mobile debug MCP redaction', () => {
  it('redacts BYOK and token presence with previews only', () => {
    expect(redactSecret('sk-abcdef123456')).toEqual({
      present: true,
      preview: 'sk...56',
    });
    expect(redactSecret('')).toEqual({ present: false });
    expect(redactSecret(null)).toEqual({ present: false });
  });

  it('redacts bearer tokens and cookie values inside strings', () => {
    const result = redactSensitiveString(
      'Authorization: Bearer abc.def.ghi Cookie: better-auth.session=secret; other=value',
    );

    expect(result).toContain(`Bearer ${REDACTED_SECRET}`);
    expect(result).toContain(`better-auth.session=${REDACTED_SECRET}`);
    expect(result).toContain(`other=${REDACTED_SECRET}`);
    expect(result).not.toContain('abc.def.ghi');
    expect(result).not.toContain('secret');
  });

  it('redacts nested secret-like object fields', () => {
    const result = redactDebugValue({
      provider: 'openai',
      apiKey: 'sk-secret',
      nested: {
        deviceToken: 'device-token',
        headers: {
          authorization: 'Bearer hidden',
          safe: 'visible',
        },
      },
    });

    expect(result).toEqual({
      provider: 'openai',
      apiKey: REDACTED_SECRET,
      nested: {
        deviceToken: REDACTED_SECRET,
        headers: {
          authorization: REDACTED_SECRET,
          safe: 'visible',
        },
      },
    });
  });
});
