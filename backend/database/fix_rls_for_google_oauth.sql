-- Fix RLS policies for Google OAuth
-- Run this SQL in your Supabase SQL Editor

-- Drop the existing policies that use auth.uid()
DROP POLICY IF EXISTS "Users can view their own offers" ON offers;
DROP POLICY IF EXISTS "Users can insert their own offers" ON offers;
DROP POLICY IF EXISTS "Users can update their own offers" ON offers;
DROP POLICY IF EXISTS "Users can delete their own offers" ON offers;

-- Option 1: Disable RLS (simplest, but less secure)
-- Uncomment the line below to disable RLS entirely
-- ALTER TABLE offers DISABLE ROW LEVEL SECURITY;

-- Option 2: Allow all operations with anon key (for development)
-- This allows all operations when using the anon/public key
-- Note: Application-level filtering by user_id is still enforced in your backend code
CREATE POLICY "Allow all operations for authenticated users" ON offers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Note: Since we're using Google OAuth (not Supabase Auth), RLS can't verify user identity
-- Security is handled at the application level:
-- 1. Backend verifies Google ID tokens
-- 2. Backend filters by user_id when querying
-- 3. Backend ensures user_id is set when creating offers

-- For production, consider:
-- 1. Using Supabase service role key (bypasses RLS) - more secure
-- 2. Or keeping this policy but ensuring backend always sets user_id correctly

