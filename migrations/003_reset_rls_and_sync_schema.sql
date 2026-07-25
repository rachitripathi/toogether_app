-- Toogether App - RLS Reset & Schema Sync
-- Version: 1.2
-- Why: Your live `profiles` table was built by hand via the Supabase dashboard
-- (policy names like "Anyone can view profiles" instead of the ones in
-- 001/002, plus an `updated_at` column 001/002 didn't know about). That means
-- 002's `DROP POLICY IF EXISTS "profiles_select_all"` never matched your real
-- policies — it would've just added duplicates next to them instead of
-- resetting anything. This migration doesn't guess policy names: for every
-- table it dynamically drops WHATEVER policies currently exist, then
-- recreates one clean, consistently-named set. Safe to run any number of
-- times, regardless of whether tables were created via SQL, the dashboard, or
-- a mix of both.

-- ============================================================================
-- 1. COLUMN SAFETY NET
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_uri TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN bio DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN age DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN gender DROP NOT NULL;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_note TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS map_url TEXT;

-- ============================================================================
-- 2. ENSURE RLS IS ENABLED EVERYWHERE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. DROP *EVERY* EXISTING POLICY ON EACH TABLE, WHATEVER IT'S CALLED
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['profiles', 'events', 'join_requests', 'messages', 'ratings', 'crew_requests']
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, target_table);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 4. RECREATE ONE CLEAN, CONSISTENT SET OF POLICIES
-- ============================================================================

-- PROFILES
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- EVENTS
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_insert_authenticated" ON public.events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND creator_id = auth.uid());
CREATE POLICY "events_update_creator" ON public.events FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "events_delete_creator" ON public.events FOR DELETE
  USING (auth.uid() = creator_id);

-- JOIN_REQUESTS
CREATE POLICY "join_requests_select_own" ON public.join_requests FOR SELECT
  USING (auth.uid() = user_id OR
         EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()));
CREATE POLICY "join_requests_insert_own" ON public.join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "join_requests_update_creator" ON public.join_requests FOR UPDATE
  USING (EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()));

-- MESSAGES
CREATE POLICY "messages_select_approved" ON public.messages FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.events e
         LEFT JOIN public.join_requests jr ON e.id = jr.event_id
         WHERE e.id = messages.event_id
         AND (e.creator_id = auth.uid() OR
              (jr.user_id = auth.uid() AND jr.status = 'approved'))));
CREATE POLICY "messages_insert_approved" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND
              EXISTS(SELECT 1 FROM public.events e
              LEFT JOIN public.join_requests jr ON e.id = jr.event_id
              WHERE e.id = messages.event_id
              AND (e.creator_id = auth.uid() OR
                   (jr.user_id = auth.uid() AND jr.status = 'approved'))));

-- RATINGS
CREATE POLICY "ratings_select_all" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_participated" ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = from_user_id AND
              EXISTS(SELECT 1 FROM public.join_requests
              WHERE event_id = ratings.event_id
              AND user_id = ratings.to_user_id
              AND status = 'approved'));
CREATE POLICY "ratings_update_own" ON public.ratings FOR UPDATE
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- CREW_REQUESTS
CREATE POLICY "crew_requests_select_own" ON public.crew_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "crew_requests_insert_own" ON public.crew_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
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

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
