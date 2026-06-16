import AfricasTalking from 'africastalking';
import { log } from '../utils/logger.js';

const AT = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});

const sms = AT.SMS;

export const smsService = {

  // Send SMS to a single number
  async sendSMS(phoneNumber, message) {
    try {
      // Format Nigerian phone number
      const formatted = formatNigerianPhone(phoneNumber);
      if (!formatted) {
        log.warn('Invalid phone number', { phoneNumber });
        return null;
      }

      const result = await sms.send({
        to: [formatted],
        message,
        from: 'DebtFree'
      });

      log.info('SMS sent', { 
        phone: formatted, 
        status: result.SMSMessageData?.Recipients?.[0]?.status 
      });
      return result;
    } catch (error) {
      log.error('SMS send failed', error);
      return null;
    }
  },

  // Send SMS to multiple numbers
  async sendBulkSMS(phoneNumbers, message) {
    try {
      const formatted = phoneNumbers
        .map(formatNigerianPhone)
        .filter(Boolean);

      if (!formatted.length) return null;

      const result = await sms.send({
        to: formatted,
        message,
        from: 'DebtFree'
      });

      log.info('Bulk SMS sent', { count: formatted.length });
      return result;
    } catch (error) {
      log.error('Bulk SMS failed', error);
      return null;
    }
  },

  // Contribution reminder SMS
  async sendContributionReminderSMS(phone, { userName, amount, circleName, dueDate }) {
    const message = 
      `Hi ${userName}! Your DebtFree contribution of ₦${amount.toLocaleString()} ` +
      `for "${circleName}" is due on ${dueDate}. ` +
      `Pay now: ${process.env.APP_URL}/dashboard. ` +
      `Reply STOP to unsubscribe.`;
    return this.sendSMS(phone, message);
  },

  // Payment received SMS
  async sendPaymentReceivedSMS(phone, { userName, amount, senderName }) {
    const message =
      `Hi ${userName}! ${senderName} just sent you ` +
      `₦${amount.toLocaleString()} on DebtFree. ` +
      `Check your wallet: ${process.env.APP_URL}/wallet`;
    return this.sendSMS(phone, message);
  },

  // Debt settlement SMS
  async sendSettlementSMS(phone, { userName, amount, groupName }) {
    const message =
      `Hi ${userName}! Your debt of ₦${amount.toLocaleString()} ` +
      `in "${groupName}" has been settled on DebtFree. ` +
      `View details: ${process.env.APP_URL}/dashboard`;
    return this.sendSMS(phone, message);
  },

  // Group invite SMS
  async sendGroupInviteSMS(phone, { inviterName, groupName, inviteLink }) {
    const message =
      `${inviterName} invited you to join "${groupName}" on DebtFree. ` +
      `Click to join: ${inviteLink}. ` +
      `DebtFree helps you manage Ajo and split expenses easily.`;
    return this.sendSMS(phone, message);
  },

  // Payout notification SMS
  async sendPayoutNotificationSMS(phone, { userName, amount, circleName }) {
    const message =
      `🎉 Congratulations ${userName}! ` +
      `Your payout of ₦${amount.toLocaleString()} from ` +
      `"${circleName}" has been processed on DebtFree. ` +
      `Check your wallet: ${process.env.APP_URL}/wallet`;
    return this.sendSMS(phone, message);
  }
};

// Helper: format Nigerian phone numbers to international format
function formatNigerianPhone(phone) {
  if (!phone) return null;
  
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Already in international format
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234')) return `+${cleaned}`;
  
  // Convert local format to international
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+234${cleaned.slice(1)}`;
  }
  
  // 10 digits without leading zero
  if (cleaned.length === 10) {
    return `+234${cleaned}`;
  }
  
  return null;
}
