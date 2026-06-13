import 'dotenv/config';
import axios from 'axios';
import { PAYSTACK_SECRET, PAYSTACK_BASE_URL } from '../src/config/constants.js';

const paystack = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function listTransactions() {
  try {
    const response = await paystack.get('/transaction?perPage=10');
    const txs = response.data.data;
    console.log('--- PAYSTACK MERCHANT TRANSACTIONS ---');
    for (const tx of txs) {
      console.log(`Ref: ${tx.reference}\n  Status: ${tx.status}\n  Amount: ${tx.amount / 100}\n  Email: ${tx.customer?.email}\n  Created: ${tx.createdAt}\n  Gateway Resp: ${tx.gateway_response}\n`);
    }
  } catch (error) {
    console.error('Error listing Paystack transactions:', error.response?.data || error.message);
  }
}

listTransactions().catch(console.error);
