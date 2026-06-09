import { supabase } from '../config/supabase.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
