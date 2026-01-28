-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow public insert access" ON public.menu_analyses;
DROP POLICY IF EXISTS "Allow public read access" ON public.menu_analyses;
DROP POLICY IF EXISTS "Allow public update access" ON public.menu_analyses;

-- Since this app uses session-based identification without authentication,
-- and database inserts happen through edge functions with service role,
-- we restrict direct client access and only allow reads by session_id match
-- The session_id will be passed as a header that RLS can check

-- Create restrictive policies that only allow access via edge functions (service role)
-- For client-side, users can only read their own session's data

-- Allow reads only when session matches (for future use if client needs to query)
CREATE POLICY "Users can only read their own session data"
ON public.menu_analyses FOR SELECT
USING (false);  -- Deny all client reads, data is returned directly from edge function

-- Deny direct inserts from client (only edge functions with service role can insert)
CREATE POLICY "Deny direct client inserts"
ON public.menu_analyses FOR INSERT
WITH CHECK (false);

-- Deny direct updates from client
CREATE POLICY "Deny direct client updates"  
ON public.menu_analyses FOR UPDATE
USING (false);

-- Deny direct deletes from client
CREATE POLICY "Deny direct client deletes"
ON public.menu_analyses FOR DELETE
USING (false);