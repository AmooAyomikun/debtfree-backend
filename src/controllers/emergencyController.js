import { supabase } from '../config/supabase.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { log } from '../utils/logger.js';
import { whatsappService } from '../services/whatsappService.js';
import { generateReference } from '../utils/generateReference.js';

// GET /api/emergency/:groupId
export async function getEmergencyPot(req, res, next) {
  try {
    const { groupId } = req.params;

    const { data: pot, error } = await supabase
      .from('group_emergency_pots')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found error

    const { data: loans } = await supabase
      .from('emergency_loans')
      .select(`
        id, amount, status, created_at,
        profiles (id, full_name, avatar_url)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    return successResponse(res, {
      balance: pot?.balance || 0,
      loans: loans || []
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/emergency/:groupId/fund
export async function fundEmergencyPot(req, res, next) {
  try {
    const { groupId } = req.params;
    const { amount } = req.body;
    const user = req.user;

    if (!amount || amount <= 0) {
      return errorResponse(res, 'Amount must be greater than zero', 400);
    }

    // Deduct from user wallet
    const reference = generateReference('EMG_FUND');
    const { error: deductErr } = await supabase.rpc('debit_wallet', {
      p_user_id: user.id,
      p_amount: amount,
      p_reference: reference
    });

    if (deductErr) {
      return errorResponse(res, 'Insufficient wallet balance', 400);
    }

    // Add to group emergency pot
    const { data: pot } = await supabase
      .from('group_emergency_pots')
      .select('id, balance')
      .eq('group_id', groupId)
      .single();

    if (pot) {
      await supabase
        .from('group_emergency_pots')
        .update({ balance: pot.balance + amount })
        .eq('id', pot.id);
    } else {
      await supabase
        .from('group_emergency_pots')
        .insert({ group_id: groupId, balance: amount });
    }

    await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount,
      description: 'Emergency pot funding',
      reference,
      status: 'success',
      payment_method: 'wallet'
    });

    return successResponse(res, null, 'Emergency pot funded successfully');
  } catch (error) {
    next(error);
  }
}

// POST /api/emergency/:groupId/request
export async function requestEmergencyLoan(req, res, next) {
  try {
    const { groupId } = req.params;
    const { amount, reason } = req.body;
    const user = req.user;

    if (!amount || amount <= 0) return errorResponse(res, 'Invalid amount', 400);

    const { data: pot } = await supabase
      .from('group_emergency_pots')
      .select('balance')
      .eq('group_id', groupId)
      .single();

    if (!pot || pot.balance < amount) {
      return errorResponse(res, 'Insufficient funds in the group emergency pot', 400);
    }

    const { error } = await supabase
      .from('emergency_loans')
      .insert({
        group_id: groupId,
        user_id: user.id,
        amount,
        reason,
        status: 'pending'
      });

    if (error) throw error;

    return successResponse(res, null, 'Emergency loan requested successfully');
  } catch (error) {
    next(error);
  }
}

// POST /api/emergency/:groupId/approve/:loanId
export async function approveEmergencyLoan(req, res, next) {
  try {
    const { groupId, loanId } = req.params;

    const { data: loan } = await supabase
      .from('emergency_loans')
      .select('*, profiles(full_name, phone)')
      .eq('id', loanId)
      .single();

    if (!loan || loan.status !== 'pending') {
      return errorResponse(res, 'Invalid loan request', 400);
    }

    const { data: pot } = await supabase
      .from('group_emergency_pots')
      .select('id, balance')
      .eq('group_id', groupId)
      .single();

    if (!pot || pot.balance < loan.amount) {
      return errorResponse(res, 'Insufficient funds in emergency pot', 400);
    }

    // Deduct pot
    await supabase
      .from('group_emergency_pots')
      .update({ balance: pot.balance - loan.amount })
      .eq('id', pot.id);

    // Update loan status
    await supabase
      .from('emergency_loans')
      .update({ status: 'approved' })
      .eq('id', loanId);

    // Credit user wallet
    const reference = generateReference('EMG_LOAN');
    await supabase.rpc('credit_wallet', {
      p_user_id: loan.user_id,
      p_amount: loan.amount,
      p_reference: reference
    });

    // Record wallet transaction
    await supabase.from('wallet_transactions').insert({
      user_id: loan.user_id,
      type: 'credit',
      amount: loan.amount,
      description: 'Emergency loan disbursed',
      reference,
      status: 'success',
      payment_method: 'wallet'
    });

    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single();

    if (loan.profiles?.phone) {
      await whatsappService.sendEmergencyLoanApproved(loan.profiles.phone, {
        userName: loan.profiles.full_name?.split(' ')[0] || 'there',
        amount: loan.amount,
        groupName: group?.name || 'Your Group'
      });
    }

    return successResponse(res, null, 'Loan approved and disbursed');
  } catch (error) {
    next(error);
  }
}
