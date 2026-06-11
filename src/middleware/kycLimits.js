import { supabase } from '../config/supabase.js';
import { errorResponse } from '../utils/response.js';

const TIER_LIMITS = {
  unverified: 50000,
  basic: 500000,
  full: 5000000
};

export const checkKYCLimits = async (req, res, next) => {
  try {
    const user = req.user;
    const requestedAmount = req.body.amount || 0;

    // Fetch user profile for kyc_tier
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('kyc_tier, is_verified')
      .eq('id', user.id)
      .single();

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('Error fetching profile for KYC:', profileErr);
      return errorResponse(res, 'Internal server error', 500);
    }

    // Default to unverified if kyc_tier doesn't exist or profile is missing
    let tier = profile?.kyc_tier || 'unverified';
    
    // Fallback: If they are verified but have no tier, assume basic
    if (tier === 'unverified' && profile?.is_verified) {
        tier = 'basic';
    }

    const tierLimit = TIER_LIMITS[tier] || TIER_LIMITS.unverified;

    // Calculate start and end of the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // Fetch user's wallet transactions for the current month
    // We only sum 'credit' (funding) and 'debit' (payments/settlements) that are 'success'
    const { data: transactions, error: txError } = await supabase
      .from('wallet_transactions')
      .select('amount, type')
      .eq('user_id', user.id)
      .eq('status', 'success')
      .gte('created_at', startOfMonth);

    if (txError) {
      console.error('Error fetching transactions for KYC limit:', txError);
      return errorResponse(res, 'Internal server error', 500);
    }

    // Sum all successful transaction amounts for the month
    const currentMonthTotal = (transactions || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Check if the requested amount pushes them over the limit
    if (currentMonthTotal + Number(requestedAmount) > tierLimit) {
      return errorResponse(
        res,
        `Transaction exceeds your monthly limit of ₦${tierLimit.toLocaleString()}. You have already used ₦${currentMonthTotal.toLocaleString()} this month. Please upgrade your KYC tier to increase your limit.`,
        403
      );
    }

    // If within limits, proceed
    next();
  } catch (err) {
    console.error('KYC limits middleware error:', err);
    return errorResponse(res, 'Internal server error', 500);
  }
};
