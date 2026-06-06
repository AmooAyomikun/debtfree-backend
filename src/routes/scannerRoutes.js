import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { scanReceipt } from '../controllers/scannerController.js';

const router = Router();

router.use(authenticate);
router.use(generalLimiter);

router.post('/receipt', scanReceipt);

export default router;
