'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

function createPool() {
    return new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
}

async function connectPostgres() {
    pool = createPool();

    pool.on('error', (err) => {
        logger.error('PostgreSQL pool error:', err.message);
    });

    // Test connection
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT current_database(), now()');
        logger.debug(`PostgreSQL: connected to ${rows[0].current_database}`);
    } finally {
        client.release();
    }

    return pool;
}

function getPool() {
    if (!pool) {
        throw new Error('PostgreSQL pool not initialized. Call connectPostgres() first.');
    }
    return pool;
}

/**
 * Execute a parameterized query safely.
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} params - Query parameters
 */
async function query(text, params = []) {
    const start = Date.now();
    try {
        const result = await getPool().query(text, params);
        const duration = Date.now() - start;
        logger.debug(`PG query executed in ${duration}ms | rows: ${result.rowCount}`);
        return result;
    } catch (err) {
        logger.error('PG query error:', { text, error: err.message });
        throw err;
    }
}

async function closePostgres() {
    if (pool) {
        await pool.end();
        logger.info('PostgreSQL pool closed');
    }
}

module.exports = { connectPostgres, getPool, query, closePostgres };
