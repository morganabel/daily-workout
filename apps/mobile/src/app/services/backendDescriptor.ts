export type BackendDescriptor = {
  baseURL: string;
  backendId: string;
  authStoragePrefix: string;
};

const encodeStorageKey = (value: string): string => {
  let encoded = '';
  for (let index = 0; index < value.length; index += 1) {
    encoded += value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return encoded;
};

export function resolveBackendDescriptor(input: string): BackendDescriptor {
  const url = new URL(input);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error('invalid_backend_url');
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  const baseURL = `${url.origin}${pathname}`;
  // Fixed-width UTF-16 encoding is reversible, SecureStore-safe, and avoids
  // collisions caused by replacing URL punctuation with underscores.
  const storageKey = encodeStorageKey(baseURL);

  return {
    baseURL,
    backendId: `backend_${storageKey}`,
    authStoragePrefix: `auth_${storageKey}`,
  };
}

export const backendDescriptor = resolveBackendDescriptor(
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000'
);
