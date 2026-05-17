'use strict';

const cheerio = require('cheerio');
const logger = require('../utils/logger');

// Comprehensive URL regex — matches http, https, ftp URLs
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

const MAX_CONTENT_LENGTH = 1 * 1024 * 1024; // 1MB

/**
 * Extract all URLs from a plain text string.
 * @param {string} text
 * @returns {string[]} Deduplicated URL list
 */
function extractUrlsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    // Limit processing length for safety
    const content = text.slice(0, MAX_CONTENT_LENGTH);
    const matches = content.match(URL_REGEX) || [];

    // Deduplicate
    return [...new Set(matches.map((u) => u.trim()))];
}

/**
 * Extract URLs from an HTML string.
 * Finds URLs in:
 * - href attributes (a, link)
 * - src attributes (img, script, iframe)
 * - action attributes (form)
 * - meta refresh redirects
 * - CSS url() in style attributes
 * - Plain text within the HTML body
 *
 * @param {string} html
 * @returns {{ urls: string[], hiddenUrls: string[] }}
 */
function extractUrlsFromHtml(html) {
    if (!html || typeof html !== 'string') {
        return { urls: [], hiddenUrls: [] };
    }

    const content = html.slice(0, MAX_CONTENT_LENGTH);
    const $ = cheerio.load(content, { decodeEntities: true });

    const allUrls = new Set();
    const hiddenUrls = new Set();

    // Standard href/src/action attributes
    $('[href]').each((_, el) => {
        const attr = $(el).attr('href');
        if (attr && (attr.startsWith('http') || attr.startsWith('//'))) {
            allUrls.add(attr.startsWith('//') ? `https:${attr}` : attr);
        }
    });

    $('[src]').each((_, el) => {
        const attr = $(el).attr('src');
        if (attr && (attr.startsWith('http') || attr.startsWith('//'))) {
            allUrls.add(attr.startsWith('//') ? `https:${attr}` : attr);
        }
    });

    $('form[action]').each((_, el) => {
        const attr = $(el).attr('action');
        if (attr && attr.startsWith('http')) {
            allUrls.add(attr);
        }
    });

    // Meta refresh redirects (often used in phishing)
    $('meta[http-equiv="refresh"]').each((_, el) => {
        const content2 = $(el).attr('content') || '';
        const urlMatch = content2.match(/url=(['"]?)(.+?)\1/i);
        if (urlMatch && urlMatch[2].startsWith('http')) {
            hiddenUrls.add(urlMatch[2]);
            allUrls.add(urlMatch[2]);
        }
    });

    // CSS url() in style attributes
    $('[style]').each((_, el) => {
        const style = $(el).attr('style') || '';
        const cssUrlMatches = style.match(/url\(['"]?(https?[^'")\s]+)['"]?\)/gi) || [];
        for (const match of cssUrlMatches) {
            const urlMatch2 = match.match(/url\(['"]?(https?[^'")\s]+)['"]?\)/i);
            if (urlMatch2) {
                hiddenUrls.add(urlMatch2[1]);
                allUrls.add(urlMatch2[1]);
            }
        }
    });

    // Hidden / invisible elements
    $('[style*="display:none"], [style*="display: none"], [hidden]').each((_, el) => {
        const text = $(el).text();
        const textUrls = extractUrlsFromText(text);
        for (const url of textUrls) {
            hiddenUrls.add(url);
            allUrls.add(url);
        }
    });

    // Also extract plain text URLs from body text
    const bodyText = $('body').text();
    const textUrls = extractUrlsFromText(bodyText);
    for (const url of textUrls) allUrls.add(url);

    logger.debug(`HTML parser: found ${allUrls.size} URLs (${hiddenUrls.size} hidden)`);

    return {
        urls: [...allUrls],
        hiddenUrls: [...hiddenUrls],
    };
}

/**
 * Auto-detect whether input looks like HTML or plain text and extract URLs.
 * @param {string} content
 * @returns {{ urls: string[], hiddenUrls: string[], isHtml: boolean }}
 */
function extractUrlsFromContent(content) {
    const isHtml = /<html|<body|<a\s/i.test(content);

    if (isHtml) {
        const result = extractUrlsFromHtml(content);
        return { ...result, isHtml: true };
    }

    return {
        urls: extractUrlsFromText(content),
        hiddenUrls: [],
        isHtml: false,
    };
}

module.exports = {
    extractUrlsFromText,
    extractUrlsFromHtml,
    extractUrlsFromContent,
};
