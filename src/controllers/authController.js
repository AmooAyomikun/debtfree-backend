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

    // Generate recovery link (does not send email, so it won't trigger rate limits or SMTP errors)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/login?tab=reset`
      }
    });

    if (error) {
      log.error('Generate link error:', error);
      return errorResponse(res, 'Could not generate reset link. Please verify user exists.', 400);
    }

    const resetLink = data.properties.action_link;

    // PRINT RESET LINK TO LOGS - perfect fallback for testing when SMTP/Email APIs are not yet activated
    console.log('========================================================');
    console.log(`🔑 PASSWORD RESET LINK FOR ${email}:`);
    console.log(resetLink);
    console.log('========================================================');

    // Attempt to send via Brevo (will work once Brevo account is activated)
    await emailService.sendPasswordResetEmail(email, resetLink);

    return successResponse(res, null, 'If this email is registered, a recovery link has been sent.');
  } catch (error) {
    log.error('Forgot password error:', error);
    next(error);
  }
}
