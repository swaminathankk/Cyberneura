'use strict';

const axios = require('axios');
const logger = require('../../utils/logger');

const FEED_NAME = 'openphish';
const DEFAULT_URL = process.env.OPENPHISH_FEED_URL || 'https://openphish.com/feed.txt';

/**
 * Fetch phishing URLs from OpenPhish Community Feed.
 * The feed is a plain text file with one URL per line.
 * No API key required for the community feed.
 *
 * @returns {Promise<string[]>}
 */
async function fetchOpenPhishFeed() {
    logger.info(`[${FEED_NAME}] Starting feed fetch from: ${DEFAULT_URL}`);

    try {
        const response = await axios.get(DEFAULT_URL, {
            timeout: 30_000,
            headers: {
                'User-Agent': 'CyberNeura/1.0 (Security Research)',
                Accept: 'text/plain',
            },
            responseType: 'text',
        });

        const text = typeof response.data === 'string' ? response.data : String(response.data);

        const urls = text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));

        logger.info(`[${FEED_NAME}] Fetched ${urls.length} phishing URLs`);
        return urls;
    } catch (err) {
        logger.error(`[${FEED_NAME}] Fetch failed:`, err.message);
        return [];
    }
}

module.exports = { fetchOpenPhishFeed, FEED_NAME };
