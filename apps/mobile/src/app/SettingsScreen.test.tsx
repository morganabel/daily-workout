import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  createAdaptiveTrainingPlanFromTemplate,
  type MetaResponse,
} from '@leveza/shared';
import { SettingsScreen } from './SettingsScreen';
import {
  fetchServerCapabilities,
  getCurrentServerCapabilities,
} from './services/auth-client';

const mockUserRepository = {
  getPreferences: jest.fn(),
  updatePreferences: jest.fn().mockResolvedValue(undefined),
};

jest.mock('./components/BottomNavigation', () => ({
  BottomNavigation: () => null,
}));

jest.mock('./components/GoogleSignInButton', () => {
  const ReactModule = require('react') as typeof React;
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    GoogleSignInButton: ({ label }: { label: string }) =>
      ReactModule.createElement(Text, null, label),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('./hooks/useBillingState', () => ({
  useBillingState: () => ({
    showUpgradeUi: false,
    entitlements: null,
  }),
}));

jest.mock('./services/auth-client', () => ({
  fetchServerCapabilities: jest.fn(),
  getCurrentServerCapabilities: jest.fn(),
  signInWithGoogle: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  useSession: () => ({ data: null }),
}));

jest.mock('./db/activeDatabase', () => ({
  getActiveRepositories: () => ({ user: mockUserRepository }),
}));

const mockFetchServerCapabilities =
  fetchServerCapabilities as jest.MockedFunction<
    typeof fetchServerCapabilities
  >;
const mockGetCurrentServerCapabilities =
  getCurrentServerCapabilities as jest.MockedFunction<
    typeof getCurrentServerCapabilities
  >;

const capabilities = (authEnabled: boolean): MetaResponse => ({
  protocolVersion: '1.0.0',
  edition: 'CE',
  auth: {
    enabled: authEnabled,
    methods: authEnabled ? ['anonymous', 'email'] : [],
    anonymousAvailable: authEnabled,
    emailAvailable: authEnabled,
    googleAvailable: authEnabled,
    accountTransitionAvailable: authEnabled,
  },
  billing: {
    enabled: false,
    showUpgradeUi: false,
    purchaseMethod: 'none',
    allowByok: true,
    upgradeEntitlementId: null,
  },
});

describe('SettingsScreen profile summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentServerCapabilities.mockReturnValue(capabilities(true));
    mockFetchServerCapabilities.mockResolvedValue(capabilities(true));
  });

  it('shows account actions while a capability refresh is pending', async () => {
    mockFetchServerCapabilities.mockReturnValue(new Promise(() => undefined));
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Bodyweight'],
      injuries: [],
      focusBias: [],
      avoid: [],
      aiFeaturesEnabled: true,
    });

    const screen = render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Create account')).toBeTruthy();
      expect(screen.getByLabelText('Sign in')).toBeTruthy();
    });
  });

  it('hides account actions when the server has auth disabled', async () => {
    mockFetchServerCapabilities.mockResolvedValue(capabilities(false));
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Bodyweight'],
      injuries: [],
      focusBias: [],
      avoid: [],
      aiFeaturesEnabled: true,
    });

    const screen = render(<SettingsScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('Accounts aren’t enabled on this server.')
      ).toBeTruthy();
    });
    expect(screen.queryByText('Continue with Google')).toBeNull();
    expect(screen.queryByText('Create account')).toBeNull();
    expect(screen.queryByLabelText('Sign in')).toBeNull();
  });

  it('summarizes the plan and saves edited weekly guidance from the focused editor', async () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }

    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Gym'],
      injuries: [],
      focusBias: [],
      avoid: [],
      aiFeaturesEnabled: true,
      adaptiveTrainingPlan: plan,
    });

    const screen = render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Training plan')).toBeTruthy();
      expect(screen.getByText('Strength 3-5x/week')).toBeTruthy();
      expect(
        screen.getByText('Usually: Push, Cardio, Pull, Legs +1')
      ).toBeTruthy();
      expect(screen.queryByText('Projected')).toBeNull();
      expect(screen.queryByText('At least')).toBeNull();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Adjust plan'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('At least').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Up to').length).toBeGreaterThan(0);
      expect(screen.getByText('3-5x/week')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getAllByText('+')[0]);
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    expect(mockUserRepository.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        adaptiveTrainingPlan: expect.objectContaining({
          targetRanges: expect.arrayContaining([
            expect.objectContaining({ id: 'lift', minCount: 4, maxCount: 5 }),
          ]),
        }),
      })
    );
  });

  it('keeps commitments and events out of profile settings', async () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }

    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Gym'],
      injuries: [],
      focusBias: [],
      avoid: [],
      aiFeaturesEnabled: true,
      adaptiveTrainingPlan: {
        ...plan,
        sessionPreferences: [
          {
            id: 'pin:0:push',
            localDate: '2026-05-01',
            blockIds: ['push'],
            status: 'pinned',
            note: 'Locked in',
          },
        ],
      },
    });

    const screen = render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Equipment')).toBeTruthy();
    });

    expect(screen.queryByText('Commitments & events')).toBeNull();
    expect(screen.queryByText('Manage commitments')).toBeNull();
    expect(screen.queryByText('Pinned sessions')).toBeNull();
    expect(screen.queryByText('Major events')).toBeNull();
    // Internal strategy mechanics must never become required user choices.
    expect(screen.queryByText(/ordered rotation/i)).toBeNull();
    expect(screen.queryByText(/weekly target balance/i)).toBeNull();
    expect(screen.queryByText(/minimum effective dose/i)).toBeNull();
    expect(screen.queryByText(/event[- ]prep/i)).toBeNull();
    expect(screen.queryByText(/schedule strategy/i)).toBeNull();
  });

  it('saves catalog-only workout creation mode', async () => {
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Bodyweight'],
      injuries: [],
      focusBias: [],
      avoid: [],
      aiFeaturesEnabled: true,
    });

    const screen = render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Workout creation')).toBeTruthy();
      expect(screen.getByText('AI + catalog')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Change mode'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Catalog only'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    expect(mockUserRepository.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        aiFeaturesEnabled: false,
      })
    );
  });
});
