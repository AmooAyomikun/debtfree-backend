import { supabase } from '../config/supabase.js';
import { emailService } from '../services/emailService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { log } from '../utils/logger.js';

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return errorResponse(res, 'Email is required', 400);
    }

    // Use Supabase native password reset email sender (uses Supabase's free built-in SMTP)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/login?tab=reset`
    });

    if (error) {
      log.error('Supabase native reset password error:', error);
      // To prevent email enumeration, we return success response even if Supabase returns user not found
    }

    return successResponse(res, null, 'If this email is registered, a recovery link has been sent.');
  } catch (error) {
    log.error('Forgot password error:', error);
    next(error);
  }
}
