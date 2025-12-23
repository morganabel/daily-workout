let counter = 0;

function makeDeterministicUuidV7(counterValue: number): string {
  // UUID format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
  // For v7, M=7. For variant 1, N is one of 8,9,a,b.
  const suffix = counterValue.toString(16).padStart(12, '0');
  return `00000000-0000-7000-8000-${suffix}`;
}

export const v7 = (): string => {
  const value = counter;
  counter += 1;
  return makeDeterministicUuidV7(value);
};
