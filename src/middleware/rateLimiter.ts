import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { Request, Response } from 'express';

/**
 * Rate limiter middleware for authentication routes (e.g. POST /api/v1/auth/login)
 * Protects against brute-force credential stuffing and DoS attacks.
 */
export const loginRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_LOGIN_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  // Allow disabling or bypassing in automated unit test environment when needed
  skip: () => config.NODE_ENV === 'test',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many login attempts. Please try again later.',
    });
  },
});
