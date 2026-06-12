-- ============================================================
-- DebtFree — Add Missing Columns to groups and expenses tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add missing columns to the groups table
ALTER TABLE groups 
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Add missing columns to the expenses table
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS date DATE;

-- 3. Update existing rows to set date from created_at if date is null
UPDATE expenses SET date = created_at::date WHERE date IS NULL;

-- Done! You can verify with:
-- SELECT id, name, color, currency, status FROM groups LIMIT 5;
-- SELECT id, title, is_flagged, date FROM expenses LIMIT 5;
