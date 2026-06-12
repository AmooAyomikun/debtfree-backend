-- ============================================================
-- DebtFree — Create Waitlist Table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        UNIQUE NOT NULL,
  source     text        DEFAULT 'landing',
  created_at timestamptz DEFAULT now()
);

-- Allow public inserts (no auth required to join the waitlist)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- Only allow admins/service role to read the list
CREATE POLICY "Service role can read waitlist"
  ON waitlist FOR SELECT
  USING (auth.role() = 'service_role');

-- View entries (run as service role/dashboard):
-- SELECT * FROM waitlist ORDER BY created_at DESC;
