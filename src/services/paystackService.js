import axios from 'axios';
import { PAYSTACK_SECRET, PAYSTACK_BASE_URL } from '../config/constants.js';

const paystack = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json'
  }
});

export const paystackService = {
  async initializeTransaction({ email, amount, reference, metadata, callback_url }) {
    const response = await paystack.post('/transaction/initialize', {
      email,
      amount: Math.round(amount * 100),
      reference,
      metadata,
      callback_url
    });
    return response.data.data;
  },

  async verifyTransaction(reference) {
    const response = await paystack.get(`/transaction/verify/${reference}`);
    return response.data.data;
  },

  async listBanks() {
    const response = await paystack.get('/bank?currency=NGN&per_page=100');
    return response.data.data;
  },

  async resolveAccount(accountNumber, bankCode) {
    const response = await paystack.get(
      `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
    );
    return response.data.data;
  },

  async createTransferRecipient({ name, accountNumber, bankCode }) {
    const response = await paystack.post('/transferrecipient', {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN'
    });
    return response.data.data;
  },

  async initiateTransfer({ amount, recipient, reason, reference }) {
    const response = await paystack.post('/transfer', {
      source: 'balance',
      amount: Math.round(amount * 100),
      recipient,
      reason,
      reference
    });
    return response.data.data;
  },

  // Create subscription plan
  async createPlan({ name, amount, interval }) {
    const response = await paystack.post('/plan', {
      name,
      amount: Math.round(amount * 100),
      interval
    });
    return response.data.data;
  },

  // Disable/cancel subscription
  async disableSubscription(subscriptionCode, emailToken) {
    const response = await paystack.post('/subscription/disable', {
      code: subscriptionCode,
      token: emailToken
    });
    return response.data.data;
  },

  // List subscriptions
  async listSubscriptions(planCode) {
    const response = await paystack.get(
      `/subscription?plan=${planCode}`
    );
    return response.data.data;
  },

  // Fetch subscription
  async fetchSubscription(subscriptionCode) {
    const response = await paystack.get(
      `/subscription/${subscriptionCode}`
    );
    return response.data.data;
  }
};
