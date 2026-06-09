import { supabase } from '../config/supabase.js';
import { successResponse, errorResponse } from '../utils/response.js';

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

    return successResponse(res, groupRows || [], 'Groups fetched successfully');
  } catch (error) {
    console.error('getGroups error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

// Create a new group
export async function createGroup(req, res) {
  try {
    const { id, name, emoji, color, currency, type, description, inviteCode, members } = req.body;
    const userId = req.user.id;

    if (!name) {
      return errorResponse(res, 'Group name is required', 400);
    }

    const groupId = id || crypto.randomUUID();

    const groupRow = {
      id: groupId,
      name,
      emoji: emoji || 'fa-users',
      color: color || '#16a34a',
      currency: currency || 'NGN',
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
        if (memberUserId && !memberUserId.startsWith('pending_') && memberUserId !== userId) {
          const cleanId = memberUserId.startsWith('user_') ? memberUserId.replace('user_', '') : memberUserId;
          memberRows.push({
            group_id: groupId,
            user_id: cleanId,
            role: m.role || 'member'
          });
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
    const { paidBy, amount, title, description, category, date, splits, groupName } = req.body;

    if (!amount || !title) {
      return errorResponse(res, 'Amount and title are required', 400);
    }

    const expenseRow = {
      group_id: groupId,
      paid_by: paidBy || userId,
      amount: Number(amount),
      title: title,
      description: description || title,
      category: category || 'other',
      date: date || new Date().toISOString().split('T')[0]
    };

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

