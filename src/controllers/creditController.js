import { supabase } from '../config/supabase.js';
import { calculateCreditScore } from '../services/creditScoreService.js';

export const getCreditScore = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('credit_score, credit_score_updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: 'Failed to fetch profile', error });
    }

    // Check if score needs recalculation (e.g. if it's null or older than 7 days)
    let score = profile.credit_score;
    let needsCalculation = false;

    if (score === null || score === undefined) {
      needsCalculation = true;
    } else if (profile.credit_score_updated_at) {
      const updatedDate = new Date(profile.credit_score_updated_at);
      const now = new Date();
      const daysSinceUpdate = (now - updatedDate) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 7) {
        needsCalculation = true;
      }
    } else {
      needsCalculation = true;
    }

    if (needsCalculation) {
      score = await calculateCreditScore(userId);
    }

    res.json({
      success: true,
      data: {
        score,
        updated_at: profile.credit_score_updated_at || new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
};

export const recalculateScore = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Force recalculation
    const score = await calculateCreditScore(userId);

    res.json({
      success: true,
      message: 'Credit score recalculated successfully',
      data: {
        score,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
};
