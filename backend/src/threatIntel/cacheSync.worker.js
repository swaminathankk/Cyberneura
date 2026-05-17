'use strict';

const cron = require('node-cron');
const { syncAllFeeds } = require('./feedManager');
const logger = require('../utils/logger');

const SYNC_CRON = process.env.FEED_SYNC_CRON || '*/30 * * * *';

let cronJob = null;
let isSyncing = false;

/**
 * Run a single sync cycle, guarded against concurrent runs.
 */
async function runSyncCycle(triggeredBy = 'cron') {
    if (isSyncing) {
        logger.warn(`[SyncWorker] Sync already in progress (triggered by ${triggeredBy}) — skipping`);
        return;
    }

    isSyncing = true;
    logger.info(`[SyncWorker] Sync cycle started (triggered by: ${triggeredBy})`);

    try {
        const result = await syncAllFeeds();
        logger.info(`[SyncWorker] Sync cycle complete:`, {
            total: result.total,
            duration: `${result.duration}ms`,
            ...result.byFeed,
        });
    } catch (err) {
        logger.error('[SyncWorker] Sync cycle failed:', err.message);
    } finally {
        isSyncing = false;
    }
}

/**
 * Start the threat feed sync worker.
 * - Performs an immediate initial sync on startup.
 * - Schedules recurring syncs based on FEED_SYNC_CRON (default: every 30 min).
 */
function startFeedSyncWorker() {
    if (!cron.validate(SYNC_CRON)) {
        logger.error(`[SyncWorker] Invalid cron expression: "${SYNC_CRON}". Worker not started.`);
        return;
    }

    logger.info(`[SyncWorker] Scheduling feed sync with cron: "${SYNC_CRON}"`);

    // Immediate startup sync (non-blocking — don't await in bootstrap)
    setImmediate(() => runSyncCycle('startup'));

    // Schedule recurring sync
    cronJob = cron.schedule(SYNC_CRON, () => {
        runSyncCycle('cron');
    });

    logger.info('[SyncWorker] Feed sync worker started successfully');
}

function stopFeedSyncWorker() {
    if (cronJob) {
        cronJob.stop();
        logger.info('[SyncWorker] Feed sync worker stopped');
    }
}

module.exports = { startFeedSyncWorker, stopFeedSyncWorker, runSyncCycle };
