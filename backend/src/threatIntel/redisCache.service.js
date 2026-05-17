'use strict';

const { getRedisClient } = require('../config/redis');
const { hashUrl, normalizeUrl } = require('../utils/hashUtils');
const logger = require('../utils/logger');

// Redis key constants
const BLACKLIST_KEY = 'cn:blacklist';
const WHITELIST_KEY = 'cn:whitelist';
const STATS_KEY = 'cn:intel:stats';

/**
 * Add a single URL to the Redis blacklist.
 */
async function addToBlacklist(rawUrl) {
    const client = getRedisClient();
    const hash = hashUrl(rawUrl);
    await client.sadd(BLACKLIST_KEY, hash);
}

/**
 * Bulk-add an array of URLs to the blacklist using a Redis pipeline.
 * This is much faster than calling addToBlacklist in a loop.
 * @param {string[]} urls
 */
async function bulkAddToBlacklist(urls) {
    if (!urls || urls.length === 0) return;
    const client = getRedisClient();
    const batchSize = parseInt(process.env.REDIS_PIPELINE_BATCH_SIZE || '1000', 10);

    let processed = 0;
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const pipeline = client.pipeline();
        for (const url of batch) {
            const hash = hashUrl(url);
            pipeline.sadd(BLACKLIST_KEY, hash);
        }
        await pipeline.exec();
        processed += batch.length;
    }

    logger.debug(`Blacklist: batch-added ${processed} URLs`);
}

/**
 * Check if a URL is in the blacklist. O(1) lookup.
 * @param {string} rawUrl
 * @returns {Promise<boolean>}
 */
async function isBlacklisted(rawUrl) {
    const client = getRedisClient();
    const hash = hashUrl(rawUrl);
    const result = await client.sismember(BLACKLIST_KEY, hash);
    return result === 1;
}

/**
 * Add a domain to the whitelist.
 */
async function addToWhitelist(domain) {
    const client = getRedisClient();
    await client.sadd(WHITELIST_KEY, domain.toLowerCase().replace(/^www\./, ''));
}

/**
 * Bulk-add domains to the whitelist.
 * @param {string[]} domains
 */
async function bulkAddToWhitelist(domains) {
    if (!domains || domains.length === 0) return;
    const client = getRedisClient();
    const batchSize = 500;

    for (let i = 0; i < domains.length; i += batchSize) {
        const batch = domains.slice(i, i + batchSize).map((d) =>
            d.toLowerCase().replace(/^www\./, '')
        );
        const pipeline = client.pipeline();
        pipeline.sadd(WHITELIST_KEY, ...batch);
        await pipeline.exec();
    }

    logger.debug(`Whitelist: loaded ${domains.length} domains`);
}

/**
 * Check if a domain is whitelisted.
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
async function isWhitelisted(domain) {
    const client = getRedisClient();
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    const result = await client.sismember(WHITELIST_KEY, normalized);
    return result === 1;
}

/**
 * Update feed sync statistics in Redis.
 * @param {{ source: string, count: number, timestamp: number }} stats
 */
async function updateSyncStats(stats) {
    const client = getRedisClient();
    await client.hset(STATS_KEY, {
        [`${stats.source}:count`]: stats.count,
        [`${stats.source}:lastSync`]: stats.timestamp,
        totalLastSync: stats.timestamp,
    });
}

/**
 * Get all sync statistics.
 */
async function getSyncStats() {
    const client = getRedisClient();
    const [stats, blacklistCount, whitelistCount] = await Promise.all([
        client.hgetall(STATS_KEY),
        client.scard(BLACKLIST_KEY),
        client.scard(WHITELIST_KEY),
    ]);

    return {
        blacklistCount,
        whitelistCount,
        feeds: stats || {},
    };
}

module.exports = {
    addToBlacklist,
    bulkAddToBlacklist,
    isBlacklisted,
    addToWhitelist,
    bulkAddToWhitelist,
    isWhitelisted,
    updateSyncStats,
    getSyncStats,
};
