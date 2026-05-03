import { z } from 'zod';
import * as dotenv from 'dotenv';
import { logger } from '@utils/logger';

dotenv.config();

const envObjectSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.url().default('http://localhost:3000'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(20, 'OpenAI API key is required'),
  OPENAI_MODEL: z.string().default('gpt-5-nano'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(1000),
  OPENAI_TEMPERATURE: z.coerce.number().default(0.3),
  OPENAI_TIMEOUT_MS: z.coerce.number().default(30000),

  // Processing
  CONCURRENCY_LIMIT: z.coerce.number().default(5),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  TEMP_FILE_LIFETIME_SECONDS: z.coerce.number().default(10),

  // Rate Limiting
  ANONYMOUS_LIMIT: z.coerce.number().default(10),
  FREE_TIER_LIMIT: z.coerce.number().default(500),
  AUTH_BATCH_MAX_FILES: z.coerce.number().default(100),

  // Database
  DB_PATH: z.string().default('data/batches.db'),

  // Supabase
  SUPABASE_URL: z.url().optional(),
  SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  // Feature Flags
  FEATURE_PLANS_PAGE: z
    .string()
    .default('false')
    .transform(val => ['true', '1'].includes(val.toLowerCase())),
});

// beta-deployment T12 + T13: production-only refinements. superRefine sees the
// parsed NODE_ENV, so tests can drive these by passing { NODE_ENV: 'production' }
// to safeParse without mutating the real process.env.
export const envSchema = envObjectSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV !== 'production') return;

  // T12: BASE_URL must be a public URL in production. Otherwise temp URLs
  // handed to OpenAI's network resolve to the container's loopback.
  if (data.BASE_URL.includes('localhost') || data.BASE_URL.includes('127.0.0.1')) {
    ctx.addIssue({
      code: 'custom',
      path: ['BASE_URL'],
      message: 'BASE_URL must be a public URL when NODE_ENV=production',
    });
  }

  // T13: Supabase service-role key is required in production. auth.middleware
  // returns null when supabaseAdmin is unavailable; combined with requireAuth
  // that 401s every authenticated user silently. Boot-fail is correct here.
  if (!data.SUPABASE_URL) {
    ctx.addIssue({
      code: 'custom',
      path: ['SUPABASE_URL'],
      message: 'SUPABASE_URL is required when NODE_ENV=production',
    });
  }
  if (!data.SUPABASE_ANON_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['SUPABASE_ANON_KEY'],
      message: 'SUPABASE_ANON_KEY is required when NODE_ENV=production',
    });
  }
  if (!data.SUPABASE_SERVICE_ROLE_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['SUPABASE_SERVICE_ROLE_KEY'],
      message: 'SUPABASE_SERVICE_ROLE_KEY is required when NODE_ENV=production',
    });
  }
});

export type AppConfig = z.infer<typeof envSchema>;

class ConfigService {
  private config: AppConfig;

  constructor() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      logger.error({ issues: result.error.issues }, 'Configuration validation failed');
      process.exit(1);
    }

    this.config = result.data;
    logger.info(
      {
        nodeEnv: this.config.NODE_ENV,
        port: this.config.PORT,
        model: this.config.OPENAI_MODEL,
      },
      'Configuration validated successfully'
    );
  }

  get server() {
    return {
      port: this.config.PORT,
      baseUrl: this.config.BASE_URL,
      isProduction: this.config.NODE_ENV === 'production',
      nodeEnv: this.config.NODE_ENV,
    };
  }

  get openai() {
    return {
      apiKey: this.config.OPENAI_API_KEY,
      model: this.config.OPENAI_MODEL,
      maxTokens: this.config.OPENAI_MAX_TOKENS,
      temperature: this.config.OPENAI_TEMPERATURE,
      timeoutMs: this.config.OPENAI_TIMEOUT_MS,
    };
  }

  get processing() {
    return {
      concurrencyLimit: this.config.CONCURRENCY_LIMIT,
      maxFileSizeMB: this.config.MAX_FILE_SIZE_MB,
      tempFileLifetime: this.config.TEMP_FILE_LIFETIME_SECONDS,
    };
  }

  get rateLimits() {
    return {
      anonymous: this.config.ANONYMOUS_LIMIT,
      freeTier: this.config.FREE_TIER_LIMIT,
      authBatchMax: this.config.AUTH_BATCH_MAX_FILES,
    };
  }

  get database() {
    return {
      path: this.config.DB_PATH,
    };
  }

  get supabase() {
    return {
      url: this.config.SUPABASE_URL,
      anonKey: this.config.SUPABASE_ANON_KEY,
      serviceRoleKey: this.config.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  get featureFlags() {
    return {
      plansPage: this.config.FEATURE_PLANS_PAGE,
    };
  }
}

export const config = new ConfigService();
