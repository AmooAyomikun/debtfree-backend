import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import {
  registerToken,
  removeToken,
  getNotifications,
  markAsRead,
  markAllRead
} from '../controllers/notificationController.js';

const router = Router();

router.use(authenticate);
router.use(generalLimiter);

router.post('/register-token', registerToken);
router.delete('/register-token', removeToken);
router.get('/', getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);

export default router;
