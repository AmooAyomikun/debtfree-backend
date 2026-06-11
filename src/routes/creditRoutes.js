import express from 'express';
import { authenticate as requireAuth } from '../middleware/authenticate.js';
import { getCreditScore, recalculateScore } from '../controllers/creditController.js';

const router = express.Router();

router.use(requireAuth);

// Get current credit score
router.get('/', getCreditScore);

// Recalculate credit score manually
router.post('/recalculate', recalculateScore);

export default router;
