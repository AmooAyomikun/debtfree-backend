import 'dotenv/config';
import { paystackService } from '../src/services/paystackService.js';
import { supabase } from '../src/config/supabase.js';

async function verifyDirectly() {
  const reference = 'FUND_1781386070191_3E3VZN';
  const userId = 'bc4e9893-3c3b-4341-9c69-78e40323b833';

  // 1. Check in database
  const { data: existingTx, error: dbErr } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('reference', reference)
    .single();

  if (dbErr) {
    console.error('Database query error:', dbErr.message);
  } else {
    console.log('Database transaction entry:', existingTx);
  }

  // 2. Query Paystack API
  try {
    const paystackTx = await paystackService.verifyTransaction(reference);
    console.log('Paystack API response:', {
      status: paystackTx.status,
      gateway_response: paystackTx.gateway_response,
      amount: paystackTx.amount,
      reference: paystackTx.reference,
      metadata: paystackTx.metadata
    });
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
  }
}

verifyDirectly().catch(console.error);
