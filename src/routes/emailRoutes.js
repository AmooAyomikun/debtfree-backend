import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { supabase } from '../config/supabase.js';
import { emailService } from '../services/emailService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();
router.use(authenticate);
router.use(generalLimiter);

// POST /api/email/send-reminder
// Admin sends contribution reminder to pending members
router.post('/send-reminder', async (req, res, next) => {
  try {
    const { circle_id, user_ids } = req.body;
    
    if (!circle_id || !user_ids?.length) {
      return errorResponse(res, 'circle_id and user_ids required', 400);
    }
    
    // Get circle details
    const { data: circle } = await supabase
      .from('circles')
      .select('*, groups(name)')
      .eq('id', circle_id)
      .single();
    
    if (!circle) return errorResponse(res, 'Circle not found', 404);
    
    // Get user profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', user_ids);
    
    // Send reminders
    const results = await Promise.allSettled(
      profiles.map(profile => 
        emailService.sendContributionReminder(profile, {
          ...circle,
          name: circle.groups?.name || 'Your Circle'
        })
      )
    );
    
    const sent = results.filter(r => r.status === 'fulfilled').length;
    
    return successResponse(res, { 
      sent, 
      total: user_ids.length 
    }, `Reminders sent to ${sent} members`);
    
  } catch (error) {
    next(error);
  }
});

// POST /api/email/weekly-summary
// Trigger weekly summary for current user
router.post('/weekly-summary', async (req, res, next) => {
  try {
    const user = req.user;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();
    
    // Get user's group balances
    const { data: memberships } = await supabase
      .from('group_members')
      .select('groups(id, name)')
      .eq('user_id', user.id);
    
    const summary = {
      totalOwed: 0,
      totalOwing: 0,
      groupCount: memberships?.length || 0,
      groups: memberships?.map(m => ({
        name: m.groups?.name,
        balance: 0
      })) || []
    };
    
    await emailService.sendWeeklySummary(
      { ...profile, email: user.email },
      summary
    );
    
    return successResponse(res, null, 'Weekly summary sent');
  } catch (error) {
    next(error);
  }
});

export default router;
