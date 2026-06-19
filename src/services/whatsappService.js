import twilio from 'twilio';
import { log } from '../utils/logger.js';

// Initialize Twilio client conditionally so it doesn't crash if keys are missing
let client;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (error) {
  log.warn('Twilio client failed to initialize (check env vars):', error.message);
}

// Ensure phone numbers are in E.164 format (e.g., +234...)
const formatPhoneForWhatsApp = (phone) => {
  let formatted = phone.replace(/[^0-9+]/g, '');
  if (formatted.startsWith('0')) {
    // Convert local Nigerian 080... to +23480...
    formatted = '+234' + formatted.substring(1);
  } else if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  return `whatsapp:${formatted}`;
};

export const whatsappService = {
  async sendWhatsAppMessage(phone, message) {
    try {
      if (!client || !process.env.TWILIO_WHATSAPP_NUMBER) {
        log.info('MOCK WHATSAPP SENT', { to: phone, message });
        return { success: true, mock: true };
      }

      const response = await client.messages.create({
        body: message,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, // e.g. whatsapp:+14155238886
        to: formatPhoneForWhatsApp(phone)
      });

      log.info('WhatsApp message sent', { sid: response.sid, to: phone });
      return { success: true, sid: response.sid };
    } catch (error) {
      log.error('Failed to send WhatsApp message', error);
      return { success: false, error: error.message };
    }
  },

  // Pre-formatted templates
  async sendPaymentReceived(phone, { userName, amount, senderName }) {
    const message = `🟢 *Payment Received!*\n\nHi ${userName},\nYou just received ₦${amount.toLocaleString()} from ${senderName} in your DebtFree wallet.\n\nOpen DebtFree to view your updated balance.`;
    return this.sendWhatsAppMessage(phone, message);
  },

  async sendAutoDebitFailed(phone, { userName }) {
    const message = `⚠️ *Action Required*\n\nHi ${userName},\nYour automatic Ajo contribution failed. Please log into DebtFree to update your card or pay manually to avoid missing the cycle.`;
    return this.sendWhatsAppMessage(phone, message);
  },

  async sendEmergencyLoanApproved(phone, { userName, amount, groupName }) {
    const message = `🚨 *Emergency Funds Approved*\n\nHi ${userName},\nYour emergency request for ₦${amount.toLocaleString()} from *${groupName}* has been approved and credited to your wallet.\n\nPlease remember to repay it by the next cycle.`;
    return this.sendWhatsAppMessage(phone, message);
  }
};
