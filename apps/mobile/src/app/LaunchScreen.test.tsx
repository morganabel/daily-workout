import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import type { MetaResponse } from '@leveza/shared';

import { LaunchScreen } from './LaunchScreen';
import { resolveStartupServerCapabilities } from './services/server-capabilities';

const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactModule = require('react') as typeof React;
    ReactModule.useEffect(callback, [callback]);
  },
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./storage/byokKey', () => ({
  getByokConfig: jest.fn().mockResolvedValue(null),
  setByokConfig: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./storage/launchState', () => ({
  getLaunchCompleted: jest.fn().mockResolvedValue(false),
  setLaunchCompleted: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./services/auth-client', () => ({
  activateCurrentAuthenticatedDataScope: jest.fn().mockResolvedValue(false),
  activateStubDataScope: jest.fn().mockResolvedValue(undefined),
  signInAnonymously: jest.fn().mockResolvedValue(true),
}));

jest.mock('./services/server-capabilities', () => ({
  BUNDLED_SERVER_CAPABILITIES: {
    auth: { enabled: true },
  },
  resolveStartupServerCapabilities: jest.fn(),
}));

jest.mock('./components/DesignSystem', () => {
  const ReactModule = require('react') as typeof React;
  const { Text, View } =
    require('react-native') as typeof import('react-native');
  return {
    Button: ({ label }: { label: string }) =>
      ReactModule.createElement(Text, null, label),
    Card: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(View, null, children),
  };
});

const mockResolveStartupServerCapabilities =
  resolveStartupServerCapabilities as jest.MockedFunction<
    typeof resolveStartupServerCapabilities
  >;

const capabilities: MetaResponse = {
  protocolVersion: '1.0.0',
  edition: 'CE',
  auth: {
    enabled: true,
    methods: ['anonymous', 'email'],
    anonymousAvailable: true,
    emailAvailable: true,
    googleAvailable: true,
    accountTransitionAvailable: true,
  },
  billing: {
    enabled: false,
    showUpgradeUi: false,
    purchaseMethod: 'none',
    allowByok: true,
    upgradeEntitlementId: null,
  },
};

describe('LaunchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the launch UI hidden until startup capabilities are resolved', async () => {
    let resolveCapabilities: (value: MetaResponse) => void = () => undefined;
    mockResolveStartupServerCapabilities.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCapabilities = resolve;
        })
    );

    render(<LaunchScreen />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockResolveStartupServerCapabilities).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('launch-checking')).toBeTruthy();
    expect(screen.queryByText('Connecting…')).toBeNull();

    await act(async () => {
      resolveCapabilities(capabilities);
      await Promise.resolve();
    });

    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.getByText('Leveza')).toBeTruthy();
  });
});
