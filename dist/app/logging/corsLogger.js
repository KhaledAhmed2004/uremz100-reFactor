"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeLogCors = exports.isOriginAllowed = exports.allowedOrigins = void 0;
const logger_1 = require("../../shared/logger");
// Allowed origins for CORS
exports.allowedOrigins = [
    'https://streaming-pearl-ten.vercel.app',
    'https://adnan5001.binarybards.online',
    'http://localhost:5001'
];
// Enable with env CORS_DEBUG=true or CORS_DEBUG=1
const CORS_DEBUG = String(process.env.CORS_DEBUG || '').toLowerCase() === 'true' ||
    process.env.CORS_DEBUG === '1';
const corsLogMap = new Map();
const CORS_LOG_WINDOW_MS = 60000; // log at most once per origin per minute
const isOriginAllowed = (origin) => {
    if (!origin)
        return true; // allow non-browser clients (Postman/mobile)
    return exports.allowedOrigins.includes(origin);
};
exports.isOriginAllowed = isOriginAllowed;
// Rate-limited CORS decision logging
// Rate-limited CORS decision logging (only for blocks to avoid log spam)
const maybeLogCors = (origin, allowed) => {
    if (!CORS_DEBUG)
        return;
    if (!allowed) {
        const key = origin || 'no-origin';
        const now = Date.now();
        const last = corsLogMap.get(key) || 0;
        if (now - last < CORS_LOG_WINDOW_MS)
            return;
        corsLogMap.set(key, now);
        logger_1.errorLogger.warn(`CORS block: ${origin}`);
    }
};
exports.maybeLogCors = maybeLogCors;
