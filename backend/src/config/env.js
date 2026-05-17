'use strict';

const { z } = require('zod');

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('4000'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

    // Redis
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    REDIS_TLS: z.string().default('false'),

    // Postgres
    DATABASE_URL: z.string().min(1),

    // Security
    API_SECRET_KEY: z.string().min(16).optional(),
    CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('60'),

    // Google Safe Browsing
    GOOGLE_SAFE_BROWSING_API_KEY: z.string().optional(),
    GOOGLE_SAFE_BROWSING_CLIENT_ID: z.string().default('cyberneura'),
    GOOGLE_SAFE_BROWSING_CLIENT_VERSION: z.string().default('1.0.0'),

    // PhishTank
    PHISHTANK_API_KEY: z.string().optional(),
    PHISHTANK_FEED_URL: z.string().url().default('http://data.phishtank.com/data/online-valid.json'),

    // OpenPhish
    OPENPHISH_FEED_URL: z.string().url().default('https://openphish.com/feed.txt'),

    // URLhaus
    URLHAUS_FEED_URL: z.string().url().default('https://urlhaus.abuse.ch/downloads/text/'),

    // Feed sync
    FEED_SYNC_CRON: z.string().default('*/30 * * * *'),
    REDIS_PIPELINE_BATCH_SIZE: z.string().default('1000'),

    // AI service
    AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
    AI_SERVICE_TIMEOUT_MS: z.string().default('5000'),
    AI_SERVICE_ENABLED: z.string().default('false'),
});

function loadEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(`Environment validation failed:\n${issues}`);
    }
    return result.data;
}

const env = loadEnv();

module.exports = { env };
