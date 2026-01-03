-- Create offers table in Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant TEXT NOT NULL,
  title TEXT,
  description TEXT,
  discount TEXT,
  terms TEXT,
  category TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'Available',
  source TEXT NOT NULL CHECK (source IN ('Amex', 'Chase', 'Email')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on merchant for faster searches
CREATE INDEX IF NOT EXISTS idx_offers_merchant ON offers(merchant);

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_offers_source ON offers(source);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON offers(created_at DESC);

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
-- For now, allowing all operations. You can restrict this later with authentication
CREATE POLICY "Allow all operations" ON offers
  FOR ALL
  USING (true)
  WITH CHECK (true);

