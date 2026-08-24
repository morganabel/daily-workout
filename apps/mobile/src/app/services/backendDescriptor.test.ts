import { resolveBackendDescriptor } from './backendDescriptor';

describe('backend descriptor', () => {
  it('canonicalizes equivalent URLs to one ownership and auth-storage key', () => {
    const first = resolveBackendDescriptor(
      'https://EXAMPLE.com:443/api/?ignored=true#fragment'
    );
    const second = resolveBackendDescriptor('https://example.com/api');

    expect(first).toEqual(second);
    expect(first.baseURL).toBe('https://example.com/api');
  });

  it('keeps scheme, effective port, and base-path boundaries distinct', () => {
    const descriptors = [
      resolveBackendDescriptor('http://example.com/api'),
      resolveBackendDescriptor('https://example.com/api'),
      resolveBackendDescriptor('https://example.com:8443/api'),
      resolveBackendDescriptor('https://example.com/other'),
    ];

    expect(new Set(descriptors.map((item) => item.backendId)).size).toBe(4);
    expect(
      new Set(descriptors.map((item) => item.authStoragePrefix)).size
    ).toBe(4);
  });

  it('rejects non-HTTP and credential-bearing URLs', () => {
    expect(() => resolveBackendDescriptor('file:///tmp/server')).toThrow(
      'invalid_backend_url'
    );
    expect(() =>
      resolveBackendDescriptor('https://user:password@example.com')
    ).toThrow('invalid_backend_url');
  });
});
