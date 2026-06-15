-- Create linked_accounts table
CREATE TABLE IF NOT EXISTS linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, account_number, bank_code)
);

-- Enable RLS
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;

-- Policies for linked_accounts
CREATE POLICY "Users can view their own linked accounts"
ON linked_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own linked accounts"
ON linked_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linked accounts"
ON linked_accounts FOR DELETE
USING (auth.uid() = user_id);
