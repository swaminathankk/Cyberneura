'use strict';

const { isWhitelisted, isBlacklisted } = require('../threatIntel/redisCache.service');
const { checkSingleUrl } = require('../threatIntel/feeds/googleSafeBrowsing.feed');
const { extractUrlsFromContent } = require('../services/urlExtractor.service');
const { analyzeUrl } = require('../services/behavioralAnalysis.service');
const { calculateRiskScore } = require('../services/riskScoring.service');
const { classifyUrl } = require('../services/aiStub.service');
const { getSyncStats } = require('../threatIntel/redisCache.service');
const { getPool, query } = require('../config/postgres');
const { checkAiServiceHealth } = require('../services/aiStub.service');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { extractDomain } = require('../utils/hashUtils');

// ───────────────────────────────────────────────────────────────────────────
// Core Scan Pipeline
// ───────────────────────────────────────────────────────────────────────────

/**
 * Run the full CyberNeura scan pipeline against a single URL.
 *
 * Pipeline:
 * 1. Input sanitization (done in middleware before controller)
 * 2. Domain whitelist check → short-circuit if trusted
 * 3. Redis blacklist lookup (O(1))
 * 4. Google Safe Browsing API cross-check
 * 5. Behavioral / heuristic analysis
 * 6. AI microservice classification
 * 7. Final risk score aggregation
 * 8. Async log to PostgreSQL
 *
 * @param {string} url - Sanitized URL string
 * @returns {Promise<Object>} Scan result
 */
async function runScanPipeline(url) {
    const scanId = uuidv4();
    const startTime = Date.now();

    logger.info(`[Scan ${scanId}] Starting scan for: ${url}`);

    const domain = extractDomain(url);
    const pipelineSteps = {};

    // Step 1 — Whitelist check
    const whitelisted = domain ? await isWhitelisted(domain) : false;
    pipelineSteps.whitelist = whitelisted;

    if (whitelisted) {
        logger.info(`[Scan ${scanId}] Whitelisted domain: ${domain} — returning SAFE`);
        const result = buildResult(scanId, url, { isWhitelisted: true }, startTime);
        logScanAsync(result);
        return result;
    }

    // Step 2 — Redis blacklist check (O(1))
    const blacklisted = await isBlacklisted(url);
    pipelineSteps.blacklist = blacklisted;

    // If blacklisted, still run behavioral for intelligence value but score is already 100
    // Step 3 — Behavioral analysis (fast, CPU-bound, no I/O)
    const behavioral = analyzeUrl(url);
    pipelineSteps.behavioral = behavioral;

    // Step 4 — Google Safe Browsing API (I/O bound, run only if not already blacklisted to save quota)
    let gsbResult = { isThreat: false };
    if (!blacklisted) {
        try {
            gsbResult = await checkSingleUrl(url);
            pipelineSteps.gsb = gsbResult;
        } catch (err) {
            logger.warn(`[Scan ${scanId}] GSB check failed:`, err.message);
        }
    }

    // Step 5 — AI model classification
    let aiScore = null;
    if (!blacklisted && !gsbResult.isThreat) {
        try {
            aiScore = await classifyUrl(url, {
                entropy: behavioral.details.entropy,
                urlLength: behavioral.details.urlLength,
                flagCount: behavioral.flags.length,
            });
            pipelineSteps.ai = aiScore;
        } catch (err) {
            logger.warn(`[Scan ${scanId}] AI classification failed:`, err.message);
        }
    }

    // Step 6 — Aggregate risk score
    const signals = {
        isWhitelisted: false,
        isBlacklisted: blacklisted,
        gsbResult,
        behavioralScore: behavioral.score,
        behavioralFlags: behavioral.flags,
        aiScore,
        hiddenLinksFound: false,
    };

    const result = buildResult(scanId, url, signals, startTime, {
        behavioral,
        gsbResult,
        aiScore,
        pipelineSteps,
    });

    // Step 7 — Log to DB (non-blocking)
    logScanAsync(result);

    logger.info(`[Scan ${scanId}] Complete: score=${result.score}, level=${result.level}, duration=${result.duration}ms`);
    return result;
}

function buildResult(scanId, url, signals, startTime, extras = {}) {
    const scoreResult = calculateRiskScore(signals);
    const duration = Date.now() - startTime;

    return {
        scanId,
        url,
        timestamp: new Date().toISOString(),
        duration,
        score: scoreResult.score,
        level: scoreResult.level,
        color: scoreResult.color,
        recommendation: scoreResult.recommendation,
        signalBreakdown: scoreResult.signalBreakdown,
        behavioral: extras.behavioral || null,
        gsbResult: extras.gsbResult || null,
        aiScore: extras.aiScore || null,
        pipeline: extras.pipelineSteps || {},
    };
}

async function logScanAsync(result) {
    try {
        await query(
            `INSERT INTO scan_logs (scan_id, url, score, level, behavioral_flags, ai_score, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (scan_id) DO NOTHING`,
            [
                result.scanId,
                result.url,
                result.score,
                result.level,
                JSON.stringify(result.behavioral?.flags || []),
                result.aiScore,
            ]
        );
    } catch (err) {
        logger.warn('Failed to log scan to DB:', err.message);
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Controller Handler Functions
// ───────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/scan/url
 * Scan a single URL.
 */
async function scanUrl(req, res, next) {
    try {
        const { url } = req.body;
        const result = await runScanPipeline(url);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/scan/bulk
 * Scan up to 20 URLs in parallel.
 */
async function scanBulk(req, res, next) {
    try {
        const { urls } = req.body;
        const MAX_BULK = 20;

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ success: false, error: 'urls must be a non-empty array' });
        }

        const urlsToScan = urls.slice(0, MAX_BULK).map((u) => u.trim()).filter(Boolean);

        const results = await Promise.allSettled(urlsToScan.map((url) => runScanPipeline(url)));

        const data = results.map((r, i) => {
            if (r.status === 'fulfilled') return { url: urlsToScan[i], ...r.value };
            return { url: urlsToScan[i], error: r.reason?.message || 'Scan failed' };
        });

        return res.status(200).json({ success: true, count: data.length, data });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/scan/email
 * Parse an email/HTML block, extract all URLs, and scan them.
 */
async function scanEmail(req, res, next) {
    try {
        const { content } = req.body;

        const { urls, hiddenUrls, isHtml } = extractUrlsFromContent(content);

        if (urls.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    urlsFound: 0,
                    hiddenUrlsFound: 0,
                    isHtml,
                    results: [],
                    message: 'No URLs found in the provided content.',
                },
            });
        }

        // Scan all extracted URLs (cap at 50)
        const urlsToScan = urls.slice(0, 50);
        const results = await Promise.allSettled(urlsToScan.map((url) => runScanPipeline(url)));

        const scannedResults = results.map((r, i) => {
            const url = urlsToScan[i];
            const isHidden = hiddenUrls.includes(url);
            if (r.status === 'fulfilled') {
                return { url, isHidden, ...r.value };
            }
            return { url, isHidden, error: r.reason?.message || 'Scan failed' };
        });

        // Sort by score descending (highest threats first)
        scannedResults.sort((a, b) => (b.score || 0) - (a.score || 0));

        return res.status(200).json({
            success: true,
            data: {
                urlsFound: urls.length,
                hiddenUrlsFound: hiddenUrls.length,
                isHtml,
                totalScanned: urlsToScan.length,
                results: scannedResults,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/scan/history
 * Return paginated scan history from PostgreSQL.
 */
async function getScanHistory(req, res, next) {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const offset = (page - 1) * limit;

        const { rows } = await query(
            `SELECT scan_id, url, score, level, ai_score, created_at
       FROM scan_logs
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const countResult = await query('SELECT COUNT(*) as total FROM scan_logs');
        const total = parseInt(countResult.rows[0]?.total || '0', 10);

        return res.status(200).json({
            success: true,
            data: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                results: rows,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { scanUrl, scanBulk, scanEmail, getScanHistory, runScanPipeline };
