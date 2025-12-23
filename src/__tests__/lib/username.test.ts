import { normalizeUsername, validateNormalizedUsername } from '@/lib/username-constants';
import { resolveUsername, checkUsernameAvailability, registerUsername, UsernameErrorCode, clearUsernameCache } from '@/lib/username';

// Basic mock for fetch
const originalFetch = global.fetch;

function mockFetch(handler: (url: string, init?: any) => Promise<Response>) {
  // @ts-ignore
  global.fetch = handler;
}

function restoreFetch() {
  global.fetch = originalFetch;
}

describe('username normalization & validation', () => {
  test('normalize removes @ and trims', () => {
    expect(normalizeUsername('  @Test_User  ')).toBe('test_user');
  });
  test('rejects too short', () => {
    const r = validateNormalizedUsername('ab');
    expect(r.valid).toBe(false);
  });
  test('rejects invalid chars', () => {
    const r = validateNormalizedUsername('bad*name');
    expect(r.valid).toBe(false);
  });
  test('accepts valid', () => {
    const r = validateNormalizedUsername('valid_name');
    expect(r.valid).toBe(true);
  });
});

describe('resolveUsername', () => {
  afterEach(() => restoreFetch());
  test('returns address on success', async () => {
    mockFetch(async () => new Response(JSON.stringify({ address: 'SolAddress123' }), { status: 200 }));
    const result = await resolveUsername('valid_name');
    expect(result.address).toBe('SolAddress123');
    expect(result.error).toBeUndefined();
  });
  test('returns not found', async () => {
    mockFetch(async () => new Response('', { status: 404 }));
    const result = await resolveUsername('unknownuser');
    expect(result.address).toBeNull();
    expect(result.error).toBe(UsernameErrorCode.NotFound);
  });
});

describe('checkUsernameAvailability', () => {
  afterEach(() => restoreFetch());
  test('available true', async () => {
    mockFetch(async () => new Response(JSON.stringify({ available: true }), { status: 200 }));
    const r = await checkUsernameAvailability('newname');
    expect(r.available).toBe(true);
  });
  test('network error', async () => {
    mockFetch(async () => { throw new Error('net'); });
    const r = await checkUsernameAvailability('any');
    expect(r.available).toBe(false);
    expect(r.error).toBe(UsernameErrorCode.Network);
  });
});

describe('registerUsername', () => {
  afterEach(() => restoreFetch());
  test('success registers', async () => {
    mockFetch(async () => new Response(JSON.stringify({ data: { username: 'okay', address: 'A' }, requestId: 'test', timestamp: Date.now() }), { status: 200 }));
    const r = await registerUsername('okay', 'A');
    expect(r.success).toBe(true);
  });
  test('conflict returns Taken', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'taken', requestId: 'test', timestamp: Date.now() } }), { status: 409 }));
    const r = await registerUsername('takenname', 'A');
    expect(r.success).toBe(false);
    expect(r.error).toBe(UsernameErrorCode.Taken);
  });
});

describe('cache clear', () => {
  test('clear function executes', () => {
    clearUsernameCache();
    expect(true).toBe(true);
  });
});
