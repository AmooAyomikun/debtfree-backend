-- ============================================================
-- DebtFree — Add debit_wallet RPC
-- Run this in your Supabase SQL Editor
-- This function atomically deducts from wallet_balance
-- and inserts a debit transaction — idempotent by reference.
-- ============================================================

CREATE OR REPLACE FUNCTION debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Idempotency: skip if reference already processed
  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE reference = p_reference AND status = 'success'
  ) THEN
    RETURN;
  END IF;

  -- Check sufficient balance
  IF (SELECT wallet_balance FROM profiles WHERE id = p_user_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Atomically deduct from wallet
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id
    AND wallet_balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient wallet balance or user not found';
  END IF;

  -- Insert transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, description, reference, status, payment_method)
  VALUES (p_user_id, 'debit', p_amount, 'Debt settlement sent', p_reference, 'success', 'wallet')
  ON CONFLICT (reference) DO NOTHING;
END;
$$;
