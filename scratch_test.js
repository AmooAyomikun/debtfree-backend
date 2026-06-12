import 'dotenv/config';
import { supabase } from './src/config/supabase.js';

function formatSavingsCircle(circle, circleMembers, contributions) {
  if (!circle) return null;

  const totalCycles = circle.total_members;
  const cycleDurationDays = circle.frequency === 'weekly' ? 7 : circle.frequency === 'biweekly' ? 14 : 30;
  const baseDate = new Date(circle.start_date || circle.created_at);

  const payoutOrder = circleMembers.map(cm => cm.user_id);

  const cycles = [];
  for (let i = 1; i <= totalCycles; i++) {
    const cycleStart = new Date(baseDate.getTime() + (i - 1) * cycleDurationDays * 24 * 60 * 60 * 1000);
    const cycleEnd = new Date(baseDate.getTime() + i * cycleDurationDays * 24 * 60 * 60 * 1000);
    
    const cycleContributions = contributions
      .filter(c => c.cycle_number === i)
      .map(c => ({
        userId: c.user_id,
        paid: c.status === 'paid',
        paidDate: c.paid_at ? c.paid_at.split('T')[0] : null
      }));

    const recipientMember = circleMembers.find(cm => cm.position === i);
    const recipient = recipientMember ? recipientMember.user_id : '';

    let payoutStatus = 'upcoming';
    if (circle.current_cycle === i) {
      payoutStatus = 'in_progress';
    } else if (circle.current_cycle > i) {
      payoutStatus = 'completed';
    }

    cycles.push({
      cycleNumber: i,
      startDate: cycleStart.toISOString().split('T')[0],
      endDate: cycleEnd.toISOString().split('T')[0],
      recipient,
      payoutAmount: Number(circle.contribution_amount) * circleMembers.length,
      payoutStatus,
      contributions: cycleContributions
    });
  }

  return {
    contributionAmount: Number(circle.contribution_amount),
    frequency: circle.frequency,
    startDate: circle.start_date,
    payoutOrder,
    cycles
  };
}

async function testGroupDetail(groupId) {
  try {
    const { data: isMember, error: checkErr } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId);

    const { data: g, error: groupErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

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

    const { data: circleRow, error: circleErr } = await supabase
      .from('circles')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle();

    if (circleRow) {
      const { data: circleMembers, error: membersErr } = await supabase
        .from('circle_members')
        .select('*')
        .eq('circle_id', circleRow.id)
        .order('position', { ascending: true });

      const { data: contributions, error: contribsErr } = await supabase
        .from('contributions')
        .select('*')
        .eq('circle_id', circleRow.id);

      const formatted = formatSavingsCircle(circleRow, circleMembers || [], contributions || []);
      console.log("FORMATTED SAVINGS CIRCLE:", JSON.stringify(formatted, null, 2));
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testGroupDetail('1faa9df2-063c-4cda-98d6-1f792feb6783');
