-- MANUAL TASK: Run this in Supabase SQL Editor:
-- alter table profiles add column if not exists fcm_token text;

-- ==========================================
-- DEBTFREE DATABASE RPC FUNCTIONS
-- Run these in the Supabase SQL Editor to enable wallet and debt settlement operations.
-- ==========================================

-- 1. Atomic wallet credit
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_reference text
)
RETURNS void AS $$
BEGIN
  -- Increment user's wallet balance
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_user_id;

  -- Mark the wallet transaction as success
  UPDATE wallet_transactions
  SET status = 'success'
  WHERE reference = p_reference;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic debt settlement
CREATE OR REPLACE FUNCTION settle_debt(
  p_from_user uuid,
  p_to_user uuid,
  p_amount numeric,
  p_group_id uuid,
  p_split_ids uuid[],
  p_reference text
)
RETURNS void AS $$
BEGIN
  -- Deduct from sender's wallet balance
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - p_amount
  WHERE id = p_from_user;

  -- Add to recipient's wallet balance
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_to_user;

  -- Mark the specified expense splits as settled
  UPDATE expense_splits
  SET is_settled = true, settled_at = now()
  WHERE id = ANY(p_split_ids);

  -- Record the settlement
  INSERT INTO settlements (group_id, from_user, to_user, amount, method, status)
  VALUES (p_group_id, p_from_user, p_to_user, p_amount, 'wallet', 'confirmed');

  -- Log the debit and credit wallet transactions
  INSERT INTO wallet_transactions (user_id, type, amount, description, reference, status)
  VALUES
    (p_from_user, 'debit', p_amount, 'Debt settlement sent', p_reference, 'success'),
    (p_to_user, 'credit', p_amount, 'Debt settlement received', p_reference||'_recv', 'success');

  -- Log the activity in the group
  INSERT INTO activity_logs (group_id, user_id, action, metadata)
  VALUES (p_group_id, p_from_user, 'debt_settled',
    jsonb_build_object('amount', p_amount, 'to_user', p_to_user));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
