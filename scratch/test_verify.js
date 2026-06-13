import 'dotenv/config';
import { paystackService } from '../src/services/paystackService.js';

async function testVerify() {
  const ref = 'FUND_1781303210145_P7KJRN';
  try {
    const paystackTx = await paystackService.verifyTransaction(ref);
    console.log('Paystack Transaction Details:', paystackTx);
  } catch (error) {
    console.error('Paystack Verification Error:', error.response?.data || error.message);
  }
}

testVerify();
