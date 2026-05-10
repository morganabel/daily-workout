import React from 'react';
import {
  act,
  fireEvent,
  render,
  type RenderAPI,
} from '@testing-library/react-native';
import { OnboardingScreen } from './OnboardingScreen';
import { userRepository } from './db/repositories/UserRepository';

const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    reset: mockReset,
  }),
}));

jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    saveTrainingBlueprint: jest.fn().mockResolvedValue(undefined),
    skipTrainingBlueprintSetup: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

type QueryResult = ReturnType<RenderAPI['getByText']>;

const press = async (element: QueryResult) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const completeQuestions = async (screen: RenderAPI) => {
  await press(screen.getByLabelText('Build muscle'));
  await press(screen.getByText('Next'));
  await press(screen.getByLabelText('Intermediate'));
  await press(screen.getByText('Next'));
  await press(screen.getByText('See my plan'));
};

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a recommended training plan after the three questions', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);

    expect(screen.getByText('Your training plan')).toBeTruthy();
    expect(screen.getAllByText('Lift')).toHaveLength(3);
    expect(screen.getByText('Use this plan')).toBeTruthy();
  });

  it('pre-selects gym as the default training environment', async () => {
    const screen = render(<OnboardingScreen />);

    await press(screen.getByLabelText('Build muscle'));
    await press(screen.getByText('Next'));
    await press(screen.getByLabelText('Intermediate'));
    await press(screen.getByText('Next'));

    expect(
      screen.getByText(
        'Assuming full gym access. You can fine-tune equipment later.'
      )
    ).toBeTruthy();
    expect(screen.getByText('See my plan')).toBeTruthy();
  });

  it('accepts the recommendation and saves the adaptive plan seed', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);
    await press(screen.getByText('Use this plan'));

    expect(mockUserRepository.saveTrainingBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'ppl-conditioning' })
    );
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  });

  it('opens day editing from the training plan without saving', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);
    await press(screen.getAllByText('Lift')[0]);

    expect(screen.getByText('Workout type')).toBeTruthy();
    expect(screen.getByText('Duration')).toBeTruthy();
    expect(screen.getAllByText('Lift').length).toBeGreaterThan(3);
    expect(screen.getAllByText('Recovery').length).toBeGreaterThan(0);
    expect(mockUserRepository.saveTrainingBlueprint).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('saves edited plan roles and day-level duration', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);
    await press(screen.getAllByText('Lift')[0]);
    await press(screen.getByText('Cardio'));
    const thirtyMinuteOptions = screen.getAllByText('30 min');
    await press(thirtyMinuteOptions[thirtyMinuteOptions.length - 1]);
    await press(screen.getByText('Apply'));
    await press(screen.getByText('Use this plan'));

    expect(mockUserRepository.saveTrainingBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({
        editStatus: 'adjusted',
        slotSequence: expect.arrayContaining([
          expect.objectContaining({
            role: 'conditioning',
            label: 'Cardio',
            targetDurationMinutes: 30,
          }),
        ]),
      })
    );
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  });

  it('makes recovery an obvious day-level option', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);
    await press(screen.getAllByText('Lift')[0]);
    const recoveryOptions = screen.getAllByText('Recovery');
    await press(recoveryOptions[recoveryOptions.length - 1]);
    await press(screen.getByText('Apply'));
    await press(screen.getByText('Use this plan'));

    expect(mockUserRepository.saveTrainingBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({
        slotSequence: expect.arrayContaining([
          expect.objectContaining({
            role: 'recovery',
            label: 'Recovery',
            targetDurationMinutes: 15,
          }),
        ]),
      })
    );
  });

  it('cancels day edits without changing the training plan', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);
    await press(screen.getAllByText('Lift')[0]);
    await press(screen.getByText('Cardio'));
    await press(screen.getByText('Cancel'));
    await press(screen.getByText('Use this plan'));

    expect(mockUserRepository.saveTrainingBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({
        editStatus: 'accepted',
        slotSequence: expect.arrayContaining([
          expect.objectContaining({
            role: 'full-body',
            label: 'Lift',
          }),
        ]),
      })
    );
  });

  it('skips onboarding and routes to the existing app experience', async () => {
    const screen = render(<OnboardingScreen />);

    await press(screen.getByText('Skip'));

    expect(mockUserRepository.skipTrainingBlueprintSetup).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  });
});
