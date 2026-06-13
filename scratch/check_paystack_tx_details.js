import 'dotenv/config';
import { paystackService } from '../src/services/paystackService.js';

async function checkDetails() {
  const reference = 'T823059692804060';
  try {
    const tx = await paystackService.verifyTransaction(reference);
    console.log('Paystack API Response for success reference:', tx);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkDetails().catch(console.error);
