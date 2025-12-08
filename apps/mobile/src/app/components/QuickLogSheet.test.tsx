import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import Toast from 'react-native-root-toast';

import { QuickLogSheet } from './QuickLogSheet';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-native-root-toast', () => ({
  show: jest.fn(),
  durations: { SHORT: 2000, LONG: 3500 },
  positions: { BOTTOM: -20 },
}));

describe('QuickLogSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('submits a focus-only quick log with defaults', async () => {
    const submitMock = jest.fn().mockResolvedValue(undefined);
    const closeMock = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      <QuickLogSheet visible onSubmit={submitMock} onClose={closeMock} />
    );

    fireEvent.press(getByText('Cardio'));

    fireEvent.press(getByText('▸ Edit details'));
    fireEvent.press(getByText('Yesterday'));
    fireEvent.changeText(
      getByPlaceholderText('Any details to remember...'),
      'Easy jog'
    );

    await act(async () => {
      fireEvent.press(getByText('Save log'));
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    const payload = submitMock.mock.calls[0][0];

    expect(payload).toMatchObject({
      name: 'Cardio',
      focus: 'Cardio',
      durationMinutes: 60,
      note: 'Easy jog',
    });
    expect(new Date(payload.completedAt).getHours()).toBe(12);
    expect(closeMock).toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith('Workout logged!', expect.anything());
  });

  it('resets the form when closing the sheet', async () => {
    const submitMock = jest.fn().mockResolvedValue(undefined);
    const closeMock = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      <QuickLogSheet visible onSubmit={submitMock} onClose={closeMock} />
    );

    const nameInput = getByPlaceholderText(
      'e.g., Morning run, Yoga session...'
    );
    fireEvent.changeText(nameInput, 'Evening yoga');

    fireEvent.press(getByText('Cancel'));

    expect(closeMock).toHaveBeenCalled();
    expect(
      getByPlaceholderText('e.g., Morning run, Yoga session...').props.value
    ).toBe('');
  });
});
