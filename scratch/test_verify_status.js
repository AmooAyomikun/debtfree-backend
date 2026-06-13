import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';
import { paystackService } from '../src/services/paystackService.js';

async function testVerifyStatus() {
  const userId = 'bc4e9893-3c3b-4341-9c69-78e40323b833'; // Amoo Ayomikun
  
  // Get the most recent transaction
  const { data: tx, error: txErr } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (txErr || !tx) {
    console.error('Failed to get last transaction:', txErr);
    return;
  }

  console.log(`Verifying last transaction ref: ${tx.reference}, status: ${tx.status}, amount: ${tx.amount}`);

  try {
    const paystackTx = await paystackService.verifyTransaction(tx.reference);
    console.log('Paystack response status:', paystackTx.status);
    console.log('Paystack response gateway_response:', paystackTx.gateway_response);
    console.log('Paystack response amount (in kobo):', paystackTx.amount);

    if (paystackTx.status === 'success') {
      console.log('Calling credit_wallet RPC...');
      const { data: rpcResult, error: rpcError } = await supabase.rpc('credit_wallet', {
        p_user_id: userId,
        p_amount: paystackTx.amount / 100,
        p_reference: tx.reference
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
      } else {
        console.log('RPC Credit Successful! Result:', rpcResult);
      }
    }
  } catch (error) {
    console.error('Error during verification:', error.response?.data || error.message);
  }
}

testVerifyStatus();
