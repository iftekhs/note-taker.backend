import { rateLimit } from 'express-rate-limit';

/** Login-only brute-force protection: 10 attempts per IP per 15 minutes. */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { message: 'Too many login attempts. Try again in 15 minutes.' },
    });
  },
});
