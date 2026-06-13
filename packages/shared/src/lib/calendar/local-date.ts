const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseLocalDateParts = (
  localDate: string
): { year: number; month: number; day: number } => {
  const match = LOCAL_DATE_PATTERN.exec(localDate);
  if (!match) {
    throw new Error(`Invalid local date: ${localDate}`);
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number.parseInt(yearValue, 10);
  const month = Number.parseInt(monthValue, 10);
  const day = Number.parseInt(dayValue, 10);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid local date: ${localDate}`);
  }

  return { year, month, day };
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const localDateToUtcOrdinal = (localDate: string): number => {
  const { year, month, day } = parseLocalDateParts(localDate);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
};

export const daysBetweenLocalDates = (
  leftLocalDate: string,
  rightLocalDate: string
): number =>
  localDateToUtcOrdinal(leftLocalDate) - localDateToUtcOrdinal(rightLocalDate);

export const addDaysToLocalDate = (localDate: string, days: number): string => {
  const { year, month, day } = parseLocalDateParts(localDate);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(
    next.getUTCDate()
  )}`;
};

export const compareLocalDates = (
  leftLocalDate: string,
  rightLocalDate: string
): number =>
  localDateToUtcOrdinal(leftLocalDate) - localDateToUtcOrdinal(rightLocalDate);
