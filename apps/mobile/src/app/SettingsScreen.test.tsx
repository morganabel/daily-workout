import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { createAdaptiveTrainingPlanFromTemplate } from '@workout-agent/shared';
import { SettingsScreen } from './SettingsScreen';
import { userRepository } from './db/repositories/UserRepository';

jest.mock('./components/BottomNavigation', () => ({
  BottomNavigation: () => null,
}));

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

jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

describe('SettingsScreen profile summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
