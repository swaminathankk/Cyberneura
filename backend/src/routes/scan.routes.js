'use strict';

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { scanUrl, scanBulk, scanEmail, getScanHistory } = require('../controllers/scan.controller');
const { scanRateLimiter } = require('../middleware/rateLimiter');

// ── Validation middleware ──────────────────────────────────────────────────

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    }
    next();
};

const validateUrl = [
    body('url')
        .trim()
        .notEmpty().withMessage('URL is required')
        .isLength({ max: 2048 }).withMessage('URL must be under 2048 characters')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Must be a valid http/https URL'),
    handleValidationErrors,
];

const validateBulk = [
    body('urls')
        .isArray({ min: 1, max: 20 }).withMessage('urls must be an array of 1-20 URLs')
        .custom((urls) => {
            for (const url of urls) {
                try { new URL(url); } catch {
                    throw new Error(`Invalid URL: ${url}`);
                }
            }
            return true;
        }),
    handleValidationErrors,
];

const validateEmail = [
    body('content')
        .trim()
        .notEmpty().withMessage('content is required')
        .isLength({ max: 500_000 }).withMessage('content must be under 500KB'),
    handleValidationErrors,
];

const validateHistory = [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    handleValidationErrors,
];

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/scan/url
 * @desc    Scan a single URL through the CyberNeura pipeline
 * @access  Public (rate limited)
 */
router.post('/url', scanRateLimiter, validateUrl, scanUrl);

/**
 * @route   POST /api/v1/scan/bulk
 * @desc    Scan up to 20 URLs in parallel
 * @access  Public (rate limited)
 */
router.post('/bulk', scanRateLimiter, validateBulk, scanBulk);

/**
 * @route   POST /api/v1/scan/email
 * @desc    Parse an email/HTML block and scan all extracted URLs
 * @access  Public (rate limited)
 */
router.post('/email', scanRateLimiter, validateEmail, scanEmail);

/**
 * @route   GET /api/v1/scan/history
 * @desc    Get paginated scan history
 * @access  Public
 */
router.get('/history', validateHistory, getScanHistory);

module.exports = router;
