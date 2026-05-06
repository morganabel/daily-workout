import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { createAdaptiveTrainingPlanFromTemplate } from '@workout-agent/shared';
import { SettingsScreen } from './SettingsScreen';
import { userRepository } from './db/repositories/UserRepository';

jest.mock('./components/BottomNavigation', () => ({
  BottomNavigation: () => null,
}));

jest.mock('./services/starterWeekSlots', () => ({
  createStarterWeekSlots: jest.fn().mockResolvedValue([]),
}));

jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

describe('SettingsScreen adaptive plan settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders adaptive blocks and saves edited target ranges locally', async () => {
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
      adaptiveTrainingPlan: plan,
    });

    const screen = render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Training Rhythm')).toBeTruthy();
      expect(screen.getAllByText('Push').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lift').length).toBeGreaterThan(0);
      expect(screen.getByText('3-5 in 7 days')).toBeTruthy();
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
});
