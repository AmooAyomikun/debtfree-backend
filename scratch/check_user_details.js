import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

async function checkUserDetails() {
  const userId = 'bc4e9893-3c3b-4341-9c69-78e40323b833'; // Amoo Ayomikun

  // Get profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileErr) {
    console.error('Error fetching profile:', profileErr);
  } else {
    console.log('Profile details:', profile);
  }

  // Get user from auth (using admin API because it's backend service role)
  const { data: { user }, error: authErr } = await supabase.auth.admin.getUserById(userId);

  if (authErr) {
    console.error('Error fetching auth user:', authErr);
  } else {
    console.log('Auth user details:', {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.user_metadata
    });
  }
}

checkUserDetails().catch(console.error);
