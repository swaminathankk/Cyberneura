'use strict';

const axios = require('axios');
const logger = require('../../utils/logger');

const FEED_NAME = 'phishtank';
const DEFAULT_URL = process.env.PHISHTANK_FEED_URL || 'http://data.phishtank.com/data/online-valid.json';

/**
 * Fetch verified phishing URLs from PhishTank.
 * PhishTank provides a JSON dump of all currently verified phising URLs.
 * Free tier: no API key required (but rate limited).
 * With API key: higher rate limits, use PHISHTANK_FEED_URL env var.
 *
 * @returns {Promise<string[]>} Array of malicious URLs
 */
async function fetchPhishTankFeed() {
    logger.info(`[${FEED_NAME}] Starting feed fetch from: ${DEFAULT_URL}`);

    try {
        const response = await axios.get(DEFAULT_URL, {
            timeout: 60_000,
            headers: {
                'User-Agent': 'CyberNeura/1.0 (Security Research)',
                Accept: 'application/json',
            },
            // PhishTank JSON can be large (50-100MB) — stream as needed
            maxContentLength: 200 * 1024 * 1024, // 200MB
        });

        const data = response.data;

        if (!Array.isArray(data)) {
            logger.warn(`[${FEED_NAME}] Unexpected response format — expected array`);
            return [];
        }

        // Filter only verified phishing entries and extract URLs
        const urls = data
            .filter((entry) => entry.verified === 'yes' && entry.url)
            .map((entry) => entry.url.trim())
            .filter((url) => url.startsWith('http'));

        logger.info(`[${FEED_NAME}] Fetched ${urls.length} verified phishing URLs`);
        return urls;
    } catch (err) {
        if (err.response?.status === 429) {
            logger.warn(`[${FEED_NAME}] Rate limited (429). Will retry next sync cycle.`);
        } else if (err.code === 'ECONNABORTED') {
            logger.warn(`[${FEED_NAME}] Request timed out after 60s`);
        } else {
            logger.error(`[${FEED_NAME}] Fetch failed:`, err.message);
        }
        return [];
    }
}

module.exports = { fetchPhishTankFeed, FEED_NAME };
