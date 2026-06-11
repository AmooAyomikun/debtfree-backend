import 'dotenv/config';
import { supabase } from './src/config/supabase.js';

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { query: 'SELECT pubname, tablename FROM pg_publication_tables WHERE pubname = \'supabase_realtime\'' });
  
  if (error) {
    console.error("RPC Error:", error);
    // Let's try querying pg_publication_tables directly if no rpc
    const { data: qData, error: qErr } = await supabase.from('pg_publication_tables').select('*').eq('pubname', 'supabase_realtime');
    console.log("direct query:", qData, qErr);
  } else {
    console.log("RPC Data:", data);
  }
}

run();
