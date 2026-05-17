'use strict';

const axios = require('axios');
const logger = require('../../utils/logger');

const FEED_NAME = 'urlhaus';
const DEFAULT_URL = process.env.URLHAUS_FEED_URL || 'https://urlhaus.abuse.ch/downloads/text/';

/**
 * Fetch malware distribution URLs from URLhaus (abuse.ch).
 * Feed is a plain text file with lines starting with # for comments,
 * followed by one malicious URL per line.
 * No API key required.
 *
 * @returns {Promise<string[]>}
 */
async function fetchUrlhausFeed() {
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
            // Skip comment lines and empty lines
            .filter((line) => line.length > 0 && !line.startsWith('#'))
            // Only include valid HTTP/HTTPS URLs
            .filter((line) => line.startsWith('http://') || line.startsWith('https://'));

        logger.info(`[${FEED_NAME}] Fetched ${urls.length} malware URLs`);
        return urls;
    } catch (err) {
        logger.error(`[${FEED_NAME}] Fetch failed:`, err.message);
        return [];
    }
}

module.exports = { fetchUrlhausFeed, FEED_NAME };
