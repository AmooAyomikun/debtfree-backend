import { supabase } from '../config/supabase.js';
import { successResponse, errorResponse } from '../utils/response.js';

// POST /api/kyc/verify-bvn
export const verifyBVN = async (req, res) => {
  try {
    const { bvn, date_of_birth } = req.body;
    const user = req.user;

    if (!bvn || !date_of_birth) {
      return errorResponse(res, 'BVN and date of birth are required', 400);
    }

    if (bvn.length !== 11 || isNaN(Number(bvn))) {
      return errorResponse(res, 'Invalid BVN. Must be 11 digits.', 400);
    }

    // MANUAL TASK: Replace mock BVN check with Mono API in production
    // POST https://api.withmono.com/v1/identity/bvn
    // Header: mono-sec-key: your_key
    // Body: { bvn, customer: { name, dob } }

    // Mock 2-second delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update user profile
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        is_verified: true,
        kyc_tier: 'basic'
      })
      .eq('id', user.id);

    if (updateErr) {
      console.error('Error updating profile KYC status:', updateErr);
      return errorResponse(res, 'Failed to update verification status', 500);
    }

    return successResponse(res, {
      verified: true,
      tier: 'basic',
      new_limit: 500000
    }, 'Identity Verified!');

  } catch (err) {
    console.error('verifyBVN error:', err);
    return errorResponse(res, 'Internal server error', 500);
  }
};
