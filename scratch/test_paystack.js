import 'dotenv/config';
import { paystackService } from '../src/services/paystackService.js';

async function testPaystack() {
  try {
    const result = await paystackService.initializeTransaction({
      email: 'ayomikunamoo89@gmail.com',
      amount: 1000,
      reference: 'TEST-' + Date.now(),
      metadata: { test: true },
      callback_url: 'http://localhost:5173/wallet'
    });
    console.log('Paystack Initialization Success:', result);
  } catch (error) {
    console.error('Paystack Initialization Error:', error.response?.data || error.message);
  }
}

testPaystack();
