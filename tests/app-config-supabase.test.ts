// Mock dotenv to prevent .env file loading during tests
vi.mock('dotenv', () => ({ config: vi.fn() }));

// Mock logger to prevent console output during tests
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const baseEnv = {
  OPENAI_API_KEY: 'sk-test-key-that-is-at-least-20-chars',
};

// Minimal env that passes ConfigService validation (all non-defaulted fields provided)
const minimalProcessEnv = {
  ...baseEnv,
  NODE_ENV: 'test',
  PATH: process.env.PATH,
};

describe('App Config — Supabase Schema Validation', () => {
  let envSchema: typeof import('../src/config/app.config').envSchema;
  const savedEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...minimalProcessEnv } as unknown as NodeJS.ProcessEnv;
    const mod = await import('../src/config/app.config');
    envSchema = mod.envSchema;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('should accept config without Supabase vars (optional)', () => {
    const result = envSchema.safeParse(baseEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPABASE_URL).toBeUndefined();
      expect(result.data.SUPABASE_ANON_KEY).toBeUndefined();
      expect(result.data.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    }
  });

  it('should accept valid Supabase URL', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      SUPABASE_URL: 'https://myproject.supabase.co',
      SUPABASE_ANON_KEY: 'eyJ-anon-key-that-is-at-least-20-chars-long',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJ-service-key-at-least-20-chars-long',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPABASE_URL).toBe('https://myproject.supabase.co');
      expect(result.data.SUPABASE_ANON_KEY).toBe('eyJ-anon-key-that-is-at-least-20-chars-long');
      expect(result.data.SUPABASE_SERVICE_ROLE_KEY).toBe('eyJ-service-key-at-least-20-chars-long');
    }
  });

  it('should reject invalid Supabase URL format', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      SUPABASE_URL: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should reject Supabase keys shorter than 20 characters', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      SUPABASE_URL: 'https://myproject.supabase.co',
      SUPABASE_ANON_KEY: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('App Config — Production Hardening (beta-deployment Phase 1.5)', () => {
  let envSchema: typeof import('../src/config/app.config').envSchema;
  const savedEnv = process.env;
  const prodSupabase = {
    SUPABASE_URL: 'https://myproject.supabase.co',
    SUPABASE_ANON_KEY: 'eyJ-anon-key-that-is-at-least-20-chars-long',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJ-service-key-at-least-20-chars-long',
  };
  const prodPublicUrl = 'https://adobe-stock-uploader.up.railway.app';

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...minimalProcessEnv } as unknown as NodeJS.ProcessEnv;
    const mod = await import('../src/config/app.config');
    envSchema = mod.envSchema;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  describe('T12: BASE_URL refinement', () => {
    it('rejects localhost BASE_URL when NODE_ENV=production', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        ...prodSupabase,
        NODE_ENV: 'production',
        BASE_URL: 'http://localhost:3000',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const baseUrlIssue = result.error.issues.find(i => i.path[0] === 'BASE_URL');
        expect(baseUrlIssue?.message).toContain('public URL');
      }
    });

    it('rejects 127.0.0.1 BASE_URL when NODE_ENV=production', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        ...prodSupabase,
        NODE_ENV: 'production',
        BASE_URL: 'http://127.0.0.1:3000',
      });
      expect(result.success).toBe(false);
    });

    it('accepts public BASE_URL when NODE_ENV=production', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        ...prodSupabase,
        NODE_ENV: 'production',
        BASE_URL: prodPublicUrl,
      });
      expect(result.success).toBe(true);
    });

    it('accepts localhost BASE_URL when NODE_ENV=development', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'development',
        BASE_URL: 'http://localhost:3000',
      });
      expect(result.success).toBe(true);
    });

    it('accepts localhost BASE_URL when NODE_ENV=test', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'test',
        BASE_URL: 'http://localhost:3000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('T13: Supabase production requirements', () => {
    it('rejects production boot when SUPABASE_SERVICE_ROLE_KEY missing', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'production',
        BASE_URL: prodPublicUrl,
        SUPABASE_URL: prodSupabase.SUPABASE_URL,
        SUPABASE_ANON_KEY: prodSupabase.SUPABASE_ANON_KEY,
        // SUPABASE_SERVICE_ROLE_KEY intentionally missing
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => i.path[0] === 'SUPABASE_SERVICE_ROLE_KEY');
        expect(issue?.message).toContain('required when NODE_ENV=production');
      }
    });

    it('rejects production boot when SUPABASE_URL missing', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'production',
        BASE_URL: prodPublicUrl,
        SUPABASE_ANON_KEY: prodSupabase.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: prodSupabase.SUPABASE_SERVICE_ROLE_KEY,
      });
      expect(result.success).toBe(false);
    });

    it('accepts production with all Supabase vars set', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        ...prodSupabase,
        NODE_ENV: 'production',
        BASE_URL: prodPublicUrl,
      });
      expect(result.success).toBe(true);
    });

    it('accepts development without Supabase vars (still optional)', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'development',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('App Config — Feature Flag Schema Validation', () => {
  let envSchema: typeof import('../src/config/app.config').envSchema;
  const savedEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...minimalProcessEnv } as unknown as NodeJS.ProcessEnv;
    const mod = await import('../src/config/app.config');
    envSchema = mod.envSchema;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('should default FEATURE_PLANS_PAGE to false when not set', () => {
    const result = envSchema.safeParse(baseEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FEATURE_PLANS_PAGE).toBe(false);
    }
  });

  it('should parse "true" string to boolean true', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      FEATURE_PLANS_PAGE: 'true',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FEATURE_PLANS_PAGE).toBe(true);
    }
  });

  it('should parse "false" string to boolean false', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      FEATURE_PLANS_PAGE: 'false',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FEATURE_PLANS_PAGE).toBe(false);
    }
  });

  it('should parse "1" to boolean true', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      FEATURE_PLANS_PAGE: '1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FEATURE_PLANS_PAGE).toBe(true);
    }
  });

  it('should parse "0" to boolean false', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      FEATURE_PLANS_PAGE: '0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FEATURE_PLANS_PAGE).toBe(false);
    }
  });

  it('should handle uppercase "TRUE" case-insensitively', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      FEATURE_PLANS_PAGE: 'TRUE',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FEATURE_PLANS_PAGE).toBe(true);
    }
  });

  it('should handle mixed case "True" case-insensitively', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      FEATURE_PLANS_PAGE: 'True',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FEATURE_PLANS_PAGE).toBe(true);
    }
  });
});
