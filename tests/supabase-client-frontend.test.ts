const mockCreateClient = vi.fn(() => ({
  auth: { getUser: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn() },
  from: vi.fn(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn() })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('Frontend Supabase Client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should export supabase as null when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { supabase } = await import('../client/src/lib/supabase');
    expect(supabase).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('should create a Supabase client when env vars are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const { supabase } = await import('../client/src/lib/supabase');
    expect(supabase).not.toBeNull();
    expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
  });

  it('should export null when only URL is present but anon key is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { supabase } = await import('../client/src/lib/supabase');
    expect(supabase).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
