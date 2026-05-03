/**
 * Client API helper tests
 *
 * These tests verify the contract between `client/src/api/client.ts` and the
 * server's auth-gated endpoints. They specifically catch the regression class
 * surfaced during T18 of the beta-deployment spec, where the server added
 * `requireAuth` to status / history routes but the client helpers weren't
 * updated to send the JWT — both sides' unit tests still passed and the bug
 * only surfaced in a live smoke test.
 *
 * Strategy: mock the Supabase client (controls the JWT) and global fetch
 * (captures the outbound request), then assert each helper sends the
 * appropriate URL, method, and Authorization header.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock so client.ts -> '../lib/supabase' resolves to our stub.
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../client/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

const TEST_JWT = 'test-jwt-abc123';

// Build a minimal Response-like object. We don't use `new Response()` to keep
// these tests independent of node's fetch globals across versions.
function makeResponse(opts: {
  ok?: boolean;
  status?: number;
  body?: unknown;
  blob?: Blob;
  headers?: Record<string, string>;
}) {
  const headers = new Map(Object.entries(opts.headers ?? {}));
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    blob: vi.fn().mockResolvedValue(opts.blob ?? new Blob([''])),
    text: vi.fn().mockResolvedValue(''),
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? headers.get(key) ?? null,
    },
  } as unknown as Response;
}

describe('client/src/api/client.ts — auth header contract', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    // Stub the global fetch used by `safeFetch`.
    vi.stubGlobal('fetch', fetchMock);
    // Default: authenticated session with a known JWT.
    mockGetSession.mockResolvedValue({ data: { session: { access_token: TEST_JWT } } });
  });

  afterEach(() => {
    // Restore URL / document / fetch globals so per-test stubs don't leak.
    vi.unstubAllGlobals();
  });

  function lastRequestInit(): RequestInit {
    const calls = fetchMock.mock.calls;
    if (calls.length === 0) throw new Error('fetch was not called');
    return (calls[calls.length - 1][1] as RequestInit) ?? {};
  }

  function lastRequestUrl(): string {
    const calls = fetchMock.mock.calls;
    if (calls.length === 0) throw new Error('fetch was not called');
    return calls[calls.length - 1][0] as string;
  }

  function authHeaderOfLastRequest(): string | undefined {
    const init = lastRequestInit();
    const headers = (init.headers ?? {}) as Record<string, string>;
    return headers['Authorization'];
  }

  describe('protected endpoints — must attach Bearer JWT', () => {
    it('startBatchProcessing → POST /api/process-batch-v2 with JWT', async () => {
      fetchMock.mockResolvedValue(makeResponse({ body: { success: true, batchId: 'b-1' } }));
      const { startBatchProcessing } = await import('../client/src/api/client');

      await startBatchProcessing(['file-1']);

      expect(lastRequestUrl()).toBe('/api/process-batch-v2');
      expect(lastRequestInit().method).toBe('POST');
      expect(authHeaderOfLastRequest()).toBe(`Bearer ${TEST_JWT}`);
    });

    it('getBatchStatus → GET /api/batch-status/:id with JWT (regression: T18 polling 401)', async () => {
      fetchMock.mockResolvedValue(makeResponse({ body: { batchId: 'b-1', status: 'pending' } }));
      const { getBatchStatus } = await import('../client/src/api/client');

      await getBatchStatus('b-1');

      expect(lastRequestUrl()).toBe('/api/batch-status/b-1');
      expect(authHeaderOfLastRequest()).toBe(`Bearer ${TEST_JWT}`);
      expect(lastRequestInit().credentials).toBe('include');
    });

    it('getBatches → GET /api/batches with JWT (regression: T18 history list 401)', async () => {
      fetchMock.mockResolvedValue(makeResponse({ body: { success: true, batches: [] } }));
      const { getBatches } = await import('../client/src/api/client');

      await getBatches();

      expect(lastRequestUrl()).toBe('/api/batches');
      expect(authHeaderOfLastRequest()).toBe(`Bearer ${TEST_JWT}`);
      expect(lastRequestInit().credentials).toBe('include');
    });

    it('getUsage → GET /api/usage with JWT', async () => {
      fetchMock.mockResolvedValue(makeResponse({ body: { tier: 'free', monthlyLimit: 500 } }));
      const { getUsage } = await import('../client/src/api/client');

      await getUsage();

      expect(lastRequestUrl()).toBe('/api/usage');
      expect(authHeaderOfLastRequest()).toBe(`Bearer ${TEST_JWT}`);
    });

    it('persistCsvToServer → POST /api/generate-csv with JWT', async () => {
      fetchMock.mockResolvedValue(makeResponse({ body: { success: true } }));
      const { persistCsvToServer } = await import('../client/src/api/client');

      await persistCsvToServer(
        [{ filename: 'a.jpg', title: 't', keywords: 'k', category: 1 }],
        'b-1',
        'AB'
      );

      expect(lastRequestUrl()).toBe('/api/generate-csv');
      expect(lastRequestInit().method).toBe('POST');
      expect(authHeaderOfLastRequest()).toBe(`Bearer ${TEST_JWT}`);
    });

    it('downloadBatchCsv → GET /api/download-csv/:id with JWT + credentials', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          blob: new Blob(['filename,title']),
          headers: { 'content-disposition': 'attachment; filename="b-1.csv"' },
        })
      );

      // Import BEFORE stubbing URL/document so the module load doesn't see
      // a half-broken URL global (the supabase client may use `new URL()`
      // during construction).
      const { downloadBatchCsv } = await import('../client/src/api/client');

      // Patch only the static methods downloadBatchCsv reaches for; preserve
      // the URL constructor so anything else that runs is unaffected.
      const realCreateObjectURL = URL.createObjectURL;
      const realRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
      URL.revokeObjectURL = vi.fn();
      const fakeLink = { href: '', download: '', click: vi.fn() };
      vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(fakeLink) });

      try {
        await downloadBatchCsv('b-1');

        expect(lastRequestUrl()).toBe('/api/download-csv/b-1');
        expect(authHeaderOfLastRequest()).toBe(`Bearer ${TEST_JWT}`);
        expect(lastRequestInit().credentials).toBe('include');
      } finally {
        URL.createObjectURL = realCreateObjectURL;
        URL.revokeObjectURL = realRevokeObjectURL;
      }
    });
  });

  describe('public endpoints — work without JWT', () => {
    it('cleanup → POST /api/cleanup with no auth header (anonymous-safe)', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      fetchMock.mockResolvedValue(makeResponse({ body: { success: true } }));
      const { cleanup } = await import('../client/src/api/client');

      await cleanup();

      expect(lastRequestUrl()).toBe('/api/cleanup');
      expect(lastRequestInit().method).toBe('POST');
      // cleanup() doesn't use authHeaders at all — no Authorization key set.
      expect(authHeaderOfLastRequest()).toBeUndefined();
    });

    it('uploadImages anonymously → POST /api/upload-images with no Authorization', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      fetchMock.mockResolvedValue(makeResponse({ body: { success: true, files: [] } }));
      const { uploadImages } = await import('../client/src/api/client');

      // Provide a minimal File-like input so FormData.append doesn't choke.
      const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      await uploadImages([file]);

      expect(lastRequestUrl()).toBe('/api/upload-images');
      expect(authHeaderOfLastRequest()).toBeUndefined();
    });

    it('uploadImages authenticated → POST /api/upload-images attaches JWT (auth-aware caps)', async () => {
      fetchMock.mockResolvedValue(makeResponse({ body: { success: true, files: [] } }));
      const { uploadImages } = await import('../client/src/api/client');

      const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      await uploadImages([file]);

      expect(authHeaderOfLastRequest()).toBe(`Bearer ${TEST_JWT}`);
    });
  });

  describe('anonymous fallback — no JWT means no Authorization header', () => {
    it('getUsage anonymously omits Authorization (route returns 401, but client must not crash)', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      fetchMock.mockResolvedValue(
        makeResponse({ ok: false, status: 401, body: { error: { message: 'unauth' } } })
      );
      const { getUsage } = await import('../client/src/api/client');

      await expect(getUsage()).rejects.toThrow();
      expect(authHeaderOfLastRequest()).toBeUndefined();
    });
  });
});
