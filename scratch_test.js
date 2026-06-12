import 'dotenv/config';
import { supabase } from './src/config/supabase.js';

async function testGroupDetail(groupId) {
  try {
    const { data: isMember, error: checkErr } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId);
    console.log("IsMember check:", isMember, checkErr);

    const { data: g, error: groupErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();
    console.log("Group details:", g, groupErr);

    const { data: membersRows, error: membersErr } = await supabase
      .from('group_members')
      .select(`
        user_id,
        role,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          email
        )
      `)
      .eq('group_id', groupId);
    console.log("Members rows:", membersRows, membersErr);

    const { data: expensesRows, error: expensesErr } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_splits (
          id,
          expense_id,
          user_id,
          amount,
          is_settled
        )
      `)
      .eq('group_id', groupId);
    console.log("Expenses rows:", expensesRows, expensesErr);

    const { data: settlementsRows, error: settlementsErr } = await supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId);
    console.log("Settlements rows:", settlementsRows, settlementsErr);

  } catch (err) {
    console.error("Test failed:", err);
  }
}

testGroupDetail('252960b5-5ff2-4f43-8bd7-199ce448e85e');
