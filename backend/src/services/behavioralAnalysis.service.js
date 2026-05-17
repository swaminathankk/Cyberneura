'use strict';

const { parse: parseTld } = require('tldts');
const { shannonEntropy, containsPunycode, isIpAddress } = require('../utils/hashUtils');
const logger = require('../utils/logger');

// Known high-risk TLDs commonly used in phishing
const HIGH_RISK_TLDS = new Set([
    'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'club', 'online', 'site',
    'icu', 'cyou', 'monster', 'fun', 'space', 'link', 'work', 'buzz',
    'click', 'download', 'zip', 'mov',
]);

// Common legitimate brands targeted by phishing (for look-alike detection)
const TARGETED_BRANDS = [
    'paypal', 'apple', 'microsoft', 'google', 'amazon', 'netflix', 'facebook',
    'instagram', 'twitter', 'linkedin', 'dropbox', 'chase', 'wellsfargo',
    'bankofamerica', 'citibank', 'irs', 'fedex', 'ups', 'dhl',
];

/**
 * Analyze a URL for behavioral/heuristic signals indicating it may be malicious.
 *
 * Returns a set of flags and a numeric behavioral score (0-100).
 * Each flag adds to the score with a specific weight.
 *
 * @param {string} rawUrl
 * @returns {{ score: number, flags: string[], details: Object }}
 */
function analyzeUrl(rawUrl) {
    const flags = [];
    const details = {};
    let score = 0;

    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { score: 30, flags: ['INVALID_URL_FORMAT'], details: {} };
    }

    const hostname = parsed.hostname;
    const fullUrl = rawUrl;
    const tldInfo = parseTld(rawUrl);
    const domain = tldInfo.domain || hostname;
    const subdomain = tldInfo.subdomain || '';

    // 1. URL Length Analysis
    details.urlLength = fullUrl.length;
    if (fullUrl.length > 200) {
        flags.push('EXCESSIVE_URL_LENGTH');
        score += 15;
    } else if (fullUrl.length > 100) {
        flags.push('LONG_URL');
        score += 8;
    }

    // 2. Shannon Entropy of the full URL path+query
    const pathAndQuery = parsed.pathname + parsed.search;
    details.entropy = parseFloat(shannonEntropy(pathAndQuery).toFixed(2));
    if (details.entropy > 4.5) {
        flags.push('HIGH_ENTROPY');
        score += 20;
    } else if (details.entropy > 3.5) {
        flags.push('MEDIUM_ENTROPY');
        score += 10;
    }

    // 3. IP address as hostname
    details.isIpHost = isIpAddress(hostname);
    if (details.isIpHost) {
        flags.push('IP_ADDRESS_HOST');
        score += 25;
    }

    // 4. Punycode / IDN homograph attack
    details.hasPunycode = containsPunycode(hostname);
    if (details.hasPunycode) {
        flags.push('PUNYCODE_IDN_DETECTED');
        score += 20;
    }

    // 5. Subdomain depth (too many subdomains = suspicious)
    const subdomainDepth = subdomain ? subdomain.split('.').length : 0;
    details.subdomainDepth = subdomainDepth;
    if (subdomainDepth >= 4) {
        flags.push('EXCESSIVE_SUBDOMAINS');
        score += 15;
    } else if (subdomainDepth >= 2) {
        flags.push('MULTIPLE_SUBDOMAINS');
        score += 8;
    }

    // 6. High-risk TLD
    const tld = tldInfo.publicSuffix || '';
    details.tld = tld;
    if (HIGH_RISK_TLDS.has(tld.toLowerCase())) {
        flags.push('HIGH_RISK_TLD');
        score += 15;
    }

    // 7. Brand impersonation in subdomain or path
    const urlLower = fullUrl.toLowerCase();
    const brandMatches = TARGETED_BRANDS.filter((brand) =>
        (subdomain + parsed.pathname + parsed.search).toLowerCase().includes(brand)
    );
    details.brandMatches = brandMatches;
    if (brandMatches.length > 0 && !urlLower.includes(`.${brandMatches[0]}.`)) {
        // Brand name appears in path/subdomain but not as the actual domain
        flags.push('BRAND_IMPERSONATION');
        score += 20;
    }

    // 8. Suspicious keywords in URL
    const SUSPICIOUS_KEYWORDS = [
        'login', 'verify', 'secure', 'update', 'account', 'banking',
        'password', 'confirm', 'validation', 'signin', 'credential',
        'authenticate', 'wallet', 'recover', 'suspended',
    ];
    const keywordMatches = SUSPICIOUS_KEYWORDS.filter((k) => urlLower.includes(k));
    details.suspiciousKeywords = keywordMatches;
    if (keywordMatches.length >= 3) {
        flags.push('MULTIPLE_SUSPICIOUS_KEYWORDS');
        score += 15;
    } else if (keywordMatches.length >= 1) {
        flags.push('SUSPICIOUS_KEYWORD');
        score += 7;
    }

    // 9. Excessive query parameters
    const paramCount = [...parsed.searchParams.keys()].length;
    details.queryParamCount = paramCount;
    if (paramCount > 5) {
        flags.push('EXCESSIVE_QUERY_PARAMS');
        score += 8;
    }

    // 10. Presence of @ in URL (can hide real destination)
    if (fullUrl.includes('@')) {
        flags.push('AT_SYMBOL_IN_URL');
        score += 25;
    }

    // 11. Double slash after domain (obfuscation)
    if (/https?:\/\/[^/]+\/\//.test(fullUrl)) {
        flags.push('URL_OBFUSCATION_DOUBLE_SLASH');
        score += 10;
    }

    // 12. HTTP (not HTTPS)
    details.protocol = parsed.protocol;
    if (parsed.protocol === 'http:') {
        flags.push('INSECURE_HTTP');
        score += 5;
    }

    // Cap score at 100
    const finalScore = Math.min(score, 100);

    logger.debug(`Behavioral analysis: ${rawUrl} → score=${finalScore}, flags=${flags.join(',')}`);

    return {
        score: finalScore,
        flags,
        details,
    };
}

module.exports = { analyzeUrl };
