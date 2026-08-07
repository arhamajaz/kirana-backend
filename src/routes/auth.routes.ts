import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateBody, loginSchema } from '../middleware/validation.middleware';

const router = Router();
const controller = new AuthController();

/**
 * Merchant Login
 * POST /api/v1/auth/login
 */
router.post('/login', validateBody(loginSchema), controller.login);

export default router;
