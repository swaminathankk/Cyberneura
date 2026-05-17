'use strict';

const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10);

/**
 * General API rate limiter.
 * Uses in-memory store by default.
 * Can be swapped to Redis store for multi-instance deployments.
 */
const rateLimiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use X-Forwarded-For if behind a proxy, fall back to IP
        return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many requests — slow down.',
            retryAfter: Math.ceil(windowMs / 1000),
        });
    },
    skip: (req) => {
        // Skip health checks from rate limiting
        return req.path === '/health' || req.path === '/api/v1/health';
    },
});

/**
 * Stricter rate limiter for scan endpoints.
 */
const scanRateLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Scan rate limit exceeded. Max 20 scans per minute.',
    },
});

module.exports = { rateLimiter, scanRateLimiter };
