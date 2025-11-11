import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().url().default('http://localhost:3000'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(20, 'OpenAI API key is required'),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(1000),
  OPENAI_TEMPERATURE: z.coerce.number().default(0.3),

  // Processing
  CONCURRENCY_LIMIT: z.coerce.number().default(5),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  TEMP_FILE_LIFETIME_SECONDS: z.coerce.number().default(10),

  // Rate Limiting
  ANONYMOUS_LIMIT: z.coerce.number().default(10),
  FREE_TIER_LIMIT: z.coerce.number().default(100),
});

export type AppConfig = z.infer<typeof envSchema>;

class ConfigService {
  private config: AppConfig;

  constructor() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('❌ Configuration validation failed:');
      console.error(result.error.format());
      process.exit(1);
    }

    this.config = result.data;
    console.log('✅ Configuration validated successfully');
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
    };
  }
}

export const config = new ConfigService();
