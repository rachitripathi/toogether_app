-- Toogether App - Fix Migration
-- Version: 1.1
-- Why: 001_create_core_schema.sql uses `CREATE POLICY IF NOT EXISTS` and
-- `CREATE TRIGGER IF NOT EXISTS` — neither is valid PostgreSQL syntax. If that
-- file was ever run as a single script, execution stopped at the first policy
-- statement, which means: tables/indexes exist, but most/all RLS policies and
-- triggers were likely never created. With RLS enabled and no policy for an
-- action, Postgres denies it by default — this is why event creation (and
-- possibly join/approve/reject, messaging, rating, crew requests) fails.
--
-- This migration is fully idempotent — safe to run any number of times,
-- regardless of what did or didn't get created by 001. It:
--   1. Adds any columns the app expects that may be missing (avatar_uri).
--   2. Relaxes the `city` column back to nullable (the app doesn't collect
--      city until the user visits Settings, so it can't be required at signup).
--   3. Ensures RLS is enabled on every table.
--   4. Drops and recreates every RLS policy with correct syntax.
--   5. Drops and recreates the updated_at trigger function + triggers.
--
-- Run this in the Supabase SQL Editor (or `supabase db push` if you use the CLI).

-- ============================================================================
-- 1. PROFILE COLUMN FIXES
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_uri TEXT;
ALTER TABLE public.profiles ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN gender DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN age DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN bio DROP NOT NULL;

-- ============================================================================
-- 2. EVENT COLUMN SAFETY NET (should already exist from 001, but just in case)
-- ============================================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_note TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS map_url TEXT;

-- ============================================================================
-- 3. ENSURE RLS IS ENABLED EVERYWHERE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES (drop + recreate so this is safe to re-run)
-- ============================================================================

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- EVENTS
DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_insert_authenticated" ON public.events;
CREATE POLICY "events_insert_authenticated" ON public.events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND creator_id = auth.uid());

DROP POLICY IF EXISTS "events_update_creator" ON public.events;
CREATE POLICY "events_update_creator" ON public.events FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "events_delete_creator" ON public.events;
CREATE POLICY "events_delete_creator" ON public.events FOR DELETE
  USING (auth.uid() = creator_id);

-- JOIN_REQUESTS
DROP POLICY IF EXISTS "join_requests_select_own" ON public.join_requests;
CREATE POLICY "join_requests_select_own" ON public.join_requests FOR SELECT
  USING (auth.uid() = user_id OR
         EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()));

DROP POLICY IF EXISTS "join_requests_insert_own" ON public.join_requests;
CREATE POLICY "join_requests_insert_own" ON public.join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "join_requests_update_creator" ON public.join_requests;
CREATE POLICY "join_requests_update_creator" ON public.join_requests FOR UPDATE
  USING (EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()));

-- MESSAGES
DROP POLICY IF EXISTS "messages_select_approved" ON public.messages;
CREATE POLICY "messages_select_approved" ON public.messages FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.events e
         LEFT JOIN public.join_requests jr ON e.id = jr.event_id
         WHERE e.id = messages.event_id
         AND (e.creator_id = auth.uid() OR
              (jr.user_id = auth.uid() AND jr.status = 'approved'))));

DROP POLICY IF EXISTS "messages_insert_approved" ON public.messages;
CREATE POLICY "messages_insert_approved" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND
              EXISTS(SELECT 1 FROM public.events e
              LEFT JOIN public.join_requests jr ON e.id = jr.event_id
              WHERE e.id = messages.event_id
              AND (e.creator_id = auth.uid() OR
                   (jr.user_id = auth.uid() AND jr.status = 'approved'))));

-- RATINGS
DROP POLICY IF EXISTS "ratings_select_all" ON public.ratings;
CREATE POLICY "ratings_select_all" ON public.ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "ratings_insert_participated" ON public.ratings;
CREATE POLICY "ratings_insert_participated" ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = from_user_id AND
              EXISTS(SELECT 1 FROM public.join_requests
              WHERE event_id = ratings.event_id
              AND user_id = ratings.to_user_id
              AND status = 'approved'));

DROP POLICY IF EXISTS "ratings_update_own" ON public.ratings;
CREATE POLICY "ratings_update_own" ON public.ratings FOR UPDATE
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- CREW_REQUESTS
DROP POLICY IF EXISTS "crew_requests_select_own" ON public.crew_requests;
CREATE POLICY "crew_requests_select_own" ON public.crew_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "crew_requests_insert_own" ON public.crew_requests;
CREATE POLICY "crew_requests_insert_own" ON public.crew_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "crew_requests_update_recipient" ON public.crew_requests;
CREATE POLICY "crew_requests_update_recipient" ON public.crew_requests FOR UPDATE
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- ============================================================================
-- 5. FUNCTIONS & TRIGGERS (drop + recreate so this is safe to re-run)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_join_requests_updated_at ON public.join_requests;
CREATE TRIGGER update_join_requests_updated_at BEFORE UPDATE ON public.join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crew_requests_updated_at ON public.crew_requests;
CREATE TRIGGER update_crew_requests_updated_at BEFORE UPDATE ON public.crew_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
