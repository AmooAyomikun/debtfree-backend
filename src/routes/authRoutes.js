import { Router } from 'express';
import { forgotPassword } from '../controllers/authController.js';

const router = Router();

router.post('/forgot-password', forgotPassword);

export default router;
