'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '5000', 10);
const AI_ENABLED = process.env.AI_SERVICE_ENABLED === 'true';

/**
 * CyberNeura AI Microservice Stub
 *
 * This module is the Node.js-side HTTP client for the Python/FastAPI
 * AI classification microservice. The AI service accepts a URL and
 * returns a maliciousness probability score (0-100).
 *
 * When AI_SERVICE_ENABLED=false or the service is unreachable,
 * this stub returns null to indicate the score is unavailable.
 * The risk scoring engine handles null gracefully.
 *
 * FastAPI Endpoint Contract (to be implemented in ai-service/):
 * POST /predict
 * Body: { "url": "https://example.com", "features": { ... } }
 * Response: { "score": 72.5, "confidence": 0.91, "model_version": "1.2.0" }
 */

/**
 * Call the AI microservice to classify a URL.
 * @param {string} url
 * @param {Object} [features] - Pre-computed behavioral features to pass to the model
 * @returns {Promise<number|null>} Score 0-100, or null if unavailable
 */
async function classifyUrl(url, features = {}) {
    if (!AI_ENABLED) {
        logger.debug('[AI Stub] AI service disabled — returning null score');
        return null;
    }

    try {
        const response = await axios.post(
            `${AI_SERVICE_URL}/predict`,
            { url, features },
            {
                timeout: AI_SERVICE_TIMEOUT,
                headers: { 'Content-Type': 'application/json' },
            }
        );

        const { score } = response.data;

        if (typeof score !== 'number' || score < 0 || score > 100) {
            logger.warn('[AI Stub] Unexpected score format from AI service:', response.data);
            return null;
        }

        logger.debug(`[AI Stub] Score for ${url}: ${score}`);
        return score;
    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            logger.warn('[AI Stub] AI service unreachable (ECONNREFUSED) — skipping');
        } else if (err.code === 'ECONNABORTED') {
            logger.warn('[AI Stub] AI service timed out — skipping');
        } else {
            logger.warn('[AI Stub] AI service error:', err.message);
        }
        return null;
    }
}

/**
 * Health check for the AI microservice.
 * @returns {Promise<{ healthy: boolean, version?: string }>}
 */
async function checkAiServiceHealth() {
    if (!AI_ENABLED) {
        return { healthy: false, reason: 'AI service disabled via AI_SERVICE_ENABLED=false' };
    }

    try {
        const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 3000 });
        return { healthy: true, version: response.data?.version || 'unknown' };
    } catch {
        return { healthy: false, reason: 'AI service unreachable' };
    }
}

module.exports = { classifyUrl, checkAiServiceHealth };
