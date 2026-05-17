'use strict';

const Redis = require('ioredis');
const logger = require('../utils/logger');

let client = null;

function createRedisClient() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const useTLS = process.env.REDIS_TLS === 'true';

    const options = {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        retryStrategy: (times) => {
            if (times > 10) {
                logger.error('Redis: max reconnect attempts reached');
                return null;
            }
            return Math.min(times * 200, 3000);
        },
        ...(useTLS ? { tls: {} } : {}),
    };

    const instance = new Redis(redisUrl, options);

    instance.on('connect', () => logger.debug('Redis: connecting...'));
    instance.on('ready', () => logger.info('Redis: ready'));
    instance.on('error', (err) => logger.error('Redis error:', err.message));
    instance.on('close', () => logger.warn('Redis: connection closed'));
    instance.on('reconnecting', () => logger.info('Redis: reconnecting...'));

    return instance;
}

async function connectRedis() {
    client = createRedisClient();
    await client.connect();
    return client;
}

function getRedisClient() {
    if (!client) {
        throw new Error('Redis client not initialized. Call connectRedis() first.');
    }
    return client;
}

function closeRedis() {
    if (client) {
        return client.quit();
    }
}

module.exports = { connectRedis, getRedisClient, closeRedis };
