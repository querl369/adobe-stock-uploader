// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockCreateClient = vi.fn(() => ({
  auth: { getUser: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn() },
  from: vi.fn(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn() })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('Backend Supabase Client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  it('should export supabaseAdmin as null when config is missing', async () => {
    vi.doMock('../src/config/app.config', () => ({
      config: {
        server: {
          port: 3000,
          baseUrl: 'http://localhost:3000',
          isProduction: false,
          nodeEnv: 'test',
        },
        openai: {
          apiKey: 'test-key',
          model: 'gpt-5-nano',
          maxTokens: 1000,
          temperature: 0.3,
          timeoutMs: 30000,
        },
        processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetime: 10 },
        rateLimits: { anonymous: 10, freeTier: 100 },
        database: { path: ':memory:' },
        supabase: { url: undefined, anonKey: undefined, serviceRoleKey: undefined },
        featureFlags: { plansPage: false },
      },
    }));

    const { supabaseAdmin } = await import('../src/lib/supabase');
    expect(supabaseAdmin).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('should create a Supabase client when config is present', async () => {
    vi.doMock('../src/config/app.config', () => ({
      config: {
        server: {
          port: 3000,
          baseUrl: 'http://localhost:3000',
          isProduction: false,
          nodeEnv: 'test',
        },
        openai: {
          apiKey: 'test-key',
          model: 'gpt-5-nano',
          maxTokens: 1000,
          temperature: 0.3,
          timeoutMs: 30000,
        },
        processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetime: 10 },
        rateLimits: { anonymous: 10, freeTier: 100 },
        database: { path: ':memory:' },
        supabase: {
          url: 'https://test.supabase.co',
          anonKey: 'test-anon-key',
          serviceRoleKey: 'test-service-role-key',
        },
        featureFlags: { plansPage: false },
      },
    }));

    const { supabaseAdmin } = await import('../src/lib/supabase');
    expect(supabaseAdmin).not.toBeNull();
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-service-role-key'
    );
  });

  it('should export null when only URL is present but service role key is missing', async () => {
    vi.doMock('../src/config/app.config', () => ({
      config: {
        server: {
          port: 3000,
          baseUrl: 'http://localhost:3000',
          isProduction: false,
          nodeEnv: 'test',
        },
        openai: {
          apiKey: 'test-key',
          model: 'gpt-5-nano',
          maxTokens: 1000,
          temperature: 0.3,
          timeoutMs: 30000,
        },
        processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetime: 10 },
        rateLimits: { anonymous: 10, freeTier: 100 },
        database: { path: ':memory:' },
        supabase: {
          url: 'https://test.supabase.co',
          anonKey: undefined,
          serviceRoleKey: undefined,
        },
        featureFlags: { plansPage: false },
      },
    }));

    const { supabaseAdmin } = await import('../src/lib/supabase');
    expect(supabaseAdmin).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
