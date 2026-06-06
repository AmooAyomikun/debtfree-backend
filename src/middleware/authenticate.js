import { supabase } from '../config/supabase.js';
import { errorResponse } from '../utils/response.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No authorization token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return errorResponse(res, 'Invalid or expired token', 401);
    }

    req.user = user;
    next();

  } catch (error) {
    return errorResponse(res, 'Authentication failed', 401);
  }
}
