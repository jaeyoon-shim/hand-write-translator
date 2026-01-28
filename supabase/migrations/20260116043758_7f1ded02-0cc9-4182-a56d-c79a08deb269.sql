-- Drop all restrictive false policies that block service role access
DROP POLICY IF EXISTS "Users can only read their own session data" ON menu_analyses;
DROP POLICY IF EXISTS "Deny direct client inserts" ON menu_analyses;
DROP POLICY IF EXISTS "Deny direct client updates" ON menu_analyses;
DROP POLICY IF EXISTS "Deny direct client deletes" ON menu_analyses;

-- RLS remains enabled with no policies
-- This means: anon/authenticated roles have NO access (no policies grant it)
-- Service role bypasses RLS entirely and can access data
-- Session-based auth is enforced at edge function layer