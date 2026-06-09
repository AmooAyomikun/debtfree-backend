import { supabase } from '../config/supabase.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Helper to format savings circle nested structure for the frontend
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

// Get all groups the authenticated user is a member of
export async function getGroups(req, res) {
  try {
    const userId = req.user.id;

    // 1. Fetch group IDs user is member of
    const { data: memberRows, error: memberErr } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (memberErr) {
      console.error('Error fetching memberships:', memberErr);
      return errorResponse(res, 'Failed to fetch memberships', 500);
    }

    if (!memberRows || memberRows.length === 0) {
      return successResponse(res, [], 'No groups found');
    }

    const groupIds = memberRows.map(r => r.group_id);

    // 2. Fetch those groups along with their members and their profiles
    const { data: groupRows, error: groupErr } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          user_id,
          role,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            email
          )
        )
      `)
      .in('id', groupIds);

    if (groupErr) {
      console.error('Error fetching groups:', groupErr);
      return errorResponse(res, 'Failed to fetch groups', 500);
    }

    // 3. Fetch circles for these groups
    const { data: circlesRows } = await supabase
      .from('circles')
      .select('*')
      .in('group_id', groupIds);

    // Fetch circle members and contributions for these groups
    let circleMembersRows = [];
    let contributionsRows = [];
    if (circlesRows && circlesRows.length > 0) {
      const circleIds = circlesRows.map(c => c.id);
      
      const { data: cmRows } = await supabase
        .from('circle_members')
        .select('*')
        .in('circle_id', circleIds)
        .order('position', { ascending: true });
      circleMembersRows = cmRows || [];

      const { data: cRows } = await supabase
        .from('contributions')
        .select('*')
        .in('circle_id', circleIds);
      contributionsRows = cRows || [];
    }

    const formattedGroups = await Promise.all((groupRows || []).map(async (g) => {
      const circle = (circlesRows || []).find(c => c.group_id === g.id);
      let savings_circle = null;
      if (circle) {
        const cMembers = circleMembersRows.filter(cm => cm.circle_id === circle.id);
        const cContributions = contributionsRows.filter(c => c.circle_id === circle.id);
        savings_circle = formatSavingsCircle(circle, cMembers, cContributions);
      } else if (g.type === 'savings') {
        // Auto-heal on list load
        const circleId = crypto.randomUUID();
        const groupMembersList = (g.group_members || []).map(m => m.user_id);
        
        const circleRow = {
          id: circleId,
          group_id: g.id,
          contribution_amount: 10000,
          frequency: 'monthly',
          total_members: groupMembersList.length,
          current_cycle: 1,
          payout_order: JSON.stringify(groupMembersList),
          start_date: new Date().toISOString().split('T')[0],
          status: 'active'
        };

        const { error: insertCircleErr } = await supabase
          .from('circles')
          .insert(circleRow);

        if (!insertCircleErr) {
          // Insert circle members
          const circleMemberRows = groupMembersList.map((mUserId, index) => ({
            circle_id: circleId,
            user_id: mUserId,
            position: index + 1,
            has_received: false
          }));
          await supabase.from('circle_members').insert(circleMemberRows);

          // Insert contributions
          const contributionRows = [];
          for (let i = 1; i <= groupMembersList.length; i++) {
            groupMembersList.forEach(mUserId => {
              contributionRows.push({
                circle_id: circleId,
                user_id: mUserId,
                amount: 10000,
                cycle_number: i,
                status: 'pending'
              });
            });
          }
          await supabase.from('contributions').insert(contributionRows);

          savings_circle = formatSavingsCircle(circleRow, circleMemberRows, contributionRows);
        }
      }
      return {
        ...g,
        savings_circle
      };
    }));

    return successResponse(res, formattedGroups, 'Groups fetched successfully');
  } catch (error) {
    console.error('getGroups error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Create a new group
export async function createGroup(req, res) {
  try {
    const { id, name, emoji, color, currency, type, description, inviteCode, members, savingsCircle } = req.body;
    const userId = req.user.id;

    if (!name) {
      return errorResponse(res, 'Group name is required', 400);
    }

    const groupId = id || crypto.randomUUID();

    const groupRow = {
      id: groupId,
      name,
      emoji: emoji || 'fa-users',
      type: type || 'expense',
      description: description || '',
      invite_code: inviteCode || null,
      created_by: userId
    };

    // 1. Insert group details
    const { data: insertedGroup, error: groupErr } = await supabase
      .from('groups')
      .insert(groupRow)
      .select()
      .single();

    if (groupErr) {
      console.error('Error inserting group:', groupErr);
      return errorResponse(res, 'Failed to create group', 500);
    }

    // 2. Prepare member rows (Always insert creator as admin)
    const memberRows = [
      {
        group_id: groupId,
        user_id: userId,
        role: 'admin'
      }
    ];

    if (members && Array.isArray(members)) {
      members.forEach(m => {
        const memberUserId = m.userId || m.user_id || m.id;
        if (memberUserId && !memberUserId.startsWith('pending_')) {
          const cleanId = memberUserId.startsWith('user_') ? memberUserId.replace('user_', '') : memberUserId;
          if (cleanId !== userId && !memberRows.some(row => row.user_id === cleanId)) {
            memberRows.push({
              group_id: groupId,
              user_id: cleanId,
              role: m.role || 'member'
            });
          }
        }
      });
    }

    // 3. Insert members
    const { error: memberErr } = await supabase
      .from('group_members')
      .insert(memberRows);

    if (memberErr) {
      console.error('Error inserting members:', memberErr);
      // We don't rollback, but return success since group is created. Members can be added/invited later.
    }

    // 4. If savings circle, insert circles, circle_members, and contributions
    if (type === 'savings' && savingsCircle) {
      const circleId = crypto.randomUUID();
      const circleRow = {
        id: circleId,
        group_id: groupId,
        contribution_amount: Number(savingsCircle.contributionAmount),
        frequency: savingsCircle.frequency,
        total_members: memberRows.length,
        current_cycle: 1,
        payout_order: JSON.stringify(savingsCircle.payoutOrder),
        start_date: savingsCircle.startDate || new Date().toISOString().split('T')[0],
        status: 'active'
      };

      const { error: circleErr } = await supabase
        .from('circles')
        .insert(circleRow);

      if (circleErr) {
        console.error('Error inserting circle:', circleErr);
      } else {
        // Insert circle members
        const circleMemberRows = savingsCircle.payoutOrder.map((mUserId, index) => {
          const cleanId = mUserId.startsWith('user_') ? mUserId.replace('user_', '') : mUserId;
          return {
            circle_id: circleId,
            user_id: cleanId,
            position: index + 1,
            has_received: false
          };
        });

        const { error: circleMemberErr } = await supabase
          .from('circle_members')
          .insert(circleMemberRows);

        if (circleMemberErr) {
          console.error('Error inserting circle members:', circleMemberErr);
        }

        // Insert contributions
        const contributionRows = [];
        savingsCircle.cycles.forEach(cycle => {
          cycle.contributions.forEach(contrib => {
            const cleanUserId = contrib.userId.startsWith('user_') ? contrib.userId.replace('user_', '') : contrib.userId;
            contributionRows.push({
              circle_id: circleId,
              user_id: cleanUserId,
              amount: Number(savingsCircle.contributionAmount),
              cycle_number: cycle.cycleNumber,
              status: contrib.paid ? 'paid' : 'pending',
              paid_at: contrib.paidDate ? new Date(contrib.paidDate).toISOString() : null
            });
          });
        });

        const { error: contribErr } = await supabase
          .from('contributions')
          .insert(contributionRows);

        if (contribErr) {
          console.error('Error inserting contributions:', contribErr);
        }
      }
    }

    return successResponse(res, insertedGroup, 'Group created successfully', 211);
  } catch (error) {
    console.error('createGroup error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Get full details of a specific group
export async function getGroupDetail(req, res) {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    // 1. Verify user membership in group
    const { data: isMember, error: checkErr } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkErr) {
      console.error('Membership check error:', checkErr);
      return errorResponse(res, 'Failed to verify membership', 500);
    }

    if (!isMember) {
      return errorResponse(res, 'You are not a member of this group', 403);
    }

    // 2. Fetch group info
    const { data: g, error: groupErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupErr) {
      console.error('Error fetching group:', groupErr);
      return errorResponse(res, 'Failed to fetch group details', 404);
    }

    // 3. Fetch members
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

    if (membersErr) {
      console.error('Error fetching group members:', membersErr);
      return errorResponse(res, 'Failed to fetch group members', 500);
    }

    // 4. Fetch expenses
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

    if (expensesErr) {
      console.error('Error fetching group expenses:', expensesErr);
      return errorResponse(res, 'Failed to fetch group expenses', 500);
    }

    // 5. Fetch settlements
    const { data: settlementsRows, error: settlementsErr } = await supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId);

    if (settlementsErr) {
      console.error('Error fetching group settlements:', settlementsErr);
      return errorResponse(res, 'Failed to fetch group settlements', 500);
    }

    // Format fields for compatibility with frontend expectations
    const members = (membersRows || []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      name: m.profiles?.full_name || 'User',
      avatarColor: '#16a34a',
      avatar: m.profiles?.avatar_url || null,
      email: m.profiles?.email || '',
    }));

    const expenses = (expensesRows || []).map((e) => ({
      id: e.id,
      title: e.title || e.description,
      amount: Number(e.amount),
      date: e.date || e.created_at?.split('T')[0],
      category: e.category || 'other',
      paidBy: e.paid_by,
      splits: (e.expense_splits || []).map((s) => ({
        id: s.id,
        expenseId: s.expense_id,
        userId: s.user_id,
        amount: Number(s.amount),
        isSettled: s.is_settled,
      })),
    }));

    const settlements = (settlementsRows || []).map((s) => ({
      id: s.id,
      from: s.from,
      to: s.to,
      amount: Number(s.amount),
      method: s.method || 'bank_transfer',
      date: s.date || s.created_at?.split('T')[0],
    }));

    // Fetch circle data if type is savings
    let savings_circle = null;
    if (g.type === 'savings') {
      let { data: circle } = await supabase
        .from('circles')
        .select('*')
        .eq('group_id', groupId)
        .maybeSingle();

      if (!circle) {
        // Auto-heal on detail load
        const circleId = crypto.randomUUID();
        const groupMembersList = members.map(m => m.userId);
        
        const circleRow = {
          id: circleId,
          group_id: groupId,
          contribution_amount: 10000,
          frequency: 'monthly',
          total_members: groupMembersList.length,
          current_cycle: 1,
          payout_order: JSON.stringify(groupMembersList),
          start_date: new Date().toISOString().split('T')[0],
          status: 'active'
        };

        const { error: insertCircleErr } = await supabase
          .from('circles')
          .insert(circleRow);

        if (!insertCircleErr) {
          circle = circleRow;

          // Insert circle members
          const circleMemberRows = groupMembersList.map((mUserId, index) => ({
            circle_id: circleId,
            user_id: mUserId,
            position: index + 1,
            has_received: false
          }));
          await supabase.from('circle_members').insert(circleMemberRows);

          // Insert contributions
          const contributionRows = [];
          for (let i = 1; i <= groupMembersList.length; i++) {
            groupMembersList.forEach(mUserId => {
              contributionRows.push({
                circle_id: circleId,
                user_id: mUserId,
                amount: 10000,
                cycle_number: i,
                status: 'pending'
              });
            });
          }
          await supabase.from('contributions').insert(contributionRows);
        }
      }

      if (circle) {
        const { data: cMembers } = await supabase
          .from('circle_members')
          .select('*')
          .eq('circle_id', circle.id)
          .order('position', { ascending: true });
        
        const { data: cContributions } = await supabase
          .from('contributions')
          .select('*')
          .eq('circle_id', circle.id);

        savings_circle = formatSavingsCircle(circle, cMembers || [], cContributions || []);
      }
    }

    const groupDetailObj = {
      id: g.id,
      name: g.name,
      emoji: g.emoji || 'fa-users',
      color: g.color || '#16a34a',
      currency: g.currency || 'NGN',
      description: g.description || '',
      type: g.type || 'expense',
      inviteCode: g.invite_code,
      createdAt: g.created_at,
      members,
      expenses,
      settlements,
      savings_circle
    };

    return successResponse(res, groupDetailObj, 'Group detail fetched successfully');
  } catch (error) {
    console.error('getGroupDetail error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Get group detail by invite code (public route/before join)
export async function getGroupDetailsByInviteCode(req, res) {
  try {
    const inviteCode = req.params.inviteCode;

    const { data: dbGroup, error } = await supabase
      .from('groups')
      .select('id, name, emoji, color, currency, type, description, invite_code')
      .eq('invite_code', inviteCode)
      .single();

    if (error || !dbGroup) {
      return errorResponse(res, 'Invalid or expired invite link', 404);
    }

    return successResponse(res, {
      id: dbGroup.id,
      name: dbGroup.name || 'Unknown Group',
      emoji: dbGroup.emoji || 'fa-users',
      color: dbGroup.color || '#16a34a',
      currency: dbGroup.currency || 'NGN',
      type: dbGroup.type || 'expense',
      description: dbGroup.description || '',
      inviteCode: dbGroup.invite_code
    }, 'Group invitation details found');
  } catch (error) {
    console.error('getGroupDetailsByInviteCode error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Join a group via invite code
export async function joinGroupByInviteCode(req, res) {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    if (!inviteCode) {
      return errorResponse(res, 'Invite code is required', 400);
    }

    // 1. Fetch group
    const { data: dbGroup, error } = await supabase
      .from('groups')
      .select('id, name')
      .eq('invite_code', inviteCode)
      .single();

    if (error || !dbGroup) {
      return errorResponse(res, 'Invalid or expired invite link', 404);
    }

    // 2. Check if user is already a member
    const { data: existingMember, error: memberErr } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', dbGroup.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return successResponse(res, dbGroup, 'Already a member of this group');
    }

    // 3. Add user as member
    const { error: insertErr } = await supabase
      .from('group_members')
      .insert({
        group_id: dbGroup.id,
        user_id: userId,
        role: 'member'
      });

    if (insertErr) {
      console.error('Error inserting member:', insertErr);
      return errorResponse(res, 'Failed to join group', 500);
    }

    return successResponse(res, dbGroup, 'Joined group successfully');
  } catch (error) {
    console.error('joinGroupByInviteCode error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Delete a group
export async function deleteGroup(req, res) {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    // Check if user is admin of group
    const { data: isMember, error: checkErr } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkErr || !isMember) {
      return errorResponse(res, 'Failed to authorize deletion or not a member', 403);
    }

    // For simplicity, allow any member to delete or check for admin role
    const { error: deleteErr } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (deleteErr) {
      console.error('Error deleting group:', deleteErr);
      return errorResponse(res, 'Failed to delete group', 500);
    }

    return successResponse(res, null, 'Group deleted successfully');
  } catch (error) {
    console.error('deleteGroup error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Add an expense to a group
export async function addExpense(req, res) {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const { paidBy, amount, title, description, category, date, splits, groupName, notes, splitType, receipt } = req.body;

    if (!amount || !title) {
      return errorResponse(res, 'Amount and title are required', 400);
    }

    const expenseRow = {
      group_id: groupId,
      paid_by: paidBy || userId,
      amount: Number(amount),
      title: title,
      category: category || 'other',
      note: notes || description || title,
      split_method: splitType || 'equal',
      receipt_url: receipt || null
    };

    if (date) {
      try {
        expenseRow.created_at = new Date(date).toISOString();
      } catch (err) {
        console.error('Invalid date format:', date);
      }
    }

    // 1. Insert expense
    const { data: insertedExpense, error: expErr } = await supabase
      .from('expenses')
      .insert(expenseRow)
      .select()
      .single();

    if (expErr) {
      console.error('Error inserting expense:', expErr);
      return errorResponse(res, 'Failed to add expense', 500);
    }

    // 2. Prepare split rows
    if (splits && Array.isArray(splits) && splits.length > 0) {
      const splitRows = splits.map(s => ({
        expense_id: insertedExpense.id,
        user_id: s.userId || s.user_id,
        amount: Number(s.amount),
        is_settled: false
      }));

      const { error: splitErr } = await supabase
        .from('expense_splits')
        .insert(splitRows);

      if (splitErr) {
        console.error('Error inserting splits:', splitErr);
        // Fail silently or delete expense? We will return error response for database integrity.
        await supabase.from('expenses').delete().eq('id', insertedExpense.id);
        return errorResponse(res, 'Failed to create expense splits', 500);
      }
    }

    // 3. Create activity log entry
    await supabase.from('activity_logs').insert({
      user_id: userId,
      type: 'expense',
      description: `Added "${expenseRow.title}" expense`,
      group_name: groupName || 'Group Expense',
      amount: -expenseRow.amount,
      is_positive: false
    });

    return successResponse(res, { id: insertedExpense.id }, 'Expense added successfully');
  } catch (error) {
    console.error('addExpense error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Delete an expense
export async function deleteExpense(req, res) {
  try {
    const { id: groupId, expenseId } = req.params;

    const { error: deleteErr } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('group_id', groupId);

    if (deleteErr) {
      console.error('Error deleting expense:', deleteErr);
      return errorResponse(res, 'Failed to delete expense', 500);
    }

    return successResponse(res, null, 'Expense deleted successfully');
  } catch (error) {
    console.error('deleteExpense error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Add a settlement
export async function addSettlement(req, res) {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const { from, to, amount, method, date, groupName } = req.body;

    if (!from || !to || !amount) {
      return errorResponse(res, 'Sender, recipient, and amount are required', 400);
    }

    const settlementRow = {
      group_id: groupId,
      from,
      to,
      amount: Number(amount),
      method: method || 'bank_transfer',
      date: date || new Date().toISOString().split('T')[0]
    };

    // 1. Insert settlement
    const { error: settleErr } = await supabase
      .from('settlements')
      .insert(settlementRow);

    if (settleErr) {
      console.error('Error inserting settlement:', settleErr);
      return errorResponse(res, 'Failed to add settlement', 500);
    }

    // 2. Create activity log entry
    await supabase.from('activity_logs').insert({
      user_id: userId,
      type: 'expense',
      description: `Settled debt of ₦${Number(amount).toLocaleString()}`,
      group_name: groupName || 'Group Settlement',
      amount: Number(amount),
      is_positive: true
    });

    return successResponse(res, null, 'Settlement recorded successfully');
  } catch (error) {
    console.error('addSettlement error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Invite member by email
export async function inviteMember(req, res) {
  try {
    const groupId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 'Email is required', 400);
    }

    // Find user profile by email
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (profileErr || !profileRow) {
      return errorResponse(res, 'User not found with this email', 404);
    }

    // Check if already a member
    const { data: existingMember, error: memberErr } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', profileRow.id)
      .maybeSingle();

    if (existingMember) {
      return errorResponse(res, 'User is already a member of this group', 400);
    }

    // Add user to group
    const { error: insertErr } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: profileRow.id,
        role: 'member',
      });

    if (insertErr) {
      console.error('Error inserting member:', insertErr);
      return errorResponse(res, 'Failed to invite member', 500);
    }

    return successResponse(res, null, 'Member invited successfully');
  } catch (error) {
    console.error('inviteMember error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Record a contribution payment for a savings circle
export async function recordContribution(req, res) {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const { cycleNumber, memberId, paymentMethod, amount } = req.body;

    // 1. Fetch the circle for this group
    const { data: circle, error: circleErr } = await supabase
      .from('circles')
      .select('id, contribution_amount')
      .eq('group_id', groupId)
      .single();

    if (circleErr || !circle) {
      return errorResponse(res, 'Savings circle not found for this group', 404);
    }

    // 2. Check if a contribution row already exists for this cycle & user
    const targetUserId = memberId || userId;
    const { data: existingContrib } = await supabase
      .from('contributions')
      .select('id')
      .eq('circle_id', circle.id)
      .eq('user_id', targetUserId)
      .eq('cycle_number', cycleNumber)
      .maybeSingle();

    if (existingContrib) {
      // Update the status to 'paid'
      const { error: updateErr } = await supabase
        .from('contributions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: paymentMethod || 'wallet'
        })
        .eq('id', existingContrib.id);

      if (updateErr) {
        console.error('Error updating contribution:', updateErr);
        return errorResponse(res, 'Failed to record contribution', 500);
      }
    } else {
      // Insert new contribution row
      const { error: insertErr } = await supabase
        .from('contributions')
        .insert({
          circle_id: circle.id,
          user_id: targetUserId,
          amount: amount || Number(circle.contribution_amount),
          cycle_number: cycleNumber,
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: paymentMethod || 'wallet'
        });

      if (insertErr) {
        console.error('Error inserting contribution:', insertErr);
        return errorResponse(res, 'Failed to record contribution', 500);
      }
    }

    return successResponse(res, null, 'Contribution recorded successfully');
  } catch (error) {
    console.error('recordContribution error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Record a payout completed for a cycle in a savings circle
export async function recordPayout(req, res) {
  try {
    const groupId = req.params.id;
    const { cycleNumber, date } = req.body;

    // 1. Fetch the circle for this group
    const { data: circle, error: circleErr } = await supabase
      .from('circles')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (circleErr || !circle) {
      return errorResponse(res, 'Savings circle not found for this group', 404);
    }

    // 2. Fetch the recipient for this cycle
    const { data: circleMembers } = await supabase
      .from('circle_members')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('position', cycleNumber);

    if (circleMembers && circleMembers.length > 0) {
      const recipient = circleMembers[0];
      // Update has_received status in circle_members
      await supabase
        .from('circle_members')
        .update({
          has_received: true,
          received_at: date || new Date().toISOString()
        })
        .eq('id', recipient.id);
    }

    // 3. Update circles table current_cycle to next cycle (current_cycle + 1)
    const { error: updateCircleErr } = await supabase
      .from('circles')
      .update({
        current_cycle: Number(cycleNumber) + 1
      })
      .eq('id', circle.id);

    if (updateCircleErr) {
      console.error('Error updating current cycle:', updateCircleErr);
      return errorResponse(res, 'Failed to update savings cycle', 500);
    }

    return successResponse(res, null, 'Payout recorded successfully');
  } catch (error) {
    console.error('recordPayout error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

