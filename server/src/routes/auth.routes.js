import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../validators/common.js';
import { loginSchema } from '../validators/auth.validators.js';
import { login, me } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', loginRateLimiter, validateBody(loginSchema), login);
router.get('/me', requireAuth, me);

export default router;
