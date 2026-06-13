import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

async function checkEmails() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, preferred_currency, wallet_balance');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  
  console.log('Profiles:');
  for (const p of profiles) {
    // Also fetch email from auth.users using supabase admin auth api
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(p.id);
    console.log(`- Profile Name: ${p.full_name}, ID: ${p.id}, Email: ${user?.email || 'N/A'}, Phone: ${user?.phone || 'N/A'}`);
  }
}

checkEmails();
