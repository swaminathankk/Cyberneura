'use strict';

const axios = require('axios');
const logger = require('../../utils/logger');

const FEED_NAME = 'google_safe_browsing';
const GSB_LOOKUP_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

/**
 * Check a batch of URLs against the Google Safe Browsing API v4.
 *
 * GSB works as an on-demand lookup, not a bulk feed download.
 * This function should be called per-URL during the scan pipeline,
 * NOT as a bulk feed ingestor.
 *
 * Threat types checked:
 * - MALWARE
 * - SOCIAL_ENGINEERING (phishing)
 * - UNWANTED_SOFTWARE
 * - POTENTIALLY_HARMFUL_APPLICATION
 *
 * @param {string[]} urls - Array of URLs to check (max 500 per request)
 * @returns {Promise<{ url: string, threatType: string, platformType: string }[]>}
 */
async function checkGoogleSafeBrowsing(urls) {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

    if (!apiKey || apiKey === 'YOUR_GSB_API_KEY_HERE') {
        logger.warn('[GSB] API key not configured — skipping Google Safe Browsing check');
        return [];
    }

    if (!urls || urls.length === 0) return [];

    // GSB API accepts max 500 URLs per request
    const urlsToCheck = urls.slice(0, 500);

    const requestBody = {
        client: {
            clientId: process.env.GOOGLE_SAFE_BROWSING_CLIENT_ID || 'cyberneura',
            clientVersion: process.env.GOOGLE_SAFE_BROWSING_CLIENT_VERSION || '1.0.0',
        },
        threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: urlsToCheck.map((url) => ({ url })),
        },
    };

    try {
        const response = await axios.post(
            `${GSB_LOOKUP_URL}?key=${apiKey}`,
            requestBody,
            {
                timeout: 10_000,
                headers: { 'Content-Type': 'application/json' },
            }
        );

        const matches = response.data?.matches || [];
        const results = matches.map((match) => ({
            url: match.threat?.url || '',
            threatType: match.threatType,
            platformType: match.platformType,
            cacheDuration: match.cacheDuration,
        }));

        if (results.length > 0) {
            logger.warn(`[GSB] Found ${results.length} threat(s) among ${urlsToCheck.length} URLs`);
        }

        return results;
    } catch (err) {
        if (err.response?.status === 400) {
            logger.warn('[GSB] Bad request — invalid URL format in batch');
        } else if (err.response?.status === 403) {
            logger.error('[GSB] API key rejected (403 Forbidden)');
        } else {
            logger.error('[GSB] Lookup failed:', err.message);
        }
        return [];
    }
}

/**
 * Check a single URL against Google Safe Browsing.
 * @param {string} url
 * @returns {Promise<{ isThreat: boolean, threatType?: string }>}
 */
async function checkSingleUrl(url) {
    const matches = await checkGoogleSafeBrowsing([url]);
    const match = matches.find((m) => m.url === url);
    return {
        isThreat: !!match,
        threatType: match?.threatType || null,
        platformType: match?.platformType || null,
    };
}

module.exports = { checkGoogleSafeBrowsing, checkSingleUrl, FEED_NAME };
