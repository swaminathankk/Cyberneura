'use strict';

const crypto = require('crypto');

/**
 * Normalize and hash a URL for consistent Redis key generation.
 * This ensures http://Google.com/ and http://google.com are the same key.
 */
function normalizeUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl.trim().toLowerCase());
        // Remove trailing slash from pathname
        const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        return `${parsed.protocol}//${parsed.hostname}${pathname}${parsed.search}`;
    } catch {
        return rawUrl.trim().toLowerCase();
    }
}

/**
 * SHA-256 hash a string — used as Redis key for URL storage.
 */
function sha256(input) {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Hash a URL after normalizing it.
 */
function hashUrl(rawUrl) {
    return sha256(normalizeUrl(rawUrl));
}

/**
 * Extract the domain from a URL string.
 */
function extractDomain(rawUrl) {
    try {
        const { hostname } = new URL(rawUrl);
        // Strip www.
        return hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

/**
 * Calculate Shannon entropy of a string.
 * Higher entropy → more random/complex → higher suspicion for URLs.
 */
function shannonEntropy(str) {
    if (!str || str.length === 0) return 0;
    const freq = {};
    for (const ch of str) {
        freq[ch] = (freq[ch] || 0) + 1;
    }
    const len = str.length;
    return Object.values(freq).reduce((acc, count) => {
        const p = count / len;
        return acc - p * Math.log2(p);
    }, 0);
}

/**
 * Check if a string contains a punycode-encoded IDN (homograph attack indicator).
 */
function containsPunycode(str) {
    return /xn--/i.test(str);
}

/**
 * Check if a hostname is a raw IP address (suspicious).
 */
function isIpAddress(hostname) {
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^\[?([0-9a-fA-F:]+)\]?$/;
    return ipv4.test(hostname) || ipv6.test(hostname);
}

module.exports = {
    normalizeUrl,
    sha256,
    hashUrl,
    extractDomain,
    shannonEntropy,
    containsPunycode,
    isIpAddress,
};
