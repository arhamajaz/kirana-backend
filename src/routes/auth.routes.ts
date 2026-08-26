import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateBody, loginSchema, registerSchema } from '../middleware/validation.middleware';
import { loginRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const controller = new AuthController();

/**
 * Merchant Login
 * POST /api/v1/auth/login
 */
router.post('/login', loginRateLimiter, validateBody(loginSchema), controller.login);

/**
 * Merchant Registration
 * POST /api/v1/auth/register
 */
router.post('/register', validateBody(registerSchema), controller.register);

export default router;
