import nodemailer from 'nodemailer';
import { log } from '../utils/logger.js';
import { geminiService } from './geminiService.js';

// Configure Nodemailer to use Gmail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // e.g. amooquadri555@gmail.com
    pass: process.env.SMTP_PASS, // The 16-character App Password
  },
});

const FROM_EMAIL = `"DebtFree" <${process.env.SMTP_USER}>`;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export const emailService = {

  // Welcome email after signup
  async sendWelcomeEmail(user) {
    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Welcome to DebtFree! 🎉',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
            <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;margin-top:40px;">
              
              <!-- Header -->
              <div style="background:#16a34a;padding:40px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:28px;">⚡ DebtFree</h1>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">Financial Unity for Community Wealth</p>
              </div>
              
              <!-- Body -->
              <div style="padding:40px;">
                <h2 style="color:#0f172a;margin:0 0 16px;">Welcome, ${user.full_name}! 👋</h2>
                <p style="color:#64748b;line-height:1.6;">
                  You've joined thousands of Nigerians using DebtFree to manage 
                  their Ajo circles, split expenses, and build credit history together.
                </p>
                
                <!-- Features -->
                <div style="background:#f0fdf4;border-radius:12px;padding:24px;margin:24px 0;">
                  <h3 style="color:#16a34a;margin:0 0 16px;">What you can do:</h3>
                  <div style="margin-bottom:12px;">✅ <strong>Split expenses</strong> fairly with friends</div>
                  <div style="margin-bottom:12px;">✅ <strong>Manage your Ajo</strong> circle digitally</div>
                  <div style="margin-bottom:12px;">✅ <strong>Build credit history</strong> with on-time contributions</div>
                  <div style="margin-bottom:12px;">✅ <strong>Settle debts</strong> instantly via wallet</div>
                </div>
                
                <!-- CTA -->
                <div style="text-align:center;margin:32px 0;">
                  <a href="${APP_URL}/dashboard" 
                    style="background:#16a34a;color:white;padding:16px 32px;
                    border-radius:12px;text-decoration:none;font-weight:bold;
                    font-size:16px;display:inline-block;">
                    Get Started →
                  </a>
                </div>
                
                <p style="color:#94a3b8;font-size:14px;text-align:center;">
                  Questions? Reply to this email anytime.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background:#f8fafc;padding:24px;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">
                  © 2026 DebtFree. Lagos, Nigeria.
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `
      });
      log.info('Welcome email sent via NodeMailer', { email: user.email });
    } catch (error) {
      log.error('Welcome email failed', error);
    }
  },

  // Payment confirmation email
  async sendPaymentConfirmation(user, { amount, type, reference }) {
    try {
      const isCredit = type === 'credit';
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: user.email,
        subject: `${isCredit ? '✅ Payment Received' : '💸 Payment Sent'} - ₦${amount.toLocaleString()}`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;">
              
              <div style="background:#16a34a;padding:32px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:24px;">⚡ DebtFree</h1>
              </div>
              
              <div style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">
                  ${isCredit ? '✅' : '💸'}
                </div>
                <h2 style="color:#0f172a;margin:0 0 8px;">
                  ${isCredit ? 'Payment Received' : 'Payment Sent'}
                </h2>
                <div style="font-size:36px;font-weight:bold;color:#16a34a;margin:16px 0;">
                  ₦${amount.toLocaleString()}
                </div>
                
                <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;text-align:left;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="color:#64748b;">Reference</span>
                    <span style="font-family:monospace;font-size:12px;">${reference}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;">
                    <span style="color:#64748b;">Date</span>
                    <span>${new Date().toLocaleDateString('en-NG', { 
                      day: 'numeric', month: 'long', year: 'numeric' 
                    })}</span>
                  </div>
                </div>
                
                <a href="${APP_URL}/wallet"
                  style="background:#16a34a;color:white;padding:14px 28px;
                  border-radius:12px;text-decoration:none;font-weight:bold;
                  display:inline-block;margin-top:8px;">
                  View Wallet →
                </a>
              </div>
              
              <div style="background:#f8fafc;padding:20px;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">
                  © 2026 DebtFree. If you didn't make this transaction, 
                  contact support immediately.
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `
      });
      log.info('Payment confirmation email sent via NodeMailer', { email: user.email, amount });
    } catch (error) {
      log.error('Payment confirmation email failed', error);
    }
  },

  // Contribution reminder email
  async sendContributionReminder(user, circle) {
    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: user.email,
        subject: `⏰ Reminder: Your ₦${circle.contribution_amount.toLocaleString()} contribution is due`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;">
              
              <div style="background:#0f172a;padding:32px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:24px;">⚡ DebtFree</h1>
              </div>
              
              <div style="padding:40px;">
                <h2 style="color:#0f172a;margin:0 0 16px;">
                  Hi ${user.full_name}, your contribution is due! ⏰
                </h2>
                
                <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:24px;margin:24px 0;">
                  <h3 style="color:#92400e;margin:0 0 12px;">
                    ${circle.name}
                  </h3>
                  <div style="font-size:32px;font-weight:bold;color:#d97706;">
                    ₦${circle.contribution_amount.toLocaleString()}
                  </div>
                  <p style="color:#92400e;margin:8px 0 0;">
                    Due by ${new Date(circle.next_due_date).toLocaleDateString('en-NG', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </p>
                </div>
                
                <p style="color:#64748b;line-height:1.6;">
                  Your circle members are counting on you. 
                  Pay on time to maintain your DebtFree credit score.
                </p>
                
                <div style="text-align:center;margin:32px 0;">
                  <a href="${APP_URL}/groups/${circle.group_id}"
                    style="background:#16a34a;color:white;padding:16px 32px;
                    border-radius:12px;text-decoration:none;font-weight:bold;
                    font-size:16px;display:inline-block;">
                    Pay Now →
                  </a>
                </div>
              </div>
              
              <div style="background:#f8fafc;padding:20px;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">
                  © 2026 DebtFree · 
                  <a href="${APP_URL}/settings" style="color:#94a3b8;">
                    Unsubscribe from reminders
                  </a>
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `
      });
      log.info('Contribution reminder sent via NodeMailer', { email: user.email, circle: circle.name });
    } catch (error) {
      log.error('Contribution reminder failed', error);
    }
  },

  // Weekly group summary email
  async sendWeeklySummary(user, summary) {
    try {
      const insight = await geminiService.generateFinancialInsight(summary);

      await transporter.sendMail({
        from: FROM_EMAIL,
        to: user.email,
        subject: `📊 Your DebtFree Weekly Summary`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;">
              
              <div style="background:#16a34a;padding:32px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:24px;">⚡ DebtFree</h1>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">
                  Weekly Summary
                </p>
              </div>
              
              <div style="padding:40px;">
                <h2 style="color:#0f172a;margin:0 0 24px;">
                  Hey ${user.full_name}, here's your week 👋
                </h2>
                
                <!-- Stats Grid -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
                  <div style="background:#f0fdf4;border-radius:12px;padding:20px;text-align:center;">
                    <div style="font-size:28px;font-weight:bold;color:#16a34a;">
                      ₦${summary.totalOwed?.toLocaleString() || '0'}
                    </div>
                    <div style="color:#64748b;font-size:14px;margin-top:4px;">
                      Owed to you
                    </div>
                  </div>
                  <div style="background:#fef2f2;border-radius:12px;padding:20px;text-align:center;">
                    <div style="font-size:28px;font-weight:bold;color:#dc2626;">
                      ₦${summary.totalOwing?.toLocaleString() || '0'}
                    </div>
                    <div style="color:#64748b;font-size:14px;margin-top:4px;">
                      You owe
                    </div>
                  </div>
                </div>

                <!-- Active Groups -->
                <div style="margin-bottom:24px;">
                  <h3 style="color:#0f172a;margin:0 0 12px;">
                    Active Groups (${summary.groupCount || 0})
                  </h3>
                  ${summary.groups?.map(g => `
                    <div style="border:1px solid #e2e8f0;border-radius:8px;
                      padding:12px 16px;margin-bottom:8px;
                      display:flex;justify-content:space-between;">
                      <span style="color:#0f172a;">${g.name}</span>
                      <span style="color:${g.balance >= 0 ? '#16a34a' : '#dc2626'};font-weight:bold;">
                        ${g.balance >= 0 ? '+' : ''}₦${Math.abs(g.balance).toLocaleString()}
                      </span>
                    </div>
                  `).join('') || '<p style="color:#94a3b8;">No active groups</p>'}
                </div>
                
                <!-- AI Insight -->
                <div style="background:#e0e7ff;border-left:4px solid #4f46e5;border-radius:8px;padding:16px;margin-bottom:24px;">
                  <h4 style="color:#3730a3;margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">✨ AI Financial Insight</h4>
                  <p style="color:#312e81;margin:0;font-size:14px;line-height:1.5;">
                    ${insight}
                  </p>
                </div>
                
                <div style="text-align:center;">
                  <a href="${APP_URL}/dashboard"
                    style="background:#16a34a;color:white;padding:14px 28px;
                    border-radius:12px;text-decoration:none;font-weight:bold;
                    display:inline-block;">
                    View Dashboard →
                  </a>
                </div>
              </div>
              
              <div style="background:#f8fafc;padding:20px;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">
                  © 2026 DebtFree · 
                  <a href="${APP_URL}/settings" style="color:#94a3b8;">
                    Unsubscribe
                  </a>
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `
      });
      log.info('Weekly summary sent via NodeMailer', { email: user.email });
    } catch (error) {
      log.error('Weekly summary failed', error);
    }
  },

  // Debt settled notification email
  async sendDebtSettledEmail(recipient, { senderName, amount, groupName }) {
    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipient.email,
        subject: `💚 ${senderName} just settled ₦${amount.toLocaleString()} with you!`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:white;
              border-radius:16px;overflow:hidden;">
              
              <div style="background:#16a34a;padding:32px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:24px;">⚡ DebtFree</h1>
              </div>
              
              <div style="padding:40px;text-align:center;">
                <div style="font-size:64px;margin-bottom:16px;">🎉</div>
                <h2 style="color:#0f172a;margin:0 0 8px;">
                  You've been paid!
                </h2>
                <p style="color:#64748b;margin:0 0 24px;">
                  ${senderName} settled their debt in ${groupName}
                </p>
                <div style="font-size:40px;font-weight:bold;color:#16a34a;margin:16px 0;">
                  +₦${amount.toLocaleString()}
                </div>
                
                <a href="${APP_URL}/wallet"
                  style="background:#16a34a;color:white;padding:14px 28px;
                  border-radius:12px;text-decoration:none;font-weight:bold;
                  display:inline-block;margin-top:16px;">
                  View Wallet →
                </a>
              </div>
              
              <div style="background:#f8fafc;padding:20px;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">
                  © 2026 DebtFree
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `
      });
      log.info('Debt settled email sent via NodeMailer', { email: recipient.email });
    } catch (error) {
      log.error('Debt settled email failed', error);
    }
  }
};
