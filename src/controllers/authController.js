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

    // Use Supabase Admin API to generate a recovery link
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/login?tab=reset`
      }
    });

    if (error) {
      log.error('Generate link error:', error);
      // Don't leak if user exists or not, just pretend we sent it
      return successResponse(res, null, 'If this email is registered, a recovery link has been sent.');
    }

    // Send the email using our Nodemailer service
    const resetLink = data.properties.action_link;
    await emailService.sendPasswordResetEmail(email, resetLink);

    return successResponse(res, null, 'Reset link sent successfully');
  } catch (error) {
    log.error('Forgot password error:', error);
    next(error);
  }
}
