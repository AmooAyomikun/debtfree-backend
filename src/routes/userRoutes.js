import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { searchUsers, getLinkedAccounts, addLinkedAccount, removeLinkedAccount } from '../controllers/userController.js';

const router = Router();

router.use(authenticate);

router.get('/search', generalLimiter, searchUsers);

router.get('/linked-accounts', getLinkedAccounts);
router.post('/linked-accounts', addLinkedAccount);
router.delete('/linked-accounts/:id', removeLinkedAccount);

export default router;
