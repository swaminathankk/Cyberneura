'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectPostgres, query, closePostgres } = require('../config/postgres');
const logger = require('../utils/logger');

async function runMigrations() {
    try {
        logger.info('🚀 Starting database migrations...');
        await connectPostgres();

        const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found at ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');
        await query(sql);

        logger.info('✅ Database migrations applied successfully!');
    } catch (err) {
        logger.error('❌ Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await closePostgres();
    }
}

runMigrations();
