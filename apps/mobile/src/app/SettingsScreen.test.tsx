import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { createAdaptiveTrainingPlanFromTemplate } from '@workout-agent/shared';
import { SettingsScreen } from './SettingsScreen';
import { userRepository } from './db/repositories/UserRepository';

jest.mock('./components/BottomNavigation', () => ({
  BottomNavigation: () => null,
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

  it('summarizes rhythm and saves edited target ranges from the focused editor', async () => {
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
      expect(screen.getByText('Training rhythm')).toBeTruthy();
      expect(screen.getByText('Strength 3-5x/week')).toBeTruthy();
      expect(
        screen.getByText('Usually: Push, Cardio, Pull, Legs +1')
      ).toBeTruthy();
      expect(screen.queryByText('Projected')).toBeNull();
      expect(screen.queryByText('At least')).toBeNull();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Adjust rhythm'));
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
});
