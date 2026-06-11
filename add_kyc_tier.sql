-- Run this SQL in your Supabase SQL Editor to add the kyc_tier column to the profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_tier TEXT DEFAULT 'unverified';
