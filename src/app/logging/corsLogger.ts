import { logger, errorLogger } from '../../shared/logger';

const envOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

// Allowed origins for CORS
export const allowedOrigins: string[] = [
  'https://streaming-pearl-ten.vercel.app',
  'https://adnan5001.binarybards.online',
  'http://localhost:5001',
  ...envOrigins
];

// Enable with env CORS_DEBUG=true or CORS_DEBUG=1
const CORS_DEBUG =
  String(process.env.CORS_DEBUG || '').toLowerCase() === 'true' ||
  process.env.CORS_DEBUG === '1';

const corsLogMap = new Map<string, number>();
const CORS_LOG_WINDOW_MS = 60_000; // log at most once per origin per minute

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true; // allow non-browser clients (Postman/mobile)
  return allowedOrigins.includes(origin);
};

// Rate-limited CORS decision logging
// Rate-limited CORS decision logging (only for blocks to avoid log spam)
export const maybeLogCors = (
  origin: string | undefined,
  allowed: boolean,
): void => {
  if (!CORS_DEBUG) return;
  if (!allowed) {
    const key = origin || 'no-origin';
    const now = Date.now();
    const last = corsLogMap.get(key) || 0;
    if (now - last < CORS_LOG_WINDOW_MS) return;
    corsLogMap.set(key, now);
    errorLogger.warn(`CORS block: ${origin}`);
  }
};
