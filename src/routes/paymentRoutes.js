import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { paymentLimiter, generalLimiter } from '../middleware/rateLimiter.js';
import {
  initializePayment,
  verifyPayment,
  handleWebhook,
  settleDebt,
  getBanks,
  resolveAccount
} from '../controllers/paymentController.js';

const router = Router();

// Webhook — NO auth middleware, raw body handled in server.js
router.post('/webhook', handleWebhook);

// All routes below require authentication
router.use(authenticate);

// Payment routes with strict rate limiting
router.post('/initialize', paymentLimiter, initializePayment);
router.post('/verify', paymentLimiter, verifyPayment);
router.post('/settle', paymentLimiter, settleDebt);

// Bank routes with general rate limiting
router.get('/banks', generalLimiter, getBanks);
router.post('/resolve-account', generalLimiter, resolveAccount);

export default router;
