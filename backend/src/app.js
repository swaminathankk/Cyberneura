'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const scanRoutes = require('./routes/scan.routes');
const healthRoutes = require('./routes/health.routes');
const logger = require('./utils/logger');

function createApp() {
    const app = express();

    // ── Security middleware ─────────────────────────────────────
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));

    // ── CORS ────────────────────────────────────────────────────
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((o) => o.trim());

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS: origin ${origin} not allowed`));
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        credentials: true,
    }));

    // ── Body parsing ────────────────────────────────────────────
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // ── Request logging ─────────────────────────────────────────
    app.use(morgan('combined', {
        stream: { write: (msg) => logger.http(msg.trim()) },
        skip: (req) => req.path === '/api/v1/health',
    }));

    // ── Global rate limiter ─────────────────────────────────────
    app.use('/api/', rateLimiter);

    // ── Routes ──────────────────────────────────────────────────
    app.get('/', (req, res) => {
        res.status(200).json({
            success: true,
            service: 'CyberNeura API',
            version: '1.0.0',
            message: 'CyberNeura API engine is running.',
            frontendDashboard: 'http://localhost:5173',
            endpoints: {
                health: '/api/v1/health',
                scanUrl: 'POST /api/v1/scan/url',
                scanBulk: 'POST /api/v1/scan/bulk',
                scanEmail: 'POST /api/v1/scan/email',
                scanHistory: 'GET /api/v1/scan/history'
            }
        });
    });

    app.use('/api/v1/health', healthRoutes);
    app.use('/api/v1/scan', scanRoutes);

    // ── 404 handler ─────────────────────────────────────────────
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'Route not found',
            path: req.originalUrl,
        });
    });

    // ── Global error handler ────────────────────────────────────
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
