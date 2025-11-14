const store = new Map<string, string>();

export const setItemAsync = jest.fn(async (key: string, value: string) => {
  store.set(key, value);
});

export const getItemAsync = jest.fn(async (key: string) => {
  const value = store.get(key);
  return value ?? null;
});

export const deleteItemAsync = jest.fn(async (key: string) => {
  store.delete(key);
});

export const isAvailableAsync = jest.fn(async () => true);
