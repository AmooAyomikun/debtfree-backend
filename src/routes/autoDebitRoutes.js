import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { supabase } from '../config/supabase.js';
import { autoDebitService } from '../services/autoDebitService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();
router.use(authenticate);
router.use(paymentLimiter);

// POST /api/auto-debit/setup
// Set up recurring auto-debit for a circle
router.post('/setup', async (req, res, next) => {
  try {
    const { circle_id } = req.body;
    const user = req.user;

    if (!circle_id) {
      return errorResponse(res, 'circle_id is required', 400);
    }

    // Get circle details
    const { data: circle } = await supabase
      .from('circles')
      .select('contribution_amount, frequency')
      .eq('id', circle_id)
      .single();

    if (!circle) return errorResponse(res, 'Circle not found', 404);

    // Check if already has active subscription
    const { data: existing } = await supabase
      .from('auto_debit_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('circle_id', circle_id)
      .eq('status', 'active')
      .single();

    if (existing) {
      return errorResponse(res, 'Auto-debit already active for this circle', 400);
    }

    const transaction = await autoDebitService.setupRecurringDebit(
      user.id,
      {
        email: user.email,
        amount: circle.contribution_amount,
        frequency: circle.frequency,
        circleId: circle_id
      }
    );

    return successResponse(res, {
      authorization_url: transaction.authorization_url,
      reference: transaction.reference
    }, 'Auto-debit setup initiated. Complete payment to activate.');

  } catch (error) {
    next(error);
  }
});

// DELETE /api/auto-debit/cancel
// Cancel auto-debit for a circle
router.delete('/cancel', async (req, res, next) => {
  try {
    const { circle_id } = req.body;
    const user = req.user;

    if (!circle_id) {
      return errorResponse(res, 'circle_id is required', 400);
    }

    await autoDebitService.cancelSubscription(user.id, circle_id);

    return successResponse(res, null, 'Auto-debit cancelled successfully');

  } catch (error) {
    next(error);
  }
});

// GET /api/auto-debit/status/:circleId
// Check if user has active auto-debit for a circle
router.get('/status/:circleId', async (req, res, next) => {
  try {
    const { circleId } = req.params;

    const { data: subscription } = await supabase
      .from('auto_debit_subscriptions')
      .select('status, next_charge_date, amount, frequency')
      .eq('user_id', req.user.id)
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return successResponse(res, {
      hasAutoDebit: subscription?.status === 'active',
      subscription: subscription || null
    });

  } catch (error) {
    return successResponse(res, { hasAutoDebit: false, subscription: null });
  }
});

export default router;
