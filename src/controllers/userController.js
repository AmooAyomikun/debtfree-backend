import { supabase } from '../config/supabase.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { paystackService } from '../services/paystackService.js';

export async function searchUsers(req, res) {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) {
      return successResponse(res, [], 'Query too short');
    }

    const currentUser = req.user;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, email')
      .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .neq('id', currentUser.id)
      .limit(10);

    if (error) {
      console.error('Error querying profiles:', error);
      return errorResponse(res, 'Failed to query users', 500);
    }

    return successResponse(res, data || [], 'Users found');
  } catch (error) {
    console.error('Search users error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
}

export async function getLinkedAccounts(req, res) {
  try {
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') { // Table does not exist (fallback for dev)
        return successResponse(res, [], 'No linked accounts found');
      }
      throw error;
    }

    return successResponse(res, data, 'Linked accounts retrieved');
  } catch (error) {
    console.error('Get linked accounts error:', error);
    return errorResponse(res, 'Failed to retrieve linked accounts', 500);
  }
}

export async function addLinkedAccount(req, res) {
  try {
    const { account_number, bank_code } = req.body;
    
    if (!account_number || !bank_code) {
      return errorResponse(res, 'Account number and bank code are required', 400);
    }

    // Resolve the account first to verify it exists and get the account name
    let accountInfo;
    try {
      accountInfo = await paystackService.resolveAccount(account_number, bank_code);
    } catch (e) {
      return errorResponse(res, 'Could not verify account details', 400);
    }

    // Get the bank name
    const banks = await paystackService.listBanks();
    const bank = banks.find(b => b.code === bank_code);
    const bank_name = bank ? bank.name : 'Unknown Bank';

    // Save to database
    const { data, error } = await supabase
      .from('linked_accounts')
      .insert({
        user_id: req.user.id,
        account_number,
        bank_code,
        bank_name,
        account_name: accountInfo.account_name
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return errorResponse(res, 'This account is already linked', 400);
      }
      throw error;
    }

    return successResponse(res, data, 'Account linked successfully');
  } catch (error) {
    console.error('Add linked account error:', error);
    return errorResponse(res, 'Failed to link account', 500);
  }
}

export async function removeLinkedAccount(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('linked_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    return successResponse(res, null, 'Linked account removed');
  } catch (error) {
    console.error('Remove linked account error:', error);
    return errorResponse(res, 'Failed to remove linked account', 500);
  }
}
