import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { supabase } from '../config/supabase.js';
import { smsService } from '../services/smsService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { log } from '../utils/logger.js';

const router = Router();
router.use(authenticate);
router.use(generalLimiter);

// POST /api/sms/send-reminder
// Admin sends SMS reminder to pending circle members
router.post('/send-reminder', async (req, res, next) => {
  try {
    const { circle_id, user_ids } = req.body;

    if (!circle_id || !user_ids?.length) {
      return errorResponse(res, 'circle_id and user_ids required', 400);
    }

    // Get circle and group details
    const { data: circle } = await supabase
      .from('circles')
      .select('*, groups(name, id)')
      .eq('id', circle_id)
      .single();

    if (!circle) return errorResponse(res, 'Circle not found', 404);

    // Get profiles with phone numbers
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', user_ids)
      .not('phone', 'is', null);

    if (!profiles?.length) {
      return errorResponse(res, 'No members with phone numbers found', 404);
    }

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const formattedDate = dueDate.toLocaleDateString('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    // Send reminders to all pending members
    const results = await Promise.allSettled(
      profiles.map(profile =>
        smsService.sendContributionReminderSMS(profile.phone, {
          userName: profile.full_name?.split(' ')[0] || 'there',
          amount: circle.contribution_amount,
          circleName: circle.groups?.name || 'Your Circle',
          dueDate: formattedDate
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;

    // Log activity
    await supabase.from('activity_logs').insert({
      group_id: circle.groups?.id,
      user_id: req.user.id,
      action: 'sms_reminder_sent',
      metadata: { circle_id, recipients: sent }
    });

    return successResponse(res, {
      sent,
      total: profiles.length
    }, `SMS reminders sent to ${sent} members`);

  } catch (error) {
    next(error);
  }
});

// POST /api/sms/invite
// Send group invite SMS to a phone number
router.post('/invite', async (req, res, next) => {
  try {
    const { phone, group_id } = req.body;

    if (!phone || !group_id) {
      return errorResponse(res, 'phone and group_id required', 400);
    }

    // Get group details
    const { data: group } = await supabase
      .from('groups')
      .select('name, invite_code')
      .eq('id', group_id)
      .single();

    if (!group) return errorResponse(res, 'Group not found', 404);

    // Get inviter profile
    const { data: inviter } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', req.user.id)
      .single();

    const inviteLink = `${process.env.APP_URL}/join/${group.invite_code}`;

    await smsService.sendGroupInviteSMS(phone, {
      inviterName: inviter?.full_name || 'Someone',
      groupName: group.name,
      inviteLink
    });

    return successResponse(res, null, 'Invite SMS sent successfully');

  } catch (error) {
    next(error);
  }
});

// POST /api/sms/test
// Test SMS endpoint (development only)
router.post('/test', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return errorResponse(res, 'Test endpoint not available in production', 403);
    }

    const { phone } = req.body;
    if (!phone) return errorResponse(res, 'Phone number required', 400);

    const result = await smsService.sendSMS(
      phone,
      'This is a test SMS from DebtFree. Your app is working correctly!'
    );

    return successResponse(res, result, 'Test SMS sent');
  } catch (error) {
    next(error);
  }
});

export default router;
