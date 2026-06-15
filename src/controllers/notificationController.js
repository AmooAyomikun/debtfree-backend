import { supabase } from '../config/supabase.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { log } from '../utils/logger.js';
import { emailService } from '../services/emailService.js';

// MANUAL TASK: Run in Supabase SQL Editor:
// alter table profiles 
// add column if not exists welcome_email_sent boolean default false;


// POST /api/notifications/register-token
// Frontend sends FCM token after permission granted
export async function registerToken(req, res, next) {
  try {
    const { token } = req.body;
    const user = req.user;

    if (!token) return errorResponse(res, 'FCM token is required', 400);

    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', user.id);

    if (error) throw error;

    log.info('FCM token registered', { userId: user.id });
    
    // Check if this is user's first login
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, welcome_email_sent')
      .eq('id', user.id)
      .single();

    if (profile && !profile.welcome_email_sent) {
      await emailService.sendWelcomeEmail({
        full_name: profile.full_name,
        email: user.email
      });
      
      await supabase
        .from('profiles')
        .update({ welcome_email_sent: true })
        .eq('id', user.id);
    }

    return successResponse(res, null, 'Notification token registered');

  } catch (error) {
    next(error);
  }
}

// DELETE /api/notifications/register-token
// Called on logout to stop notifications
export async function removeToken(req, res, next) {
  try {
    await supabase
      .from('profiles')
      .update({ fcm_token: null })
      .eq('id', req.user.id);

    return successResponse(res, null, 'Token removed');
  } catch (error) {
    next(error);
  }
}

// GET /api/notifications
export async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return successResponse(res, {
      notifications: data,
      total: count,
      page: Number(page),
      hasMore: offset + limit < count
    });

  } catch (error) {
    next(error);
  }
}

// PATCH /api/notifications/:id/read
export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    return successResponse(res, null, 'Marked as read');
  } catch (error) {
    next(error);
  }
}

// PATCH /api/notifications/read-all
export async function markAllRead(req, res, next) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
}
