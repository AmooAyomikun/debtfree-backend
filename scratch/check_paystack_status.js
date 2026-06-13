import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';
import { paystackService } from '../src/services/paystackService.js';

async function checkPaystackStatus() {
  const { data: txs, error } = await supabase
    .from('wallet_transactions')
    .select('reference, status, amount')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching transactions:', error);
    return;
  }

  console.log('--- PAYSTACK STATUS FOR RECENT TRANSACTIONS ---');
  for (const tx of txs) {
    try {
      const paystackTx = await paystackService.verifyTransaction(tx.reference);
      console.log(`Ref: ${tx.reference}\n  DB Status: ${tx.status}\n  Amount: ${tx.amount}\n  Paystack Status: ${paystackTx.status}\n  Gateway Resp: ${paystackTx.gateway_response}\n`);
    } catch (err) {
      console.log(`Ref: ${tx.reference}\n  DB Status: ${tx.status}\n  Amount: ${tx.amount}\n  Paystack Error: ${err.message}\n`);
    }
  }
}

checkPaystackStatus().catch(console.error);
