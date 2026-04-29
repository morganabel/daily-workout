const REDACTED_NOTE = '[REDACTED]';

const isNotesKey = (key: string): boolean => key.toLowerCase().includes('note');

export function redactDebugNotesFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactDebugNotesFields(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isNotesKey(key) && entry != null
        ? REDACTED_NOTE
        : redactDebugNotesFields(entry),
    ]),
  );
}
