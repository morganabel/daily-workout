let sequence = 0;

export const v7 = jest.fn(() => {
  sequence += 1;
  return `00000000-0000-7000-8000-${sequence.toString(16).padStart(12, '0')}`;
});
