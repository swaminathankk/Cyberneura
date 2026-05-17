'use strict';

const express = require('express');
const router = express.Router();
const { getSyncStats } = require('../threatIntel/redisCache.service');
const { checkAiServiceHealth } = require('../services/aiStub.service');
const { getPool } = require('../config/postgres');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * GET /api/v1/health
 * Returns system health status for Redis, Postgres, feed sync, and AI service.
 */
router.get('/', async (req, res) => {
    const checks = {};
    let overallHealthy = true;

    // Redis check
    try {
        const client = getRedisClient();
        await client.ping();
        const syncStats = await getSyncStats();
        checks.redis = {
            status: 'ok',
            blacklistCount: syncStats.blacklistCount,
            whitelistCount: syncStats.whitelistCount,
            lastSync: syncStats.feeds?.totalLastSync
                ? new Date(parseInt(syncStats.feeds.totalLastSync, 10)).toISOString()
                : null,
            feedStats: syncStats.feeds || {},
        };
    } catch (err) {
        checks.redis = { status: 'error', error: err.message };
        overallHealthy = false;
    }

    // PostgreSQL check
    try {
        const pool = getPool();
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        checks.postgres = { status: 'ok' };
    } catch (err) {
        checks.postgres = { status: 'error', error: err.message };
        overallHealthy = false;
    }

    // AI service check
    try {
        const aiHealth = await checkAiServiceHealth();
        checks.aiService = aiHealth.healthy
            ? { status: 'ok', version: aiHealth.version }
            : { status: 'degraded', reason: aiHealth.reason };
    } catch (err) {
        checks.aiService = { status: 'error', error: err.message };
    }

    const status = overallHealthy ? 200 : 503;
    return res.status(status).json({
        success: overallHealthy,
        service: 'CyberNeura API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        checks,
    });
});

module.exports = router;
