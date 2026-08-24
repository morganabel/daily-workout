const store = new Map<string, string>();

function ensureValidKey(key: string): void {
  if (!/^[\w.-]+$/.test(key)) {
    throw new Error(
      'Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".'
    );
  }
}

export const setItemAsync = jest.fn(async (key: string, value: string) => {
  ensureValidKey(key);
  store.set(key, value);
});

export const getItemAsync = jest.fn(async (key: string) => {
  ensureValidKey(key);
  const value = store.get(key);
  return value ?? null;
});

export const deleteItemAsync = jest.fn(async (key: string) => {
  ensureValidKey(key);
  store.delete(key);
});

export const isAvailableAsync = jest.fn(async () => true);
