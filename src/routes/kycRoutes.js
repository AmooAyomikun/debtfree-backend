import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { verifyBVN } from '../controllers/kycController.js';

const router = Router();

// All KYC routes require authentication
router.use(authenticate);

router.post('/verify-bvn', verifyBVN);

export default router;
