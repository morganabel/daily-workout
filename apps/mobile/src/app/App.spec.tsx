import * as React from 'react';
import { render } from '@testing-library/react-native';

import App from './App';

describe('App', () => {
  it('renders the home screen shell and hero card', async () => {
    const { getByText, findByText } = render(<App />);

    expect(getByText(/Your workout hub/i)).toBeTruthy();
    expect(getByText(/Quick actions/i)).toBeTruthy();
    expect(getByText(/Workout Agent/i)).toBeTruthy();
    expect(getByText(/Quick log/i)).toBeTruthy();
    await findByText(/Start workout/i);
  });
});
