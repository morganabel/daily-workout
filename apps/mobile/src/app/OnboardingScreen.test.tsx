import React from 'react';
import {
  act,
  fireEvent,
  render,
  type RenderAPI,
} from '@testing-library/react-native';
import { OnboardingScreen } from './OnboardingScreen';
import { createStarterWeekSlots } from './services/starterWeekSlots';
import { userRepository } from './db/repositories/UserRepository';

const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    reset: mockReset,
  }),
}));

jest.mock('./services/starterWeekSlots', () => ({
  createStarterWeekSlots: jest.fn().mockResolvedValue([]),
}));

jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    saveTrainingBlueprint: jest.fn().mockResolvedValue(undefined),
    skipTrainingBlueprintSetup: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockCreateStarterWeekSlots = createStarterWeekSlots as jest.MockedFunction<
  typeof createStarterWeekSlots
>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

type QueryResult = ReturnType<RenderAPI['getByText']>;

const press = async (element: QueryResult) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const completeQuestions = async (screen: RenderAPI) => {
  await press(screen.getByLabelText('Build muscle'));
  await press(screen.getByText('Continue'));
  await press(screen.getByLabelText('Intermediate'));
  await press(screen.getByText('Continue'));
  await press(screen.getAllByLabelText('Gym')[0]);
  await press(screen.getByText('Continue'));
};

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a recommended starter week after the three questions', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);

    expect(screen.getByText('PPL conditioning')).toBeTruthy();
    expect(screen.getByText('Use this plan')).toBeTruthy();
  });

  it('accepts the recommendation and creates starter slots', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);
    await press(screen.getByText('Use this plan'));

    expect(mockUserRepository.saveTrainingBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'ppl-conditioning' })
    );
    expect(mockCreateStarterWeekSlots).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'ppl-conditioning' })
    );
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  });

  it('enters the adjustment path before saving to Plan Settings', async () => {
    const screen = render(<OnboardingScreen />);

    await completeQuestions(screen);
    await press(screen.getByText('Adjust'));

    expect(screen.getByText('Adjust after saving')).toBeTruthy();

    await press(screen.getByText('Save and open Plan Settings'));

    expect(mockUserRepository.saveTrainingBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({ editStatus: 'adjusted' })
    );
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Settings' }],
    });
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
