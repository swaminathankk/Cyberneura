'use strict';

const logger = require('../utils/logger');

/**
 * Centralized error handler for Express.
 * Must be the last middleware added to the app.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const isDev = process.env.NODE_ENV !== 'production';

    // Log the error
    if (status >= 500) {
        logger.error('Server error:', {
            message: err.message,
            stack: err.stack,
            path: req.originalUrl,
            method: req.method,
        });
    } else {
        logger.warn('Client error:', {
            message: err.message,
            path: req.originalUrl,
            status,
        });
    }

    res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        code: err.code || 'INTERNAL_ERROR',
        ...(isDev && status >= 500 ? { stack: err.stack } : {}),
    });
}

/**
 * Create a typed application error with an HTTP status.
 */
class AppError extends Error {
    constructor(message, status = 500, code = 'APP_ERROR') {
        super(message);
        this.status = status;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { errorHandler, AppError };
