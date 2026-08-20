import rateLimit from 'express-rate-limit';

// Brute-force defence on login only — 10 attempts per 15 minutes per IP.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } }
});
