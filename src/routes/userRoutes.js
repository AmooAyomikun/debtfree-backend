import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { searchUsers } from '../controllers/userController.js';

const router = Router();

router.use(authenticate);

router.get('/search', generalLimiter, searchUsers);

export default router;
