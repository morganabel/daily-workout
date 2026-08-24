import * as SecureStore from 'expo-secure-store';
import type { MetaResponse } from '@workout-agent/shared';

import { backendDescriptor } from './backendDescriptor';
import {
  BUNDLED_SERVER_CAPABILITIES,
  resetServerCapabilitiesCacheForTests,
  resolveStartupServerCapabilities,
} from './server-capabilities';

const storageKey = `server_capabilities_v1_${backendDescriptor.backendId}`;

const liveCapabilities: MetaResponse = {
  protocolVersion: '1.0.0',
  edition: 'CE',
  auth: {
    enabled: false,
    methods: [],
    anonymousAvailable: false,
    emailAvailable: false,
    googleAvailable: false,
    accountTransitionAvailable: false,
  },
  billing: {
    enabled: false,
    showUpgradeUi: false,
    purchaseMethod: 'none',
    allowByok: true,
  },
};

describe('server capabilities', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetServerCapabilitiesCacheForTests();
    await SecureStore.deleteItemAsync(storageKey);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses bundled production defaults when the startup request times out', async () => {
    global.fetch = jest.fn(() => new Promise(() => undefined));

    const result = resolveStartupServerCapabilities(1_500);
    await Promise.resolve();
    jest.advanceTimersByTime(1_500);

    await expect(result).resolves.toEqual(BUNDLED_SERVER_CAPABILITIES);
  });

  it('uses the last validated response when the startup request times out', async () => {
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({
        version: 1,
        fetchedAt: 0,
        data: liveCapabilities,
      })
    );
    global.fetch = jest.fn(() => new Promise(() => undefined));

    const result = resolveStartupServerCapabilities(1_500);
    await Promise.resolve();
    jest.advanceTimersByTime(1_500);

    await expect(result).resolves.toEqual(liveCapabilities);
  });

  it('validates and persists a live response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(liveCapabilities),
    });

    await expect(resolveStartupServerCapabilities()).resolves.toEqual(
      liveCapabilities
    );
    await Promise.resolve();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      storageKey,
      expect.stringContaining('"version":1')
    );
  });
});
