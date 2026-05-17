'use strict';

const { fetchPhishTankFeed } = require('./feeds/phishTank.feed');
const { fetchOpenPhishFeed } = require('./feeds/openPhish.feed');
const { fetchUrlhausFeed } = require('./feeds/urlhaus.feed');
const { bulkAddToBlacklist, updateSyncStats } = require('./redisCache.service');
const logger = require('../utils/logger');

/**
 * Orchestrates fetching from all threat intelligence feeds in parallel,
 * deduplicates results, and bulk-writes to the Redis blacklist.
 *
 * @returns {Promise<{ total: number, byFeed: Object, duration: number }>}
 */
async function syncAllFeeds() {
    const startTime = Date.now();
    logger.info('🔄 Starting threat intelligence feed sync...');

    // Fetch all feeds in parallel — one slow/failing feed won't block others
    const [phishTankUrls, openPhishUrls, urlhausUrls] = await Promise.allSettled([
        fetchPhishTankFeed(),
        fetchOpenPhishFeed(),
        fetchUrlhausFeed(),
    ]).then((results) =>
        results.map((r) => {
            if (r.status === 'fulfilled') return r.value;
            logger.warn('Feed fetch promise rejected:', r.reason?.message);
            return [];
        })
    );

    const byFeed = {
        phishtank: phishTankUrls.length,
        openphish: openPhishUrls.length,
        urlhaus: urlhausUrls.length,
    };

    // Merge and deduplicate
    const allUrlsSet = new Set([
        ...phishTankUrls,
        ...openPhishUrls,
        ...urlhausUrls,
    ]);
    const uniqueUrls = [...allUrlsSet];

    logger.info(`Feed sync: ${uniqueUrls.length} unique URLs after deduplication (raw total: ${phishTankUrls.length + openPhishUrls.length + urlhausUrls.length})`);

    // Bulk-write to Redis
    await bulkAddToBlacklist(uniqueUrls);

    const timestamp = Date.now();
    const duration = timestamp - startTime;

    // Update stats per feed
    await Promise.allSettled([
        updateSyncStats({ source: 'phishtank', count: phishTankUrls.length, timestamp }),
        updateSyncStats({ source: 'openphish', count: openPhishUrls.length, timestamp }),
        updateSyncStats({ source: 'urlhaus', count: urlhausUrls.length, timestamp }),
    ]);

    logger.info(`✅ Feed sync complete: ${uniqueUrls.length} URLs cached in ${duration}ms`, byFeed);

    return { total: uniqueUrls.length, byFeed, duration };
}

/**
 * Check if a specific set of URLs appear in any feed (used for API cross-check).
 * This does not call the feeds directly — relies on the Redis blacklist.
 * GSB is called separately in the scan pipeline.
 */
async function getFeedSources() {
    return ['phishtank', 'openphish', 'urlhaus', 'google_safe_browsing'];
}

module.exports = { syncAllFeeds, getFeedSources };
