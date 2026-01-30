export const pad2 = (value: number): string => String(value).padStart(2, '0');

export const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const parseLocalDate = (localDate: string): Date => {
  const [year, month, day] = localDate
    .split('-')
    .map((value) => Number.parseInt(value, 10));
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

export const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

export const isSameDay = (left: Date, right: Date): boolean =>
  startOfDay(left).getTime() === startOfDay(right).getTime();

export const getLocalDateFromTimestamp = (timestamp: number): string =>
  formatLocalDate(new Date(timestamp));

export const getDeviceTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
