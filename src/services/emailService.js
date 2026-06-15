import nodemailer from 'nodemailer';
import { log } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

export const emailService = {
  async sendPasswordResetEmail(email, resetLink) {
    try {
      const mailOptions = {
        from: `"DebtFree App" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: 'Reset Your Password - DebtFree',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #2b3a55;">DebtFree</h2>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <h3 style="color: #333; margin-top: 0;">Password Reset Request</h3>
              <p style="color: #666; line-height: 1.5;">We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #4be277; color: #003915; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #999; font-size: 12px; margin-top: 20px;">Or copy and paste this link into your browser:</p>
              <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      log.info(`Password reset email sent to ${email}`, info.messageId);
      return { success: true };
    } catch (error) {
      log.error(`Failed to send password reset email to ${email}`, error);
      // We throw so the controller can handle the failure
      throw new Error('Failed to send recovery email. Please check SMTP configuration.');
    }
  }
};
