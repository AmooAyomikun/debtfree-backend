import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

async function checkTransactions() {
  const { data: txs, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching transactions:', error);
    return;
  }

  console.log('--- RECENT TRANSACTIONS ---');
  for (const tx of txs) {
    console.log(`ID: ${tx.id}\nUser: ${tx.user_id}\nType: ${tx.type}\nAmount: ${tx.amount}\nStatus: ${tx.status}\nRef: ${tx.reference}\nCreated: ${tx.created_at}\n`);
  }
}

checkTransactions().catch(console.error);
