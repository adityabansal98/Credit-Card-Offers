-- Updated schema to support user authentication
-- Run this SQL in your Supabase SQL Editor to add user_id column

-- Add user_id column to offers table (if it doesn't exist)
ALTER TABLE offers ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);

-- Update existing RLS policies to filter by user_id
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations" ON offers;

-- Create policy to allow users to see only their own offers
CREATE POLICY "Users can view their own offers" ON offers
  FOR SELECT
  USING (auth.uid()::text = user_id OR user_id IS NULL);

-- Create policy to allow users to insert their own offers
CREATE POLICY "Users can insert their own offers" ON offers
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to update their own offers
CREATE POLICY "Users can update their own offers" ON offers
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own offers
CREATE POLICY "Users can delete their own offers" ON offers
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Note: The above policies use Supabase's built-in auth.uid()
-- For Clerk authentication, you'll need to use a different approach
-- since Clerk users are managed separately. You may want to:
-- 1. Store Clerk user IDs directly in user_id column (as TEXT)
-- 2. Use application-level filtering instead of RLS, or
-- 3. Set up a mapping between Clerk users and Supabase users

