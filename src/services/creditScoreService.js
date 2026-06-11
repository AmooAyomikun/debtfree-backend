import { supabase } from '../config/supabase.js';

export async function calculateCreditScore(userId) {
  // Fetch all user data needed for scoring
  const [contributionsData, settlementsData, profileData] = await Promise.all([
    supabase.from('contributions').select('*').eq('user_id', userId),
    supabase.from('settlements').select('*').or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from('profiles').select('created_at, is_verified, kyc_tier').eq('id', userId).single()
  ]);

  const contributions = contributionsData.data || [];
  const settlements = settlementsData.data || [];
  const profile = profileData.data || {};

  let score = 300; // base score

  // FACTOR 1: On-time contributions (max +200 points)
  const totalContributions = contributions.length;
  // Let's assume a contribution is "on-time" if it's paid. (Ideally we'd check paid_at <= target_date, but we'll use status='paid' for now based on user's snippet)
  const onTimeContributions = contributions.filter(c => c.status === 'paid').length;
  
  if (totalContributions > 0) {
    const onTimeRate = onTimeContributions / totalContributions;
    score += Math.round(onTimeRate * 200);
  }

  // FACTOR 2: Early/On-time settlements (max +200 points)
  // Let's assume a settlement is good if status='completed'
  const totalSettlements = settlements.length;
  const completedSettlements = settlements.filter(s => s.status === 'completed').length;
  
  if (totalSettlements > 0) {
    const settlementRate = completedSettlements / totalSettlements;
    score += Math.round(settlementRate * 200);
  }

  // FACTOR 3: KYC Verification Status (max +150 points)
  if (profile.kyc_tier === 'full') {
    score += 150;
  } else if (profile.kyc_tier === 'basic' || profile.is_verified) {
    score += 100;
  }

  // FACTOR 4: Account Age (max +150 points)
  if (profile.created_at) {
    const createdDate = new Date(profile.created_at);
    const now = new Date();
    const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    
    // Linearly increase up to 365 days (1 year)
    const ageFactor = Math.min(daysSinceCreation / 365, 1);
    score += Math.round(ageFactor * 150);
  }

  // Cap score at 850
  score = Math.min(score, 850);

  // Update profile with new score and timestamp
  await supabase
    .from('profiles')
    .update({ 
      credit_score: score,
      credit_score_updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  return score;
}
