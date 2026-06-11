import { supabase } from '../config/supabase.js';

const checkGroupAdmin = async (groupId, userId) => {
  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return false;
  return data.role === 'admin';
};

const checkGroupMember = async (groupId, userId) => {
  const { data, error } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return false;
  return true;
};

export const removeMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { memberId } = req.body;
    const userId = req.user.id;

    if (!(await checkGroupAdmin(groupId, userId))) {
      return res.status(403).json({ error: 'Unauthorized: Admins only' });
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberId);

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      group_id: groupId,
      user_id: userId,
      action: 'member_removed',
      metadata: { removed_user_id: memberId }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const pauseGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    if (!(await checkGroupAdmin(groupId, userId))) {
      return res.status(403).json({ error: 'Unauthorized: Admins only' });
    }

    const { data, error } = await supabase
      .from('groups')
      .update({ status: 'paused' })
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      group_id: groupId,
      user_id: userId,
      action: 'group_paused',
      metadata: {}
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resumeGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    if (!(await checkGroupAdmin(groupId, userId))) {
      return res.status(403).json({ error: 'Unauthorized: Admins only' });
    }

    const { data, error } = await supabase
      .from('groups')
      .update({ status: 'active' })
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      group_id: groupId,
      user_id: userId,
      action: 'group_resumed',
      metadata: {}
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const closeGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    if (!(await checkGroupAdmin(groupId, userId))) {
      return res.status(403).json({ error: 'Unauthorized: Admins only' });
    }

    const { data, error } = await supabase
      .from('groups')
      .update({ status: 'completed' })
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      group_id: groupId,
      user_id: userId,
      action: 'group_completed',
      metadata: {}
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const flagExpense = async (req, res) => {
  try {
    const groupId = req.params.id;
    const expenseId = req.params.expenseId;
    const userId = req.user.id;

    if (!(await checkGroupMember(groupId, userId))) {
      return res.status(403).json({ error: 'Unauthorized: Members only' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .update({ is_flagged: true })
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      group_id: groupId,
      user_id: userId,
      action: 'expense_flagged',
      metadata: { expense_id: expenseId, expense_description: data.description }
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const dismissExpenseFlag = async (req, res) => {
  try {
    const groupId = req.params.id;
    const expenseId = req.params.expenseId;
    const userId = req.user.id;

    if (!(await checkGroupAdmin(groupId, userId))) {
      return res.status(403).json({ error: 'Unauthorized: Admins only' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .update({ is_flagged: false })
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      group_id: groupId,
      user_id: userId,
      action: 'expense_flagged_dismissed',
      metadata: { expense_id: expenseId, expense_description: data.description }
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getGroupActivity = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    if (!(await checkGroupMember(groupId, userId))) {
      return res.status(403).json({ error: 'Unauthorized: Members only' });
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        profiles:user_id ( full_name, avatar_url )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
