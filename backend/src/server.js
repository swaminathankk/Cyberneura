'use strict';

require('dotenv').config();
const { createApp } = require('./app');
const { connectRedis } = require('./config/redis');
const { connectPostgres } = require('./config/postgres');
const { startFeedSyncWorker } = require('./threatIntel/cacheSync.worker');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // 1. Connect to databases
    await connectRedis();
    logger.info('✅ Redis connected');

    await connectPostgres();
    logger.info('✅ PostgreSQL connected');

    // 2. Start the threat intelligence sync worker (cron)
    startFeedSyncWorker();
    logger.info('✅ Threat feed sync worker started');

    // 3. Create and start the Express app
    const app = createApp();
    app.listen(PORT, () => {
      logger.info(`🚀 CyberNeura API running on http://localhost:${PORT}`);
      logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();
